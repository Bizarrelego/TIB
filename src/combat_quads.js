// src/combat_quads.js
// 2x2 Quad Squad Cohesive Movement, Quad CostMatrix, Cross-Healing Matrix & Ranged/Siege Tactics
const { roomCenterPos, calcDistance, getDirectionTo, getRivalSafeModeRemaining, calculateKillScore } = require('./constants');
const { moveCreep } = require('./traffic');
const { moveToRoomViaExit } = require('./remotes');
const { boostCreepIfEligible } = require('./labs_market');
const { isRoomHostile } = require('./defense');
const { getAllStructures, resolveMyUsername } = require('./state');
const { getConfig, isOffenseAllowed } = require('./config');
const {
    collectRoomHostileStructures,
    computeRoomTargetDoctrine,
    executeCombatUnitDoctrine,
    isDestructibleHostileStruct,
    isRmaCountableStruct,
    isTargetRoiNegative,
    selectHostileTarget,
    shouldBorderBounceHeal,
    solveBreachTarget
} = require('./offense');

const QUAD_OFFSETS = [
    { dx: 0, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 }
];

function getQuadCostMatrix(roomName) {
    if (typeof PathFinder === 'undefined' || !PathFinder.CostMatrix) {
        return { get: () => 0, set: () => { }, clone: function () { return this; } };
    }

    const heap = (typeof global !== 'undefined' && global.heap) ? global.heap : null;
    if (heap) {
        if (!heap.quadCostMatrices) heap.quadCostMatrices = {};
        const cached = heap.quadCostMatrices[roomName];
        if (cached && typeof Game !== 'undefined' && Game.time < cached.expires) {
            return cached.matrix;
        }
    }

    const matrix = new PathFinder.CostMatrix();
    const room = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[roomName] : null;
    const terrain = room && room.getTerrain
        ? room.getTerrain()
        : (typeof Game !== 'undefined' && Game.map && Game.map.getRoomTerrain ? Game.map.getRoomTerrain(roomName) : null);

    const blocked = new Uint8Array(2500);
    const swamps = new Uint8Array(2500);
    const breachCost = new Uint8Array(2500);

    if (terrain) {
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                const t = terrain.get(x, y);
                if (t === TERRAIN_MASK_WALL) blocked[x * 50 + y] = 1;
                else if (t === TERRAIN_MASK_SWAMP) swamps[x * 50 + y] = 1;
            }
        }
    }

    const roomState = heap && heap.rooms ? heap.rooms[roomName] : null;
    const roadGrid = roomState && roomState.roadGrid ? roomState.roadGrid : null;
    if (roadGrid) {
        for (let idx = 0; idx < 2500; idx++) {
            if (roadGrid[idx] === 1) swamps[idx] = 0;
        }
    }
    const structures = roomState
        ? getAllStructures(roomState)
        : (room && room.find ? room.find(FIND_STRUCTURES) : []);

    const isHostile = isRoomHostile(roomName);

    for (let i = 0; i < structures.length; i++) {
        const s = structures[i];
        if (!s || !s.pos) continue;
        const idx = s.pos.x * 50 + s.pos.y;
        if (s.structureType === STRUCTURE_ROAD) {
            swamps[idx] = 0;
            continue;
        }
        if (s.structureType === STRUCTURE_CONTAINER) continue;
        if (s.structureType === STRUCTURE_RAMPART && s.my) continue;
        if (s.structureType === STRUCTURE_CONTROLLER || s.my) {
            blocked[idx] = 1;
            continue;
        }
        if (isHostile) {
            if (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL) {
                if (s.hits !== undefined && s.hits <= 0) continue;
                const barrierCost = Math.min(254, 20 + Math.ceil((s.hits || 0) / 100000));
                if (barrierCost > breachCost[idx]) breachCost[idx] = barrierCost;
            } else {
                const structCost = Math.min(254, 15 + Math.ceil((s.hits || 0) / 50000));
                if (structCost > breachCost[idx]) breachCost[idx] = structCost;
            }
        } else {
            blocked[idx] = 1;
        }
    }

    // Top-left anchor (x,y) is passable if all 4 tiles (x..x+1, y..y+1) are unblocked
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            if (x === 0 || y === 0 || x >= 48 || y >= 48) {
                matrix.set(x, y, 255);
                continue;
            }
            let isBlocked = false;
            let hasSwamp = false;
            let maxBreach = 0;
            for (let o = 0; o < 4; o++) {
                const tx = x + QUAD_OFFSETS[o].dx;
                const ty = y + QUAD_OFFSETS[o].dy;
                const idx = tx * 50 + ty;
                if (blocked[idx]) {
                    isBlocked = true;
                    break;
                }
                if (breachCost[idx] > maxBreach) maxBreach = breachCost[idx];
                if (swamps[idx]) hasSwamp = true;
            }
            if (isBlocked) {
                matrix.set(x, y, 255);
            } else if (maxBreach > 0) {
                matrix.set(x, y, Math.min(254, maxBreach + (hasSwamp ? 12 : 0)));
            } else if (hasSwamp) {
                matrix.set(x, y, 12);
            }
        }
    }

    if (heap && typeof Game !== 'undefined') {
        heap.quadCostMatrices[roomName] = { matrix, expires: Game.time + 15 };
    }
    return matrix;
}

function getPrimaryBreachTarget(roomName, hostileStructs, leadPos) {
    const rState = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    if (rState && rState._doctrine && rState._doctrine.primaryTarget) {
        const originPos = leadPos ||
            (rState.creeps && rState.creeps.find && rState.creeps.find(c => c && !c.spawning && c.pos) ? rState.creeps.find(c => c && !c.spawning && c.pos).pos : null) ||
            roomCenterPos(roomName);
        return solveBreachTarget(roomName, originPos, rState._doctrine.primaryTarget, rState);
    }

    if (!global.heap) global.heap = {};
    if (!global.heap.quadBreachTarget) global.heap.quadBreachTarget = {};
    const cached = global.heap.quadBreachTarget[roomName];
    if (cached) {
        const obj = Game.getObjectById(cached.id);
        if (obj && obj.hits > 0) return obj;
    }

    // Score each rampart: prefer low hits and proximity to high-value structures (tower/spawn/storage)
    let weakest = null;
    let bestScore = Infinity;
    for (let i = 0; i < hostileStructs.length; i++) {
        const s = hostileStructs[i];
        if (s.structureType !== STRUCTURE_RAMPART && s.structureType !== STRUCTURE_WALL) continue;
        let nearest = 50;
        for (let j = 0; j < hostileStructs.length; j++) {
            const v = hostileStructs[j];
            const t = v.structureType;
            if (t !== STRUCTURE_TOWER && t !== STRUCTURE_SPAWN && t !== STRUCTURE_STORAGE) continue;
            const d = calcDistance(s.pos, v.pos);
            if (d < nearest) nearest = d;
        }
        const score = s.hits + nearest * 1000000;
        if (score < bestScore) {
            bestScore = score;
            weakest = s;
        }
    }
    if (weakest) {
        global.heap.quadBreachTarget[roomName] = { id: weakest.id, pos: weakest.pos };
    }
    return weakest;
}

function recordQuadCohesion(creeps) {
    if (typeof Memory === 'undefined' || !creeps || creeps.length === 0) return;
    if (!Memory.empire) Memory.empire = {};
    if (!Memory.empire.combatStats) {
        Memory.empire.combatStats = {
            damageDealt: 0,
            damageTaken: 0,
            healingDone: 0,
            hostilesKilled: 0,
            friendlyDeaths: 0,
            quadCohesionPct: 100,
            cohesionSamples: 0,
            lastCombatTick: 0
        };
    }
    const leader = creeps[0];
    let cohesive = 1;
    for (let i = 1; i < creeps.length; i++) {
        const c = creeps[i];
        if (!c || c.room.name !== leader.room.name) continue;
        const d = calcDistance(leader.pos, c.pos);
        if (d <= 2) cohesive++;
    }
    const pct = Math.round((cohesive / creeps.length) * 100);
    const cs = Memory.empire.combatStats;
    const n = cs.cohesionSamples || 0;
    cs.quadCohesionPct = n > 0 ? Math.round(((cs.quadCohesionPct * n) + pct) / (n + 1)) : pct;
    cs.cohesionSamples = n + 1;
}

function pickQuadTarget(leader, creeps, hostiles, hostileStructs) {
    if (leader && leader.room) {
        const doctrine = computeRoomTargetDoctrine(leader.room.name);
        if (doctrine && doctrine.primaryTarget) return doctrine.primaryTarget;
    }

    let best = null;
    let bestScore = -Infinity;

    let quadRangedDmg = 0;
    if (creeps && creeps.length > 0) {
        for (let i = 0; i < creeps.length; i++) {
            const c = creeps[i];
            if (!c || c.spawning) continue;
            const ra = c.getActiveBodyparts ? c.getActiveBodyparts(RANGED_ATTACK) : 0;
            quadRangedDmg += ra * 10;
        }
    }

    const healers = hostiles.filter(h => h.getActiveBodyparts && h.getActiveBodyparts(HEAL) > 0);

    for (let i = 0; i < hostiles.length; i++) {
        const h = hostiles[i];
        let score = calculateKillScore(h, quadRangedDmg, healers);
        score -= calcDistance(leader.pos, h.pos) * 45;
        if (score > bestScore) {
            bestScore = score;
            best = h;
        }
    }

    // Prioritize enemy towers cleanly if reachable or no higher-threat mobile targets block
    for (let i = 0; i < hostileStructs.length; i++) {
        const st = hostileStructs[i];
        if (st.structureType === STRUCTURE_CONTROLLER) continue;
        let score = 500 - (st.hits || 0) * 0.01;
        if (st.structureType === STRUCTURE_TOWER) score += 6000;
        else if (st.structureType === STRUCTURE_SPAWN) score += 3500;
        else if (st.structureType === STRUCTURE_RAMPART) score += 2200;
        score -= calcDistance(leader.pos, st.pos) * 45;
        if (score > bestScore) {
            bestScore = score;
            best = st;
        }
    }

    return best;
}

function executeQuadCombatActions(creeps, target, hostiles, hostileStructs) {
    // 1. Cross-Healing Matrix (range <= 1 heal, <= 3 rangedHeal)
    let lowestCreep = creeps[0];
    let lowestRatio = (lowestCreep.hits || 1) / (lowestCreep.hitsMax || 1);
    for (let i = 1; i < creeps.length; i++) {
        const c = creeps[i];
        const ratio = (c.hits || 1) / (c.hitsMax || 1);
        if (ratio < lowestRatio || (ratio === lowestRatio && c.hits < lowestCreep.hits)) {
            lowestRatio = ratio;
            lowestCreep = c;
        }
    }

    const myUsername = resolveMyUsername();
    const roomName = creeps[0] && creeps[0].room ? creeps[0].room.name : '';
    const rState = (roomName && global.heap && global.heap.rooms) ? global.heap.rooms[roomName] : null;
    const mergedStructs = rState ? collectRoomHostileStructures({ hostileStructures: hostileStructs, walls: rState.walls }) : hostileStructs;
    const underThreat = hostiles.length > 0 || mergedStructs.some(s => s.structureType === STRUCTURE_TOWER);
    const scoreById = (rState && rState._doctrine && rState._doctrine.scoreById) || {};
    const breachTarget = roomName ? getPrimaryBreachTarget(roomName, mergedStructs, creeps[0].pos) : null;

    for (let i = 0; i < creeps.length; i++) {
        const c = creeps[i];
        if (!c || c.spawning) continue;
        if (!c.heap) c.heap = {};
        if (hostiles.length > 0 || mergedStructs.length > 0) c.heap.sleepUntil = 0;

        const hasHeal = c.getActiveBodyparts && c.getActiveBodyparts(HEAL) > 0;
        const hasRanged = c.getActiveBodyparts && c.getActiveBodyparts(RANGED_ATTACK) > 0;
        const hasMelee = c.getActiveBodyparts && c.getActiveBodyparts(ATTACK) > 0;
        const hasWork = c.getActiveBodyparts && c.getActiveBodyparts(WORK) > 0;

        if (hasHeal) {
            if (lowestCreep.hits < lowestCreep.hitsMax || underThreat) {
                const d = calcDistance(c.pos, lowestCreep.pos);
                if (d <= 1) c.heal(lowestCreep);
                else if (d <= 3) c.rangedHeal(lowestCreep);
                else if (c.hits < c.hitsMax || underThreat) c.heal(c);
            }
        }

        if (hasRanged) {
            let rmaDamage = 0;
            let hasArmedRange1 = false;
            let bestSingle = null;
            let bestSingleScore = -Infinity;

            for (let h = 0; h < hostiles.length; h++) {
                const hs = hostiles[h];
                if (!hs || hs.my || (hs.owner && myUsername && hs.owner.username === myUsername)) continue;
                const hd = calcDistance(c.pos, hs.pos);
                if (hd > 3) continue;
                const hasA = hs.getActiveBodyparts && (hs.getActiveBodyparts(ATTACK) > 0 || hs.getActiveBodyparts(RANGED_ATTACK) > 0 || hs.getActiveBodyparts(HEAL) > 0);
                if (hd <= 1) {
                    rmaDamage += 10;
                    if (hasA) hasArmedRange1 = true;
                } else if (hd === 2) rmaDamage += 4;
                else rmaDamage += 1;

                const baseSc = hasA ? 1000000 : 100000;
                const sc = baseSc + ((hs.id && scoreById[hs.id] !== undefined) ? scoreById[hs.id] : 0) - (hs.hits || 0) * 0.001;
                if (sc > bestSingleScore) { bestSingleScore = sc; bestSingle = hs; }
            }

            // Mandatory Wall Exclusion: NEVER include STRUCTURE_WALL/ROAD/CONTAINER/CONTROLLER in rmaDamage
            for (let s = 0; s < mergedStructs.length; s++) {
                const st = mergedStructs[s];
                if (!isDestructibleHostileStruct(st, myUsername)) continue;
                const sd = calcDistance(c.pos, st.pos);
                if (sd > 3) continue;
                if (isRmaCountableStruct(st, myUsername)) {
                    if (sd <= 1) rmaDamage += 10;
                    else if (sd === 2) rmaDamage += 4;
                    else rmaDamage += 1;
                }
                let stScore = 50000 - (st.hits || 0) * 0.0001;
                if (st.structureType === STRUCTURE_TOWER) stScore = 800000 - (st.hits || 0) * 0.0001;
                else if (st.structureType === STRUCTURE_SPAWN) stScore = 600000 - (st.hits || 0) * 0.0001;
                else if (st.structureType === STRUCTURE_ROAD || st.structureType === STRUCTURE_CONTAINER) stScore = 1000 - (st.hits || 0) * 0.0001;
                if (breachTarget && st === breachTarget) stScore = Math.max(stScore, 450000);
                if (target && st === target) stScore = Math.max(stScore, 850000);
                if (stScore > bestSingleScore) { bestSingleScore = stScore; bestSingle = st; }
            }

            if (rmaDamage > 10 || hasArmedRange1) {
                c.rangedMassAttack();
            } else if (bestSingle) {
                c.rangedAttack(bestSingle);
            } else if (breachTarget && calcDistance(c.pos, breachTarget.pos) <= 3) {
                c.rangedAttack(breachTarget);
            } else if (target && calcDistance(c.pos, target.pos) <= 3) {
                c.rangedAttack(target);
            }
        }

        let meleeAttacked = false;
        if (hasMelee) {
            let adj = null;
            if (target && target.pos && calcDistance(c.pos, target.pos) <= 1 &&
                (!target.structureType || isDestructibleHostileStruct(target, myUsername))) {
                adj = target;
            } else if (breachTarget && breachTarget.pos && calcDistance(c.pos, breachTarget.pos) <= 1 &&
                isDestructibleHostileStruct(breachTarget, myUsername)) {
                adj = breachTarget;
            } else {
                let bestCreep = null;
                let bestCreepScore = -Infinity;
                for (let h = 0; h < hostiles.length; h++) {
                    const hs = hostiles[h];
                    if (!hs || hs.my || (hs.owner && myUsername && hs.owner.username === myUsername)) continue;
                    if (calcDistance(c.pos, hs.pos) <= 1) {
                        const sc = (hs.id && scoreById[hs.id] !== undefined) ? scoreById[hs.id] : 10000;
                        if (sc > bestCreepScore) { bestCreepScore = sc; bestCreep = hs; }
                    }
                }
                if (bestCreep) {
                    adj = bestCreep;
                } else {
                    let bestStruct = null;
                    let bestHits = Infinity;
                    for (let s = 0; s < mergedStructs.length; s++) {
                        const st = mergedStructs[s];
                        if (!isDestructibleHostileStruct(st, myUsername)) continue;
                        if (calcDistance(c.pos, st.pos) <= 1) {
                            const penalty = (st.structureType === STRUCTURE_ROAD || st.structureType === STRUCTURE_CONTAINER) ? 1000000000 : 0;
                            const hv = (st.hits || 0) + penalty;
                            if (hv < bestHits) { bestHits = hv; bestStruct = st; }
                        }
                    }
                    adj = bestStruct;
                }
            }
            if (adj) {
                c.attack(adj);
                meleeAttacked = true;
            }
        }

        if (hasWork && !meleeAttacked) {
            let dis = null;
            if (target && target.structureType && target.pos && calcDistance(c.pos, target.pos) <= 1 &&
                isDestructibleHostileStruct(target, myUsername)) {
                dis = target;
            } else if (breachTarget && breachTarget.structureType && breachTarget.pos && calcDistance(c.pos, breachTarget.pos) <= 1 &&
                isDestructibleHostileStruct(breachTarget, myUsername)) {
                dis = breachTarget;
            } else {
                let bestDis = null;
                let bestDisHits = Infinity;
                for (let s = 0; s < mergedStructs.length; s++) {
                    const st = mergedStructs[s];
                    if (!isDestructibleHostileStruct(st, myUsername)) continue;
                    if (calcDistance(c.pos, st.pos) <= 1) {
                        const penalty = (st.structureType === STRUCTURE_ROAD || st.structureType === STRUCTURE_CONTAINER) ? 1000000000 : 0;
                        const hv = (st.hits || 0) + penalty;
                        if (hv < bestDisHits) { bestDisHits = hv; bestDis = st; }
                    }
                }
                dis = bestDis;
            }
            if (dis && c.dismantle) c.dismantle(dis);
        }
    }
    return breachTarget;
}

function executeQuadSquad(squad) {
    if (!squad) return;
    const raw = Array.isArray(squad) ? squad : (squad.creeps || []);
    const creeps = raw.filter(c => c && !c.spawning);
    if (creeps.length === 0) return;

    const leader = creeps[0];
    const room = leader.room;
    if (!room) return;

    let waitingForBoost = false;
    for (let i = 0; i < creeps.length; i++) {
        if (!boostCreepIfEligible(creeps[i])) {
            waitingForBoost = true;
        }
    }
    if (waitingForBoost) return;

    recordQuadCohesion(creeps);

    const roomState = (typeof global !== 'undefined' && global.heap && global.heap.rooms) ? global.heap.rooms[room.name] : null;
    const hostiles = (roomState && roomState.hostiles) || (room.find ? room.find(FIND_HOSTILE_CREEPS) : []);
    const hostileStructs = (roomState && roomState.hostileStructures)
        ? roomState.hostileStructures
        : (room.find ? room.find(FIND_HOSTILE_STRUCTURES) : []);
    const target = pickQuadTarget(leader, creeps, hostiles, hostileStructs);

    const breachTarget = executeQuadCombatActions(creeps, target, hostiles, hostileStructs);

    // Nuke synchronization: hold outside the target room until impact tick has passed (avoid friendly splash)
    const nukeRoom = leader.memory.targetRoom || (leader.heap && leader.heap.targetRoom) ||
        ((typeof Memory !== 'undefined' && Memory.empire && Array.isArray(Memory.empire.raidTargets) && Memory.empire.raidTargets[0]) ? Memory.empire.raidTargets[0].roomName : null);
    if (nukeRoom && leader.room.name !== nukeRoom) {
        const impactIn = getNukeImpactIn(nukeRoom);
        if (impactIn >= 0 && impactIn <= 15) return;
    }

    // Fatigue Gate: never break 2x2 lock while any member still carries fatigue
    for (let i = 0; i < creeps.length; i++) {
        if (creeps[i].fatigue > 0) return;
    }

    // Check if squad is currently in compact 2x2 formation (each follower at leader.pos + offset)
    let inFormation = true;
    for (let i = 1; i < creeps.length; i++) {
        const expectedX = leader.pos.x + QUAD_OFFSETS[i].dx;
        const expectedY = leader.pos.y + QUAD_OFFSETS[i].dy;
        if (creeps[i].room.name !== room.name || creeps[i].pos.x !== expectedX || creeps[i].pos.y !== expectedY) {
            inFormation = false;
            break;
        }
    }

    // 1-Tick Synchronized Cyclic Damage Rotation Tanking
    // [0: TL, 1: TR, 2: BL, 3: BR]
    if (creeps.length === 4 && inFormation) {
        const frontDamaged = (creeps[0].hits / creeps[0].hitsMax < 0.4) || (creeps[1].hits / creeps[1].hitsMax < 0.4);
        const rearHealthy = (creeps[2].hits / creeps[2].hitsMax > 0.7) && (creeps[3].hits / creeps[3].hitsMax > 0.7);
        if (frontDamaged && rearHealthy) {
            creeps[0].move(3); // RIGHT
            creeps[1].move(5); // BOTTOM
            creeps[3].move(7); // LEFT
            creeps[2].move(1); // TOP
            for (let i = 0; i < 4; i++) {
                if (!creeps[i].heap) creeps[i].heap = {};
                creeps[i].heap.actionIntent = 'quadRotate';
            }
            const tmp = creeps[0];
            creeps[0] = creeps[2];
            creeps[2] = creeps[3];
            creeps[3] = creeps[1];
            creeps[1] = tmp;
            return;
        }
    }

    const targetRoom = leader.memory.targetRoom || (leader.heap && leader.heap.targetRoom) ||
        ((typeof Memory !== 'undefined' && Memory.empire && Array.isArray(Memory.empire.raidTargets) && Memory.empire.raidTargets[0]) ? Memory.empire.raidTargets[0].roomName : null);

    // Tower-range / Border-Bounce Healing: if squad leader drops < 55% HP under active towers, bounce out to heal
    if (shouldBorderBounceHeal(leader, roomState)) {
        const home = leader.memory && (leader.memory.homeRoom || leader.memory.colony);
        if (home && leader.room.name !== home) {
            moveToRoomViaExit(leader, home, roomCenterPos(home), 2);
            for (let i = 1; i < creeps.length; i++) moveCreep(creeps[i], creeps[i - 1].pos, 0);
            return;
        }
    }

    // Safe Mode & Negative-ROI Pivot: never feed a 2x2 quad into a Safe-Moded or negative-ROI room
    if (targetRoom && (getRivalSafeModeRemaining(targetRoom) > 0 || isTargetRoiNegative(targetRoom))) {
        const home = leader.memory && (leader.memory.homeRoom || leader.memory.colony);
        const pivot = home ? selectHostileTarget(home, 'quad') : null;
        for (let i = 0; i < creeps.length; i++) {
            if (creeps[i].memory) creeps[i].memory.targetRoom = pivot || null;
            if (creeps[i].heap) creeps[i].heap.targetRoom = pivot || null;
        }
        if (!pivot) {
            if (home && leader.room.name !== home) {
                moveToRoomViaExit(leader, home, roomCenterPos(home), 4);
                for (let i = 1; i < creeps.length; i++) moveCreep(creeps[i], creeps[i - 1].pos, 0);
            }
            return;
        }
    }

    const distToTargetRoom = (targetRoom && typeof Game !== 'undefined' && Game.map)
        ? Game.map.getRoomLinearDistance(leader.room.name, targetRoom)
        : 99;
    const isNearOrInTarget = targetRoom && (leader.room.name === targetRoom || distToTargetRoom <= 1);
    const inHostileTerritory = isRoomHostile(leader.room.name) || isNearOrInTarget;

    // Dynamic Formation Morphing: Single-file 1x4 snake transit through safe/neutral highways 2+ rooms away
    if (distToTargetRoom > 1 && !inHostileTerritory) {
        moveToRoomViaExit(leader, targetRoom, roomCenterPos(targetRoom), 3);
        for (let i = 1; i < creeps.length; i++) {
            moveCreep(creeps[i], creeps[i - 1].pos, 0);
        }
        return;
    }

    // Pre-Border Room Entry Staging: 1 room before target, assemble into 2x2 brick before crossing!
    if (distToTargetRoom === 1) {
        const allInRoom = creeps.every(c => c.room.name === leader.room.name);
        if (!allInRoom || !inFormation) {
            for (let i = 1; i < creeps.length; i++) {
                const tx = Math.max(2, Math.min(47, leader.pos.x + QUAD_OFFSETS[i].dx));
                const ty = Math.max(2, Math.min(47, leader.pos.y + QUAD_OFFSETS[i].dy));
                moveCreep(creeps[i], { x: tx, y: ty, roomName: leader.room.name }, 0);
            }
            return;
        }
    }

    if (!target) {
        if (!inFormation) {
            for (let i = 1; i < creeps.length; i++) {
                const tx = Math.max(1, Math.min(48, leader.pos.x + QUAD_OFFSETS[i].dx));
                const ty = Math.max(1, Math.min(48, leader.pos.y + QUAD_OFFSETS[i].dy));
                moveCreep(creeps[i], { x: tx, y: ty, roomName: room.name }, 0);
            }
            return;
        }

        if (targetRoom && leader.room.name !== targetRoom) {
            moveToRoomViaExit(leader, targetRoom, roomCenterPos(targetRoom), 3);
            for (let i = 1; i < creeps.length; i++) {
                const tx = Math.max(1, Math.min(48, leader.pos.x + QUAD_OFFSETS[i].dx));
                const ty = Math.max(1, Math.min(48, leader.pos.y + QUAD_OFFSETS[i].dy));
                moveCreep(creeps[i], { x: tx, y: ty, roomName: room.name }, 0);
            }
        }
        return;
    }

    const moveGoal = breachTarget || target;
    const dist = calcDistance(leader.pos, moveGoal.pos);
    const hasMeleeOrDismantle = creeps.some(c => c.getActiveBodyparts && (c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(WORK) > 0));
    const isMeleeOnlyTarget = !breachTarget && moveGoal.getActiveBodyparts &&
        moveGoal.getActiveBodyparts(ATTACK) > 0 &&
        moveGoal.getActiveBodyparts(RANGED_ATTACK) === 0;
    const idealRange = hasMeleeOrDismantle ? 1 : 3;

    if (!leader.heap) leader.heap = {};
    const posKey = (leader.pos.x * 50) + leader.pos.y;
    if (leader.heap.lastQuadPos === posKey && dist > idealRange) {
        leader.heap.quadStalled = (leader.heap.quadStalled || 0) + 1;
    } else {
        leader.heap.quadStalled = 0;
    }
    leader.heap.lastQuadPos = posKey;

    let desiredStep = null;
    if (!hasMeleeOrDismantle && isMeleeOnlyTarget && dist <= 2 && typeof PathFinder !== 'undefined') {
        const flee = PathFinder.search(leader.pos, { pos: moveGoal.pos, range: 3 }, {
            flee: true,
            maxRooms: 1,
            plainCost: 2,
            swampCost: 12,
            roomCallback: (rName) => getQuadCostMatrix(rName)
        });
        if (flee && flee.path && flee.path.length > 0) desiredStep = flee.path[0];
    } else if (dist > idealRange) {
        if (typeof PathFinder !== 'undefined') {
            const pathRes = PathFinder.search(leader.pos, { pos: moveGoal.pos, range: idealRange }, {
                maxRooms: 1,
                plainCost: 2,
                swampCost: 12,
                roomCallback: (rName) => getQuadCostMatrix(rName)
            });
            if ((!pathRes || pathRes.incomplete || !pathRes.path || pathRes.path.length === 0) && leader.heap.quadStalled >= 2) {
                const home = leader.memory && (leader.memory.homeRoom || leader.memory.colony);
                const docState = roomState || {
                    creeps,
                    hostiles,
                    armedHostiles: hostiles,
                    hostileStructures: hostileStructs,
                    hostileTowers: hostileStructs.filter(s => s.structureType === STRUCTURE_TOWER)
                };
                executeCombatUnitDoctrine(creeps, room.name, home, docState);
                return;
            }
            if (pathRes && pathRes.path && pathRes.path.length > 0) {
                desiredStep = pathRes.path[0];
            }
        }
        if (!desiredStep) desiredStep = moveGoal.pos;
    }

    if (inFormation && desiredStep && leader.heap.quadStalled < 2) {
        const dir = getDirectionTo(leader.pos, desiredStep);
        if (dir) {
            // Atomic 2x2 brick step so followers never block the leader
            for (let i = 0; i < creeps.length; i++) {
                creeps[i].move(dir);
                if (!creeps[i].heap) creeps[i].heap = {};
                creeps[i].heap.actionIntent = 'quadMove';
            }
            return;
        }
    }

    if (desiredStep) {
        moveCreep(leader, desiredStep, 0);
    }

    for (let i = 1; i < creeps.length; i++) {
        const anchor = (desiredStep && calcDistance(leader.pos, desiredStep) <= 1) ? desiredStep : leader.pos;
        const tx = Math.max(1, Math.min(48, anchor.x + QUAD_OFFSETS[i].dx));
        const ty = Math.max(1, Math.min(48, anchor.y + QUAD_OFFSETS[i].dy));
        moveCreep(creeps[i], { x: tx, y: ty, roomName: room.name }, 0);
    }
}

function runQuadSquad() {
    if (typeof Game === 'undefined' || !Game.creeps) return;
    if (global.heap && global.heap.hasQuadCreeps === false) return;

    const cfg = getConfig();
    if (!isOffenseAllowed('quad', cfg)) {
        for (const name in Game.creeps) {
            const c = Game.creeps[name];
            if (!c || c.spawning) continue;
            if (!((c.memory && c.memory.role === 'quad') || (c.heap && c.heap.role === 'quad'))) continue;
            if (c.heap) {
                c.heap.state = 'idle';
                c.heap.targetId = null;
            }
            const home = c.memory && (c.memory.homeRoom || c.memory.colony);
            if (home && c.room && c.room.name !== home) {
                moveToRoomViaExit(c, home, roomCenterPos(home), 4);
            }
        }
        return;
    }

    // Group by memory.squadId; creeps without one are batched 4 at a time (legacy behaviour)
    const squads = {};
    const loose = [];
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (!c || c.spawning) continue;
        if (!((c.memory && c.memory.role === 'quad') || (c.heap && c.heap.role === 'quad'))) continue;
        const sid = c.memory && c.memory.squadId;
        if (sid) {
            if (!squads[sid]) squads[sid] = [];
            squads[sid].push(c);
        } else {
            loose.push(c);
        }
    }

    for (const sid in squads) {
        // Slot order keeps the dismantler as leader so QUAD_OFFSETS formation is stable
        squads[sid].sort((a, b) => (a.memory.quadSlot || 0) - (b.memory.quadSlot || 0));
        executeQuadSquad(squads[sid]);
    }

    if (loose.length > 0) {
        loose.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (let i = 0; i < loose.length; i += 4) {
            executeQuadSquad(loose.slice(i, i + 4));
        }
    }
}

// Returns ticks until a friendly nuke lands on roomName, or -1 if none pending
function getNukeImpactIn(roomName) {
    if (typeof Memory === 'undefined' || !Memory.empire || !Array.isArray(Memory.empire.nukeStrikes)) return -1;
    const strikes = Memory.empire.nukeStrikes;
    for (let i = 0; i < strikes.length; i++) {
        const s = strikes[i];
        if (s && s.targetRoom === roomName && s.impactTick >= Game.time) return s.impactTick - Game.time;
    }
    return -1;
}

module.exports = {
    executeQuadCombatActions,
    executeQuadSquad,
    getPrimaryBreachTarget,
    getQuadCostMatrix,
    runQuadSquad
};
