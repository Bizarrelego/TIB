// src/workers.js
// Dedicated Upgrader & Builder Muscle: Container Circle Upgrading, 6-Tier Energy Supply & Prioritized Building
const { roomCenterPos, calcDistance } = require('./constants');
const { moveCreep } = require('./traffic');
const { getEffectiveStore, getEffectiveFreeCapacity } = require('./state');
const { moveToRoomViaExit } = require('./remotes');
const { getRoomBlueprint } = require('./bunker');
const { getRampartBaseline } = require('./config');

const SITE_PRIORITY = {
    [STRUCTURE_SPAWN]: 1,
    [STRUCTURE_TOWER]: 2,
    [STRUCTURE_CONTAINER]: 3,
    [STRUCTURE_EXTENSION]: 4,
    [STRUCTURE_RAMPART]: 5,
    [STRUCTURE_STORAGE]: 6,
    [STRUCTURE_ROAD]: 7
};

function getSitePriority(site) {
    if (!site || !site.structureType) return 99;
    return SITE_PRIORITY[site.structureType] || 10;
}

function isSiteBlacklisted(siteId) {
    if (!global.heap || !global.heap.blacklistedSites) return false;
    const bl = global.heap.blacklistedSites;
    const now = (typeof Game !== 'undefined') ? Game.time : 0;
    for (let i = 0; i < bl.length; i += 2) {
        if (bl[i] === siteId) {
            if (bl[i + 1] > now) return true;
            bl.splice(i, 2);
            return false;
        }
    }
    return false;
}

function blacklistSite(siteId, duration = 500) {
    if (!global.heap) global.heap = {};
    if (!global.heap.blacklistedSites) global.heap.blacklistedSites = [];
    const bl = global.heap.blacklistedSites;
    const now = (typeof Game !== 'undefined') ? Game.time : 0;
    const expireTick = now + duration;
    for (let i = 0; i < bl.length; i += 2) {
        if (bl[i] === siteId) {
            bl[i + 1] = Math.max(bl[i + 1], expireTick);
            return;
        }
    }
    bl.push(siteId, expireTick);
}

function selectRoomWorkerTargets(roomName, state, forceRefresh) {
    if (!state) return { primarySite: null, primaryRepair: null };
    if (!global.heap) global.heap = {};
    if (!global.heap.workerTargets) global.heap.workerTargets = {};
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    const cached = global.heap.workerTargets[roomName];
    if (!forceRefresh && cached && now < cached.expires) {
        const sObj = cached.siteId ? Game.getObjectById(cached.siteId) : null;
        const rObj = cached.repairId ? Game.getObjectById(cached.repairId) : null;
        if ((!cached.siteId || sObj) && (!cached.repairId || rObj)) {
            state.primarySiteId = cached.siteId || null;
            state.primaryRepairId = cached.repairId || null;
            return { primarySite: sObj, primaryRepair: rObj };
        }
    }

    const rawSites = (state.constructionSites || []).filter(s => !isSiteBlacklisted(s.id));
    rawSites.sort((a, b) => getSitePriority(a) - getSitePriority(b));
    let primarySite = rawSites.length > 0 ? rawSites[0] : null;
    if (!primarySite) {
        const colony = global.heap.colonies ? global.heap.colonies[roomName] : null;
        const outposts = (colony && colony.outposts) || (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) || [];
        for (let o = 0; o < outposts.length; o++) {
            const oState = global.heap.rooms ? global.heap.rooms[outposts[o]] : null;
            if (oState && oState.safe !== false && oState.constructionSites && oState.constructionSites.length > 0) {
                const prioritized = oState.constructionSites.filter(s => !isSiteBlacklisted(s.id)).slice().sort((a, b) => getSitePriority(a) - getSitePriority(b));
                if (prioritized.length > 0) { primarySite = prioritized[0]; break; }
            }
        }
    }

    const containers = state.containers || [];
    const damagedContainer = containers.find(cnt => cnt.hits < cnt.hitsMax * 0.5) || null;
    const siteId = primarySite ? primarySite.id : null;
    const repairId = damagedContainer ? damagedContainer.id : null;
    state.primarySiteId = siteId;
    state.primaryRepairId = repairId;
    global.heap.workerTargets[roomName] = { siteId, repairId, expires: now + 5 };
    return { primarySite, primaryRepair: damagedContainer };
}

function upgradersCount(state) {
    return (state && state.creepsByRole && state.creepsByRole.upgrader) ? state.creepsByRole.upgrader.length : 0;
}

function findUpgraderSupply(c, state, room, cContainer, cLink) {
    const controller = state.controller;
    const dropped = state.droppedEnergy || [];
    const containers = state.containers || [];
    const storage = state.storage;
    const spawns = state.spawns || [];
    const sources = state.sources || [];
    const harvesters = (state.creepsByRole && state.creepsByRole.harvester) || [];
    const haulers = (state.creepsByRole && state.creepsByRole.hauler) || [];

    // 1. Dropped energy within range 4 of controller (pickup)
    const ctrlDrop = dropped.find(d => calcDistance(d.pos, controller.pos) <= 4 && getEffectiveStore(d) >= 15);
    if (ctrlDrop) return { target: ctrlDrop, action: 'pickup' };

    // 2. roomState.controllerContainer or Controller Link (withdraw)
    if (cLink && getEffectiveStore(cLink) > 0) return { target: cLink, action: 'withdraw' };
    if (cContainer && getEffectiveStore(cContainer) > 0) return { target: cContainer, action: 'withdraw' };

    // 3. Storage with EMERGENCY BUFFER PROTECTION!
    // When storage exists (RCL 4+), NEVER withdraw below 20,000 energy unless controller downgrade is critical!
    if (storage) {
        const stored = getEffectiveStore(storage);
        const emergency = controller && controller.ticksToDowngrade < 5000;
        if (stored >= 20000 || (emergency && stored >= 50)) {
            return { target: storage, action: 'withdraw' };
        }
    }

    // 4. Any other container with getEffectiveStore >= 50 (only if no storage or storage is healthy)
    if (!storage) {
        const otherCont = containers.find(cnt => getEffectiveStore(cnt) >= 50);
        if (otherCont) return { target: otherCont, action: 'withdraw' };
    }

    // 4. Dropped energy near controller or closer source (never walk >15 tiles across the room when a hauler exists!)
    let bestDrop = null;
    let bestScore = -Infinity;
    const maxDropDist = haulers.length > 0 ? 15 : 50;
    for (let i = 0; i < dropped.length; i++) {
        const d = dropped[i];
        const eff = getEffectiveStore(d);
        if (eff >= 10) {
            const distFromCtrl = calcDistance(controller.pos, d.pos);
            if (distFromCtrl > maxDropDist && calcDistance(c.pos, d.pos) > 10) continue;
            const score = eff - calcDistance(c.pos, d.pos) * 4 - distFromCtrl * 2;
            if (score > bestScore) {
                bestScore = score;
                bestDrop = d;
            }
        }
    }
    if (bestDrop) return { target: bestDrop, action: 'pickup' };

    // 5. Spawn1 surplus energy (when >= 2 harvesters + >= 1 hauler exist)
    if (harvesters.length >= 2 && haulers.length >= 1 && spawns.length > 0) {
        const sp = spawns[0];
        const upCount = upgradersCount(state);
        const sprintDone = (room.controller.level === 1 && upCount >= 2) ||
            (room.controller.level === 2 && haulers.length >= 2 && upCount >= 4);
        const minReserve = sprintDone ? 0 : 200;
        if (sp.store && sp.store[RESOURCE_ENERGY] > minReserve + 20) {
            return { target: sp, action: 'withdraw', amount: Math.min(c.store.getFreeCapacity(RESOURCE_ENERGY), sp.store[RESOURCE_ENERGY] - minReserve) };
        }
    }

    // 6. Direct source harvest fallback if haulers.length === 0
    if (haulers.length === 0 && sources.length > 0) {
        const activeSrc = sources.find(s => s.energy > 0) || sources[0];
        return { target: activeSrc, action: 'harvest' };
    }

    return null;
}

function runWorkers(roomName) {
    if (typeof Game === 'undefined' || !Game.creeps) return;

    const state = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    if (!state) return;

    const room = Game.rooms[roomName];
    if (!room) return;
    const controller = state.controller;
    if (!controller) return;

    const sites = (state.constructionSites || []).filter(s => !isSiteBlacklisted(s.id)).slice().sort((a, b) => getSitePriority(a) - getSitePriority(b));
    const containers = state.containers || [];
    const links = state.links || [];
    const dropped = state.droppedEnergy || [];
    const storage = state.storage;
    const spawns = state.spawns || [];

    // 1. Run Upgraders (Container Circle, Nonstop Simultaneous Withdraw + Upgrade & 6-Tier Supply)
    // Siege lockdown, RCL 4 FOB lock, or Necrosis flood halts upgrading unless controller downgrade is near
    const isFobLocked = !!(room.memory && room.memory.fob === true && controller.level >= 4 && room.energyCapacityAvailable >= 1300);
    const isNecrosisActive = !!(global.heap && global.heap.necrosis && global.heap.necrosis.active);
    const lockedDown = (!!(global.heap && global.heap.lockdown && global.heap.lockdown[roomName] > Game.time) || isFobLocked || isNecrosisActive) &&
        !(controller.ticksToDowngrade < 5000);
    const col = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
    const upgraders = lockedDown ? [] : ((col && col.creepsByRole && col.creepsByRole.upgrader && col.creepsByRole.upgrader.length > 0)
        ? col.creepsByRole.upgrader
        : ((state.creepsByRole && state.creepsByRole.upgrader) || []));

    const cContainer = state.controllerContainer || containers.find(cnt => calcDistance(cnt.pos, controller.pos) <= 3);
    const cLink = links.find(l => calcDistance(l.pos, controller.pos) <= 3) || null;
    const circleAnchorPos = cLink ? cLink.pos : (cContainer ? cContainer.pos : (state.controllerContainerPos || null));
    const terrain = room.getTerrain ? room.getTerrain() : { get: () => 0 };
    const hubPos = spawns.length > 0 ? spawns[0].pos : (storage ? storage.pos : { x: 25, y: 25 });

    let upgraderSpots = [];

    if (!cLink && state.upgradeArcTiles && state.upgradeArcTiles.length > 0) {
        upgraderSpots = state.upgradeArcTiles;
    } else if (circleAnchorPos) {
        const candidates = [];
        const anchorPos = circleAnchorPos;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = anchorPos.x + dx;
                const y = anchorPos.y + dy;
                if (x <= 1 || x >= 48 || y <= 1 || y >= 48) continue;
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                if (calcDistance({ x, y }, controller.pos) <= 3) {
                    candidates.push({ x, y, distToHub: calcDistance({ x, y }, hubPos) });
                }
            }
        }
        candidates.sort((a, b) => a.distToHub - b.distToHub);
        upgraderSpots = candidates;
    }

    const dockTiles = !cLink ? state.controllerDockTiles : null;
    const dockContainerPos = cContainer ? cContainer.pos : state.controllerContainerPos;
    const isDockPos = (pos) => {
        if (!cLink && dockContainerPos && pos.x === dockContainerPos.x && pos.y === dockContainerPos.y) return true;
        if (dockTiles) {
            const packed = pos.x * 50 + pos.y;
            if (dockTiles[0] === packed || dockTiles[1] === packed) return true;
        }
        return false;
    };

    const claimedSpots = {};
    if (circleAnchorPos) {
        for (let i = 0; i < upgraders.length; i++) {
            const c = upgraders[i];
            if (c.spawning) continue;
            if (isDockPos(c.pos)) {
                if (!c.heap) c.heap = {};
                c.heap.inPosition = false;
                continue;
            }
            const dAnchor = calcDistance(c.pos, circleAnchorPos);
            const dCtrl = calcDistance(c.pos, controller.pos);
            if (dAnchor <= 2 && dCtrl <= 3) {
                claimedSpots[`${c.pos.x},${c.pos.y}`] = c.id;
                if (!c.heap) c.heap = {};
                c.heap.inPosition = true;
                c.heap.nextStep = null;
            }
        }
    }

    const ctrlDropped = dropped.some(d => d.amount > 0 && calcDistance(d.pos, controller.pos) <= 4);

    for (let i = 0; i < upgraders.length; i++) {
        const c = upgraders[i];
        if (c.spawning) continue;
        if (!c.heap) c.heap = {};

        const carried = c.store ? (c.store[RESOURCE_ENERGY] || 0) : 0;
        const freeCap = c.store ? c.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
        const linkEnergy = (cLink && cLink.store) ? (cLink.store[RESOURCE_ENERGY] || 0) : 0;
        const contEnergy = (cContainer && cContainer.store) ? (cContainer.store[RESOURCE_ENERGY] || 0) : 0;

        if (circleAnchorPos && (linkEnergy > 0 || contEnergy > 0 || carried > 0 || ctrlDropped)) {
            const distToAnchor = calcDistance(c.pos, circleAnchorPos);
            const distToCtrl = calcDistance(c.pos, controller.pos);
            const onDock = isDockPos(c.pos);

            if (!onDock && distToAnchor <= 1 && distToCtrl <= 3) {
                c.heap.inPosition = true;
                c.heap.nextStep = null;
            } else if (!onDock && distToAnchor === 2 && distToCtrl <= 3 && carried > 0) {
                // Secondary outer arc tile: lock if all range-1 arc spots are claimed
                c.heap.inPosition = true;
                c.heap.nextStep = null;
            } else {
                let bestSpot = null;
                let bestDist = Infinity;
                for (let s = 0; s < upgraderSpots.length; s++) {
                    const sp = upgraderSpots[s];
                    if (isDockPos(sp)) continue;
                    const key = `${sp.x},${sp.y}`;
                    if (claimedSpots[key] && claimedSpots[key] !== c.id) continue;
                    const d = calcDistance(c.pos, sp);
                    if (d < bestDist) {
                        bestDist = d;
                        bestSpot = sp;
                    }
                }
                if (bestSpot) {
                    claimedSpots[`${bestSpot.x},${bestSpot.y}`] = c.id;
                    c.heap.inPosition = false;
                    moveCreep(c, bestSpot, 0);
                } else if (onDock) {
                    c.heap.inPosition = false;
                    let evadeSpot = null;
                    let evadeDist = Infinity;
                    for (let s = 0; s < upgraderSpots.length; s++) {
                        const sp = upgraderSpots[s];
                        if (isDockPos(sp)) continue;
                        const d = calcDistance(c.pos, sp);
                        if (d < evadeDist) {
                            evadeDist = d;
                            evadeSpot = sp;
                        }
                    }
                    if (!evadeSpot) {
                        for (let dx = -3; dx <= 3; dx++) {
                            for (let dy = -3; dy <= 3; dy++) {
                                const tx = controller.pos.x + dx;
                                const ty = controller.pos.y + dy;
                                if (tx <= 1 || tx >= 48 || ty <= 1 || ty >= 48) continue;
                                if (terrain.get(tx, ty) === TERRAIN_MASK_WALL) continue;
                                const pt = { x: tx, y: ty, roomName: roomName };
                                if (isDockPos(pt)) continue;
                                const key = `${tx},${ty}`;
                                if (claimedSpots[key] && claimedSpots[key] !== c.id) continue;
                                const d = calcDistance(c.pos, pt);
                                if (d < evadeDist) {
                                    evadeDist = d;
                                    evadeSpot = pt;
                                }
                            }
                        }
                    }
                    moveCreep(c, evadeSpot || controller.pos, evadeSpot ? 0 : 1);
                } else if (distToCtrl > 3) {
                    c.heap.inPosition = false;
                    moveCreep(c, controller.pos, 3);
                }
            }

            // Simultaneous Intent Execution: Ground-first pickup -> cLink -> cContainer, and upgrade on the SAME tick!
            const workParts = c.getActiveBodyparts ? c.getActiveBodyparts(WORK) : 2;
            const adjCtrlDrop = freeCap > 0 ? dropped.find(d => calcDistance(c.pos, d.pos) <= 1 && d.amount > 0) : null;
            if (adjCtrlDrop) {
                c.pickup(adjCtrlDrop);
            } else if (cLink && calcDistance(c.pos, cLink.pos) <= 1 && linkEnergy > 0 && carried <= workParts) {
                c.withdraw(cLink, RESOURCE_ENERGY);
            } else if (cContainer && calcDistance(c.pos, cContainer.pos) <= 1 && contEnergy > 0 && carried <= workParts) {
                c.withdraw(cContainer, RESOURCE_ENERGY);
            }

            if ((carried > 0 || (distToAnchor <= 1 && (linkEnergy > 0 || contEnergy > 0))) && distToCtrl <= 3) {
                c.heap.actionIntent = 'upgrade';
                c.upgradeController(controller);
            }

            // Bucket Brigade: Share energy with adjacent range-2 outer-arc upgraders when > 25 energy
            if (cContainer && carried > 25 && calcDistance(c.pos, cContainer.pos) <= 1) {
                const outerUpgrader = upgraders.find(other =>
                    other.id !== c.id &&
                    calcDistance(c.pos, other.pos) <= 1 &&
                    calcDistance(other.pos, controller.pos) <= 3 &&
                    calcDistance(other.pos, cContainer.pos) > 1 &&
                    other.store && other.store[RESOURCE_ENERGY] < 20
                );
                if (outerUpgrader) {
                    c.transfer(outerUpgrader, RESOURCE_ENERGY);
                }
            }
        } else {
            // 6-Tier Supply & Range-3 Upgrade Loop
            if (carried === 0) {
                c.heap.working = false;
            } else if (freeCap === 0) {
                c.heap.working = true;
            } else if (c.heap.working === undefined) {
                c.heap.working = carried > 0;
            }

            // Opportunity pickup if adjacent to dropped energy near controller even while working
            if (freeCap > 0) {
                const adjDrop = dropped.find(d => calcDistance(c.pos, d.pos) <= 1 && d.amount > 0);
                if (adjDrop) {
                    c.pickup(adjDrop);
                    c.heap.working = true;
                }
            }

            if (!c.heap.working) {
                c.heap.inPosition = false;
                const supInfo = findUpgraderSupply(c, state, room, cContainer, cLink);

                if (supInfo && supInfo.target) {
                    const supply = supInfo.target;
                    const distToSupply = calcDistance(c.pos, supply.pos);
                    if (distToSupply <= 1) {
                        if (supInfo.action === 'pickup') {
                            c.pickup(supply);
                            c.heap.working = true;
                        } else if (supInfo.action === 'harvest') {
                            c.harvest(supply);
                            if (freeCap <= 2) c.heap.working = true;
                        } else {
                            c.withdraw(supply, RESOURCE_ENERGY, supInfo.amount);
                            c.heap.working = true;
                        }
                        if (c.heap.working && calcDistance(c.pos, controller.pos) > 3) {
                            moveCreep(c, controller.pos, 3);
                        } else if (c.heap.working && calcDistance(c.pos, controller.pos) <= 3) {
                            c.upgradeController(controller);
                        }
                    } else {
                        moveCreep(c, supply.pos, 1);
                    }
                } else {
                    const arcPos = (state.upgradePositions && state.upgradePositions.length > 0)
                        ? state.upgradePositions[i % state.upgradePositions.length]
                        : controller.pos;
                    const arcRange = (state.upgradePositions && state.upgradePositions.length > 0) ? 0 : 3;
                    if (calcDistance(c.pos, arcPos) > arcRange) {
                        c.heap.actionIntent = 'move';
                        c.heap.inPosition = false;
                        moveCreep(c, arcPos, arcRange);
                    } else {
                        c.heap.actionIntent = 'upgrade';
                        c.heap.inPosition = true;
                    }
                }
            } else {
                c.heap.actionIntent = 'upgrade';
                const distToCtrl = calcDistance(c.pos, controller.pos);
                if (distToCtrl > 3) {
                    c.heap.inPosition = false;
                    const arcPos = (state.upgradePositions && state.upgradePositions.length > 0)
                        ? state.upgradePositions[i % state.upgradePositions.length]
                        : controller.pos;
                    const arcRange = (state.upgradePositions && state.upgradePositions.length > 0) ? 0 : 3;
                    moveCreep(c, arcPos, arcRange);
                } else {
                    c.heap.inPosition = true;
                    c.upgradeController(controller);
                }
            }
        }
    }

    // 2. Run Builders (Top-Down 5-Tick Target Lock: 1-HP Rampart Handoff > Decaying Containers > Sites > Controller Assist)
    const builders = (col && col.creepsByRole && col.creepsByRole.builder && col.creepsByRole.builder.length > 0)
        ? col.creepsByRole.builder
        : ((state.creepsByRole && state.creepsByRole.builder) || []);
    if (!builders.length) {
        // Still allow praisers below
    }

    const { primarySite, primaryRepair } = selectRoomWorkerTargets(roomName, state);
    const damagedContainer = primaryRepair;

    // Rampart maintenance candidates (filter against approved Min-Cut cuts + core anchors when cached)
    const rampartTarget = getRampartBaseline(controller.level);
    const urgentThreshold = Math.min(25000, rampartTarget);
    let candidateRamparts = state.ramparts || [];
    const mincutCached = global.heap && global.heap.mincutCache && global.heap.mincutCache[roomName];
    if (mincutCached && mincutCached.cuts && candidateRamparts.length > 0) {
        const anchorMem = typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].anchor;
        const tws = state.towers || [];
        const stPos = storage ? (storage.pos.x + ',' + storage.pos.y) : '';
        const aKey = anchorMem ? (anchorMem.x + ',' + anchorMem.y) : '';
        const sig = `${mincutCached.cuts.length}:${stPos}:${spawns.length}:${tws.length}:${aKey}`;
        let approvedSet = (mincutCached.approvedSet && mincutCached._approvedSig === sig) ? mincutCached.approvedSet : null;
        if (!approvedSet) {
            approvedSet = new Set();
            for (let r = 0; r < mincutCached.cuts.length; r++) {
                approvedSet.add(mincutCached.cuts[r].x + ':' + mincutCached.cuts[r].y);
            }
            if (storage) approvedSet.add(storage.pos.x + ':' + storage.pos.y);
            for (let sp = 0; sp < spawns.length; sp++) approvedSet.add(spawns[sp].pos.x + ':' + spawns[sp].pos.y);
            for (let tw = 0; tw < tws.length; tw++) approvedSet.add(tws[tw].pos.x + ':' + tws[tw].pos.y);
            if (anchorMem) {
                approvedSet.add(anchorMem.x + ':' + anchorMem.y);
                approvedSet.add((anchorMem.x - 2) + ':' + anchorMem.y);
                approvedSet.add((anchorMem.x + 2) + ':' + anchorMem.y);
            }
            mincutCached.approvedSet = approvedSet;
            mincutCached._approvedSig = sig;
        }
        candidateRamparts = candidateRamparts.filter(r => approvedSet.has(r.pos.x + ':' + r.pos.y));
    }
    let urgentRampart = null;
    let urgentRampartHits = urgentThreshold;
    let maintenanceRampart = null;
    let maintenanceRampartHits = rampartTarget;
    for (let r = 0; r < candidateRamparts.length; r++) {
        const rp = candidateRamparts[r];
        if (rp.hits < urgentRampartHits && rp.hits < rp.hitsMax) {
            urgentRampartHits = rp.hits;
            urgentRampart = rp;
        }
        if (rp.hits < maintenanceRampartHits && rp.hits < rp.hitsMax) {
            maintenanceRampartHits = rp.hits;
            maintenanceRampart = rp;
        }
    }

    // Focus-Fire Construction: all builders pull the 5-tick locked primarySite in O(1)!

    for (let i = 0; i < builders.length; i++) {
        const c = builders[i];
        if (c.spawning) continue;
        if (!c.heap) c.heap = {};

        const carried = c.store ? (c.store[RESOURCE_ENERGY] || 0) : 0;
        const freeCap = c.store ? c.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
        if (!primarySite && !urgentRampart && !damagedContainer && (!maintenanceRampart || maintenanceRampart.hits >= urgentThreshold) && carried === 0) {
            c.heap.actionIntent = 'idle';
            c.heap.sleepUntil = Game.time + 10;
            continue;
        }
        if (c.heap.sleepUntil && Game.time < c.heap.sleepUntil) continue;

        // 1-HP Rampart Handoff Protocol: identify completed rampart
        if (c.heap.buildingRampartSiteId) {
            const siteObj = Game.getObjectById(c.heap.buildingRampartSiteId);
            if (!siteObj && c.heap.buildingRampartPos) {
                const rPos = c.heap.buildingRampartPos;
                const newRampart = (state.ramparts || []).find(r => r.pos.x === rPos.x && r.pos.y === rPos.y) ||
                    (Game.rooms[rPos.roomName] && Game.rooms[rPos.roomName].lookForAt ?
                        Game.rooms[rPos.roomName].lookForAt(LOOK_STRUCTURES, rPos.x, rPos.y).find(s => s.structureType === STRUCTURE_RAMPART) : null);
                if (newRampart && newRampart.hits < urgentThreshold) {
                    c.heap.rampartHandoffId = newRampart.id;
                }
                c.heap.buildingRampartSiteId = null;
                c.heap.buildingRampartPos = null;
            }
        }

        // Operation Phoenix States 2 & 4: Pre-position & Swarm-Build Spawn1 at (anchor.x - 2, anchor.y - 1)
        const phoenixState = room.memory ? room.memory.phoenix : 0;
        if (phoenixState === 2 || phoenixState === 4) {
            const bp = getRoomBlueprint(room);
            if (bp && bp.anchor) {
                const targetPos = { x: bp.anchor.x - 2, y: bp.anchor.y - 1, roomName: room.name };
                if (phoenixState === 2) {
                    if (freeCap > 0 && storage && (storage.store[RESOURCE_ENERGY] || 0) > 0) {
                        if (calcDistance(c.pos, storage.pos) <= 1) c.withdraw(storage, RESOURCE_ENERGY);
                        else moveCreep(c, storage.pos, 1);
                    } else if (calcDistance(c.pos, targetPos) > 2) {
                        c.heap.inPosition = false;
                        moveCreep(c, targetPos, 2);
                    } else {
                        c.heap.inPosition = true;
                        c.heap.actionIntent = 'idle';
                    }
                    continue;
                }
                if (phoenixState === 4) {
                    const spawnSite = sites.find(s => s.structureType === STRUCTURE_SPAWN);
                    if (carried === 0) {
                        c.heap.inPosition = false;
                        const drop = dropped.find(d => d.amount >= 50);
                        if (storage && (storage.store[RESOURCE_ENERGY] || 0) > 0) {
                            if (calcDistance(c.pos, storage.pos) <= 1) c.withdraw(storage, RESOURCE_ENERGY);
                            else moveCreep(c, storage.pos, 1);
                            continue;
                        } else if (drop) {
                            if (calcDistance(c.pos, drop.pos) <= 1) c.pickup(drop);
                            else moveCreep(c, drop.pos, 1);
                            continue;
                        }
                    } else if (spawnSite) {
                        if (calcDistance(c.pos, spawnSite.pos) <= 3) {
                            c.heap.inPosition = true;
                            c.heap.actionIntent = 'build';
                            c.build(spawnSite);
                        } else {
                            c.heap.inPosition = false;
                            moveCreep(c, spawnSite.pos, 3);
                        }
                        continue;
                    }
                }
            }
        }

        if (carried === 0) {
            c.heap.working = false;
        } else if (freeCap === 0) {
            c.heap.working = true;
        } else if (c.heap.working === undefined) {
            c.heap.working = carried > 0;
        }

        const targetSite = primarySite;

        // Target approach & stuck bailout tracking for unreachable site blacklisting
        if (targetSite) {
            if (c.heap.targetSiteId === targetSite.id) {
                if (calcDistance(c.pos, targetSite.pos) > 3) {
                    c.heap.siteApproachTicks = (c.heap.siteApproachTicks || 0) + 1;
                } else {
                    c.heap.siteApproachTicks = 0;
                }
                if (c.heap.stuckTicks > 3) {
                    c.heap.siteStuckBailouts = (c.heap.siteStuckBailouts || 0) + 1;
                }
                if ((c.heap.siteApproachTicks || 0) > 15 || (c.heap.siteStuckBailouts || 0) >= 3) {
                    blacklistSite(targetSite.id, 500);
                    c.heap.targetSiteId = null;
                    c.heap.siteApproachTicks = 0;
                    c.heap.siteStuckBailouts = 0;
                }
            } else {
                c.heap.targetSiteId = targetSite.id;
                c.heap.siteApproachTicks = 0;
                c.heap.siteStuckBailouts = 0;
            }
        } else {
            c.heap.targetSiteId = null;
            c.heap.siteApproachTicks = 0;
            c.heap.siteStuckBailouts = 0;
        }

        if (!c.heap.working) {
            c.heap.inPosition = false;
            // Builders clean up dropped energy first if abundant, then overflowing storage/containers
            const bigDrop = dropped.find(d => getEffectiveStore(d) >= 50);
            const supply = (storage && getEffectiveStore(storage) >= 100 ? storage : null) ||
                bigDrop ||
                containers.find(cnt => getEffectiveStore(cnt) >= 40) ||
                dropped.find(d => getEffectiveStore(d) >= 15) ||
                (room.energyAvailable >= 250 && spawns.length > 0 && spawns[0].store[RESOURCE_ENERGY] >= 220 ? spawns[0] : null);

            if (supply) {
                if (c.room.name !== roomName) {
                    moveToRoomViaExit(c, roomName, supply.pos, 1);
                    continue;
                }
                const dist = calcDistance(c.pos, supply.pos);
                if (dist <= 1) {
                    if (supply.amount !== undefined) c.pickup(supply);
                    else if (supply.structureType === STRUCTURE_SPAWN) c.withdraw(supply, RESOURCE_ENERGY, Math.min(freeCap, supply.store[RESOURCE_ENERGY] - 200));
                    else c.withdraw(supply, RESOURCE_ENERGY);
                    c.heap.working = true;
                    if (targetSite && targetSite.pos.roomName === roomName && calcDistance(c.pos, targetSite.pos) > 3) {
                        moveCreep(c, targetSite.pos, 3);
                    }
                } else {
                    moveCreep(c, supply.pos, 1);
                }
            } else {
                c.heap.actionIntent = 'idle';
                c.heap.sleepUntil = Game.time + 5;
            }
        } else if (c.heap.rampartHandoffId) {
            const handoffRampart = Game.getObjectById(c.heap.rampartHandoffId);
            if (handoffRampart && handoffRampart.hits < urgentThreshold) {
                c.heap.actionIntent = 'repair';
                const dist = calcDistance(c.pos, handoffRampart.pos);
                if (dist <= 3) {
                    c.repair(handoffRampart);
                } else {
                    moveCreep(c, handoffRampart.pos, 3);
                }
            } else {
                c.heap.rampartHandoffId = null;
            }
        } else if (urgentRampart && c.room.name === roomName) {
            c.heap.actionIntent = 'repair';
            const dist = calcDistance(c.pos, urgentRampart.pos);
            if (dist <= 3) {
                c.repair(urgentRampart);
            } else {
                moveCreep(c, urgentRampart.pos, 3);
            }
        } else if (damagedContainer && c.room.name === roomName) {
            c.heap.actionIntent = 'repair';
            const dist = calcDistance(c.pos, damagedContainer.pos);
            if (dist <= 3) {
                c.repair(damagedContainer);
            } else {
                moveCreep(c, damagedContainer.pos, 3);
            }
        } else if (targetSite) {
            c.heap.actionIntent = 'build';
            if (c.room.name !== targetSite.pos.roomName) {
                moveToRoomViaExit(c, targetSite.pos.roomName, targetSite.pos, 3);
                continue;
            }
            const dist = calcDistance(c.pos, targetSite.pos);
            if (dist <= 3) {
                if (targetSite.structureType === STRUCTURE_RAMPART) {
                    c.heap.buildingRampartSiteId = targetSite.id;
                    c.heap.buildingRampartPos = { x: targetSite.pos.x, y: targetSite.pos.y, roomName: targetSite.pos.roomName };
                }
                c.build(targetSite);
            } else {
                moveCreep(c, targetSite.pos, 3);
            }
        } else if (maintenanceRampart && c.room.name === roomName) {
            c.heap.actionIntent = 'repair';
            const dist = calcDistance(c.pos, maintenanceRampart.pos);
            if (dist <= 3) {
                c.repair(maintenanceRampart);
            } else {
                moveCreep(c, maintenanceRampart.pos, 3);
            }
        } else {
            // Citadel fully fortified, highways pristine, sites built: assist with upgrading controller
            if (c.room.name !== roomName) {
                moveToRoomViaExit(c, roomName, controller.pos, 3);
                continue;
            }
            c.heap.actionIntent = 'upgrade';
            const dist = calcDistance(c.pos, controller.pos);
            if (dist <= 3) {
                c.upgradeController(controller);
            } else {
                moveCreep(c, controller.pos, 3);
            }
        }
    }

    // 3. Run Praisers (Dedicated GCL Controller Boosters in Praiseroom, KasamiBot Pattern)
    const praisers = (col && col.creepsByRole && col.creepsByRole.praiser) || ((state && state.creepsByRole && state.creepsByRole.praiser) || []);
    for (let i = 0; i < praisers.length; i++) {
        const p = praisers[i];
        if (p.spawning || p.fatigue > 0) continue;
        if (!p.heap) p.heap = {};

        const praiseTarget = (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.praiseRoom) || roomName;
        if (p.room.name !== praiseTarget) {
            moveToRoomViaExit(p, praiseTarget, roomCenterPos(praiseTarget), 3);
            continue;
        }

        const carried = p.store ? (p.store[RESOURCE_ENERGY] || 0) : 0;
        const freeCap = p.store ? p.store.getFreeCapacity(RESOURCE_ENERGY) : 0;

        if (carried === 0) p.heap.working = false;
        else if (freeCap === 0) p.heap.working = true;
        else if (p.heap.working === undefined) p.heap.working = carried > 0;

        const pCtrl = p.room.controller;
        if (!p.heap.working) {
            const pState = global.heap && global.heap.rooms ? global.heap.rooms[praiseTarget] : null;
            const energySource = (pState && pState.storage && pState.storage.store[RESOURCE_ENERGY] > 0)
                ? pState.storage
                : ((pState && pState.terminal && pState.terminal.store[RESOURCE_ENERGY] > 0)
                    ? pState.terminal
                    : ((pState && pState.containers) ? pState.containers.find(c => c.store[RESOURCE_ENERGY] > 50) : null));
            if (energySource) {
                if (calcDistance(p.pos, energySource.pos) <= 1) p.withdraw(energySource, RESOURCE_ENERGY);
                else moveCreep(p, energySource.pos, 1);
            }
        } else if (pCtrl) {
            if (calcDistance(p.pos, pCtrl.pos) <= 3) {
                p.upgradeController(pCtrl);
            } else {
                moveCreep(p, pCtrl.pos, 3);
            }
        }
    }
}

module.exports = {
    getEffectiveFreeCapacity,
    getEffectiveStore,
    runWorkers,
    selectRoomWorkerTargets
};
