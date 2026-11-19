// src/remotes.js
// Outpost Lifecycle, Multi-Room Remote Mining Execution (Scout, Reserver, RemoteMiner, RemoteHauler) & Observer Sweeps
const { roomCenterPos, calcDistance, profLap, getRivalSafeModeRemaining } = require('./constants');
const { depositNonEnergyLoot, moveCreep, withdrawOrPickupLoot } = require('./traffic');
const { clearRemoteThreat, countBootstrappingColonies, getEffectiveFreeCapacity, isFriendlyOrEmpireRoom, isRemoteExcluded, registerIntent, safeSuicide, scheduleTask, setSegmentData } = require('./state');
const { getRoomBlueprint } = require('./bunker');
const { getConfig } = require('./config');

function getRemoteOutpostCap(rcl, storageEnergy, bucket, spawnUtil, cfg) {
    const c = cfg || getConfig();
    let cap = (c.remotesByRcl && c.remotesByRcl[rcl] !== undefined) ? c.remotesByRcl[rcl] : 0;
    if (rcl >= 7 && c.rcl7DynamicThirdRemote && storageEnergy < c.rcl7ThirdRemoteEnergyCap &&
        bucket >= c.cpuBucketFloor && spawnUtil < 0.75) {
        cap += 1;
    }
    return cap;
}

function isSKOrCenterRoom(roomName) {
    if (!roomName) return false;
    const match = roomName.match(/^[WE](\d+)[NS](\d+)$/);
    if (!match) return false;
    const modX = parseInt(match[1], 10) % 10;
    const modY = parseInt(match[2], 10) % 10;
    return modX >= 4 && modX <= 6 && modY >= 4 && modY <= 6;
}

function isNormalStatusRoom(roomName) {
    if (typeof Game !== 'undefined' && Game.map && Game.map.getRoomStatus) {
        const st = Game.map.getRoomStatus(roomName);
        if (st && st.status && st.status !== 'normal') return false;
    }
    return true;
}

function assessOutpostViability(colonyName, remoteRoomName) {
    if (!remoteRoomName || remoteRoomName === colonyName) return false;
    if (isSKOrCenterRoom(remoteRoomName)) return false;

    // Never treat our own colonies or any sister colony as an outpost!
    if (global.heap && global.heap.colonies && global.heap.colonies[remoteRoomName]) return false;
    if (typeof Game !== 'undefined' && Game.rooms && Game.rooms[remoteRoomName] && Game.rooms[remoteRoomName].controller && Game.rooms[remoteRoomName].controller.my) return false;

    // If already claimed by another sister colony in global partition, unviable for us!
    if (global.heap && global.heap.outpostOwners && global.heap.outpostOwners[remoteRoomName] && global.heap.outpostOwners[remoteRoomName] !== colonyName) {
        return false;
    }

    const cfg = getConfig();
    const isPassive = cfg.posture === 'passive';

    const room = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[remoteRoomName] : null;
    if (!room) {
        const rem = global.heap && global.heap.remoteRooms ? global.heap.remoteRooms[remoteRoomName] : null;
        if (rem && (rem.isSourceKeeper || rem.isHighway)) return false;
        if (isPassive && rem && rem.threatLevel && rem.threatLevel !== 'none') return false;
        return rem ? rem.safe !== false : true;
    }

    // Unviable if room is claimed/reserved/owned by another player
    if (room.controller && room.controller.owner && !room.controller.my) return false;
    if (isPassive && room.controller && room.controller.reservation && room.controller.reservation.username) {
        const colRoom = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[colonyName] : null;
        const myUser = (colRoom && colRoom.controller && colRoom.controller.owner) ? colRoom.controller.owner.username : null;
        if (myUser && room.controller.reservation.username !== myUser) return false;
    }

    // Armed hostiles check (consume pre-scanned state first, fallback to room.find only if unscanned)
    const rState = global.heap && global.heap.rooms ? global.heap.rooms[remoteRoomName] : null;
    const armedHostiles = (rState && rState.armedHostiles)
        ? rState.armedHostiles
        : ((room.find && room.find(FIND_HOSTILE_CREEPS)) || []).filter(h => h.getActiveBodyparts && (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0));
    if (isPassive) {
        if (armedHostiles.length > 0) return false;
        if (rState && rState.invaderCores && rState.invaderCores.length > 0) return false;
        const rem = global.heap && global.heap.remoteRooms ? global.heap.remoteRooms[remoteRoomName] : null;
        if (rem && rem.threatLevel && rem.threatLevel !== 'none') return false;
    } else if (armedHostiles.length > 2) {
        return false;
    }

    return true;
}

function calculateOutpostEconomics(colonyName, remoteRoomName, homePos, rcl, canReserve) {
    const remoteRooms = (global.heap && global.heap.remoteRooms) || {};
    const info = remoteRooms[remoteRoomName] || ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[remoteRoomName]) ? Memory.rooms[remoteRoomName].scoutData : null);

    const sources = (info && Array.isArray(info.sources)) ? info.sources : [];
    const sourcesCount = Math.max(1, sources.length);

    // Distance calculation
    let linearDist = 1;
    if (typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance) {
        linearDist = Math.max(1, Game.map.getRoomLinearDistance(colonyName, remoteRoomName));
    }
    let avgTileDist = 50 * linearDist;
    if (sources.length > 0 && homePos) {
        let totalD = 0;
        for (let s = 0; s < sources.length; s++) {
            totalD += (linearDist - 1) * 50 + Math.max(15, calcDistance(homePos, sources[s]));
        }
        avgTileDist = Math.round(totalD / sources.length);
    }
    const roundTrip = avgTileDist * 2;

    // Gross Revenue: Reserved sources generate 10 e/t, unreserved generate 5 e/t
    const eptPerSource = (rcl >= 3 && canReserve) ? 10 : 5;
    const grossEPT = sourcesCount * eptPerSource;

    // Hauler sizing based on distance and production rate
    const energyPerRoundTrip = grossEPT * roundTrip;
    const haulerCapacity = rcl >= 5 ? 800 : (rcl === 4 ? 600 : (rcl === 3 ? 300 : 150));
    const haulersNeeded = Math.max(1, Math.ceil(energyPerRoundTrip / haulerCapacity));

    // Operating Costs (Amortized per tick)
    const minerCost = sourcesCount * (550 / 1500); // ~0.37 e/t per source
    const haulerCost = haulersNeeded * ((haulerCapacity * 2) / 1500); // ~0.53 - 1.0 e/t
    const reserverCost = (rcl >= 3 && canReserve) ? (650 / 600) : 0; // 1.08 e/t
    const roadCost = 0.5 * linearDist; // Road decay maintenance
    const totalOverhead = minerCost + haulerCost + reserverCost + roadCost;

    const netEPT = Math.round((grossEPT - totalOverhead) * 10) / 10;
    const roi = totalOverhead > 0 ? Math.round((grossEPT / totalOverhead) * 10) / 10 : grossEPT;

    return {
        roomName: remoteRoomName,
        sourcesCount,
        distance: avgTileDist,
        linearDist,
        grossEPT,
        netEPT,
        roi,
        haulersNeeded,
        reserverNeeded: (rcl >= 3 && canReserve),
        viable: netEPT > 0
    };
}

function partitionEmpireOutposts() {
    if (typeof Game === 'undefined' || !Game.rooms) return {};

    const heap = (typeof global !== 'undefined') ? (global.heap || (global.heap = {})) : {};
    if (!heap.outpostOwners) heap.outpostOwners = {};
    if (typeof Memory !== 'undefined') {
        if (!Memory.empire) Memory.empire = {};
        if (!Memory.empire.outpostOwners) Memory.empire.outpostOwners = {};
    }

    // 1. Identify all active owned colonies
    const cfg = getConfig();
    if (!heap.remoteCaps) heap.remoteCaps = {};
    const bucket = (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket !== undefined) ? Game.cpu.bucket : 10000;
    const colonies = [];
    const ownedRoomNames = new Set();
    for (const rName in Game.rooms) {
        const r = Game.rooms[rName];
        if (r && r.controller && r.controller.my) {
            ownedRoomNames.add(rName);
            const rcl = r.controller.level || 1;
            const rState = heap.rooms ? heap.rooms[rName] : null;
            const spawns = (rState && rState.spawns) || (r.find ? r.find(FIND_MY_SPAWNS) : []);
            const homePos = (r.storage && r.storage.pos) || (spawns.length > 0 ? spawns[0].pos : roomCenterPos(rName));
            const storageEnergy = (r.storage && r.storage.store) ? (r.storage.store[RESOURCE_ENERGY] || 0) : 0;
            const spawnUtil = (heap.spawnUtil && heap.spawnUtil[rName] !== undefined) ? heap.spawnUtil[rName] : 0;
            const maxOutposts = getRemoteOutpostCap(rcl, storageEnergy, bucket, spawnUtil, cfg);
            heap.remoteCaps[rName] = maxOutposts;

            colonies.push({
                name: rName,
                room: r,
                rcl,
                homePos,
                canReserve: r.energyCapacityAvailable >= 650,
                maxOutposts
            });
        }
    }

    if (colonies.length === 0) return {};

    // 2. Discover all reachable candidate outposts per colony (1 hop for RCL 1-3, 2 hops for RCL 4+)
    const candidatePairs = [];
    const manualOutposts = (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.manualOutposts) ? Memory.empire.manualOutposts : {};

    for (let c = 0; c < colonies.length; c++) {
        const col = colonies[c];
        const candidatesSet = new Set();
        if (Game.map && Game.map.describeExits) {
            const hop1 = Game.map.describeExits(col.name);
            if (hop1) {
                for (const dir in hop1) {
                    const r1 = hop1[dir];
                    if (!ownedRoomNames.has(r1) && !isSKOrCenterRoom(r1)) {
                        candidatesSet.add(r1);
                    }
                }
            }
            if (col.rcl >= 6) {
                const hop1Rooms = Array.from(candidatesSet);
                for (let i = 0; i < hop1Rooms.length; i++) {
                    const hop2 = Game.map.describeExits(hop1Rooms[i]);
                    if (hop2) {
                        for (const dir in hop2) {
                            const r2 = hop2[dir];
                            if (!ownedRoomNames.has(r2) && !candidatesSet.has(r2) && !isSKOrCenterRoom(r2)) {
                                candidatesSet.add(r2);
                            }
                        }
                    }
                }
            }
        }

        // Include any manual outpost for this colony
        for (const out in manualOutposts) {
            if (manualOutposts[out] === col.name) candidatesSet.add(out);
        }

        const candidateArray = Array.from(candidatesSet);
        for (let i = 0; i < candidateArray.length; i++) {
            const outName = candidateArray[i];
            if (!assessOutpostViability(col.name, outName)) continue;

            const econ = calculateOutpostEconomics(col.name, outName, col.homePos, col.rcl, col.canReserve);
            if (!econ.viable && !manualOutposts[outName]) continue;

            // Score this (candidate, colony) pairing:
            // 1-hop distance gets massive bonus over 2-hop to prevent distant poaching
            const isManual = (manualOutposts[outName] === col.name);
            const linearBonus = (econ.linearDist === 1 ? 1000 : 0);
            const rclBonus = col.rcl * 10;
            const distPenalty = econ.distance * 2;
            const score = isManual ? 100000 : (econ.netEPT * 20 + linearBonus + rclBonus - distPenalty);

            candidatePairs.push({
                colonyName: col.name,
                outpostName: outName,
                linearDist: econ.linearDist,
                distance: econ.distance,
                econ,
                score,
                isManual
            });
        }
    }

    // 3. Sort pairs by score descending (highest priority first)
    candidatePairs.sort((a, b) => b.score - a.score);

    // 4. Greedy Exclusive Assignment (Each outpost can be claimed by AT MOST ONE colony)
    // Enforce global maxEmpireRemotes & dynamic CPU budget throttling (drop lowest-ROI / furthest remotes first)
    const baseMaxGlobal = cfg.maxEmpireRemotes !== undefined ? cfg.maxEmpireRemotes : 8;
    const cpuOverBudget = (heap.cpuMean50 !== undefined && heap.cpuMean50 > (cfg.cpuTarget || 15)) || (bucket < (cfg.cpuBucketFloor || 8000));
    heap.remoteThrottleActive = !!cpuOverBudget;
    const effectiveMaxGlobal = cpuOverBudget ? Math.max(2, Math.floor(baseMaxGlobal / 2)) : baseMaxGlobal;

    const assignedOutposts = new Set();
    const colonyAssignments = {};
    const colonyEconomics = {};
    const colonyCounts = {};
    for (let c = 0; c < colonies.length; c++) {
        colonyAssignments[colonies[c].name] = [];
        colonyEconomics[colonies[c].name] = {};
        colonyCounts[colonies[c].name] = 0;
    }

    for (let i = 0; i < candidatePairs.length; i++) {
        if (assignedOutposts.size >= effectiveMaxGlobal) break;
        const pair = candidatePairs[i];
        if (assignedOutposts.has(pair.outpostName)) continue; // Already claimed by a closer/better sister colony!

        const col = colonies.find(k => k.name === pair.colonyName);
        if (!col) continue;

        if (!pair.isManual && colonyCounts[pair.colonyName] >= col.maxOutposts) continue;

        assignedOutposts.add(pair.outpostName);
        colonyAssignments[pair.colonyName].push(pair.outpostName);
        colonyEconomics[pair.colonyName][pair.outpostName] = pair.econ;
        colonyCounts[pair.colonyName]++;
    }

    // 5. Commit to Heap and Memory across all colonies
    heap.outpostOwners = {};
    if (typeof Memory !== 'undefined' && Memory.empire) {
        Memory.empire.outpostOwners = {};
    }

    for (let c = 0; c < colonies.length; c++) {
        const colName = colonies[c].name;
        const outList = colonyAssignments[colName] || [];
        const econMap = colonyEconomics[colName] || {};

        for (let o = 0; o < outList.length; o++) {
            heap.outpostOwners[outList[o]] = colName;
            if (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.outpostOwners) {
                Memory.empire.outpostOwners[outList[o]] = colName;
            }
        }

        if (typeof Memory !== 'undefined' && Memory.rooms) {
            if (!Memory.rooms[colName]) Memory.rooms[colName] = {};
            Memory.rooms[colName].outposts = outList;
            Memory.rooms[colName].outpostEconomics = econMap;
        }

        if (heap.colonies && heap.colonies[colName]) {
            heap.colonies[colName].outposts = outList;
            heap.colonies[colName].outpostEconomics = econMap;
        }

        if (!heap.outpostEvalCache) heap.outpostEvalCache = {};
        heap.outpostEvalCache[colName] = {
            outposts: outList,
            economicsMap: econMap,
            rcl: colonies[c].rcl,
            expires: Game.time + 30
        };

        if (Game.time % 50 === 0 && outList.length > 0) {
            let totalNet = 0;
            const details = outList.map(r => {
                const e = econMap[r];
                totalNet += (e ? e.netEPT : 0);
                return `${r} (net +${e ? e.netEPT : 0} e/t, ${e ? e.sourcesCount : 1}s, d:${e ? e.distance : '?'}, ${e ? e.haulersNeeded : 1}h)`;
            }).join(', ');
            console.log(`[DEBUG] [OUTPOST_ECONOMY] ${colName} assigned ${outList.length} exclusive outposts (Net: +${Math.round(totalNet * 10) / 10} e/t): ${details}`);
        }
    }

    heap.empireOutpostsPartitionedAt = Game.time;
    return colonyAssignments;
}

function evaluateColonyOutposts(roomName) {
    const room = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[roomName] : null;
    if (!room || !room.controller || !room.controller.my) return [];

    const heap = (typeof global !== 'undefined') ? (global.heap || (global.heap = {})) : null;
    const lastPartition = heap ? heap.empireOutpostsPartitionedAt : 0;
    const isFresh = (lastPartition && typeof Game !== 'undefined' && Game.time < lastPartition + 25);

    if (!isFresh) {
        partitionEmpireOutposts();
    }

    if (heap && heap.colonies && heap.colonies[roomName] && heap.colonies[roomName].outposts) {
        return heap.colonies[roomName].outposts;
    }
    if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
        return Memory.rooms[roomName].outposts;
    }
    return [];
}

function moveToRoomViaExit(creep, targetRoom, targetPos, targetRange) {
    if (!creep || !creep.room) return ERR_INVALID_ARGS;

    if (creep.room.name === targetRoom) {
        return moveCreep(creep, targetPos || roomCenterPos(targetRoom), targetRange !== undefined ? targetRange : 1);
    }

    const heap = (typeof global !== 'undefined') ? (global.heap || (global.heap = {})) : null;
    if (heap && !heap.routeExitCache) heap.routeExitCache = {};
    const routeKey = `${creep.room.name}:${targetRoom}`;
    const isCombatRole = creep.memory && (creep.memory.role === 'defender' || creep.memory.role === 'raider' || creep.memory.role === 'outpostDefender');
    const cachedRoute = (!isCombatRole && heap) ? heap.routeExitCache[routeKey] : null;
    const nowTick = typeof Game !== 'undefined' ? Game.time : 0;

    let exitDir = ERR_NO_PATH;
    if (cachedRoute && nowTick >= cachedRoute.tick && nowTick < cachedRoute.expires) {
        exitDir = cachedRoute.exitDir;
    } else {
        if (typeof Game !== 'undefined' && Game.map && Game.map.findRoute) {
            const route = Game.map.findRoute(creep.room.name, targetRoom, {
                routeCallback(rName) {
                    if (rName === targetRoom || rName === creep.room.name) return 1;
                    if (!isNormalStatusRoom(rName)) return Infinity;
                    if (isSKOrCenterRoom(rName)) return Infinity;
                    if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[rName]) {
                        const sd = Memory.rooms[rName].scoutData;
                        if (sd && sd.threatLevel === 'player_defended') return Infinity;
                        if (creep.memory && creep.memory.role !== 'defender' && creep.memory.role !== 'raider') {
                            const t = Memory.rooms[rName].threat;
                            if (t && t.expiresAt > Game.time && t.hasArmedHostiles) return Infinity;
                        }
                    }
                    return 1;
                }
            });
            if (route && route.length > 0 && route[0].exit) {
                exitDir = route[0].exit;
            }
        }

        if (exitDir < 0 || exitDir > 8) {
            exitDir = creep.room.findExitTo ? creep.room.findExitTo(targetRoom) : ERR_NO_PATH;
        }
        if ((exitDir < 0 || exitDir > 8) && typeof Game !== 'undefined' && Game.map && Game.map.findExit) {
            exitDir = Game.map.findExit(creep.room.name, targetRoom);
        }
        if (!isCombatRole && heap && exitDir >= 1 && exitDir <= 8) {
            heap.routeExitCache[routeKey] = { exitDir, tick: nowTick, expires: nowTick + 200 };
        }
    }

    if (exitDir >= 1 && exitDir <= 8 && creep.room.find) {
        if (heap && !heap.exitTilesCache) heap.exitTilesCache = {};
        const cacheKey = creep.room.name + ':' + exitDir;
        let exitTiles = heap ? heap.exitTilesCache[cacheKey] : null;
        if (!exitTiles) {
            const found = creep.room.find(exitDir) || [];
            exitTiles = found.map(p => ({ x: p.x, y: p.y, roomName: creep.room.name }));
            if (heap && exitTiles.length > 0) heap.exitTilesCache[cacheKey] = exitTiles;
        }
        if (exitTiles && exitTiles.length > 0) {
            // Smart Exit Selection: Avoid exit tiles camped by armed hostiles so we don't walk into ambush
            const rState = heap && heap.rooms ? heap.rooms[creep.room.name] : null;
            const armedHostiles = (rState && rState.armedHostiles) || [];
            let safeExits = exitTiles;
            if (armedHostiles.length > 0) {
                const uncamped = exitTiles.filter(t => !armedHostiles.some(h => calcDistance(h.pos, t) <= 2));
                if (uncamped.length > 0) safeExits = uncamped;
            }

            let bestExit = safeExits[0];
            let bestDist = calcDistance(creep.pos, bestExit);
            for (let i = 1; i < safeExits.length; i++) {
                const d = calcDistance(creep.pos, safeExits[i]);
                if (d < bestDist) {
                    bestDist = d;
                    bestExit = safeExits[i];
                }
            }
            if (bestDist === 1) {
                if (!creep.heap) creep.heap = {};
                creep.heap.nextStep = { x: bestExit.x, y: bestExit.y, roomName: creep.room.name };
                return OK;
            }
            if (bestDist === 0) {
                return OK;
            }
            return moveCreep(creep, bestExit, 1);
        }
    }

    return moveCreep(creep, targetPos || roomCenterPos(targetRoom), targetRange !== undefined ? targetRange : 18);
}

function selectHomeDeliveryTarget(c, homeState) {
    if (!homeState) return null;
    const storage = homeState.storage;
    const cContainer = homeState.controllerContainer;
    const towers = homeState.towers || [];
    const spawns = homeState.spawns || [];
    const extensions = homeState.extensions || [];
    const carried = c.store ? (c.store[RESOURCE_ENERGY] || 0) : 0;

    const canAcceptController = (cnt) => {
        if (!cnt || !cnt.store) return false;
        const cEnergy = cnt.store[RESOURCE_ENERGY] || 0;
        if (c.heap && c.heap.targetId === cnt.id) return cEnergy < 2000;
        const incoming = homeState.controllerIncomingEnergy || 0;
        return (2000 - cEnergy - incoming) >= carried * 0.5;
    };

    // 1. Critical Tower Defense (< 400 energy)
    for (let t = 0; t < towers.length; t++) {
        if (towers[t].store && towers[t].store[RESOURCE_ENERGY] < 400 && getEffectiveFreeCapacity(towers[t]) >= 200) {
            return towers[t];
        }
    }

    // 2. Storage Priority (RCL 4+): Remote haulers deliver straight to Storage or top off controller container (with cap)!
    if (storage && getEffectiveFreeCapacity(storage) > 0) {
        if (cContainer && canAcceptController(cContainer) && (2000 - (cContainer.store[RESOURCE_ENERGY] || 0)) >= 400) {
            if (!c.heap || c.heap.targetId !== cContainer.id) {
                homeState.controllerIncomingEnergy = (homeState.controllerIncomingEnergy || 0) + carried;
                if (c.heap) c.heap.targetId = cContainer.id;
            }
            return cContainer;
        }
        return storage;
    }

    // 3. Fallback before Storage (RCL 1-3 or Storage under construction): Spawns & Extensions
    for (let s = 0; s < spawns.length; s++) {
        if (getEffectiveFreeCapacity(spawns[s]) > 0) return spawns[s];
    }
    for (let e = 0; e < extensions.length; e++) {
        if (getEffectiveFreeCapacity(extensions[e]) > 0) return extensions[e];
    }
    for (let t = 0; t < towers.length; t++) {
        if (getEffectiveFreeCapacity(towers[t]) >= 200) return towers[t];
    }
    if (cContainer && canAcceptController(cContainer)) {
        if (!c.heap || c.heap.targetId !== cContainer.id) {
            homeState.controllerIncomingEnergy = (homeState.controllerIncomingEnergy || 0) + carried;
            if (c.heap) c.heap.targetId = cContainer.id;
        }
        return cContainer;
    }

    // 4. Direct handoff to Builders / Upgraders if Storage isn't built and Controller Container is full!
    const builders = (homeState.creepsByRole && homeState.creepsByRole.builder) || [];
    for (let b = 0; b < builders.length; b++) {
        if (builders[b] && !builders[b].spawning && getEffectiveFreeCapacity(builders[b]) >= 20) {
            return builders[b];
        }
    }
    const upgraders = (homeState.creepsByRole && homeState.creepsByRole.upgrader) || [];
    for (let u = 0; u < upgraders.length; u++) {
        if (upgraders[u] && !upgraders[u].spawning && getEffectiveFreeCapacity(upgraders[u]) >= 15) {
            return upgraders[u];
        }
    }
    return null;
}

const SCOUT_INTEL_STALE_TICKS = 1500;

function getNextScoutTarget(colonyName, scout, excludedTargets) {
    if (!colonyName || typeof Game === 'undefined' || !Game.map || !Game.map.describeExits) return null;

    const rHeap = global.heap || {};
    const remoteRooms = rHeap.remoteRooms || {};
    const excl = excludedTargets || null;
    const currentRoom = (scout && scout.room) ? scout.room.name : null;

    if (scout && scout.memory && scout.room) {
        if (!scout.memory.recentRooms) scout.memory.recentRooms = [];
        const recent = scout.memory.recentRooms;
        if (recent[recent.length - 1] !== scout.room.name) {
            recent.push(scout.room.name);
            if (recent.length > 4) recent.shift();
        }
    }

    // Priority 1: Pre-expiry outpost exclusion recon (<= 50 ticks remaining)
    const col = rHeap.colonies ? rHeap.colonies[colonyName] : null;
    const colOutposts = (col && Array.isArray(col.outposts))
        ? col.outposts
        : ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[colonyName] && Array.isArray(Memory.rooms[colonyName].outposts))
            ? Memory.rooms[colonyName].outposts
            : []);

    if (rHeap.remoteSlotMap && rHeap.remoteExclusionMask && rHeap.remoteExclusionUntil) {
        for (let r = 0; r < colOutposts.length; r++) {
            const outName = colOutposts[r];
            const slot = rHeap.remoteSlotMap[outName];
            if (slot !== undefined && (rHeap.remoteExclusionMask[slot >> 5] & (1 << (slot & 31))) !== 0) {
                if (Game.time >= rHeap.remoteExclusionUntil[slot]) {
                    clearRemoteThreat(outName);
                } else if ((rHeap.remoteExclusionUntil[slot] - Game.time) <= 50) {
                    if (outName !== currentRoom && (!excl || !excl[outName]) && isNormalStatusRoom(outName) && !isSKOrCenterRoom(outName)) {
                        return outName;
                    }
                }
            }
        }
    }

    // Priority 2: Pre-expiry rival citadel Safe Mode recon (T <= 500 ticks)
    if (rHeap.rivalCitadelStorage) {
        for (const cRoom in rHeap.rivalCitadelStorage) {
            const prof = rHeap.rivalCitadelStorage[cRoom];
            if (!prof || isFriendlyOrEmpireRoom(cRoom)) continue;
            if (cRoom === currentRoom || (excl && excl[cRoom])) continue;
            if (!isNormalStatusRoom(cRoom) || isSKOrCenterRoom(cRoom)) continue;
            const smRem = getRivalSafeModeRemaining(prof);
            if (smRem > 0 && smRem <= 500) {
                const lastSeen = prof.tick || ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[cRoom] && Memory.rooms[cRoom].scoutData) ? Memory.rooms[cRoom].scoutData.lastSeen : 0);
                if ((Game.time - lastSeen) > 100) {
                    const dist = Game.map.getRoomLinearDistance ? Game.map.getRoomLinearDistance(colonyName, cRoom) : 3;
                    if (dist <= 6) return cRoom;
                }
            }
        }
    }

    // Priority 3: Unified BFS discovery (1-hop below RCL 4, up to 2-hop at RCL 4+)
    const homeRoom = Game.rooms ? Game.rooms[colonyName] : null;
    const maxHops = (homeRoom && homeRoom.controller && homeRoom.controller.level >= 4) ? 2 : 1;
    const queue = [{ roomName: colonyName, dist: 0 }];
    const visited = new Set([colonyName]);
    const reachable = [];

    while (queue.length > 0) {
        const curr = queue.shift();
        if (curr.dist >= maxHops) continue;

        const exits = Game.map.describeExits(curr.roomName);
        if (!exits) continue;

        for (const dir in exits) {
            const nextRoom = exits[dir];
            if (visited.has(nextRoom)) continue;
            visited.add(nextRoom);

            if (!isNormalStatusRoom(nextRoom)) continue;
            if (isSKOrCenterRoom(nextRoom)) continue;

            const rInfo = remoteRooms[nextRoom] || ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[nextRoom]) ? Memory.rooms[nextRoom].scoutData : null);
            const age = (rInfo && rInfo.lastSeen) ? (Game.time - rInfo.lastSeen) : Infinity;

            const smRemaining = getRivalSafeModeRemaining(nextRoom);
            const isPreExpiryRecon = (smRemaining > 0 && smRemaining <= 500);
            if (rInfo && rInfo.threatLevel === 'player_defended' && age < 5000 && !isPreExpiryRecon) continue;

            reachable.push({ roomName: nextRoom, dist: curr.dist + 1, rInfo, age, isPreExpiryRecon });
            queue.push({ roomName: nextRoom, dist: curr.dist + 1 });
        }
    }

    const recentList = (scout && scout.memory && Array.isArray(scout.memory.recentRooms)) ? scout.memory.recentRooms : null;
    let bestRoom = null;
    let bestScore = -Infinity;

    for (let i = 0; i < reachable.length; i++) {
        const { roomName, dist, rInfo, age, isPreExpiryRecon } = reachable[i];
        if (roomName === colonyName || roomName === currentRoom) continue;
        if (excl && excl[roomName]) continue;
        if (Game.rooms && Game.rooms[roomName] && Game.rooms[roomName].controller && Game.rooms[roomName].controller.my) continue;
        if (rHeap.colonies && rHeap.colonies[roomName]) continue;
        if (rHeap.outpostOwners && rHeap.outpostOwners[roomName] && rHeap.outpostOwners[roomName] !== colonyName) continue;

        const needsIntel = (isPreExpiryRecon && age > 100) || age > SCOUT_INTEL_STALE_TICKS;
        if (!needsIntel) continue;

        let score = 0;
        if (isPreExpiryRecon && age > 100) {
            score = 25000 - dist * 100;
        } else if (!rInfo || !rInfo.lastSeen) {
            score = 10000 - dist * 250;
        } else {
            score = age - dist * 150;
            if (rInfo.poachScore > 0 || rInfo.threatLevel === 'player_weak') score += 600;
            if (rInfo.expansionScore > 50) score += 200;
        }

        if (recentList && recentList.indexOf(roomName) !== -1) {
            score -= 6000;
        }

        if (score > bestScore) {
            bestScore = score;
            bestRoom = roomName;
        }
    }

    return bestRoom;
}

function pickNextScoutRoom(scout, colonyName) {
    return getNextScoutTarget(colonyName, scout);
}

function parkScoutOffRoad(scout, roomState) {
    if (!scout || !scout.pos || !scout.room) return;
    if (scout.pos.x <= 2 || scout.pos.x >= 47 || scout.pos.y <= 2 || scout.pos.y >= 47) {
        moveCreep(scout, roomCenterPos(scout.room.name), 15);
        return;
    }
    const roadGrid = roomState && roomState.roadGrid;
    if (!roadGrid || roadGrid[scout.pos.x * 50 + scout.pos.y] !== 1) return;

    const terrain = scout.room.getTerrain ? scout.room.getTerrain() : null;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const nx = scout.pos.x + dx;
            const ny = scout.pos.y + dy;
            if (nx < 2 || nx > 47 || ny < 2 || ny > 47) continue;
            if (terrain && terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
            if (roadGrid[nx * 50 + ny] === 1) continue;
            moveCreep(scout, new RoomPosition(nx, ny, scout.room.name), 0);
            return;
        }
    }
}

// Siege Target Selection: ranks rival-owned rooms by how breachable they are for a strike quad.
// Reorders Memory.empire.raidTargets (best first) and records Memory.empire.siegeTarget.
// Cached highway target lookup: resolves the power bank / deposit by stored ID; scans the room only on a cache miss
function getHighwayTarget(roomName, kind, room) {
    const heap = global.heap || (global.heap = {});
    const cache = heap.highwayTargets || (heap.highwayTargets = {});
    const key = kind + roomName;
    const id = cache[key];
    if (id) {
        const obj = Game.getObjectById(id);
        if (obj) return obj;
        delete cache[key];
    }
    if (!room || !room.find) return null;
    let found = null;
    if (kind === 'bank') {
        const pType = (typeof global !== 'undefined' && global.STRUCTURE_POWER_BANK) ? global.STRUCTURE_POWER_BANK : 'powerBank';
        const banks = room.find(FIND_STRUCTURES, { filter: s => s.structureType === pType });
        found = banks[0] || null;
    } else {
        const findDeposits = (typeof global !== 'undefined' && global.FIND_DEPOSITS) ? global.FIND_DEPOSITS : 122;
        const deps = room.find(findDeposits);
        found = deps[0] || null;
    }
    if (found) cache[key] = found.id;
    return found;
}

const SQUAD_BREACH_DPS = 720; // mid-tier quad: 12 WORK dismantle (600) + 12 RANGED (120)
function selectSiegeTarget() {
    if (typeof Memory === 'undefined' || !Memory.empire || !Array.isArray(Memory.empire.raidTargets)) return;
    if (Game.time % 20 !== 0) return; // raidTargets is rebuilt by state.js on these ticks; reorder right after

    const heap = global.heap;
    const colonies = [];
    for (const rn in Game.rooms) {
        const r = Game.rooms[rn];
        if (r.controller && r.controller.my && r.controller.level >= 7) colonies.push(rn);
    }
    if (colonies.length === 0) {
        Memory.empire.siegeTarget = null;
        return;
    }

    const targets = Memory.empire.raidTargets;
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t || !t.roomName || t.assaultType === 'nukeBreach' || getRivalSafeModeRemaining(t.roomName) > 0) continue;
        const info = (heap && heap.remoteRooms && heap.remoteRooms[t.roomName]) ||
            (Memory.rooms && Memory.rooms[t.roomName] ? Memory.rooms[t.roomName].scoutData : null);
        if (!info || !t.owner) continue; // only fortified rival-owned rooms with intel are siege candidates

        const cp = info.combatProfile || {};
        const towers = cp.towerCount || t.towersCount || 0;
        const boosted = cp.boostedCount || 0;
        const breachNeeded = cp.estimatedBreachDPS || 0;
        const rampHits = cp.minRampartHits || 0;

        // Hard gates: un-wallable / over-fortified sectors are skipped
        if (breachNeeded > SQUAD_BREACH_DPS * 2) continue;
        if (towers >= 6 && boosted > 0) continue;

        let minDist = Infinity;
        for (let c = 0; c < colonies.length; c++) {
            const d = Game.map.getRoomLinearDistance(t.roomName, colonies[c]);
            if (d < minDist) minDist = d;
        }
        if (minDist > 6) continue;

        const score = 1000 - towers * 80 - boosted * 50 - rampHits / 100000 - minDist * 25 + (t.poachScore || 0) * 0.1;
        if (score > bestScore) {
            bestScore = score;
            best = t;
        }
    }

    if (best) {
        const idx = targets.indexOf(best);
        if (idx > 0) {
            targets.splice(idx, 1);
            targets.unshift(best);
        }
        Memory.empire.siegeTarget = { roomName: best.roomName, score: Math.round(bestScore), tick: Game.time };
    } else {
        Memory.empire.siegeTarget = null;
    }
}

function planOutposts(colonyName) {
    const outposts = evaluateColonyOutposts(colonyName);
    if (typeof Game === 'undefined' || !Game.creeps) return outposts;

    const colony = global.heap && global.heap.colonies ? global.heap.colonies[colonyName] : null;
    const homeState = global.heap && global.heap.rooms ? global.heap.rooms[colonyName] : null;
    const remoteRooms = (global.heap && global.heap.remoteRooms) || {};

    const byRole = colony && colony.creepsByRole ? colony.creepsByRole : null;
    const scouts = byRole ? (byRole.scout || []) : [];
    const remoteMiners = byRole ? (byRole.remoteMiner || []) : [];
    const remoteHaulers = byRole ? (byRole.remoteHauler || []) : [];
    const reservers = byRole ? (byRole.reserver || []) : [];
    const claimers = byRole ? (byRole.claimer || []) : [];
    const pioneers = byRole ? (byRole.pioneer || []) : [];
    const janitors = byRole ? (byRole.janitor || []) : [];
    const outpostDefenders = byRole ? (byRole.outpostDefender || []) : [];
    const skGuards = byRole ? (byRole.skGuard || []) : [];
    const skHealers = byRole ? (byRole.skHealer || []) : [];
    const bankAttackers = byRole ? (byRole.bankAttacker || []) : [];
    const bankHealers = byRole ? (byRole.bankHealer || []) : [];
    const bankHaulers = byRole ? (byRole.bankHauler || []) : [];
    const depositHarvesters = byRole ? (byRole.depositHarvester || []) : [];

    profLap('rem:setup');
    // 1. Run Scouts: Unified Frontier Explorer (zero instant suicides; park & sleep when all rooms are fresh)
    const validOutposts = outposts;
    const assignedScoutTargets = {};
    for (let i = 0; i < scouts.length; i++) {
        const scout = scouts[i];
        if (scout.spawning || scout.fatigue > 0) continue;
        if (!scout.heap) scout.heap = {};

        const scoutRoomState = global.heap && global.heap.rooms ? global.heap.rooms[scout.room.name] : null;
        if (!scout.heap.targetRoom && scout.memory && scout.memory.targetRoom) {
            scout.heap.targetRoom = scout.memory.targetRoom;
        }

        // Threat Early Clearance: if scout safely enters an outpost with no armed hostiles or invader core, clear lockout early!
        if (scoutRoomState && scout.pos.x > 2 && scout.pos.x < 47 && scout.pos.y > 2 && scout.pos.y < 47) {
            if ((!scoutRoomState.armedHostiles || scoutRoomState.armedHostiles.length === 0) && !scoutRoomState.invaderCore) {
                if (isRemoteExcluded(scout.room.name) || (Memory.rooms && Memory.rooms[scout.room.name] && Memory.rooms[scout.room.name].threat)) {
                    clearRemoteThreat(scout.room.name);
                }
            }
        }

        // Hostile avoidance: consume pre-scanned hostiles first, cache flee exits
        const hostiles = (scoutRoomState && scoutRoomState.hostiles) || ((scout.room && scout.room.find) ? scout.room.find(FIND_HOSTILE_CREEPS) : []);
        const dangerousHostile = hostiles.find(h => calcDistance(scout.pos, h.pos) <= 4 && h.getActiveBodyparts && (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0));
        if (dangerousHostile || scout.hits < scout.hitsMax) {
            const exitConst = (typeof global !== 'undefined' && global.FIND_EXIT) ? global.FIND_EXIT : 10;
            const cache = global.heap ? (global.heap.exitTilesCache || (global.heap.exitTilesCache = {})) : null;
            const eKey = scout.room.name + ':all';
            let fleeExits = cache ? cache[eKey] : null;
            if (!fleeExits && scout.room.find) {
                fleeExits = (scout.room.find(exitConst) || []).map(p => ({ x: p.x, y: p.y, roomName: scout.room.name }));
                if (cache && fleeExits.length > 0) cache[eKey] = fleeExits;
            }
            if (fleeExits && fleeExits.length > 0) {
                let bestExit = fleeExits[0];
                let maxDist = -Infinity;
                const threatPos = dangerousHostile ? dangerousHostile.pos : scout.pos;
                for (let e = 0; e < fleeExits.length; e++) {
                    const distFromThreat = calcDistance(threatPos, fleeExits[e]);
                    if (distFromThreat > maxDist) { maxDist = distFromThreat; bestExit = fleeExits[e]; }
                }
                moveCreep(scout, bestExit, 0);
                scout.heap.targetRoom = null;
                if (scout.memory) scout.memory.targetRoom = null;
                continue;
            }
        }

        const onBorder = scout.pos.x <= 2 || scout.pos.x >= 47 || scout.pos.y <= 2 || scout.pos.y >= 47;
        if (!onBorder && scout.hits === scout.hitsMax && scout.heap.sleepUntil && Game.time < scout.heap.sleepUntil) {
            continue;
        }

        let targetRoom = scout.heap.targetRoom || (scout.memory && scout.memory.targetRoom) || null;
        const targetInfo = targetRoom ? (remoteRooms[targetRoom] || ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[targetRoom]) ? Memory.rooms[targetRoom].scoutData : null)) : null;
        const insideTarget = !onBorder && scout.room.name === targetRoom;
        const targetAlreadyFresh = !!(targetInfo && targetInfo.lastSeen && (Game.time - targetInfo.lastSeen) <= SCOUT_INTEL_STALE_TICKS);

        if (!targetRoom || isSKOrCenterRoom(targetRoom) || !isNormalStatusRoom(targetRoom) || insideTarget || (scout.room.name !== targetRoom && targetAlreadyFresh)) {
            targetRoom = getNextScoutTarget(colonyName, scout, assignedScoutTargets);
            scout.heap.targetRoom = targetRoom;
            if (scout.memory) scout.memory.targetRoom = targetRoom;
        }

        if (targetRoom) {
            assignedScoutTargets[targetRoom] = true;
            if (scout.room.name !== targetRoom) {
                moveToRoomViaExit(scout, targetRoom, roomCenterPos(targetRoom), 18);
            } else if (onBorder) {
                moveCreep(scout, roomCenterPos(scout.room.name), 15);
            }
        } else {
            parkScoutOffRoad(scout, scoutRoomState);
            scout.heap.actionIntent = 'idle';
            scout.heap.sleepUntil = Game.time + 25;
        }
    }

    // Collect all discovered safe non-excluded remote sources exclusively belonging to this colony
    const activeOutposts = [];
    const allRemoteSources = [];
    const remoteSourceById = {};
    for (let r = 0; r < outposts.length; r++) {
        const outName = outposts[r];
        if (isRemoteExcluded && isRemoteExcluded(outName)) continue;
        activeOutposts.push(outName);
        const info = remoteRooms[outName];
        if (info && info.safe !== false && Array.isArray(info.sources)) {
            for (let s = 0; s < info.sources.length; s++) {
                const srcObj = info.sources[s];
                allRemoteSources.push(srcObj);
                if (srcObj && srcObj.id) remoteSourceById[srcObj.id] = srcObj;
            }
        }
    }
    const routableOutposts = activeOutposts.length > 0 ? activeOutposts : validOutposts;

    // Lazy Outpost-to-Core Road Stitching trigger (on remote assignment changes or every 1,000 ticks)
    const stitchHeap = (typeof global !== 'undefined') ? (global.heap || (global.heap = {})) : null;
    if (stitchHeap && activeOutposts.length > 0) {
        if (!stitchHeap.remoteStitchState) stitchHeap.remoteStitchState = {};
        const stitchSig = `${activeOutposts.slice().sort().join(',')}:${allRemoteSources.length}`;
        const prevStitch = stitchHeap.remoteStitchState[colonyName];
        if (!prevStitch || prevStitch.sig !== stitchSig || (typeof Game !== 'undefined' && (Game.time - prevStitch.tick) >= 1000)) {
            stitchHeap.remoteStitchState[colonyName] = { sig: stitchSig, tick: typeof Game !== 'undefined' ? Game.time : 0 };
            if (typeof scheduleTask === 'function') {
                scheduleTask('stitchRemoteRoads', { roomName: colonyName }, 'stitch:' + colonyName);
            }
        }
    }

    const homeSpawn = homeState && homeState.spawns && homeState.spawns[0];

    profLap('rem:scouts');
    // 2. Run Remote Miners: path to cached remote source coordinate, lock inPosition = true at range 1, and drop-mine
    const assignedSourceIds = new Set();
    for (let i = 0; i < remoteMiners.length; i++) {
        const miner = remoteMiners[i];
        if (miner.spawning || miner.fatigue > 0) continue;
        if (!miner.heap) miner.heap = {};

        const curSrcId = miner.memory && miner.memory.sourceId;
        const curTargetRoom = miner.memory && miner.memory.targetRoom;
        const needsReassign = !curTargetRoom || routableOutposts.indexOf(curTargetRoom) === -1 ||
            !curSrcId || !remoteSourceById[curSrcId] || assignedSourceIds.has(curSrcId);
        if (needsReassign) {
            let freeSrc = null;
            for (let s = 0; s < allRemoteSources.length; s++) {
                const candId = allRemoteSources[s].id;
                if (assignedSourceIds.has(candId)) continue;
                let claimed = false;
                for (let m = i + 1; m < remoteMiners.length; m++) {
                    const rm = remoteMiners[m];
                    if (rm && rm.memory && rm.memory.sourceId === candId && routableOutposts.indexOf(rm.memory.targetRoom) !== -1) {
                        claimed = true;
                        break;
                    }
                }
                if (!claimed) { freeSrc = allRemoteSources[s]; break; }
            }
            if (freeSrc) {
                if (miner.memory) {
                    miner.memory.sourceId = freeSrc.id;
                    miner.memory.targetRoom = freeSrc.roomName;
                }
                miner.heap.inPosition = false;
                miner.heap.nextStep = null;
                miner.heap.sleepUntil = 0;
            } else {
                const mState = global.heap && global.heap.rooms ? global.heap.rooms[miner.room.name] : null;
                parkScoutOffRoad(miner, mState);
                miner.heap.actionIntent = 'idle';
                miner.heap.sleepUntil = Game.time + 25;
                continue;
            }
        }
        if (miner.memory && miner.memory.sourceId && (miner.ticksToLive === undefined || miner.ticksToLive >= 100)) {
            assignedSourceIds.add(miner.memory.sourceId);
        }

        if (miner.heap.sleepUntil && miner.heap.sleepUntil > Game.time && miner.room.name === (miner.memory && miner.memory.targetRoom)) continue;

        let srcInfo = (miner.memory && miner.memory.sourceId) ? (remoteSourceById[miner.memory.sourceId] || null) : null;
        if (!srcInfo && allRemoteSources.length > 0) {
            srcInfo = allRemoteSources[i % allRemoteSources.length];
            if (miner.memory) {
                miner.memory.sourceId = srcInfo.id;
                miner.memory.targetRoom = srcInfo.roomName;
            }
        }

        const targetRoom = (srcInfo && srcInfo.roomName) || (miner.memory && miner.memory.targetRoom);
        if (!targetRoom) {
            if (homeSpawn) {
                if (calcDistance(miner.pos, homeSpawn.pos) <= 1) homeSpawn.recycleCreep(miner);
                else moveCreep(miner, homeSpawn.pos, 1);
            }
            continue;
        }

        if (miner.room.name !== targetRoom) {
            miner.heap.inPosition = false;
            const destPos = srcInfo ? new RoomPosition(srcInfo.x, srcInfo.y, targetRoom) : roomCenterPos(targetRoom);
            moveToRoomViaExit(miner, targetRoom, destPos, srcInfo ? 1 : 18);
            continue;
        }

        const remState = global.heap && global.heap.rooms ? global.heap.rooms[targetRoom] : null;
        const liveSource = (srcInfo && Game.getObjectById(srcInfo.id)) || (remState && remState.sources && remState.sources[0]) || (miner.room.find ? miner.room.find(FIND_SOURCES)[0] : null);
        if (!liveSource) continue;

        // Evade armed hostiles in remote room
        const hostiles = (remState && remState.hostiles) || (miner.room.find ? miner.room.find(FIND_HOSTILE_CREEPS) : []);
        const dangerousHostile = hostiles.find(h => calcDistance(miner.pos, h.pos) <= 5 && h.getActiveBodyparts && (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0));
        if (dangerousHostile || miner.hits < miner.hitsMax) {
            miner.heap.inPosition = false;
            moveToRoomViaExit(miner, colonyName, roomCenterPos(colonyName), 1);
            continue;
        }
        const srcContainer = (remState && remState.containers)
            ? remState.containers.find(c => calcDistance(c.pos, liveSource.pos) <= 1)
            : null;

        const minerDest = srcContainer ? srcContainer.pos : liveSource.pos;
        const desiredRange = srcContainer ? 0 : 1;

        if (calcDistance(miner.pos, minerDest) > desiredRange) {
            miner.heap.inPosition = false;
            moveCreep(miner, minerDest, desiredRange);
        } else {
            miner.heap.inPosition = true;
            miner.heap.nextStep = null;

            const carried = miner.store ? (miner.store[RESOURCE_ENERGY] || 0) : 0;
            const hasCarry = miner.store && miner.store.getCapacity(RESOURCE_ENERGY) > 0;
            if (hasCarry && carried >= 25) {
                if (srcContainer && srcContainer.hits < 150000) {
                    miner.repair(srcContainer);
                    continue;
                }
                const nearSite = (remState && remState.constructionSites)
                    ? remState.constructionSites.find(s => calcDistance(miner.pos, s.pos) <= 3)
                    : (miner.pos.findInRange ? miner.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 3)[0] : null);
                if (nearSite) {
                    miner.build(nearSite);
                    continue;
                }
            }
            if (liveSource.energy > 0) {
                miner.harvest(liveSource);
            } else if (liveSource.ticksToRegeneration > 0) {
                miner.heap.sleepUntil = Game.time + liveSource.ticksToRegeneration;
            }
        }
    }

    profLap('rem:remoteMiners');
    // 3. Run Remote Haulers: pick up dropped energy at remote sources and haul back to colonyName
    for (let i = 0; i < remoteHaulers.length; i++) {
        const hauler = remoteHaulers[i];
        if (hauler.spawning || hauler.fatigue > 0) continue;
        if (!hauler.heap) hauler.heap = {};

        const carried = hauler.store ? hauler.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
        const freeCap = hauler.store ? hauler.store.getFreeCapacity(RESOURCE_ENERGY) : 0;

        if (hauler.heap.sleepUntil && Game.time < hauler.heap.sleepUntil && carried === 0) continue;

        // Sister Colony / Exclusion Zoning Enforcement: Reassign or retire haulers targeting an excluded or sister outpost
        if (hauler.memory && hauler.memory.targetRoom && routableOutposts.indexOf(hauler.memory.targetRoom) === -1) {
            if (routableOutposts.length > 0) {
                const newRoom = routableOutposts[i % routableOutposts.length];
                hauler.memory.targetRoom = newRoom;
                let src = null;
                for (let s = 0; s < allRemoteSources.length; s++) {
                    if (allRemoteSources[s].roomName === newRoom) { src = allRemoteSources[s]; break; }
                }
                hauler.memory.sourceId = src ? src.id : null;
            } else if (homeSpawn) {
                if (calcDistance(hauler.pos, homeSpawn.pos) <= 1) {
                    homeSpawn.recycleCreep(hauler);
                } else {
                    moveCreep(hauler, homeSpawn.pos, 1);
                }
                continue;
            }
        }

        const totalCarried = (hauler.store && typeof hauler.store.getUsedCapacity === 'function')
            ? (hauler.store.getUsedCapacity() || 0)
            : carried;
        if (totalCarried === 0) hauler.heap.working = false;
        else if (freeCap === 0) hauler.heap.working = true;
        else if (hauler.heap.working === undefined) hauler.heap.working = totalCarried > freeCap;

        if (!hauler.heap.working) {
            let srcInfo = (hauler.memory && hauler.memory.sourceId) ? (remoteSourceById[hauler.memory.sourceId] || null) : null;
            if (!srcInfo && allRemoteSources.length > 0) {
                srcInfo = allRemoteSources[i % allRemoteSources.length];
            }
            let targetRoom = (srcInfo && srcInfo.roomName) || (hauler.memory && hauler.memory.targetRoom) || routableOutposts[0];

            // Dynamic Remote Hauler Re-Targeting: if assigned outpost is dry (<100e) while another visible outpost is overflowing (>=1000e), redirect immediately
            if (targetRoom && hauler.room.name === colonyName) {
                const curState = global.heap && global.heap.rooms ? global.heap.rooms[targetRoom] : null;
                if (curState) {
                    const curEnergy = (curState.droppedEnergy || []).reduce((a, d) => a + (d.amount || 0), 0) +
                        (curState.containers || []).reduce((a, c) => a + (c.store ? (c.store[RESOURCE_ENERGY] || 0) : 0), 0);
                    if (curEnergy < 100) {
                        let bestOut = null;
                        let bestOutEnergy = 999;
                        for (let r = 0; r < routableOutposts.length; r++) {
                            const oName = routableOutposts[r];
                            if (oName === targetRoom) continue;
                            const oState = global.heap && global.heap.rooms ? global.heap.rooms[oName] : null;
                            if (!oState) continue;
                            const oEnergy = (oState.droppedEnergy || []).reduce((a, d) => a + (d.amount || 0), 0) +
                                (oState.containers || []).reduce((a, c) => a + (c.store ? (c.store[RESOURCE_ENERGY] || 0) : 0), 0);
                            if (oEnergy > bestOutEnergy) {
                                bestOutEnergy = oEnergy;
                                bestOut = oName;
                            }
                        }
                        if (bestOut) {
                            const bestSrc = allRemoteSources.find(s => s.roomName === bestOut) || null;
                            targetRoom = bestOut;
                            srcInfo = bestSrc;
                            if (hauler.memory) {
                                hauler.memory.targetRoom = bestOut;
                                hauler.memory.sourceId = bestSrc ? bestSrc.id : null;
                            }
                        }
                    }
                }
            }

            if (!targetRoom) {
                if (homeSpawn) {
                    if (calcDistance(hauler.pos, homeSpawn.pos) <= 1) homeSpawn.recycleCreep(hauler);
                    else moveCreep(hauler, homeSpawn.pos, 1);
                }
                continue;
            }

            const isTargetThreatened = (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[targetRoom] && Memory.rooms[targetRoom].threat && Memory.rooms[targetRoom].threat.expiresAt > Game.time) ||
                (global.heap && global.heap.remoteRooms && global.heap.remoteRooms[targetRoom] && global.heap.remoteRooms[targetRoom].safe === false);

            if (hauler.room.name !== targetRoom) {
                if (isTargetThreatened) {
                    // HOLD IN SAFETY: Outpost under attack! Do not walk into the danger zone
                    if (hauler.room.name === colonyName) {
                        const waitPos = (homeState && homeState.storage) ? homeState.storage.pos : roomCenterPos(colonyName);
                        if (calcDistance(hauler.pos, waitPos) > 4) moveCreep(hauler, waitPos, 3);
                    } else {
                        moveToRoomViaExit(hauler, colonyName, roomCenterPos(colonyName), 2);
                    }
                    continue;
                }
                const dest = srcInfo ? new RoomPosition(srcInfo.x, srcInfo.y, targetRoom) : roomCenterPos(targetRoom);
                moveToRoomViaExit(hauler, targetRoom, dest, 1);
                continue;
            }

            // Inside target room: check for nearby threats
            const remState = global.heap && global.heap.rooms ? global.heap.rooms[targetRoom] : null;
            const hostiles = (remState && remState.hostiles) || (hauler.room.find ? hauler.room.find(FIND_HOSTILE_CREEPS) : []);
            const dangerousHostile = hostiles.find(h => calcDistance(hauler.pos, h.pos) <= 6 && h.getActiveBodyparts && (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0));
            if (dangerousHostile || hauler.hits < hauler.hitsMax) {
                // EMERGENCY FLEE: Run back toward home colony!
                moveToRoomViaExit(hauler, colonyName, roomCenterPos(colonyName), 1);
                continue;
            }

            const homeRoomObj = Game.rooms[colonyName];
            const canStoreMinerals = !!(homeRoomObj && (homeRoomObj.terminal || homeRoomObj.storage));
            const remArmed = (remState && remState.armedHostiles) || [];
            const lootList = (remArmed.length === 0 && freeCap > 0 && remState && remState.lootTargets) ? remState.lootTargets : [];
            let lootTarget = null;
            for (let li = 0; li < lootList.length; li++) {
                const lt = lootList[li];
                if (!lt || !lt.pos) continue;
                if (lt.amount !== undefined) {
                    if (canStoreMinerals || (lt.resourceType === RESOURCE_ENERGY && lt.amount >= 50)) { lootTarget = lt; break; }
                } else if (lt.store && (canStoreMinerals || (lt.store[RESOURCE_ENERGY] || 0) >= 50)) {
                    lootTarget = lt;
                    break;
                }
            }

            const drops = (remState && remState.droppedEnergy) || (hauler.room.find ? hauler.room.find(FIND_DROPPED_RESOURCES) : []);
            const drop = drops.find(d => d.resourceType === RESOURCE_ENERGY && d.amount >= 20);
            const containers = (remState && remState.containers) || [];
            const srcContainer = srcInfo
                ? containers.find(c => calcDistance(c.pos, srcInfo) <= 2 && c.store && c.store[RESOURCE_ENERGY] >= 50)
                : containers.find(c => c.store && c.store[RESOURCE_ENERGY] >= 50);

            if (lootTarget) {
                if (calcDistance(hauler.pos, lootTarget.pos) <= 1) {
                    withdrawOrPickupLoot(hauler, lootTarget, canStoreMinerals);
                    hauler.heap.working = true;
                } else {
                    moveCreep(hauler, lootTarget.pos, 1);
                }
            } else if (drop) {
                if (calcDistance(hauler.pos, drop.pos) <= 1) {
                    hauler.pickup(drop);
                    hauler.heap.working = true;
                } else {
                    moveCreep(hauler, drop.pos, 1);
                }
            } else if (srcContainer) {
                if (calcDistance(hauler.pos, srcContainer.pos) <= 1) {
                    hauler.withdraw(srcContainer, RESOURCE_ENERGY);
                    hauler.heap.working = true;
                } else {
                    moveCreep(hauler, srcContainer.pos, 1);
                }
            } else if (srcInfo && calcDistance(hauler.pos, srcInfo) > 2) {
                moveCreep(hauler, { x: srcInfo.x, y: srcInfo.y, roomName: targetRoom }, 2);
            } else if (srcInfo && carried === 0) {
                hauler.heap.sleepUntil = Game.time + 4;
            }
        } else {
            // Deliver back to home colony
            // On-the-Move Transit Road Repair: if hauler has WORK and energy, repair decaying road under feet in parallel with moving
            if (carried > 0 && hauler.getActiveBodyparts && hauler.getActiveBodyparts(WORK) > 0) {
                const currentRoomState = global.heap && global.heap.rooms ? global.heap.rooms[hauler.room.name] : null;
                const rIdx = (currentRoomState && currentRoomState.roadIndexGrid)
                    ? currentRoomState.roadIndexGrid[hauler.pos.x * 50 + hauler.pos.y]
                    : 0;
                const roadUnderFeet = (rIdx > 0 && currentRoomState.roadIds)
                    ? Game.getObjectById(currentRoomState.roadIds[rIdx - 1])
                    : null;
                if (roadUnderFeet && roadUnderFeet.hits < roadUnderFeet.hitsMax * 0.70) {
                    hauler.repair(roadUnderFeet);
                }
            }

            if (hauler.room.name !== colonyName) {
                const spawnPos = (homeState && homeState.spawns && homeState.spawns[0]) ? homeState.spawns[0].pos : roomCenterPos(colonyName);
                moveToRoomViaExit(hauler, colonyName, spawnPos, 1);
                continue;
            }

            if (depositNonEnergyLoot(hauler, Game.rooms[colonyName])) continue;
            const target = selectHomeDeliveryTarget(hauler, homeState);
            const cCont = homeState ? homeState.controllerContainer : null;
            if (target) {
                const isCtrlCont = !!(cCont && target.id === cCont.id);
                registerIntent(hauler, 'transfer', target, carried);
                const dist = calcDistance(hauler.pos, target.pos);
                if (isCtrlCont) {
                    if (dist <= 1) {
                        const freeSpace = target.store ? target.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
                        if (freeSpace >= carried) {
                            hauler.transfer(target, RESOURCE_ENERGY);
                            hauler.heap.targetId = null;
                            hauler.heap.working = false;
                            hauler.heap.waitTicks = 0;
                        } else if (freeSpace > 0) {
                            hauler.transfer(target, RESOURCE_ENERGY);
                            hauler.heap.targetId = null;
                            hauler.heap.waitTicks = 0;
                        } else {
                            hauler.drop(RESOURCE_ENERGY);
                            hauler.heap.targetId = null;
                            hauler.heap.working = false;
                            hauler.heap.waitTicks = 0;
                        }
                    } else {
                        if (dist <= 2 && (hauler.heap.stuckTicks || 0) > 0) {
                            hauler.heap.waitTicks = (hauler.heap.waitTicks || 0) + 1;
                            const ups = (homeState && homeState.creepsByRole && homeState.creepsByRole.upgrader) || [];
                            if (hauler.heap.waitTicks >= 3) {
                                const adjUp = ups.find(u => calcDistance(hauler.pos, u.pos) <= 1 && getEffectiveFreeCapacity(u) > 0);
                                if (adjUp) {
                                    hauler.transfer(adjUp, RESOURCE_ENERGY);
                                    hauler.heap.targetId = null;
                                    hauler.heap.working = false;
                                    hauler.heap.waitTicks = 0;
                                    continue;
                                } else if (ups.some(u => calcDistance(hauler.pos, u.pos) <= 1)) {
                                    hauler.drop(RESOURCE_ENERGY);
                                    hauler.heap.targetId = null;
                                    hauler.heap.working = false;
                                    hauler.heap.waitTicks = 0;
                                    continue;
                                } else if (homeState && homeState.storage && getEffectiveFreeCapacity(homeState.storage) > 0) {
                                    hauler.heap.targetId = homeState.storage.id;
                                    hauler.heap.waitTicks = 0;
                                    if (calcDistance(hauler.pos, homeState.storage.pos) <= 1) {
                                        hauler.transfer(homeState.storage, RESOURCE_ENERGY);
                                        hauler.heap.working = false;
                                    } else {
                                        moveCreep(hauler, homeState.storage.pos, 1);
                                    }
                                    continue;
                                }
                            }
                        } else {
                            hauler.heap.waitTicks = 0;
                        }
                        const dockList = homeState ? homeState.controllerDockPosList : null;
                        if (dockList && dockList.length > 0) {
                            moveCreep(hauler, dockList[i % dockList.length], 0);
                        } else {
                            moveCreep(hauler, target.pos, 1);
                        }
                    }
                } else {
                    if (dist <= 1) {
                        hauler.transfer(target, RESOURCE_ENERGY);
                        hauler.heap.targetId = null;
                        hauler.heap.waitTicks = 0;
                    } else {
                        moveCreep(hauler, target.pos, 1);
                    }
                }
            } else if (homeState && homeState.controller) {
                if (calcDistance(hauler.pos, homeState.controller.pos) <= 2) {
                    hauler.drop(RESOURCE_ENERGY);
                    hauler.heap.working = false;
                } else {
                    moveCreep(hauler, homeState.controller.pos, 2);
                }
            }
        }
    }

    profLap('rem:remoteHaulers');
    // 4. Run Reservers: reserve remote controllers to double source capacity to 3,000
    const assignedReserverRooms = new Set();
    for (let i = 0; i < reservers.length; i++) {
        const res = reservers[i];
        if (res.spawning || res.fatigue > 0) continue;
        if (!res.heap) res.heap = {};
        if (res.heap.sleepUntil && Game.time < res.heap.sleepUntil) continue;
        // Self-clean damaged/invalid reservers with 0 active CLAIM parts (guarded by safeSuicide)
        if (res.getActiveBodyparts && res.getActiveBodyparts(CLAIM) === 0) {
            safeSuicide(res, 'no_claim_parts');
            continue;
        }

        // Sister Colony Outpost Enforcement & 1-Reserver-Per-Outpost Dedup (ignore dying predecessors < 80 TTL)
        let targetRoom = res.memory && res.memory.targetRoom;
        if (!targetRoom || validOutposts.indexOf(targetRoom) === -1 || assignedReserverRooms.has(targetRoom)) {
            let freeOutpost = null;
            for (let o = 0; o < validOutposts.length; o++) {
                const cand = validOutposts[o];
                if (assignedReserverRooms.has(cand)) continue;
                let claimed = false;
                for (let r = i + 1; r < reservers.length; r++) {
                    const rr = reservers[r];
                    if (rr && rr.memory && rr.memory.targetRoom === cand && (rr.ticksToLive === undefined || rr.ticksToLive >= 80)) {
                        claimed = true;
                        break;
                    }
                }
                if (!claimed) { freeOutpost = cand; break; }
            }
            if (freeOutpost) {
                targetRoom = freeOutpost;
                if (res.memory) res.memory.targetRoom = freeOutpost;
            } else {
                const resState = global.heap && global.heap.rooms ? global.heap.rooms[res.room.name] : null;
                parkScoutOffRoad(res, resState);
                res.heap.actionIntent = 'idle';
                res.heap.sleepUntil = Game.time + 25;
                continue;
            }
        }
        if (res.ticksToLive === undefined || res.ticksToLive >= 80) {
            assignedReserverRooms.add(targetRoom);
        }

        if (res.room.name !== targetRoom) {
            moveToRoomViaExit(res, targetRoom, roomCenterPos(targetRoom), 18);
            continue;
        }
        const ctrl = res.room.controller;
        if (ctrl) {
            if (calcDistance(res.pos, ctrl.pos) <= 1) {
                const homeRoom = Game.rooms[colonyName];
                const myUsername = (homeRoom && homeRoom.controller && homeRoom.controller.owner) ? homeRoom.controller.owner.username : null;
                if (ctrl.reservation && myUsername && ctrl.reservation.username !== myUsername) {
                    res.attackController(ctrl); // Attack and destroy enemy reservation to poach the room
                } else if (!(ctrl.reservation && ctrl.reservation.ticksToEnd >= 1000 && res.getActiveBodyparts && res.getActiveBodyparts(CLAIM) >= 2 && (Game.time % 2 === 1))) {
                    res.reserveController(ctrl);
                }
            } else {
                moveCreep(res, ctrl.pos, 1);
            }
        }
    }

    profLap('rem:reservers');
    // 5. Run Claimers: Claim new GCL expansion rooms
    const fallbackExpand = (typeof Memory !== 'undefined' && Memory.empire) ? Memory.empire.expansionTarget : null;
    for (let i = 0; i < claimers.length; i++) {
        const clm = claimers[i];
        if (clm.spawning || clm.fatigue > 0) continue;
        const targetRoom = (clm.memory && clm.memory.targetRoom) || fallbackExpand;
        if (!targetRoom) continue;

        if (clm.room.name !== targetRoom) {
            moveToRoomViaExit(clm, targetRoom, roomCenterPos(targetRoom), 18);
            continue;
        }
        const ctrl = clm.room.controller;
        if (!ctrl) continue;
        if (ctrl.my) {
            clm.memory.targetRoom = fallbackExpand && fallbackExpand !== targetRoom ? fallbackExpand : null;
            continue;
        }
        if (calcDistance(clm.pos, ctrl.pos) <= 1) {
            const homeRoom = Game.rooms[colonyName];
            const myUsername = (homeRoom && homeRoom.controller && homeRoom.controller.owner) ? homeRoom.controller.owner.username : null;
            let myColoniesCount = 0;
            for (const rn in Game.rooms) {
                if (Game.rooms[rn] && Game.rooms[rn].controller && Game.rooms[rn].controller.my) myColoniesCount++;
            }
            const gclLevel = (typeof Game !== 'undefined' && Game.gcl) ? Game.gcl.level : 1;
            const isCtrlAttacker = clm.memory && clm.memory.subRole === 'CONTROLLER_ATTACKER';

            if ((ctrl.owner && !ctrl.my && !ctrl.safeMode && !ctrl.upgradeBlocked) ||
                (ctrl.reservation && myUsername && ctrl.reservation.username !== myUsername)) {
                clm.attackController(ctrl);
            } else if (!isCtrlAttacker && myColoniesCount < gclLevel && clm.claimController(ctrl) === OK) {
                if (global.heap && global.heap.expansion) {
                    global.heap.expansion.claimTick = Game.time;
                    global.heap.expansion.phase = 'CLAIMED';
                }
                // If claimed target was scored as an FOB border seed, stamp fob flags into room memory
                if (typeof Memory !== 'undefined' && Memory.empire && Array.isArray(Memory.empire.expansionPoints)) {
                    const expEntry = Memory.empire.expansionPoints.find(e => e && e.roomName === targetRoom);
                    if (expEntry && expEntry.isFob) {
                        if (!Memory.rooms) Memory.rooms = {};
                        if (!Memory.rooms[targetRoom]) Memory.rooms[targetRoom] = {};
                        Memory.rooms[targetRoom].fob = true;
                        Memory.rooms[targetRoom].fobTarget = expEntry.fobTarget;
                    }
                }
                // Clear obstructing unowned structures in 5x5 anchor footprint (preserve >2k energy storage/terminal for looting)
                const bp = getRoomBlueprint(clm.room);
                if (bp && bp.anchor && clm.room.find) {
                    const structs = clm.room.find(FIND_STRUCTURES);
                    for (let s = 0; s < structs.length; s++) {
                        const st = structs[s];
                        if (st.my || st.structureType === STRUCTURE_CONTROLLER) continue;
                        const isEnergyVault = (st.structureType === STRUCTURE_STORAGE || st.structureType === STRUCTURE_TERMINAL) && st.store && (st.store[RESOURCE_ENERGY] || 0) > 2000;
                        if (isEnergyVault) continue;
                        if (Math.abs(st.pos.x - bp.anchor.x) <= 2 && Math.abs(st.pos.y - bp.anchor.y) <= 2 && st.destroy) {
                            st.destroy();
                        }
                    }
                }
            } else if (!ctrl.owner) {
                clm.reserveController(ctrl);
            }
        } else {
            moveCreep(clm, ctrl.pos, 1);
        }
    }

    profLap('rem:claimers');
    // 6. Run Pioneers: RCL 2 Flash-Upgrade, Zero-Walk Bucket Brigade (PIONEER_MINER / PIONEER_WORKER), & Colonizer Hauler
    for (let i = 0; i < pioneers.length; i++) {
        const pio = pioneers[i];
        if (pio.spawning || pio.fatigue > 0) continue;
        if (!pio.heap) pio.heap = {};
        const targetRoom = (pio.memory && pio.memory.targetRoom) || fallbackExpand;
        if (!targetRoom) continue;

        const carried = pio.store ? (pio.store[RESOURCE_ENERGY] || 0) : 0;
        const freeCap = pio.store ? pio.store.getFreeCapacity(RESOURCE_ENERGY) : 0;

        // Wave 2 Colonizer Hauler: bulk-haul energy from parent Storage to child Core Container / Upgrade Arc
        if (pio.memory && pio.memory.subRole === 'COLONIZER_HAULER') {
            if (carried === 0) {
                if (pio.room.name !== colonyName) {
                    const hSpawn = (homeState && homeState.spawns && homeState.spawns[0]) ? homeState.spawns[0].pos : roomCenterPos(colonyName);
                    moveToRoomViaExit(pio, colonyName, hSpawn, 1);
                } else if (homeState && homeState.storage && (homeState.storage.store[RESOURCE_ENERGY] || 0) >= 1000) {
                    if (calcDistance(pio.pos, homeState.storage.pos) <= 1) pio.withdraw(homeState.storage, RESOURCE_ENERGY);
                    else moveCreep(pio, homeState.storage.pos, 1);
                }
            } else {
                if (pio.room.name !== targetRoom) {
                    moveToRoomViaExit(pio, targetRoom, roomCenterPos(targetRoom), 12);
                } else {
                    const tState = global.heap && global.heap.rooms ? global.heap.rooms[targetRoom] : null;
                    const tBp = getRoomBlueprint(pio.room);
                    const coreCont = (tState && tState.containers && tBp && tBp.anchor)
                        ? tState.containers.find(c => Math.abs(c.pos.x - tBp.anchor.x) <= 2 && Math.abs(c.pos.y - tBp.anchor.y) <= 2 && c.store && c.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                        : null;
                    const dropArc = (tState && tState.upgradePositions && tState.upgradePositions[0]) || (pio.room.controller ? pio.room.controller.pos : roomCenterPos(targetRoom));
                    if (coreCont) {
                        if (calcDistance(pio.pos, coreCont.pos) <= 1) pio.transfer(coreCont, RESOURCE_ENERGY);
                        else moveCreep(pio, coreCont.pos, 1);
                    } else if (calcDistance(pio.pos, dropArc) <= 1) {
                        pio.drop(RESOURCE_ENERGY);
                    } else {
                        moveCreep(pio, dropArc, 1);
                    }
                }
            }
            continue;
        }

        if (pio.room.name !== targetRoom) {
            pio.heap.inPosition = false;
            moveToRoomViaExit(pio, targetRoom, roomCenterPos(targetRoom), 12);
            continue;
        }

        const tState = global.heap && global.heap.rooms ? global.heap.rooms[targetRoom] : null;
        const ctrl = pio.room.controller;
        const existingSpawns = (tState && tState.spawns) || (pio.room.find ? pio.room.find(FIND_MY_SPAWNS) : []);
        let existingTowers = (tState && tState.towers) || [];
        if ((!tState || !tState.towers) && pio.room.find && typeof FIND_MY_STRUCTURES !== 'undefined') {
            existingTowers = [];
            const myStructs = pio.room.find(FIND_MY_STRUCTURES);
            for (let ms = 0; ms < myStructs.length; ms++) {
                if (myStructs[ms] && myStructs[ms].structureType === STRUCTURE_TOWER) existingTowers.push(myStructs[ms]);
            }
        }
        const sites = (tState && tState.constructionSites) || (pio.room.find ? pio.room.find(FIND_MY_CONSTRUCTION_SITES) : []);
        const srcs = (tState && tState.sources) || (pio.room.find ? pio.room.find(FIND_SOURCES) : []);

        if (ctrl && ctrl.my && existingSpawns.length > 0 && global.heap && global.heap.expansion && !global.heap.expansion.spawnBuiltTick) {
            global.heap.expansion.spawnBuiltTick = Game.time;
            global.heap.expansion.phase = 'OPERATIONAL';
        }

        // Only convert pioneers into permanent local workforce once RCL 3 & Tower 1 are operational
        if (ctrl && ctrl.my && existingSpawns.length > 0 && ctrl.level >= 3 && existingTowers.length > 0) {
            pio.memory.colony = targetRoom;
            if (i % 2 === 0) {
                pio.memory.role = 'harvester';
                pio.heap.roleId = 0;
                if (srcs.length > 0) pio.memory.sourceId = srcs[0].id;
            } else {
                pio.memory.role = 'builder';
                pio.heap.roleId = 6;
            }
            continue;
        }

        // Phase 1: 40-Tick RCL 2 Flash-Upgrade (Do NOT build Spawn until RCL >= 2!)
        if (ctrl && ctrl.my && ctrl.level === 1) {
            if (carried === 0) pio.heap.working = false;
            else if (freeCap === 0) pio.heap.working = true;
            else if (pio.heap.working === undefined) pio.heap.working = carried > 0;

            if (!pio.heap.working) {
                const nearSrc = srcs.length > 0 ? srcs.slice().sort((a, b) => calcDistance(a.pos, ctrl.pos) - calcDistance(b.pos, ctrl.pos))[0] : null;
                if (nearSrc) {
                    if (calcDistance(pio.pos, nearSrc.pos) <= 1) pio.harvest(nearSrc);
                    else moveCreep(pio, nearSrc.pos, 1);
                }
            } else {
                if (calcDistance(pio.pos, ctrl.pos) <= 3) pio.upgradeController(ctrl);
                else moveCreep(pio, ctrl.pos, 3);
            }
            continue;
        }

        // Phase 2: RCL >= 2 -> Place Spawn1 site at FAST_FILLER_STAMP (-2, -1) if missing
        if (ctrl && ctrl.my && ctrl.level >= 2 && existingSpawns.length === 0 && pio.room.createConstructionSite) {
            const hasSpawnSite = sites.some(s => s.structureType === STRUCTURE_SPAWN);
            if (!hasSpawnSite) {
                const bp = getRoomBlueprint(pio.room);
                const sp = bp && bp.spawns && bp.spawns[0] ? bp.spawns[0] : (bp && bp.anchor ? bp.anchor : { x: 25, y: 25 });
                pio.room.createConstructionSite(sp.x, sp.y, STRUCTURE_SPAWN);
            }
        }

        // Zero-Walk Role Split: PIONEER_MINER (1 per Source) vs. PIONEER_WORKER across all sponsors
        const allPioneers = (typeof Game !== 'undefined' && Game.creeps) ? Object.values(Game.creeps) : pioneers;
        const localPioneers = allPioneers
            .filter(p => p && !p.spawning && p.memory && p.memory.role === 'pioneer' && p.memory.subRole !== 'COLONIZER_HAULER' && p.room && p.room.name === targetRoom)
            .sort((a, b) => (a.name < b.name ? -1 : (a.name > b.name ? 1 : 0)));
        const pIdx = localPioneers.findIndex(p => p.id === pio.id);
        const isMiner = (pIdx !== -1 && pIdx < Math.min(2, srcs.length));
        pio.heap.subRole = isMiner ? 'PIONEER_MINER' : 'PIONEER_WORKER';

        if (isMiner) {
            const mySrc = srcs[pIdx];
            if (mySrc) {
                if (calcDistance(pio.pos, mySrc.pos) > 1) {
                    pio.heap.inPosition = false;
                    moveCreep(pio, mySrc.pos, 1);
                } else {
                    pio.heap.inPosition = true;
                    pio.heap.actionIntent = 'harvest';
                    pio.harvest(mySrc);
                    if (freeCap === 0) {
                        const adjWorker = localPioneers.find(w => w.id !== pio.id && w.heap && w.heap.subRole === 'PIONEER_WORKER' && calcDistance(pio.pos, w.pos) <= 1 && w.store && w.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
                        if (adjWorker) pio.transfer(adjWorker, RESOURCE_ENERGY);
                        else pio.drop(RESOURCE_ENERGY);
                    }
                }
            }
            continue;
        }

        // PIONEER_WORKER: Drain >2k hostile Storage/Terminal first, else pickup from PIONEER_MINER and build Spawn1
        if (carried === 0) pio.heap.working = false;
        else if (freeCap === 0) pio.heap.working = true;
        else if (pio.heap.working === undefined) pio.heap.working = carried > 0;

        if (!pio.heap.working) {
            const hostileLoot = (tState && tState.hostileStructures)
                ? tState.hostileStructures.find(st => (st.structureType === STRUCTURE_STORAGE || st.structureType === STRUCTURE_TERMINAL) && st.store && (st.store[RESOURCE_ENERGY] || 0) > 2000)
                : null;
            if (hostileLoot) {
                if (calcDistance(pio.pos, hostileLoot.pos) <= 1) pio.withdraw(hostileLoot, RESOURCE_ENERGY);
                else moveCreep(pio, hostileLoot.pos, 1);
                continue;
            }
            const drops = (tState && tState.droppedEnergy) || [];
            const bigDrop = drops.find(d => d.amount >= 20);
            if (bigDrop) {
                if (calcDistance(pio.pos, bigDrop.pos) <= 1) {
                    pio.pickup(bigDrop);
                    pio.heap.working = true;
                } else {
                    moveCreep(pio, bigDrop.pos, 1);
                }
                continue;
            }
            const miner = localPioneers.find(m => m.heap && m.heap.subRole === 'PIONEER_MINER' && m.heap.inPosition);
            if (miner) {
                if (calcDistance(pio.pos, miner.pos) > 1) moveCreep(pio, miner.pos, 1);
            } else if (srcs.length > 0) {
                if (calcDistance(pio.pos, srcs[0].pos) <= 1) pio.harvest(srcs[0]);
                else moveCreep(pio, srcs[0].pos, 1);
            }
        } else {
            const targetSite = sites.find(s => s.structureType === STRUCTURE_SPAWN) ||
                sites.find(s => s.structureType === STRUCTURE_TOWER) ||
                sites.find(s => s.structureType === STRUCTURE_CONTAINER) ||
                sites.find(s => s.structureType === STRUCTURE_EXTENSION) ||
                sites.find(s => s.structureType === STRUCTURE_RAMPART) ||
                sites[0];
            if (ctrl && ctrl.my && ctrl.ticksToDowngrade < 4000) {
                if (calcDistance(pio.pos, ctrl.pos) <= 3) pio.upgradeController(ctrl);
                else moveCreep(pio, ctrl.pos, 3);
            } else if (targetSite) {
                if (calcDistance(pio.pos, targetSite.pos) <= 3) pio.build(targetSite);
                else moveCreep(pio, targetSite.pos, 3);
            } else if (ctrl && ctrl.my) {
                if (calcDistance(pio.pos, ctrl.pos) <= 3) pio.upgradeController(ctrl);
                else moveCreep(pio, ctrl.pos, 3);
            }
        }
    }

    profLap('rem:pioneers');
    // 7. Run Janitors: Remote road and container repair/construction
    for (let i = 0; i < janitors.length; i++) {
        const jan = janitors[i];
        if (jan.spawning || jan.fatigue > 0) continue;
        if (!jan.heap) jan.heap = {};
        if (jan.heap.sleepUntil && Game.time < jan.heap.sleepUntil) continue;

        const carried = jan.store ? (jan.store[RESOURCE_ENERGY] || 0) : 0;
        const targetRoom = (jan.memory && jan.memory.targetRoom) || validOutposts[i % validOutposts.length];
        if (!targetRoom) {
            const jState = global.heap && global.heap.rooms ? global.heap.rooms[jan.room.name] : null;
            parkScoutOffRoad(jan, jState);
            jan.heap.actionIntent = 'idle';
            jan.heap.sleepUntil = Game.time + 25;
            continue;
        }

        const rState = global.heap && global.heap.rooms ? global.heap.rooms[targetRoom] : null;
        if (rState) {
            const sites = rState.constructionSites || [];
            const damagedContainers = (rState.containers || []).filter(c => c.hits < c.hitsMax * 0.7);
            const damagedRoads = (rState.roads || []).filter(s => s.hits < s.hitsMax * 0.5);
            if (sites.length === 0 && damagedContainers.length === 0 && damagedRoads.length === 0) {
                parkScoutOffRoad(jan, rState);
                jan.heap.actionIntent = 'idle';
                jan.heap.sleepUntil = Game.time + 25;
                continue;
            }
        }

        if (carried === 0) {
            // Need energy: withdraw from container or harvest
            if (jan.room.name !== targetRoom) {
                moveToRoomViaExit(jan, targetRoom, roomCenterPos(targetRoom), 15);
                continue;
            }
            const containers = (rState && rState.containers) || [];
            const energyContainer = containers.find(c => c.store && c.store[RESOURCE_ENERGY] >= 50);
            if (energyContainer) {
                if (calcDistance(jan.pos, energyContainer.pos) <= 1) jan.withdraw(energyContainer, RESOURCE_ENERGY);
                else moveCreep(jan, energyContainer.pos, 1);
            } else {
                const sources = (rState && rState.sources) || [];
                if (sources.length > 0) {
                    if (calcDistance(jan.pos, sources[0].pos) <= 1) jan.harvest(sources[0]);
                    else moveCreep(jan, sources[0].pos, 1);
                }
            }
        } else {
            // Repair or build
            if (jan.room.name !== targetRoom) {
                moveToRoomViaExit(jan, targetRoom, roomCenterPos(targetRoom), 15);
                continue;
            }
            const sites = (rState && rState.constructionSites) || [];
            const damagedContainers = ((rState && rState.containers) || []).filter(c => c.hits < c.hitsMax * 0.7);
            const damagedRoads = ((rState && rState.roads) || []).filter(s => s.hits < s.hitsMax * 0.5);

            if (damagedContainers.length > 0) {
                const target = damagedContainers[0];
                if (calcDistance(jan.pos, target.pos) <= 3) jan.repair(target);
                else moveCreep(jan, target.pos, 3);
            } else if (sites.length > 0) {
                const target = sites[0];
                if (calcDistance(jan.pos, target.pos) <= 3) jan.build(target);
                else moveCreep(jan, target.pos, 3);
            } else if (damagedRoads.length > 0) {
                const target = damagedRoads[0];
                if (calcDistance(jan.pos, target.pos) <= 3) jan.repair(target);
                else moveCreep(jan, target.pos, 3);
            }
        }
    }

    profLap('rem:janitors');
    // 8. Run Outpost Defenders: Patrol outposts, self-heal, engage hostiles/Invader Cores without sleeping
    for (let i = 0; i < outpostDefenders.length; i++) {
        const def = outpostDefenders[i];
        if (!def || def.spawning) continue;
        if (!def.heap) def.heap = {};
        const curState = global.heap && global.heap.rooms ? global.heap.rooms[def.room.name] : null;
        const curDanger = !!(curState && ((curState.hostiles && curState.hostiles.length > 0) || (curState.hostileStructures && curState.hostileStructures.length > 0)));
        if (curDanger) {
            def.heap.sleepUntil = 0;
        } else if (def.heap.sleepUntil && Game.time < def.heap.sleepUntil && def.hits === def.hitsMax) {
            continue;
        }

        const hasHeal = def.getActiveBodyparts && def.getActiveBodyparts(HEAL) > 0;
        const hasRanged = def.getActiveBodyparts && def.getActiveBodyparts(RANGED_ATTACK) > 0;
        const hasMelee = def.getActiveBodyparts && def.getActiveBodyparts(ATTACK) > 0;

        // Self heal if damaged
        if (hasHeal && def.hits < def.hitsMax) {
            def.heal(def);
        }

        const targetRoom = (def.memory && def.memory.targetRoom) || validOutposts[i % validOutposts.length];
        if (def.room.name !== targetRoom) {
            if (def.fatigue === 0) moveToRoomViaExit(def, targetRoom, roomCenterPos(targetRoom), 15);
            continue;
        }

        const rState = global.heap && global.heap.rooms ? global.heap.rooms[targetRoom] : null;
        const hostiles = (rState && rState.hostiles) || (def.room.find ? def.room.find(FIND_HOSTILE_CREEPS) : []);
        const hostileStructs = (rState && rState.hostileStructures) || [];
        const invCore = (rState && rState.invaderCore) || hostileStructs.find(s => s && s.structureType === 'invaderCore');

        if (hostiles.length > 0) {
            const target = hostiles[0];
            const dist = calcDistance(def.pos, target.pos);

            // Ranged + melee zero-idle execution (works even while fatigued)
            let rmaDmg = 0;
            let hasArmedR1 = false;
            for (let h = 0; h < hostiles.length; h++) {
                const hd = calcDistance(def.pos, hostiles[h].pos);
                if (hd > 3) continue;
                if (hd <= 1) {
                    rmaDmg += 10;
                    const p = hostiles[h].getActiveBodyparts;
                    if (p && (p.call(hostiles[h], ATTACK) > 0 || p.call(hostiles[h], RANGED_ATTACK) > 0 || p.call(hostiles[h], HEAL) > 0)) {
                        hasArmedR1 = true;
                    }
                } else if (hd === 2) rmaDmg += 4;
                else rmaDmg += 1;
            }
            if (hasRanged) {
                if (rmaDmg > 10 || hasArmedR1) def.rangedMassAttack();
                else if (dist <= 3) def.rangedAttack(target);
            }
            if (hasMelee && dist <= 1) def.attack(target);

            if (def.fatigue > 0) continue;

            const enemyHasMelee = target.getActiveBodyparts && target.getActiveBodyparts(ATTACK) > 0;
            if (hasRanged && !hasMelee && enemyHasMelee && dist <= 2) {
                const fleeX = def.pos.x + (def.pos.x - target.pos.x);
                const fleeY = def.pos.y + (def.pos.y - target.pos.y);
                moveCreep(def, { x: Math.max(2, Math.min(47, fleeX)), y: Math.max(2, Math.min(47, fleeY)), roomName: def.room.name }, 0);
            } else if (dist > (hasMelee ? 1 : 3)) {
                moveCreep(def, target.pos, hasMelee ? 1 : 3);
            }
        } else if (invCore || hostileStructs.length > 0) {
            const structTarget = invCore || hostileStructs[0];
            const sDist = calcDistance(def.pos, structTarget.pos);
            if (hasRanged && sDist <= 3) def.rangedAttack(structTarget);
            if (hasMelee && sDist <= 1) def.attack(structTarget);
            if (def.fatigue > 0) continue;
            if (sDist > (hasMelee ? 1 : 3)) moveCreep(def, structTarget.pos, hasMelee ? 1 : 3);
        } else if (def.fatigue === 0 && (def.pos.x <= 2 || def.pos.x >= 47 || def.pos.y <= 2 || def.pos.y >= 47 || calcDistance(def.pos, roomCenterPos(targetRoom)) > 15)) {
            moveCreep(def, roomCenterPos(targetRoom), 10);
        } else {
            def.heap.sleepUntil = Game.time + 5;
        }
    }

    profLap('rem:outpostDefenders');
    // 9. Run SK Guards & Healers: Coordinated Keeper Lair camping and clearing
    for (let i = 0; i < skGuards.length; i++) {
        const guard = skGuards[i];
        if (guard.spawning || guard.fatigue > 0) continue;
        if (!guard.heap) guard.heap = {};

        const partnerHealer = skHealers[i] || null;
        const targetRoom = (guard.memory && guard.memory.targetRoom) || null;
        if (!targetRoom) continue;

        if (partnerHealer && calcDistance(guard.pos, partnerHealer.pos) > 1) {
            if (partnerHealer.room.name === guard.room.name) {
                // Wait for healer to catch up
                moveCreep(guard, partnerHealer.pos, 1);
                continue;
            }
        }

        if (guard.room.name !== targetRoom) {
            moveToRoomViaExit(guard, targetRoom, roomCenterPos(targetRoom), 15);
            if (partnerHealer && !partnerHealer.spawning) {
                moveCreep(partnerHealer, guard.pos, 1);
            }
            continue;
        }

        // Inside SK Room: find Keepers or impending Lairs
        const rState = global.heap && global.heap.rooms ? global.heap.rooms[targetRoom] : null;
        const hostiles = (rState && rState.hostiles) || [];
        const keepers = hostiles.filter(h => h.owner && h.owner.username === 'Source Keeper');

        if (keepers.length > 0) {
            const target = keepers[0];
            const dist = calcDistance(guard.pos, target.pos);
            if (dist <= 3) {
                if (guard.getActiveBodyparts(RANGED_ATTACK) > 0) guard.rangedAttack(target);
            }
            if (dist <= 1) {
                guard.attack(target);
            } else {
                moveCreep(guard, target.pos, 1);
            }
        } else {
            // Pre-position next to the lair that will spawn first
            const lairType = (typeof global !== 'undefined' && global.STRUCTURE_KEEPER_LAIR) ? global.STRUCTURE_KEEPER_LAIR : 'keeperLair';
            const lairs = (rState && rState.keeperLairs && rState.keeperLairs.length > 0)
                ? rState.keeperLairs
                : (guard.room.find ? guard.room.find(FIND_STRUCTURES, { filter: s => s.structureType === lairType }) : []);
            if (lairs.length > 0) {
                lairs.sort((a, b) => (a.ticksToSpawn || 999) - (b.ticksToSpawn || 999));
                const nextLair = lairs[0];
                if (calcDistance(guard.pos, nextLair.pos) > 1) {
                    moveCreep(guard, nextLair.pos, 1);
                } else if ((nextLair.ticksToSpawn || 999) <= 15) {
                    guard.heap.inPosition = true;
                    guard.heap.actionIntent = 'attack';
                }
            }
        }

        // Partner healer sticks to guard like glue
        if (partnerHealer && !partnerHealer.spawning && partnerHealer.fatigue === 0) {
            partnerHealer.heal(guard);
            moveCreep(partnerHealer, guard.pos, 1);
        }
    }

    profLap('rem:skGuards');
    // 10. Run Highway Power Bank Strike Teams (KasamiBot Bank Robbers Pattern)
    for (let i = 0; i < bankAttackers.length; i++) {
        const attacker = bankAttackers[i];
        if (attacker.spawning || attacker.fatigue > 0) continue;
        const healer = bankHealers[i] || null;
        const targetRoom = attacker.memory.targetRoom;
        if (!targetRoom) continue;

        if (healer && calcDistance(attacker.pos, healer.pos) > 1 && healer.room.name === attacker.room.name) {
            moveCreep(attacker, healer.pos, 1);
            continue;
        }

        if (attacker.room.name !== targetRoom) {
            moveToRoomViaExit(attacker, targetRoom, roomCenterPos(targetRoom), 15);
            if (healer && !healer.spawning) moveCreep(healer, attacker.pos, 1);
            continue;
        }

        // Inside Power Bank Room
        const bank = getHighwayTarget(targetRoom, 'bank', attacker.room);

        if (bank) {
            const haulersInRoom = bankHaulers.filter(h => h.room.name === targetRoom).length;
            // Reflect guard: bank returns 50% of damage, so only strike with a healer on the attacker's tile neighbourhood
            const healerCovering = healer && !healer.spawning && healer.room.name === targetRoom && calcDistance(attacker.pos, healer.pos) <= 1;
            const isSafeToAttack = healerCovering && (attacker.hits > attacker.hitsMax * 0.5) && (bank.hits > 12000 || haulersInRoom >= 1);

            if (isSafeToAttack) {
                if (calcDistance(attacker.pos, bank.pos) <= 1) {
                    attacker.attack(bank);
                } else {
                    moveCreep(attacker, bank.pos, 1);
                }
            } else if (calcDistance(attacker.pos, bank.pos) > 2) {
                moveCreep(attacker, bank.pos, 2);
            }
        }

        if (healer && !healer.spawning && healer.fatigue === 0) {
            healer.heal(attacker);
            moveCreep(healer, attacker.pos, 1);
        }
    }

    // Run Bank Haulers: collect cracked power and transport directly to colony storage
    for (let i = 0; i < bankHaulers.length; i++) {
        const hauler = bankHaulers[i];
        if (hauler.spawning || hauler.fatigue > 0) continue;
        const targetRoom = hauler.memory.targetRoom;
        if (!targetRoom) continue;

        const carried = hauler.store ? hauler.store.getUsedCapacity(RESOURCE_POWER) : 0;
        const freeCap = hauler.store ? hauler.store.getFreeCapacity(RESOURCE_POWER) : 0;

        if (carried > 0 && (freeCap === 0 || hauler.room.name === colonyName)) {
            // Deliver to home storage
            if (hauler.room.name !== colonyName) {
                moveToRoomViaExit(hauler, colonyName, roomCenterPos(colonyName), 1);
            } else {
                const homeState = global.heap && global.heap.rooms ? global.heap.rooms[colonyName] : null;
                const storage = homeState && homeState.storage;
                if (storage) {
                    if (calcDistance(hauler.pos, storage.pos) <= 1) hauler.transfer(storage, RESOURCE_POWER);
                    else moveCreep(hauler, storage.pos, 1);
                }
            }
        } else {
            // Move to bank room and loot power
            if (hauler.room.name !== targetRoom) {
                moveToRoomViaExit(hauler, targetRoom, roomCenterPos(targetRoom), 15);
            } else {
                const drops = hauler.room.find ? hauler.room.find(FIND_DROPPED_RESOURCES, { filter: d => d.resourceType === RESOURCE_POWER }) : [];
                if (drops.length > 0) {
                    const drop = drops[0];
                    if (calcDistance(hauler.pos, drop.pos) <= 1) hauler.pickup(drop);
                    else moveCreep(hauler, drop.pos, 1);
                } else {
                    const banks = getHighwayTarget(targetRoom, 'bank', hauler.room);
                    if (banks) {
                        moveCreep(hauler, banks.pos, 3);
                    }
                }
            }
        }
    }

    profLap('rem:bankTeams');
    // 11. Run Highway Deposit Harvesters (Commodity Extraction)
    for (let i = 0; i < depositHarvesters.length; i++) {
        const harvester = depositHarvesters[i];
        if (!harvester || harvester.spawning || harvester.fatigue > 0) continue;

        const targetRoom = harvester.memory.targetRoom;
        if (!targetRoom) continue;

        const storeFree = (harvester.store && harvester.store.getFreeCapacity()) || 0;

        if (storeFree > 0 && harvester.ticksToLive > 150) {
            if (harvester.room.name !== targetRoom) {
                moveToRoomViaExit(harvester, targetRoom, roomCenterPos(targetRoom), 3);
            } else {
                const dep = getHighwayTarget(targetRoom, 'deposit', harvester.room);
                if (dep) {
                    if (calcDistance(harvester.pos, dep.pos) <= 1) {
                        if (!dep.cooldown || dep.cooldown === 0) {
                            harvester.harvest(dep);
                        }
                    } else {
                        moveCreep(harvester, dep.pos, 1);
                    }
                }
            }
        } else {
            const homeRoom = Game.rooms[harvester.memory.colony];
            if (harvester.room.name !== harvester.memory.colony) {
                moveToRoomViaExit(harvester, harvester.memory.colony, roomCenterPos(harvester.memory.colony), 3);
            } else if (homeRoom && (homeRoom.storage || homeRoom.terminal)) {
                const dest = homeRoom.storage || homeRoom.terminal;
                if (calcDistance(harvester.pos, dest.pos) <= 1) {
                    for (const resource in harvester.store) {
                        harvester.transfer(dest, resource);
                        break;
                    }
                } else {
                    moveCreep(harvester, dest.pos, 1);
                }
            }
        }
    }

    profLap('rem:deposits');
    return outposts;
}

function runObserver(roomName) {
    for (const rName in Game.rooms) {
        if (roomName && rName !== roomName) continue;
        const room = Game.rooms[rName];
        if (!room || !room.controller || !room.controller.my) continue;

        const rState = global.heap && global.heap.rooms ? global.heap.rooms[rName] : null;
        const observers = (rState && rState.observer) ? [rState.observer] : (room.find && room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_OBSERVER }));
        if (!observers.length) continue;

        // Check previously observed room for Power Banks & Highway Deposits
        const lastObs = room.memory.lastObservedHighway;
        if (lastObs && Game.rooms[lastObs]) {
            const obsRoom = Game.rooms[lastObs];
            const pType = (typeof global !== 'undefined' && global.STRUCTURE_POWER_BANK) ? global.STRUCTURE_POWER_BANK : 'powerBank';
            const pBanks = obsRoom.find ? obsRoom.find(FIND_STRUCTURES, { filter: s => s.structureType === pType }) : [];
            if (pBanks.length > 0 && pBanks[0].power >= 1500 && pBanks[0].ticksToDecay >= 2500) {
                if (typeof Memory !== 'undefined' && Memory.empire) {
                    if (!Memory.empire.powerBanks) Memory.empire.powerBanks = {};
                    Memory.empire.powerBanks[lastObs] = {
                        id: pBanks[0].id,
                        x: pBanks[0].pos.x,
                        y: pBanks[0].pos.y,
                        roomName: lastObs,
                        power: pBanks[0].power,
                        decayAt: Game.time + pBanks[0].ticksToDecay,
                        hits: pBanks[0].hits,
                        colony: rName
                    };
                    setSegmentData(11, JSON.stringify(Memory.empire.powerBanks));
                }
            }

            // Highway Deposit Scan (Commodities: silicon, metal, biomass, mist)
            const findDeposits = (typeof global !== 'undefined' && global.FIND_DEPOSITS) ? global.FIND_DEPOSITS : 122;
            const deposits = obsRoom.find ? obsRoom.find(findDeposits) : [];
            if (deposits.length > 0) {
                const dep = deposits[0];
                if ((!dep.lastCooldown || dep.lastCooldown <= 100) && dep.ticksToDecay >= 1000) {
                    if (typeof Memory !== 'undefined' && Memory.empire) {
                        if (!Memory.empire.deposits) Memory.empire.deposits = {};
                        Memory.empire.deposits[lastObs] = {
                            id: dep.id,
                            depositType: dep.depositType,
                            x: dep.pos.x,
                            y: dep.pos.y,
                            roomName: lastObs,
                            lastCooldown: dep.lastCooldown || 0,
                            decayAt: Game.time + dep.ticksToDecay,
                            colony: rName
                        };
                        setSegmentData(10, JSON.stringify(Memory.empire.deposits));
                    }
                }
            }
        }

        // Priority Pre-Expiry Citadel Reconnaissance: observe rival rooms with <= 500 ticks remaining on Safe Mode!
        let observedPreExpiry = false;
        if (global.heap && global.heap.rivalCitadelStorage) {
            for (const cRoom in global.heap.rivalCitadelStorage) {
                const prof = global.heap.rivalCitadelStorage[cRoom];
                if (!prof || isFriendlyOrEmpireRoom(cRoom)) continue;
                const smRem = getRivalSafeModeRemaining(prof);
                if (smRem > 0 && smRem <= 500) {
                    if (Game.map && Game.map.getRoomLinearDistance(rName, cRoom) <= 10) {
                        const lastSeen = prof.tick || 0;
                        if ((Game.time - lastSeen) > 20) {
                            observers[0].observeRoom(cRoom);
                            observedPreExpiry = true;
                            break;
                        }
                    }
                }
            }
        }
        if (observedPreExpiry) continue;

        // Periodic sweep of rival citadels (even % 4 === 0), outposts, & highway corridors
        const enemyList = (typeof Memory !== 'undefined' && Memory.empire && Array.isArray(Memory.empire.enemyRooms)) ? Memory.empire.enemyRooms : [];
        const outposts = evaluateColonyOutposts(rName);
        if (enemyList.length > 0 && Game.time % 4 === 0) {
            const eRoom = enemyList[(Game.time >> 2) % enemyList.length];
            if (eRoom && Game.map.getRoomLinearDistance(rName, eRoom) <= 10) {
                observers[0].observeRoom(eRoom);
                continue;
            }
        }
        if (outposts.length > 0 && Game.time % 2 !== 0) {
            const targetOutpost = outposts[Game.time % outposts.length];
            observers[0].observeRoom(targetOutpost);
        } else if (Game.map && Game.map.describeExits) {
            // Highway power bank sweep
            const match = rName.match(/^([WE])(\d+)([NS])(\d+)$/);
            if (match) {
                const we = match[1], x = parseInt(match[2], 10);
                const ns = match[3], y = parseInt(match[4], 10);
                const hwX = Math.round(x / 10) * 10;
                const hwY = Math.round(y / 10) * 10;
                const highwayRoom = `${we}${hwX}${ns}${hwY}`;
                if (highwayRoom !== rName) {
                    observers[0].observeRoom(highwayRoom);
                    room.memory.lastObservedHighway = highwayRoom;
                }
            }
        }
    }
}

function isHighwayCoord(roomName) {
    if (!roomName) return false;
    const match = roomName.match(/^[WE](\d+)[NS](\d+)$/);
    if (!match) return true;
    const modX = parseInt(match[1], 10) % 10;
    const modY = parseInt(match[2], 10) % 10;
    return modX === 0 || modY === 0;
}

function getScoutInfoSafe(roomName) {
    if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].scoutData) {
        return Memory.rooms[roomName].scoutData;
    }
    return (global.heap && global.heap.remoteRooms) ? global.heap.remoteRooms[roomName] : null;
}

function getEligibleSponsorsForExpansion(cfg) {
    if (typeof Game === 'undefined' || !Game.rooms) return [];
    const c = cfg || getConfig();
    const minRcl = c.minSponsorRcl !== undefined ? c.minSponsorRcl : 4;
    const minEnergy = c.minSponsorEnergy !== undefined ? c.minSponsorEnergy : 100000;
    const sponsors = [];

    for (const rName in Game.rooms) {
        const r = Game.rooms[rName];
        if (!r || !r.controller || !r.controller.my) continue;
        if ((r.controller.level || 0) < minRcl) continue;
        const rState = global.heap && global.heap.rooms ? global.heap.rooms[rName] : null;
        if (rState && rState.armedHostiles && rState.armedHostiles.length > 0) continue;
        const st = (rState && rState.storage) || r.storage;
        const stEnergy = (st && st.store) ? (st.store[RESOURCE_ENERGY] || 0) : 0;
        if (stEnergy < minEnergy) continue;
        sponsors.push(rName);
    }
    return sponsors;
}

function getCachedExpansionRouteLength(fromRoom, toRoom) {
    if (!fromRoom || !toRoom) return Infinity;
    if (fromRoom === toRoom) return 0;
    if (typeof Game === 'undefined' || !Game.map || !Game.map.findRoute) return 1;

    if (!global.heap) global.heap = {};
    if (!global.heap._expRouteCache) global.heap._expRouteCache = {};
    const key = `${fromRoom}:${toRoom}`;
    const now = Game.time !== undefined ? Game.time : 0;
    const cached = global.heap._expRouteCache[key];
    if (cached && now >= cached.tick && (now - cached.tick) < 500) {
        return cached.routeLen;
    }

    const route = Game.map.findRoute(fromRoom, toRoom, {
        routeCallback(rName) {
            if (rName === fromRoom || rName === toRoom) return 1;
            if (isSKOrCenterRoom(rName) || !isNormalStatusRoom(rName)) return Infinity;
            return 1;
        }
    });
    const routeLen = Array.isArray(route) ? route.length : Infinity;
    global.heap._expRouteCache[key] = { routeLen, tick: now };
    return routeLen;
}

// =========================================================================
// AUTONOMOUS IMPERIAL EXPANSION ENGINE (AIEE)
// Evaluates scouted candidate rooms against our territorial & logistics matrix
// =========================================================================

function scoreExpansionCandidate(candidateRoomName, myColonies, activeOutposts, mineralNeeds, rivalCitadels, opts) {
    if (!candidateRoomName) return -Infinity;
    if (isSKOrCenterRoom(candidateRoomName) || !isNormalStatusRoom(candidateRoomName)) return -Infinity;

    const cfg = (opts && opts.cfg) || getConfig();
    const scoutData = getScoutInfoSafe(candidateRoomName);

    if (!scoutData) return -Infinity;
    if (scoutData.roomType !== 'normal' || scoutData.isSourceKeeper || scoutData.isHighway) return -Infinity;
    if (!scoutData.controller) return -Infinity;
    if (scoutData.controller.owner) return -Infinity; // Reject player-claimed rooms
    const myUsername = (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.myUsername) || null;
    const ctrlRes = scoutData.controller.reservation;
    if (scoutData.safe === false || scoutData.invaderCoreLevel > 0 || scoutData.threatLevel === 'invader_core' || scoutData.threatLevel === 'hostile_active' ||
        isRemoteExcluded(candidateRoomName) || (ctrlRes && (!myUsername || ctrlRes !== myUsername))) {
        return -Infinity;
    }

    // Strict 2-source gate: never colonize 1-source rooms
    const sourceCount = scoutData.sources ? scoutData.sources.length : (scoutData.sourceCount || 0);
    if (sourceCount < 2) return -Infinity;

    // Never cannibalize an active outpost of an existing colony
    if (activeOutposts && activeOutposts.has(candidateRoomName)) return -Infinity;

    const linearDist = (a, b) => (typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance) ? Game.map.getRoomLinearDistance(a, b) : 1;
    const minColonyDist = cfg.minColonyDistance !== undefined ? cfg.minColonyDistance : 4;
    const maxColonyDist = cfg.maxColonyDistance !== undefined ? cfg.maxColonyDistance : 7;

    // Spacing gate against ALL owned colonies AND active in-flight targets
    let minDistToAny = Infinity;
    if (myColonies) {
        for (let i = 0; i < myColonies.length; i++) {
            const d = linearDist(myColonies[i], candidateRoomName);
            if (d < minDistToAny) minDistToAny = d;
        }
    }
    if (opts && Array.isArray(opts.activeTargets)) {
        for (let i = 0; i < opts.activeTargets.length; i++) {
            const at = opts.activeTargets[i];
            if (!at || at === candidateRoomName) continue;
            const d = linearDist(at, candidateRoomName);
            if (d < minDistToAny) minDistToAny = d;
        }
    }
    if (minDistToAny < minColonyDist) return -Infinity;

    // Logistic ceiling & closest mature sponsor lookup
    const sponsorList = (opts && opts.eligibleSponsors && opts.eligibleSponsors.length > 0) ? opts.eligibleSponsors : myColonies;
    let closestSponsor = null;
    let minDistToSponsor = Infinity;
    if (sponsorList) {
        for (let i = 0; i < sponsorList.length; i++) {
            const d = linearDist(sponsorList[i], candidateRoomName);
            if (d < minDistToSponsor) {
                minDistToSponsor = d;
                closestSponsor = sponsorList[i];
            }
        }
    }
    if (minDistToSponsor > maxColonyDist) return -Infinity;

    // Claimer Route Distance Guard (<= 9 rooms so 600-TTL claimers never die en route)
    if (closestSponsor) {
        const routeLen = getCachedExpansionRouteLength(closestSponsor, candidateRoomName);
        if (!Number.isFinite(routeLen) || routeLen > 9) return -Infinity;
    }

    let score = 0;

    // 1. Source Capacity: 2+ sources mandatory
    score += 500;

    // 2. Mineral Diversity: prioritize Catalyst (X) and unowned minerals for T3 boosts
    const mineralType = scoutData.mineral ? (scoutData.mineral.mineralType || scoutData.mineral) : null;
    if (mineralType) {
        if (mineralType === 'X' && (!mineralNeeds || mineralNeeds.has('X'))) {
            score += 400;
        } else if (mineralNeeds && mineralNeeds.has(mineralType)) {
            score += 300;
        } else if (mineralType === 'X') {
            score += 150;
        } else {
            score += 50;
        }
    }

    // 3. Territorial Distance Band [minColonyDistance..maxColonyDistance]
    if (minDistToSponsor <= 5) {
        score += 120;
    } else if (minDistToSponsor <= 7) {
        score += 60;
    } else {
        score += 20;
    }

    // 4. Distance to Known Rival Citadels (Strategic Rear vs Danger Zone)
    if (rivalCitadels && rivalCitadels.length > 0) {
        let minDistToRival = Infinity;
        for (let r = 0; r < rivalCitadels.length; r++) {
            const rd = linearDist(rivalCitadels[r], candidateRoomName);
            if (rd < minDistToRival) minDistToRival = rd;
        }
        if (minDistToRival <= 2) {
            score -= 400; // Dangerous border friction
        } else if (minDistToRival >= 4) {
            score += 100; // Safe strategic depth
        }
    }

    // 5. Defensibility (Min-Cut Rampart Efficiency + Anchor DT)
    const rampartCount = scoutData.minCutRampartCount || (scoutData.combatProfile ? scoutData.combatProfile.minRampartCount : null);
    if (rampartCount !== null && rampartCount !== undefined) {
        if (rampartCount <= 18) score += 250; // Natural choke/cavern fortress
        else if (rampartCount <= 26) score += 120;
        else if (rampartCount > 34) score -= 150; // Wide open plain
    }
    const anchorDt = scoutData.anchorDt || 0;
    if (anchorDt >= 5) score += 150;
    else if (anchorDt >= 4) score += 80;

    // 6. 1-2 Hop Unclaimed Outpost Halo
    if (typeof Game !== 'undefined' && Game.map && Game.map.describeExits) {
        const isHaloEligible = (rm, info) => {
            if (!rm || isSKOrCenterRoom(rm) || !isNormalStatusRoom(rm)) return false;
            if (myColonies && myColonies.includes(rm)) return false;
            if (activeOutposts && activeOutposts.has(rm)) return false;
            if (info) {
                if (info.isHighway || info.isSourceKeeper) return false;
                if (info.controller && info.controller.owner) return false;
            } else if (isHighwayCoord(rm)) {
                return false;
            }
            return true;
        };

        const visited = new Set([candidateRoomName]);
        const hop1Pass = [];
        const exits1 = Game.map.describeExits(candidateRoomName);
        if (exits1) {
            for (const dir in exits1) {
                const adj1 = exits1[dir];
                if (!adj1 || visited.has(adj1)) continue;
                visited.add(adj1);
                const info1 = getScoutInfoSafe(adj1);
                if (isHaloEligible(adj1, info1)) {
                    score += 45;
                    hop1Pass.push(adj1);
                } else if (!isSKOrCenterRoom(adj1) && isNormalStatusRoom(adj1)) {
                    hop1Pass.push(adj1);
                }
            }
        }
        for (let h = 0; h < hop1Pass.length; h++) {
            const exits2 = Game.map.describeExits(hop1Pass[h]);
            if (!exits2) continue;
            for (const dir2 in exits2) {
                const adj2 = exits2[dir2];
                if (!adj2 || visited.has(adj2)) continue;
                visited.add(adj2);
                const info2 = getScoutInfoSafe(adj2);
                if (isHaloEligible(adj2, info2)) {
                    score += 20;
                }
            }
        }
    }

    // 7. Active Hostile Penalties
    if (scoutData.invaderCoreLevel > 0) score -= 100;
    if (scoutData.threatLevel === 'hostile_active') score -= 200;

    return score;
}

function findBestExpansionTarget(homeRoomName) {
    if (typeof Game === 'undefined' || !Game.rooms) return null;

    // 1. Gather colonies & validate Config/GCL/Anti-Tumor/CPU/Sponsor hard empire gates
    const myColonies = [];
    for (const rName in Game.rooms) {
        const r = Game.rooms[rName];
        if (r && r.controller && r.controller.my) myColonies.push(rName);
    }
    const cfg = getConfig();
    if (!cfg.autoExpand) return null;

    const gclLevel = (typeof Game !== 'undefined' && Game.gcl) ? Game.gcl.level : 1;
    if (myColonies.length >= Math.min(gclLevel, cfg.maxColonies)) return null;

    const maxBoot = cfg.maxBootstrappingColonies !== undefined ? cfg.maxBootstrappingColonies : 1;
    if (countBootstrappingColonies() >= maxBoot) return null;

    const bucket = (Game.cpu && Game.cpu.bucket !== undefined) ? Game.cpu.bucket : 10000;
    if (bucket < (cfg.cpuBucketFloor !== undefined ? cfg.cpuBucketFloor : 8000)) return null;

    const cpuTarget = cfg.cpuTarget !== undefined ? cfg.cpuTarget : 15;
    const cpuHeadroom = cfg.expansionCpuHeadroom !== undefined ? cfg.expansionCpuHeadroom : 3.0;
    if (global.heap && global.heap.cpuMean50 !== undefined && global.heap.cpuMean50 > (cpuTarget - cpuHeadroom)) {
        return null;
    }

    const eligibleSponsors = getEligibleSponsorsForExpansion(cfg);
    if (eligibleSponsors.length === 0) return null;
    if (homeRoomName && !eligibleSponsors.includes(homeRoomName)) return null;

    // 2. Assemble context early so in-flight target can also be validated against spacing/route bounds
    const activeOutposts = new Set();
    if (typeof Memory !== 'undefined') {
        if (Memory.empire && Memory.empire.outpostOwners) {
            for (const o in Memory.empire.outpostOwners) activeOutposts.add(o);
        }
        if (Memory.rooms) {
            for (const r in Memory.rooms) {
                if (Memory.rooms[r] && Array.isArray(Memory.rooms[r].outposts)) {
                    for (let i = 0; i < Memory.rooms[r].outposts.length; i++) {
                        activeOutposts.add(Memory.rooms[r].outposts[i]);
                    }
                }
            }
        }
    }

    const ownedMinerals = new Set();
    for (let i = 0; i < myColonies.length; i++) {
        const colState = global.heap && global.heap.rooms ? global.heap.rooms[myColonies[i]] : null;
        if (colState && colState.mineral && colState.mineral.mineralType) {
            ownedMinerals.add(colState.mineral.mineralType);
        }
    }
    const allMinerals = ['H', 'O', 'U', 'K', 'L', 'Z', 'X'];
    const mineralNeeds = new Set(allMinerals.filter(m => !ownedMinerals.has(m)));

    const rivalCitadels = [];
    if (typeof Memory !== 'undefined' && Memory.empire && Array.isArray(Memory.empire.enemyRooms)) {
        for (let i = 0; i < Memory.empire.enemyRooms.length; i++) {
            rivalCitadels.push(Memory.empire.enemyRooms[i]);
        }
    }
    if (global.heap && global.heap.rivalCitadelStorage) {
        for (const rn in global.heap.rivalCitadelStorage) {
            if (!rivalCitadels.includes(rn)) rivalCitadels.push(rn);
        }
    }

    const activeTargets = [];

    // 3. Existing Target In-Flight Check
    if (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.expansionTarget) {
        const currentTarget = Memory.empire.expansionTarget;
        const tInfo = getScoutInfoSafe(currentTarget);
        const myUsername = (Memory.empire && Memory.empire.myUsername) || null;
        const tRes = tInfo && ((tInfo.controller && tInfo.controller.reservation) || tInfo.reservation);
        const invalidTarget = !!(tInfo && (tInfo.safe === false || tInfo.invaderCoreLevel > 0 || tInfo.threatLevel === 'invader_core' || tInfo.threatLevel === 'hostile_active' ||
            isRemoteExcluded(currentTarget) || (tRes && (!myUsername || tRes !== myUsername))));

        let spacingOrRouteBad = false;
        if (!invalidTarget) {
            const linearDist = (a, b) => (typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance) ? Game.map.getRoomLinearDistance(a, b) : 1;
            let minColD = Infinity;
            for (let i = 0; i < myColonies.length; i++) {
                if (myColonies[i] === currentTarget) continue;
                const d = linearDist(myColonies[i], currentTarget);
                if (d < minColD) minColD = d;
            }
            let closestSp = null;
            let minSpD = Infinity;
            for (let i = 0; i < eligibleSponsors.length; i++) {
                const d = linearDist(eligibleSponsors[i], currentTarget);
                if (d < minSpD) {
                    minSpD = d;
                    closestSp = eligibleSponsors[i];
                }
            }
            const minCfgD = cfg.minColonyDistance !== undefined ? cfg.minColonyDistance : 4;
            const maxCfgD = cfg.maxColonyDistance !== undefined ? cfg.maxColonyDistance : 7;
            if (minColD < minCfgD || minSpD > maxCfgD) spacingOrRouteBad = true;
            else if (closestSp) {
                const rLen = getCachedExpansionRouteLength(closestSp, currentTarget);
                if (!Number.isFinite(rLen) || rLen > 9) spacingOrRouteBad = true;
            }
        }

        if (invalidTarget || spacingOrRouteBad) {
            delete Memory.empire.expansionTarget;
        } else {
            const targetRoom = Game.rooms[currentTarget];
            if (targetRoom && targetRoom.controller) {
                if (targetRoom.controller.my) {
                    const spCount = targetRoom.find ? targetRoom.find(FIND_MY_SPAWNS).length : 0;
                    if (spCount > 0) {
                        delete Memory.empire.expansionTarget;
                    } else {
                        return currentTarget;
                    }
                } else if (targetRoom.controller.owner) {
                    delete Memory.empire.expansionTarget;
                } else {
                    return currentTarget;
                }
            } else {
                return currentTarget;
            }
        }
    }

    // 4. Evaluate all scouted candidate rooms
    const scoreOpts = { cfg, eligibleSponsors, activeTargets };
    let bestCandidate = null;
    let highestScore = -Infinity;

    const scoutSource = (typeof Memory !== 'undefined' && Memory.rooms) ? Memory.rooms : {};
    for (const rName in scoutSource) {
        if (!scoutSource[rName] || !scoutSource[rName].scoutData) continue;
        const score = scoreExpansionCandidate(rName, myColonies, activeOutposts, mineralNeeds, rivalCitadels, scoreOpts);
        if (score > highestScore && score > 0) {
            highestScore = score;
            bestCandidate = rName;
        }
    }

    if (global.heap && global.heap.remoteRooms) {
        for (const rName in global.heap.remoteRooms) {
            if (scoutSource[rName] && scoutSource[rName].scoutData) continue;
            const score = scoreExpansionCandidate(rName, myColonies, activeOutposts, mineralNeeds, rivalCitadels, scoreOpts);
            if (score > highestScore && score > 0) {
                highestScore = score;
                bestCandidate = rName;
            }
        }
    }

    if (bestCandidate) {
        if (typeof Memory !== 'undefined') {
            if (!Memory.empire) Memory.empire = {};
            Memory.empire.expansionTarget = bestCandidate;
        }
        return bestCandidate;
    }

    return null;
}

module.exports = {
    assessOutpostViability,
    evaluateColonyOutposts,
    findBestExpansionTarget,
    getEligibleSponsorsForExpansion,
    getNextScoutTarget,
    getRemoteOutpostCap,
    moveToRoomViaExit,
    partitionEmpireOutposts,
    pickNextScoutRoom,
    planOutposts,
    runObserver,
    scoreExpansionCandidate,
    selectSiegeTarget
};
