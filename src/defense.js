// src/defense.js
// Net-DPS Tower Focus-Fire, Rampart Hysteresis Repair, and Cross-Room Defense Routing
const { roomCenterPos, calcDistance, populateThreatField, evaluateKiteTile, calculateKillScore } = require('./constants');
const { getCombatAvoidanceMatrix, moveCreep } = require('./traffic');
const { moveToRoomViaExit } = require('./remotes');
const { isFriendlyOrEmpireRoom, resolveMyUsername, getAllStructures } = require('./state');
const { runPowerCreeps } = require('./power_creeps');
const { getConfig, getRampartBaseline } = require('./config');

function isDefenseRmaStruct(st, myUsername) {
    if (!st || st.my === true) return false;
    if (st.owner && myUsername && st.owner.username === myUsername) return false;
    const t = st.structureType;
    if (!t || t === STRUCTURE_WALL || t === STRUCTURE_CONTROLLER || t === STRUCTURE_ROAD || t === STRUCTURE_CONTAINER) return false;
    if (st.hits !== undefined && st.hits <= 0) return false;
    return true;
}

function isDefenseDestructibleStruct(st, myUsername) {
    if (!st || st.my === true) return false;
    if (st.owner && myUsername && st.owner.username === myUsername) return false;
    const t = st.structureType;
    if (!t || t === STRUCTURE_CONTROLLER) return false;
    if (st.hits !== undefined && st.hits <= 0) return false;
    return true;
}

function collectDefenseHostileStructs(rState, room, myUsername) {
    const raw = [];
    if (rState) {
        const hs = rState.hostileStructures || [];
        const wl = rState.walls || [];
        for (let i = 0; i < hs.length; i++) raw.push(hs[i]);
        for (let i = 0; i < wl.length; i++) raw.push(wl[i]);
    } else if (room && room.find) {
        const fs = room.find(FIND_STRUCTURES) || [];
        for (let i = 0; i < fs.length; i++) raw.push(fs[i]);
    }
    const seen = new Set();
    const out = [];
    for (let i = 0; i < raw.length; i++) {
        const s = raw[i];
        if (!isDefenseDestructibleStruct(s, myUsername)) continue;
        const k = s.id || (s.pos ? `${s.structureType}:${s.pos.x},${s.pos.y}` : i);
        if (!seen.has(k)) {
            seen.add(k);
            out.push(s);
        }
    }
    return out;
}

function executeDefenseWeaponFallback(creep, primaryTarget, rState, breachTarget) {
    if (!creep || creep.spawning) return;
    const hasHeal = creep.getActiveBodyparts && creep.getActiveBodyparts(HEAL) > 0;
    const hasRanged = creep.getActiveBodyparts && creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasMelee = creep.getActiveBodyparts && creep.getActiveBodyparts(ATTACK) > 0;
    const hasWork = creep.getActiveBodyparts && creep.getActiveBodyparts(WORK) > 0;
    if (!hasHeal && !hasRanged && !hasMelee && !hasWork) return;

    const myUsername = resolveMyUsername();
    const room = creep.room;
    const hostilesRaw = (rState && rState.hostiles) || (room && !rState && room.find ? room.find(FIND_HOSTILE_CREEPS) : []);
    const hostiles = myUsername ? hostilesRaw.filter(h => h && !h.my && (!h.owner || h.owner.username !== myUsername)) : hostilesRaw;
    const structs = collectDefenseHostileStructs(rState, room, myUsername);

    let adj = null;
    if (hasMelee) {
        if (primaryTarget && primaryTarget.pos && calcDistance(creep.pos, primaryTarget.pos) <= 1 &&
            (!primaryTarget.structureType || isDefenseDestructibleStruct(primaryTarget, myUsername))) {
            adj = primaryTarget;
        } else if (breachTarget && breachTarget.pos && calcDistance(creep.pos, breachTarget.pos) <= 1 &&
            isDefenseDestructibleStruct(breachTarget, myUsername)) {
            adj = breachTarget;
        } else {
            let bestCreep = null;
            let bestCreepSc = -Infinity;
            for (let i = 0; i < hostiles.length; i++) {
                const h = hostiles[i];
                if (calcDistance(creep.pos, h.pos) <= 1) {
                    const isArmed = h.getActiveBodyparts && (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0);
                    const isHeal = h.getActiveBodyparts && h.getActiveBodyparts(HEAL) > 0;
                    const sc = (isArmed ? 50000 : 0) + (isHeal ? 30000 : 0) + 10000 - (h.hits || 0) * 0.01;
                    if (sc > bestCreepSc) { bestCreepSc = sc; bestCreep = h; }
                }
            }
            if (bestCreep) {
                adj = bestCreep;
            } else {
                let bestStruct = null;
                let bestHits = Infinity;
                for (let s = 0; s < structs.length; s++) {
                    const st = structs[s];
                    if (calcDistance(creep.pos, st.pos) <= 1) {
                        const penalty = (st.structureType === STRUCTURE_ROAD || st.structureType === STRUCTURE_CONTAINER) ? 1000000000 : 0;
                        const hv = (st.hits || 0) + penalty;
                        if (hv < bestHits) { bestHits = hv; bestStruct = st; }
                    }
                }
                adj = bestStruct;
            }
        }
    }

    const willMeleeAttack = !!(hasMelee && adj);
    const isCriticalSelf = (creep.hits || 0) < (creep.hitsMax || 1) * 0.5;
    let healedThisTick = false;
    if (hasHeal && (!willMeleeAttack || isCriticalSelf)) {
        let lowAlly = (creep.hits < creep.hitsMax) ? creep : null;
        let lowRatio = (creep.hits || 1) / (creep.hitsMax || 1);
        const allies = (rState && rState.creeps) || [];
        for (let i = 0; i < allies.length; i++) {
            const al = allies[i];
            if (!al || al.hits >= al.hitsMax) continue;
            const d = calcDistance(creep.pos, al.pos);
            if (d > 3) continue;
            const ratio = (al.hits || 1) / (al.hitsMax || 1);
            if (ratio < lowRatio) { lowRatio = ratio; lowAlly = al; }
        }
        if (lowAlly) {
            const hd = calcDistance(creep.pos, lowAlly.pos);
            if (hd <= 1) { creep.heal(lowAlly); healedThisTick = true; }
            else if (hd <= 3) { creep.rangedHeal(lowAlly); healedThisTick = true; }
        }
    }

    if (hasRanged) {
        let rmaDamage = 0;
        let hasArmedRange1 = false;
        let bestSingle = null;
        let bestScore = -Infinity;

        for (let i = 0; i < hostiles.length; i++) {
            const h = hostiles[i];
            const d = calcDistance(creep.pos, h.pos);
            if (d > 3) continue;
            const isHealer = h.getActiveBodyparts && h.getActiveBodyparts(HEAL) > 0;
            const isArmed = isHealer || (h.getActiveBodyparts && (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0));
            if (d <= 1) {
                rmaDamage += 10;
                if (isArmed) hasArmedRange1 = true;
            } else if (d === 2) rmaDamage += 4;
            else rmaDamage += 1;
            const sc = (isArmed ? 1000000 : 100000) + (isHealer ? 50000 : 0) - (h.hits || 0) * 0.001 - d * 10;
            if (sc > bestScore) { bestScore = sc; bestSingle = h; }
        }

        // Mandatory Wall Exclusion on RMA: only owned destructible structures add to rmaDamage
        for (let s = 0; s < structs.length; s++) {
            const st = structs[s];
            const d = calcDistance(creep.pos, st.pos);
            if (d > 3) continue;
            if (isDefenseRmaStruct(st, myUsername)) {
                if (d <= 1) rmaDamage += 10;
                else if (d === 2) rmaDamage += 4;
                else rmaDamage += 1;
            }
            const t = st.structureType;
            let sc = 50000 - (st.hits || 0) * 0.0001;
            if (t === STRUCTURE_TOWER) sc = 800000 - (st.hits || 0) * 0.0001;
            else if (t === STRUCTURE_SPAWN) sc = 600000 - (st.hits || 0) * 0.0001;
            else if (t === STRUCTURE_ROAD || t === STRUCTURE_CONTAINER) sc = 1000 - (st.hits || 0) * 0.0001;
            if (breachTarget && st === breachTarget) sc = Math.max(sc, 450000);
            if (primaryTarget && st === primaryTarget) sc = Math.max(sc, 850000);
            if (sc > bestScore) { bestScore = sc; bestSingle = st; }
        }

        if (rmaDamage > 10 || hasArmedRange1) {
            creep.rangedMassAttack();
        } else if (bestSingle) {
            creep.rangedAttack(bestSingle);
        } else if (primaryTarget && primaryTarget.pos && calcDistance(creep.pos, primaryTarget.pos) <= 3 &&
            (!primaryTarget.structureType || isDefenseDestructibleStruct(primaryTarget, myUsername))) {
            creep.rangedAttack(primaryTarget);
        }
    }

    let meleeHit = false;
    if (willMeleeAttack && !(healedThisTick && isCriticalSelf)) {
        creep.attack(adj);
        meleeHit = true;
    }

    if (hasWork && !meleeHit) {
        let dis = null;
        if (primaryTarget && primaryTarget.structureType && primaryTarget.pos &&
            calcDistance(creep.pos, primaryTarget.pos) <= 1 && isDefenseDestructibleStruct(primaryTarget, myUsername)) {
            dis = primaryTarget;
        } else if (breachTarget && breachTarget.structureType && breachTarget.pos &&
            calcDistance(creep.pos, breachTarget.pos) <= 1 && isDefenseDestructibleStruct(breachTarget, myUsername)) {
            dis = breachTarget;
        } else {
            let bestDis = null;
            let bestHits = Infinity;
            for (let s = 0; s < structs.length; s++) {
                const st = structs[s];
                if (calcDistance(creep.pos, st.pos) <= 1) {
                    const penalty = (st.structureType === STRUCTURE_ROAD || st.structureType === STRUCTURE_CONTAINER) ? 1000000000 : 0;
                    const hv = (st.hits || 0) + penalty;
                    if (hv < bestHits) { bestHits = hv; bestDis = st; }
                }
            }
            dis = bestDis;
        }
        if (dis && creep.dismantle) creep.dismantle(dis);
    }
}

function getTowerDamageMatrix(tower) {
    if (!global.heap) global.heap = {};
    if (!global.heap.towerDamageMatrices) global.heap.towerDamageMatrices = {};
    const cached = global.heap.towerDamageMatrices[tower.id];
    if (cached) return cached;

    const matrix = new Uint16Array(2500);
    const tx = tower.pos.x;
    const ty = tower.pos.y;
    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            const dx = Math.abs(x - tx);
            const dy = Math.abs(y - ty);
            const dist = dx > dy ? dx : dy;
            let dmg = 600;
            if (dist <= 5) dmg = 600;
            else if (dist >= 20) dmg = 150;
            else dmg = Math.round(600 - ((dist - 5) * 30));
            matrix[x * 50 + y] = dmg;
        }
    }
    global.heap.towerDamageMatrices[tower.id] = matrix;
    return matrix;
}

function getDrainBuffer(hostileId, initialHits) {
    if (!global.heap) global.heap = {};
    if (!global.heap.drainBuffers) global.heap.drainBuffers = {};
    let db = global.heap.drainBuffers[hostileId];
    if (!db) {
        db = {
            buffer: new Int16Array(10),
            head: 0,
            count: 0,
            prevHits: initialHits,
            lockedUntil: 0
        };
        global.heap.drainBuffers[hostileId] = db;
    }
    return db;
}

function requestGlobalReinforcements(besiegedRoom, requestingColony) {
    if (!global.heap || !global.heap.colonies) return;
    for (const cName in global.heap.colonies) {
        if (cName === requestingColony) continue;
        const helperColony = global.heap.colonies[cName];
        if (helperColony.threats && helperColony.threats.length > 0) continue; // Helper is also under attack

        // Reroute idle defenders to the besieged room
        const defenders = helperColony.creepsByRole.defender || [];
        for (let i = 0; i < defenders.length; i++) {
            const def = defenders[i];
            if (!def.heap) def.heap = {};
            if (!def.heap.targetId || def.heap.actionIntent === 'idle' || def.memory.targetRoom === cName) {
                def.memory.targetRoom = besiegedRoom;
                def.heap.targetRoom = besiegedRoom;
                def.heap.actionIntent = 'moveRoom';
                def.heap.destination = { x: 25, y: 25, roomName: besiegedRoom, range: 20 };
            }
        }
    }
}

function getDesiredRampartHits(roomState) {
    const cfg = getConfig();
    const rcl = (roomState.controller && roomState.controller.level) || 1;
    const baseHits = getRampartBaseline(rcl, cfg);
    const storage = roomState.storage;
    const storageEnergy = (storage && storage.store) ? (storage.store[RESOURCE_ENERGY] || 0) : 0;
    // RCL 6+: configurable baseline + aggressive 11.25 HP per stored energy above 100k
    if (rcl >= 6) {
        const target = baseHits + Math.max(0, (storageEnergy - 100000) * 11.25);
        const rcl6to8Max = rcl >= 8 ? 300000000 : (rcl === 7 ? 100000000 : 30000000);
        return Math.min(rcl6to8Max, Math.floor(target));
    }
    return baseHits;
}

function isRoomHostile(roomName) {
    if (!roomName) return false;
    if (isFriendlyOrEmpireRoom(roomName)) return false;

    const room = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[roomName] : null;
    const myUsername = resolveMyUsername();

    if (room && room.controller) {
        if (room.controller.owner && (!myUsername || room.controller.owner.username !== myUsername)) return true;
        if (room.controller.reservation && room.controller.reservation.username &&
            room.controller.reservation.username !== 'Invader' &&
            (!myUsername || room.controller.reservation.username !== myUsername)) return true;
    }

    if (typeof Memory !== 'undefined' && Memory.empire) {
        if (Array.isArray(Memory.empire.enemyOutposts) && Memory.empire.enemyOutposts.some(e => e && e.roomName === roomName && !isFriendlyOrEmpireRoom(e.roomName))) return true;
        if (Array.isArray(Memory.empire.enemyRooms) && Memory.empire.enemyRooms.indexOf(roomName) !== -1 && !isFriendlyOrEmpireRoom(roomName)) return true;
    }

    if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName]) {
        const sd = Memory.rooms[roomName].scoutData;
        if (sd && (sd.threatLevel === 'player_defended' || sd.threatLevel === 'player_weak') && (!myUsername || sd.enemyOwner !== myUsername)) return true;
    }

    return false;
}

function executeDriveByCombat(creep) {
    if (!creep || creep.spawning) return;
    const room = creep.room;
    if (!room) return;

    // Strict Hostile Boundary: Never attack structures or creeps in neutral or friendly rooms!
    if (!isRoomHostile(room.name)) return;
    if (isFriendlyOrEmpireRoom(room.name)) return;

    const hasRanged = creep.getActiveBodyparts && creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasMelee = creep.getActiveBodyparts && creep.getActiveBodyparts(ATTACK) > 0;
    const hasHeal = creep.getActiveBodyparts && creep.getActiveBodyparts(HEAL) > 0;
    const hasWork = creep.getActiveBodyparts && creep.getActiveBodyparts(WORK) > 0;

    if (!hasRanged && !hasMelee && !hasHeal && !hasWork) return;

    const heap = (typeof global !== 'undefined') ? global.heap : null;
    const rState = heap && heap.rooms ? heap.rooms[room.name] : null;
    const myUsername = resolveMyUsername();

    // 1. Hostiles: NEVER target friendly creeps or self units
    const rawHostiles = (rState && rState.hostiles) || (room.find ? room.find(FIND_HOSTILE_CREEPS) : []);
    const hostiles = myUsername ? rawHostiles.filter(h => !h.my && (!h.owner || h.owner.username !== myUsername)) : rawHostiles;

    // 2. Enemy Structures in Hostile Territory: Prioritize military/economic targets; NEVER attack self/neutral structures
    const rawStructs = rState ? getAllStructures(rState) : (room.find ? room.find(FIND_STRUCTURES) : []);
    const structures = rawStructs.filter(s => isDefenseDestructibleStruct(s, myUsername));

    // 1. Ranged Drive-By Attack (exact 10/4/1 RMA with Mandatory Wall Exclusion + Tier 1 priority)
    if (hasRanged) {
        let rmaDamage = 0;
        let hasArmedRange1 = false;
        let singleTarget = null;
        let bestScore = -Infinity;
        const scoreById = (rState && rState._doctrine && rState._doctrine.scoreById) || {};

        for (let i = 0; i < hostiles.length; i++) {
            const h = hostiles[i];
            const d = calcDistance(creep.pos, h.pos);
            if (d <= 3) {
                const isArmed = h.getActiveBodyparts && (h.getActiveBodyparts(HEAL) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0 || h.getActiveBodyparts(ATTACK) > 0);
                if (d <= 1) {
                    rmaDamage += 10;
                    if (isArmed) hasArmedRange1 = true;
                } else if (d === 2) rmaDamage += 4;
                else rmaDamage += 1;
                const sc = (h.id && scoreById[h.id] !== undefined)
                    ? scoreById[h.id]
                    : (isArmed ? 100000 : 10000) - d * 100;
                if (sc > bestScore) { bestScore = sc; singleTarget = h; }
            }
        }

        for (let i = 0; i < structures.length; i++) {
            const s = structures[i];
            const d = calcDistance(creep.pos, s.pos);
            if (d <= 3 && isDefenseRmaStruct(s, myUsername)) {
                if (d <= 1) rmaDamage += 10;
                else if (d === 2) rmaDamage += 4;
                else rmaDamage += 1;
            }
        }

        if (rmaDamage > 10 || hasArmedRange1) {
            creep.rangedMassAttack();
        } else if (singleTarget) {
            creep.rangedAttack(singleTarget);
        } else {
            let bestStruct = null;
            let bestPriority = -1;
            let bestHits = Infinity;
            for (let i = 0; i < structures.length; i++) {
                const s = structures[i];
                const d = calcDistance(creep.pos, s.pos);
                if (d <= 3) {
                    let priority = 1;
                    if (s.structureType === STRUCTURE_TOWER) priority = 10;
                    else if (s.structureType === STRUCTURE_SPAWN) priority = 9;
                    else if (s.structureType === 'invaderCore') priority = 8;
                    else if (s.structureType === STRUCTURE_RAMPART) priority = 7;
                    else if (s.structureType === STRUCTURE_EXTENSION) priority = 6;
                    else if (s.structureType === STRUCTURE_LAB) priority = 5;
                    else if (s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_TERMINAL) priority = 4;
                    else if (s.structureType === STRUCTURE_WALL) priority = 3;

                    if (priority > bestPriority || (priority === bestPriority && (s.hits || 0) < bestHits)) {
                        bestPriority = priority;
                        bestHits = s.hits || 0;
                        bestStruct = s;
                    }
                }
            }
            if (bestStruct) creep.rangedAttack(bestStruct);
        }
    }

    // 2. Melee Drive-By Attack & WORK Dismantle
    let attackedCreepOrStruct = false;
    if (hasMelee) {
        let meleeTarget = null;
        for (let i = 0; i < hostiles.length; i++) {
            if (calcDistance(creep.pos, hostiles[i].pos) <= 1) {
                meleeTarget = hostiles[i];
                break;
            }
        }
        if (meleeTarget) {
            creep.attack(meleeTarget);
            attackedCreepOrStruct = true;
        } else {
            let bestMeleeStruct = null;
            let bestMeleePri = -1;
            let bestMeleeHits = Infinity;
            for (let i = 0; i < structures.length; i++) {
                const s = structures[i];
                if (calcDistance(creep.pos, s.pos) <= 1) {
                    let priority = 1;
                    if (s.structureType === STRUCTURE_TOWER) priority = 10;
                    else if (s.structureType === STRUCTURE_SPAWN) priority = 9;
                    else if (s.structureType === 'invaderCore') priority = 8;
                    else if (s.structureType === STRUCTURE_RAMPART) priority = 7;
                    else if (s.structureType === STRUCTURE_EXTENSION) priority = 6;
                    else if (s.structureType === STRUCTURE_WALL) priority = 3;
                    if (priority > bestMeleePri || (priority === bestMeleePri && (s.hits || 0) < bestMeleeHits)) {
                        bestMeleePri = priority;
                        bestMeleeHits = s.hits || 0;
                        bestMeleeStruct = s;
                    }
                }
            }
            if (bestMeleeStruct) {
                creep.attack(bestMeleeStruct);
                attackedCreepOrStruct = true;
            }
        }
    }

    if (hasWork && !attackedCreepOrStruct && creep.dismantle) {
        let bestDisStruct = null;
        let bestDisPri = -1;
        let bestDisHits = Infinity;
        for (let i = 0; i < structures.length; i++) {
            const s = structures[i];
            if (calcDistance(creep.pos, s.pos) <= 1) {
                let priority = 1;
                if (s.structureType === STRUCTURE_TOWER) priority = 10;
                else if (s.structureType === STRUCTURE_SPAWN) priority = 9;
                else if (s.structureType === 'invaderCore') priority = 8;
                else if (s.structureType === STRUCTURE_RAMPART) priority = 7;
                else if (s.structureType === STRUCTURE_EXTENSION) priority = 6;
                else if (s.structureType === STRUCTURE_WALL) priority = 3;
                if (priority > bestDisPri || (priority === bestDisPri && (s.hits || 0) < bestDisHits)) {
                    bestDisPri = priority;
                    bestDisHits = s.hits || 0;
                    bestDisStruct = s;
                }
            }
        }
        if (bestDisStruct) creep.dismantle(bestDisStruct);
    }

    // 3. Drive-By Healing
    if (hasHeal) {
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        } else {
            const allies = (rState && rState.creeps) || (room.find ? room.find(FIND_MY_CREEPS) : []);
            for (let i = 0; i < allies.length; i++) {
                const a = allies[i];
                if (a.hits < a.hitsMax) {
                    const d = calcDistance(creep.pos, a.pos);
                    if (d <= 1) {
                        creep.heal(a);
                        break;
                    } else if (d <= 3) {
                        creep.rangedHeal(a);
                        break;
                    }
                }
            }
        }
    }
}

// Boost-aware damage multiplier for TOUGH parts (0.7 / 0.5 / 0.3) and HEAL parts (2x / 3x / 4x)
function getToughDamageMult(creep) {
    if (!creep || !creep.body) return 1;
    let minMult = 1;
    for (let i = 0; i < creep.body.length; i++) {
        const part = creep.body[i];
        if (part.type === TOUGH && part.hits > 0 && part.boost) {
            if (part.boost === 'XGHO2') return 0.3;
            if (part.boost === 'GHO2' && minMult > 0.5) minMult = 0.5;
            else if (part.boost === 'GO' && minMult > 0.7) minMult = 0.7;
        }
    }
    return minMult;
}

function getHealPowerMultiplier(creep) {
    if (!creep || !creep.body) return 1;
    let best = 1;
    for (let i = 0; i < creep.body.length; i++) {
        const part = creep.body[i];
        if (part.type === HEAL && part.hits > 0 && part.boost) {
            if (part.boost === 'XLHO2') return 4;
            if (part.boost === 'LHO2' && best < 3) best = 3;
            else if (part.boost === 'LO' && best < 2) best = 2;
        }
    }
    return best;
}

function hasRampartInRange2(rampartGrid, x, y) {
    if (!rampartGrid) return false;
    const minX = x > 1 ? x - 2 : 0;
    const maxX = x < 48 ? x + 2 : 49;
    const minY = y > 1 ? y - 2 : 0;
    const maxY = y < 48 ? y + 2 : 49;
    for (let nx = minX; nx <= maxX; nx++) {
        const col = nx * 50;
        for (let ny = minY; ny <= maxY; ny++) {
            if (rampartGrid[col + ny] === 1) return true;
        }
    }
    return false;
}

function buildApprovedRampartSet(roomState, mincutCached, anchorPos) {
    if (!mincutCached || !mincutCached.cuts) return null;
    const sps = roomState.spawns || [];
    const tws = roomState.towers || [];
    const stPos = roomState.storage ? (roomState.storage.pos.x + ',' + roomState.storage.pos.y) : '';
    const aKey = anchorPos ? (anchorPos.x + ',' + anchorPos.y) : '';
    const sig = `${mincutCached.cuts.length}:${stPos}:${sps.length}:${tws.length}:${aKey}`;
    if (mincutCached.approvedSet && mincutCached._approvedSig === sig) {
        return mincutCached.approvedSet;
    }

    const approvedSet = new Set();
    for (let i = 0; i < mincutCached.cuts.length; i++) {
        approvedSet.add(mincutCached.cuts[i].x + ':' + mincutCached.cuts[i].y);
    }
    if (roomState.storage) approvedSet.add(roomState.storage.pos.x + ':' + roomState.storage.pos.y);
    for (let i = 0; i < sps.length; i++) {
        approvedSet.add(sps[i].pos.x + ':' + sps[i].pos.y);
    }
    for (let i = 0; i < tws.length; i++) {
        approvedSet.add(tws[i].pos.x + ':' + tws[i].pos.y);
    }
    if (anchorPos) {
        approvedSet.add(anchorPos.x + ':' + anchorPos.y);
        approvedSet.add((anchorPos.x - 2) + ':' + anchorPos.y);
        approvedSet.add((anchorPos.x + 2) + ':' + anchorPos.y);
    }
    mincutCached.approvedSet = approvedSet;
    mincutCached._approvedSig = sig;
    return approvedSet;
}

function runTowers(roomName) {
    const heap = global.heap;
    if (!heap || !heap.rooms) return;

    const roomState = heap.rooms[roomName];
    if (!roomState || !roomState.towers || !roomState.towers.length) return;

    const towers = roomState.towers;
    const hostiles = roomState.hostiles || [];
    const armedHostilesList = (roomState.armedHostiles && roomState.armedHostiles.length > 0)
        ? roomState.armedHostiles
        : hostiles.filter(h => h && h.getActiveBodyparts &&
            (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0 || h.getActiveBodyparts(HEAL) > 0 || h.getActiveBodyparts(WORK) > 0));

    // 1. Hostile Focus-Fire + Anti-Squad Healing Priority + Tower Drain Guard
    if (hostiles.length > 0) {
        const friendlyCreeps = roomState.creeps || [];
        let criticalAlly = null;
        for (let a = 0; a < friendlyCreeps.length; a++) {
            if (friendlyCreeps[a].hits < friendlyCreeps[a].hitsMax * 0.6) { criticalAlly = friendlyCreeps[a]; break; }
        }

        const enemyHealers = [];
        const friendlyCombat = [];
        for (let h = 0; h < hostiles.length; h++) {
            if (hostiles[h].getActiveBodyparts && hostiles[h].getActiveBodyparts(HEAL) > 0) enemyHealers.push(hostiles[h]);
        }
        for (let f = 0; f < friendlyCreeps.length; f++) {
            const fc = friendlyCreeps[f];
            if (!fc || fc.spawning || !fc.getActiveBodyparts) continue;
            if (fc.getActiveBodyparts(ATTACK) > 0 || fc.getActiveBodyparts(RANGED_ATTACK) > 0) friendlyCombat.push(fc);
        }
        const myRamparts = roomState.ramparts || [];
        const rampartGrid = roomState.rampartGrid || null;

        let bestTarget = null;
        let highestPriority = -Infinity;
        let fallbackInteriorArmed = null;
        let fallbackArmedHits = Infinity;

        const activeTowers = [];
        for (let t = 0; t < towers.length; t++) {
            if (towers[t].store && towers[t].store[RESOURCE_ENERGY] >= 10) activeTowers.push(towers[t]);
        }
        if (!activeTowers.length) return;

        for (let i = 0; i < hostiles.length; i++) {
            const h = hostiles[i];
            const hPos = h.pos;
            const hIdx = hPos.x * 50 + hPos.y;

            const db = getDrainBuffer(h.id, h.hits);
            const hitDelta = h.hits - db.prevHits;
            db.buffer[db.head] = hitDelta;
            db.head = (db.head + 1) % 10;
            if (db.count < 10) db.count++;
            db.prevHits = h.hits;

            let netHitsChange = 0;
            for (let b = 0; b < db.count; b++) netHitsChange += db.buffer[b];

            const isNearRampart = rampartGrid
                ? hasRampartInRange2(rampartGrid, hPos.x, hPos.y)
                : myRamparts.some(r => calcDistance(r.pos, hPos) <= 2);
            const isBorderCamper = (hPos.x <= 2 || hPos.x >= 47 || hPos.y <= 2 || hPos.y >= 47);

            let rawTowerDmg = 0;
            for (let t = 0; t < activeTowers.length; t++) {
                rawTowerDmg += getTowerDamageMatrix(activeTowers[t])[hIdx];
            }
            const toughMult = getToughDamageMult(h);
            const totalTowerDmg = rawTowerDmg * toughMult;

            // Combine nearby friendly defender DPS so towers break through healing alongside defenders
            let friendlyCombatDmg = 0;
            for (let fc = 0; fc < friendlyCombat.length; fc++) {
                const ally = friendlyCombat[fc];
                const dAlly = calcDistance(ally.pos, hPos);
                if (dAlly <= 2) friendlyCombatDmg += ally.getActiveBodyparts(ATTACK) * 30 * toughMult;
                if (dAlly <= 4) friendlyCombatDmg += ally.getActiveBodyparts(RANGED_ATTACK) * 10 * toughMult;
            }

            let squadHeal = 0;
            for (let e = 0; e < enemyHealers.length; e++) {
                const healer = enemyHealers[e];
                const dHeal = calcDistance(healer.pos, hPos);
                if (dHeal <= 1) squadHeal += healer.getActiveBodyparts(HEAL) * 12 * getHealPowerMultiplier(healer);
                else if (dHeal <= 3) squadHeal += healer.getActiveBodyparts(HEAL) * 4 * getHealPowerMultiplier(healer);
            }

            const combinedNetDmg = totalTowerDmg + friendlyCombatDmg - squadHeal;
            const isHealer = (h.getActiveBodyparts && h.getActiveBodyparts(HEAL) > 0);
            const isArmedOrHealer = isHealer || (h.getActiveBodyparts &&
                (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0 || h.getActiveBodyparts(WORK) > 0));
            const isAlphaKillable = (h.hits <= totalTowerDmg);

            if (isArmedOrHealer && (!isBorderCamper || isNearRampart) && (h.hits + squadHeal * 2) < fallbackArmedHits) {
                fallbackArmedHits = h.hits + squadHeal * 2;
                fallbackInteriorArmed = h;
            }

            if (db.count >= 8 && netHitsChange >= 0 && isBorderCamper && !isNearRampart && combinedNetDmg <= 0) {
                db.lockedUntil = Game.time + 20;
            }

            if (db.lockedUntil > Game.time && !isNearRampart && !isAlphaKillable) {
                continue;
            }

            if (combinedNetDmg <= 0 && !isAlphaKillable && !isNearRampart) {
                continue;
            }

            // Priority Scoring: Armed/Healers strictly beat unarmed decoys; focus lowest effective HP
            let score = 0;
            if (isArmedOrHealer) score += 50000;
            if (isAlphaKillable) score += 25000;
            if (isNearRampart) score += 12000;
            if (isHealer) score += 8000;
            if (combinedNetDmg > 0) score += combinedNetDmg * 2;
            else score -= 1000;

            const avgDist = calcDistance(activeTowers[0].pos, hPos);
            score -= avgDist * 20;
            score -= (h.hits + squadHeal * 2) / 50;

            if (score > highestPriority) {
                highestPriority = score;
                bestTarget = h;
            }
        }

        if (!bestTarget && armedHostilesList.length > 0 && fallbackInteriorArmed) {
            bestTarget = fallbackInteriorArmed;
        }

        if (bestTarget) {
            for (let i = 0; i < towers.length; i++) {
                if (i === 0 && criticalAlly && towers.length >= 2) {
                    towers[i].heal(criticalAlly);
                } else {
                    towers[i].attack(bestTarget);
                }
            }
            return;
        }
    }

    // 2. Friendly Creep Healing
    const friendlyCreeps = roomState.creeps || [];
    for (let i = 0; i < friendlyCreeps.length; i++) {
        const c = friendlyCreeps[i];
        if (c.hits < c.hitsMax) {
            for (let t = 0; t < towers.length; t++) {
                towers[t].heal(c);
            }
            return;
        }
    }

    const anchorPos = (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].anchor) ||
        (roomState.spawns && roomState.spawns[0] && roomState.spawns[0].pos) || null;
    const mincutCached = heap && heap.mincutCache && heap.mincutCache[roomName];
    const approvedSet = buildApprovedRampartSet(roomState, mincutCached, anchorPos);
    const approvedRamparts = approvedSet
        ? (roomState.ramparts || []).filter(r => approvedSet.has(r.pos.x + ':' + r.pos.y))
        : (roomState.ramparts || []);

    // 2.5 Active Siege Breach Surge: if sieged and towers idle (hostiles locked out at border), surge-repair weakest rampart near threat
    if (roomState.sieged && hostiles.length > 0 && approvedRamparts.length > 0) {
        const threatPos = hostiles[0].pos;
        let breachRamp = null;
        let breachScore = Infinity;
        for (let r = 0; r < approvedRamparts.length; r++) {
            const rp = approvedRamparts[r];
            if (rp.hits >= rp.hitsMax) continue;
            const d = calcDistance(rp.pos, threatPos);
            if (d <= 4 && rp.hits < breachScore) {
                breachScore = rp.hits;
                breachRamp = rp;
            }
        }
        if (breachRamp && breachRamp.hits < getDesiredRampartHits(roomState)) {
            for (let t = 0; t < towers.length; t++) {
                if (towers[t].store && towers[t].store[RESOURCE_ENERGY] >= 200) towers[t].repair(breachRamp);
            }
            return;
        }
    }

    // Hard Combat Repair Block: NEVER waste energy repairing containers, links, or roads while armed hostiles are present!
    if (armedHostilesList.length > 0) return;

    // 2.6 Critical Infrastructure Bypass (< 20% hitsMax): repairs Core/Controller containers & Center Link immediately
    let critInfra = null;
    let lowestCritRatio = 0.2;
    if (roomState.controllerContainer && roomState.controllerContainer.hitsMax > 0) {
        const r = roomState.controllerContainer.hits / roomState.controllerContainer.hitsMax;
        if (r < lowestCritRatio) { lowestCritRatio = r; critInfra = roomState.controllerContainer; }
    }
    if (anchorPos) {
        const cList = roomState.containers || [];
        for (let i = 0; i < cList.length; i++) {
            const c = cList[i];
            if (Math.abs(c.pos.x - anchorPos.x) <= 2 && Math.abs(c.pos.y - anchorPos.y) <= 2 && c.hitsMax > 0) {
                const r = c.hits / c.hitsMax;
                if (r < lowestCritRatio) { lowestCritRatio = r; critInfra = c; }
            }
        }
        const lList = roomState.links || [];
        for (let i = 0; i < lList.length; i++) {
            const l = lList[i];
            if (Math.abs(l.pos.x - anchorPos.x) <= 2 && Math.abs(l.pos.y - anchorPos.y) <= 2 && l.hitsMax > 0) {
                const r = l.hits / l.hitsMax;
                if (r < lowestCritRatio) { lowestCritRatio = r; critInfra = l; }
            }
        }
    }
    if (critInfra) {
        for (let t = 0; t < towers.length; t++) {
            if (towers[t].store && towers[t].store[RESOURCE_ENERGY] >= 10) towers[t].repair(critInfra);
        }
        return;
    }

    // 2.6b Critical Rampart Anti-Decay Bypass (< 10,000 HP): immediately boost newly built or critical ramparts above decay danger
    let critRampart = null;
    let critRampHits = 10000;
    for (let i = 0; i < approvedRamparts.length; i++) {
        const rp = approvedRamparts[i];
        if (rp.hits < critRampHits && rp.hits < rp.hitsMax) {
            critRampHits = rp.hits;
            critRampart = rp;
        }
    }
    if (critRampart) {
        for (let t = 0; t < towers.length; t++) {
            if (towers[t].store && towers[t].store[RESOURCE_ENERGY] >= 200) towers[t].repair(critRampart);
        }
        return;
    }

    // 3. Dynamic Peacetime Maintenance (Containers, Roads < 50%, Ramparts)
    const storage = roomState.storage;
    const storageEnergy = (storage && storage.store) ? (storage.store[RESOURCE_ENERGY] || 0) : 0;
    const hasStorage = !!storage;

    // Fortification Pulse: every tick > 100k, every 5 ticks >= 15k, every 10 ticks otherwise
    const fortifyInterval = (storageEnergy > 100000) ? 1 : ((storageEnergy >= 15000) ? 5 : 10);
    if (Game.time % fortifyInterval !== 0) return;

    const allowRampartRepair = hasStorage ? (storageEnergy >= 5000) : true;
    const rampartTarget = getDesiredRampartHits(roomState);
    const ramparts = allowRampartRepair ? approvedRamparts : [];

    const roads = roomState.roads || [];
    const containers = roomState.containers || [];

    let weakestRampart = null;
    let weakestHits = Infinity;
    let lowestStructure = null;
    let lowestHitsRatio = 0.5; // Only repair if hits < 50% hitsMax

    for (let s = 0; s < ramparts.length; s++) {
        const struct = ramparts[s];
        if (struct.hits < rampartTarget && struct.hits < weakestHits) {
            weakestHits = struct.hits;
            weakestRampart = struct;
        }
    }

    for (let s = 0; s < containers.length; s++) {
        const struct = containers[s];
        if (struct.hitsMax > 0) {
            const ratio = struct.hits / struct.hitsMax;
            if (ratio < lowestHitsRatio) {
                lowestHitsRatio = ratio;
                lowestStructure = struct;
            }
        }
    }

    for (let s = 0; s < roads.length; s++) {
        const struct = roads[s];
        if (struct.hitsMax > 0) {
            const ratio = struct.hits / struct.hitsMax;
            if (ratio < lowestHitsRatio) {
                lowestHitsRatio = ratio;
                lowestStructure = struct;
            }
        }
    }

    const minTowerReserve = (storageEnergy > 100000) ? 250 : ((storageEnergy >= 30000) ? 400 : 500);
    const prioritizeRampart = !!(weakestRampart && (weakestRampart.hits < 50000 || !lowestStructure));
    for (let t = 0; t < towers.length; t++) {
        const tower = towers[t];
        if (tower.store && tower.store.getUsedCapacity(RESOURCE_ENERGY) <= minTowerReserve) continue;
        if (prioritizeRampart) {
            tower.repair(weakestRampart);
        } else if (lowestStructure) {
            tower.repair(lowestStructure);
        } else if (weakestRampart) {
            tower.repair(weakestRampart);
        }
    }
}

function runPowerSpawn(roomName) {
    const heap = global.heap;
    if (!heap || !heap.rooms) return;
    const roomState = heap.rooms[roomName];
    if (!roomState) return;

    const powerSpawns = roomState.powerSpawns || [];
    if (!powerSpawns.length) return;

    const ps = powerSpawns[0];
    if (ps.store && ps.store[RESOURCE_POWER] > 0 && ps.store[RESOURCE_ENERGY] >= 50) {
        ps.processPower();
    }
}

function runDefenders(roomName) {
    const heap = global.heap;
    if (!heap) return;

    const colony = heap.colonies ? heap.colonies[roomName] : null;
    const defenders = (colony && colony.creepsByRole && colony.creepsByRole.defender) || [];
    if (!defenders.length) return;

    const maxColDistCfg = getConfig().maxColonyDistance || 7;
    const qrfInRange = !!(heap.qrfTarget && typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance &&
        Game.map.getRoomLinearDistance(roomName, heap.qrfTarget) <= maxColDistCfg);

    for (let i = 0; i < defenders.length; i++) {
        const creep = defenders[i];
        if (!creep || creep.spawning) continue;

        const hasHeal = creep.getActiveBodyparts && creep.getActiveBodyparts(HEAL) > 0;
        const hasRanged = creep.getActiveBodyparts && creep.getActiveBodyparts(RANGED_ATTACK) > 0;
        const hasMelee = creep.getActiveBodyparts && creep.getActiveBodyparts(ATTACK) > 0;
        const hasWork = creep.getActiveBodyparts && creep.getActiveBodyparts(WORK) > 0;

        if (!creep.heap) creep.heap = {};
        const curState = heap.rooms ? heap.rooms[creep.room.name] : null;
        const homeState = heap.rooms ? heap.rooms[roomName] : null;

        // Fatigue handling: execute full zero-polling weapon & heal fallback while immobile
        if (creep.fatigue > 0) {
            executeDefenseWeaponFallback(creep, null, curState);
            continue;
        }

        const subRole = creep.memory.subRole;
        const inTransitMission = !!((subRole === 'QRF' || subRole === 'ESCORT') && creep.memory.targetRoom && creep.room.name !== creep.memory.targetRoom);
        const curDanger = !!(curState && ((curState.hostiles && curState.hostiles.length > 0) || (curState.hostileStructures && curState.hostileStructures.length > 0)));
        const homeDanger = !!(homeState && ((homeState.hostiles && homeState.hostiles.length > 0) || (homeState.hostileStructures && homeState.hostileStructures.length > 0)));
        const colonyThreatActive = !!(colony && colony.threats && colony.threats.length > 0);
        const hasCombatActivity = curDanger || homeDanger || colonyThreatActive || qrfInRange || inTransitMission;
        if (hasCombatActivity) {
            creep.heap.sleepUntil = 0;
        } else if (creep.heap.sleepUntil && Game.time < creep.heap.sleepUntil && creep.hits === creep.hitsMax) {
            continue;
        }

        // Self-heal priority if injured
        if (hasHeal && creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }

        // Determine destination threat room (honoring ESCORT and QRF mission locks when home is safe)
        const homeArmed = (homeState && homeState.armedHostiles) ? homeState.armedHostiles.length : 0;
        let targetRoom = creep.memory.targetRoom;

        if (homeArmed > 0) {
            targetRoom = roomName;
        } else if (subRole === 'ESCORT' && targetRoom) {
            const tRoomObj = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[targetRoom] : null;
            const tState = heap.rooms ? heap.rooms[targetRoom] : null;
            const tArmed = tState && tState.armedHostiles ? tState.armedHostiles.length : 0;
            const tTowers = (tState && tState.towers) ? tState.towers.length : 0;
            if (tRoomObj && tRoomObj.controller && tRoomObj.controller.my && tTowers >= 1 && tArmed === 0) {
                delete creep.memory.subRole;
                targetRoom = roomName;
                creep.memory.targetRoom = roomName;
            }
        } else if (subRole === 'QRF' && targetRoom) {
            const tState = heap.rooms ? heap.rooms[targetRoom] : null;
            const tArmed = tState && tState.armedHostiles ? tState.armedHostiles.length : 0;
            if (heap.qrfTarget === targetRoom || tArmed > 0) {
                // Keep QRF mission lock active until target room is safe
            } else {
                const maxColDist = getConfig().maxColonyDistance || 7;
                const qrfDist = (heap.qrfTarget && typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance)
                    ? Game.map.getRoomLinearDistance(roomName, heap.qrfTarget)
                    : Infinity;
                if (heap.qrfTarget && qrfDist <= maxColDist) {
                    targetRoom = heap.qrfTarget;
                    creep.memory.targetRoom = targetRoom;
                } else {
                    delete creep.memory.subRole;
                    targetRoom = roomName;
                    creep.memory.targetRoom = roomName;
                }
            }
        } else if (!targetRoom || targetRoom === roomName) {
            if (colony && colony.threats && colony.threats.length > 0) {
                targetRoom = colony.threats[0].roomName;
            } else if (typeof Memory !== 'undefined' && Memory.rooms) {
                const outposts = (Memory.rooms[roomName] && Memory.rooms[roomName].outposts) || [];
                for (let o = 0; o < outposts.length; o++) {
                    const r = outposts[o];
                    if (Memory.rooms[r] && Memory.rooms[r].threat && Memory.rooms[r].threat.expiresAt > Game.time) {
                        targetRoom = r;
                        break;
                    }
                }
            }
            if ((!targetRoom || targetRoom === roomName) && heap.qrfTarget && (!colony || !colony.threats || colony.threats.length === 0)) {
                const maxColDist = getConfig().maxColonyDistance || 7;
                const qrfDist = (typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance)
                    ? Game.map.getRoomLinearDistance(roomName, heap.qrfTarget)
                    : Infinity;
                if (qrfDist <= maxColDist) {
                    targetRoom = heap.qrfTarget;
                    creep.memory.subRole = 'QRF';
                }
            }
            if (!targetRoom) targetRoom = roomName;
            creep.memory.targetRoom = targetRoom;
        }

        // Transit to target room if not there
        if (creep.room.name !== targetRoom) {
            const destPos = roomCenterPos(targetRoom);
            moveToRoomViaExit(creep, targetRoom, destPos, 2);
            executeDriveByCombat(creep);

            // Heal nearby ally on the road
            if (hasHeal && creep.hits === creep.hitsMax) {
                const rState = heap.rooms ? heap.rooms[creep.room.name] : null;
                const allies = (rState && rState.creeps) || (creep.room.find ? creep.room.find(FIND_MY_CREEPS) : []);
                const injured = allies.find(a => a.hits < a.hitsMax && calcDistance(creep.pos, a.pos) <= 3);
                if (injured) {
                    if (calcDistance(creep.pos, injured.pos) <= 1) creep.heal(injured);
                    else creep.rangedHeal(injured);
                }
            }
            continue;
        }

        // Inside target room: Hunt down hostiles from pre-scanned roomState!
        const rState = heap.rooms ? heap.rooms[creep.room.name] : null;
        const hostiles = (rState && rState.hostiles) || (creep.room.find ? creep.room.find(FIND_HOSTILE_CREEPS) : []);
        const invaderStructures = (rState && rState.hostileStructures)
            ? rState.hostileStructures
            : (creep.room.find ? creep.room.find(FIND_HOSTILE_STRUCTURES) : []);
        const allTargets = hostiles.concat(invaderStructures);

        if (allTargets.length === 0) {
            // Threat eliminated! Clear threat in Memory and heap
            if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[targetRoom]) {
                delete Memory.rooms[targetRoom].threat;
            }
            if (heap.remoteRooms && heap.remoteRooms[targetRoom]) {
                heap.remoteRooms[targetRoom].safe = true;
            }
            if (hasHeal && creep.hits < creep.hitsMax) {
                creep.heal(creep);
            }
            const hasColonyThreat = !!(colony && colony.threats && colony.threats.length > 0);
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                moveCreep(creep, roomCenterPos(targetRoom), 5);
            } else if (!hasColonyThreat) {
                creep.heap.sleepUntil = Game.time + 15;
            } else {
                creep.heap.sleepUntil = Game.time + 5;
            }
            continue;
        }

        if (!heap.threatField) heap.threatField = new Int16Array(2500);
        populateThreatField(heap.threatField, hostiles);

        // Target prioritization:
        // Alpha-Strike vulnerability & healer focus-fire
        let bestTarget = null;
        let bestScore = -Infinity;
        const myRanged = creep.getActiveBodyparts ? creep.getActiveBodyparts(RANGED_ATTACK) * 10 : 0;
        const healers = hostiles.filter(h => h.getActiveBodyparts && h.getActiveBodyparts(HEAL) > 0);

        for (let t = 0; t < allTargets.length; t++) {
            const target = allTargets[t];
            let score = calculateKillScore(target, myRanged, healers);
            const dist = calcDistance(creep.pos, target.pos);
            score -= dist * 50;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        }

        if (!bestTarget) continue;

        const dist = calcDistance(creep.pos, bestTarget.pos);
        const myAttack = creep.getActiveBodyparts ? creep.getActiveBodyparts(ATTACK) : 0;
        const targetAttack = bestTarget.getActiveBodyparts ? bestTarget.getActiveBodyparts(ATTACK) : 0;
        const targetRanged = bestTarget.getActiveBodyparts ? bestTarget.getActiveBodyparts(RANGED_ATTACK) : 0;
        const shouldKiteMelee = hasRanged && targetAttack > 0 && targetRanged === 0 && (myAttack === 0 || targetAttack > myAttack);

        // Combat execution: Mandatory Zero-Idle Fallback Chain (fires at bestTarget OR any in-range enemy/structure)
        executeDefenseWeaponFallback(creep, bestTarget, rState);

        // Build walkable-rampart set in home room (exclude unwalkable Spawn/Tower/Storage/Extension tiles)
        let walkableRamparts = null;
        if (creep.room.name === roomName && rState && rState.ramparts && rState.ramparts.length > 0) {
            const blockedTiles = new Set();
            const addBlocked = (arr) => {
                if (!arr) return;
                for (let b = 0; b < arr.length; b++) {
                    if (arr[b] && arr[b].pos) blockedTiles.add(arr[b].pos.x * 50 + arr[b].pos.y);
                }
            };
            addBlocked(rState.spawns);
            addBlocked(rState.towers);
            addBlocked(rState.extensions);
            addBlocked(rState.labs);
            addBlocked(rState.links);
            addBlocked(rState.powerSpawns);
            if (rState.storage && rState.storage.pos) blockedTiles.add(rState.storage.pos.x * 50 + rState.storage.pos.y);
            if (rState.terminal && rState.terminal.pos) blockedTiles.add(rState.terminal.pos.x * 50 + rState.terminal.pos.y);
            if (rState.factory && rState.factory.pos) blockedTiles.add(rState.factory.pos.x * 50 + rState.factory.pos.y);
            if (rState.nuker && rState.nuker.pos) blockedTiles.add(rState.nuker.pos.x * 50 + rState.nuker.pos.y);
            if (rState.observer && rState.observer.pos) blockedTiles.add(rState.observer.pos.x * 50 + rState.observer.pos.y);

            walkableRamparts = [];
            for (let rp = 0; rp < rState.ramparts.length; rp++) {
                const ramp = rState.ramparts[rp];
                if (ramp && ramp.pos && !blockedTiles.has(ramp.pos.x * 50 + ramp.pos.y)) {
                    walkableRamparts.push(ramp);
                }
            }
        }

        const standingOnWalkableRamp = !!(walkableRamparts && walkableRamparts.some(s => s.pos.x === creep.pos.x && s.pos.y === creep.pos.y));
        if (shouldKiteMelee && !standingOnWalkableRamp) {
            const room = creep.room;
            const terrain = room && room.getTerrain ? room.getTerrain() : null;
            const matrix = getCombatAvoidanceMatrix(room.name, 15);
            const kiteTile = evaluateKiteTile(creep, bestTarget, heap.threatField, terrain, matrix);
            if (kiteTile) {
                creep.heap.nextStep = kiteTile;
            } else if (dist <= 2) {
                moveCreep(creep, bestTarget.pos, 3, { costMatrix: matrix });
            } else if (dist > 3) {
                moveCreep(creep, bestTarget.pos, 3, { costMatrix: matrix });
            }
        } else if (walkableRamparts && walkableRamparts.length > 0) {
            // Walkable Rampart-Anchored Home Defense: step onto closest walkable rampart inside weapon range!
            const engageRange = (hasRanged && !hasMelee && !hasWork) ? 3 : 1;
            let bestRampart = null;
            let bestRampartScore = Infinity;
            for (let rp = 0; rp < walkableRamparts.length; rp++) {
                const ramp = walkableRamparts[rp];
                const rDist = calcDistance(ramp.pos, bestTarget.pos);
                if (rDist > engageRange) continue;
                const occupiedByOther = defenders.some(other => other.id !== creep.id && other.pos.x === ramp.pos.x && other.pos.y === ramp.pos.y);
                if (occupiedByOther) continue;
                const dFromMe = calcDistance(creep.pos, ramp.pos);
                const scoreDist = rDist * 5 + dFromMe;
                if (scoreDist < bestRampartScore) {
                    bestRampartScore = scoreDist;
                    bestRampart = ramp;
                }
            }
            if (bestRampart) {
                if (creep.pos.x !== bestRampart.pos.x || creep.pos.y !== bestRampart.pos.y) {
                    const cMat = getCombatAvoidanceMatrix(creep.room.name, 15);
                    moveCreep(creep, bestRampart.pos, 0, { costMatrix: cMat });
                }
            } else {
                let closestRamp = null;
                let minRampDist = Infinity;
                for (let rp = 0; rp < walkableRamparts.length; rp++) {
                    const ramp = walkableRamparts[rp];
                    const occupied = defenders.some(other => other.id !== creep.id && other.pos.x === ramp.pos.x && other.pos.y === ramp.pos.y);
                    if (occupied) continue;
                    const d = calcDistance(ramp.pos, bestTarget.pos);
                    if (d < minRampDist) { minRampDist = d; closestRamp = ramp; }
                }
                if (closestRamp && walkableRamparts.length >= 6 && minRampDist <= 4) {
                    if (creep.pos.x !== closestRamp.pos.x || creep.pos.y !== closestRamp.pos.y) {
                        const cMat = getCombatAvoidanceMatrix(creep.room.name, 15);
                        moveCreep(creep, closestRamp.pos, 0, { costMatrix: cMat });
                    }
                } else {
                    // Core-only ramparts or enemy out of wall reach: aggressively close distance!
                    const desiredRange = (hasMelee || hasWork) ? 1 : 3;
                    if (dist > desiredRange) {
                        const cMat = getCombatAvoidanceMatrix(creep.room.name, 15);
                        moveCreep(creep, bestTarget.pos, desiredRange, { costMatrix: cMat });
                    }
                }
            }
        } else if (hasMelee || hasWork) {
            if (dist > 1) {
                const cMat = getCombatAvoidanceMatrix(creep.room.name, 15);
                moveCreep(creep, bestTarget.pos, 1, { costMatrix: cMat });
            }
        } else if (hasRanged && dist > 3) {
            const cMat = getCombatAvoidanceMatrix(creep.room.name, 15);
            moveCreep(creep, bestTarget.pos, 3, { costMatrix: cMat });
        }

        // Healing in combat
        if (hasHeal) {
            if (creep.hits < creep.hitsMax) {
                creep.heal(creep);
            } else if (dist > 1) {
                const allies = (rState && rState.creeps) || (creep.room.find ? creep.room.find(FIND_MY_CREEPS) : []);
                const injured = allies.find(a => a.hits < a.hitsMax && calcDistance(creep.pos, a.pos) <= 3);
                if (injured) {
                    if (calcDistance(creep.pos, injured.pos) <= 1) creep.heal(injured);
                    else creep.rangedHeal(injured);
                }
            }
        }
    }
}

function runRaiders(roomName, combatOps) {
    const heap = global.heap;
    if (!heap) return;

    const colony = heap.colonies ? heap.colonies[roomName] : null;
    const raiders = (colony && colony.creepsByRole && colony.creepsByRole.raider) || [];
    if (!raiders.length) return;

    const enemyOutposts = (typeof Memory !== 'undefined' && Memory.empire && Array.isArray(Memory.empire.enemyOutposts))
        ? Memory.empire.enemyOutposts
        : [];
    const myUsername = resolveMyUsername();

    for (let i = 0; i < raiders.length; i++) {
        const creep = raiders[i];
        if (!creep || creep.spawning) continue;
        if (!creep.heap) creep.heap = {};
        if (creep.heap._strikeHandledTick === Game.time) continue;

        const hasRanged = creep.getActiveBodyparts && creep.getActiveBodyparts(RANGED_ATTACK) > 0;
        const hasMelee = creep.getActiveBodyparts && creep.getActiveBodyparts(ATTACK) > 0;
        const hasWork = creep.getActiveBodyparts && creep.getActiveBodyparts(WORK) > 0;

        const cState = heap.rooms ? heap.rooms[creep.room.name] : null;
        if (cState && ((cState.hostiles && cState.hostiles.length > 0) || (cState.hostileStructures && cState.hostileStructures.length > 0))) {
            creep.heap.sleepUntil = 0;
        }

        if (creep.fatigue > 0) {
            executeDefenseWeaponFallback(creep, null, cState);
            continue;
        }

        let targetRoom = creep.memory.targetRoom;
        if (targetRoom && isFriendlyOrEmpireRoom(targetRoom)) {
            delete creep.memory.targetRoom;
            targetRoom = null;
        }
        const validEnemyOutposts = enemyOutposts.filter(e => e && !isFriendlyOrEmpireRoom(e.roomName));
        if (!targetRoom && validEnemyOutposts.length > 0) {
            targetRoom = validEnemyOutposts[i % validEnemyOutposts.length].roomName;
            creep.memory.targetRoom = targetRoom;
        }
        if (!targetRoom) continue;

        // Transit safely around SK / Tower rooms toward target enemy outpost
        if (creep.room.name !== targetRoom) {
            executeDriveByCombat(creep);
            moveToRoomViaExit(creep, targetRoom, roomCenterPos(targetRoom), 5);
            continue;
        }

        if (isFriendlyOrEmpireRoom(creep.room.name)) {
            delete creep.memory.targetRoom;
            continue;
        }

        const hostileStructs = collectDefenseHostileStructs(cState, creep.room, myUsername);
        const hTowers = (cState && cState.hostileTowers) || [];
        const hasTowers = hTowers.length > 0;
        const hostiles = (cState && cState.hostiles) || [];
        const armedHostiles = (cState && cState.armedHostiles) || [];

        if (hasTowers || armedHostiles.length >= 3 || creep.hits < creep.hitsMax * 0.45) {
            executeDefenseWeaponFallback(creep, null, cState);
            moveToRoomViaExit(creep, roomName, roomCenterPos(roomName), 3);
            continue;
        }

        // 1. Strict 5-Tier Priority: Tier 1 Armed/Healers (100k+) -> Tier 4 Workers (10k+)
        if (hostiles.length > 0) {
            let bestTarget = null;
            let bestScore = -Infinity;
            for (let t = 0; t < hostiles.length; t++) {
                const h = hostiles[t];
                const d = calcDistance(creep.pos, h.pos);
                const hHeal = h.getActiveBodyparts && h.getActiveBodyparts(HEAL) > 0;
                const hasR = h.getActiveBodyparts && h.getActiveBodyparts(RANGED_ATTACK) > 0;
                const hasA = h.getActiveBodyparts && h.getActiveBodyparts(ATTACK) > 0;
                const score = (hHeal || hasR || hasA)
                    ? (100000 + (hHeal ? 20000 : 0) + ((hasR || hasA) ? 10000 : 0) + (h.hits <= 300 ? 30000 : 0) - d * 100)
                    : (10000 + (h.getActiveBodyparts && h.getActiveBodyparts(CLAIM) > 0 ? 500 : 0) + (h.getActiveBodyparts && h.getActiveBodyparts(WORK) > 0 ? 300 : 0) - d * 50);
                if (score > bestScore) { bestScore = score; bestTarget = h; }
            }

            if (bestTarget) {
                const hasBarriers = hostileStructs.some(s => s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL);
                const breachTarget = (hasBarriers && combatOps && combatOps.solveBreachTarget && cState)
                    ? combatOps.solveBreachTarget(targetRoom, creep.pos, bestTarget, cState)
                    : null;
                const moveGoal = breachTarget || bestTarget;

                executeDefenseWeaponFallback(creep, bestTarget, cState, breachTarget);

                const dist = calcDistance(creep.pos, moveGoal.pos);
                const myAttack = creep.getActiveBodyparts ? creep.getActiveBodyparts(ATTACK) : 0;
                const targetAttack = moveGoal.getActiveBodyparts ? moveGoal.getActiveBodyparts(ATTACK) : 0;
                const targetRanged = moveGoal.getActiveBodyparts ? moveGoal.getActiveBodyparts(RANGED_ATTACK) : 0;
                const shouldKiteMelee = !breachTarget && hasRanged && targetAttack > 0 && targetRanged === 0 && (myAttack === 0 || targetAttack > myAttack);

                if (shouldKiteMelee) {
                    if (dist <= 2) {
                        const fleePath = PathFinder.search(creep.pos, { pos: moveGoal.pos, range: 3 }, {
                            flee: true,
                            maxRooms: 1,
                            plainCost: 2,
                            swampCost: 12,
                            roomCallback: () => getCombatAvoidanceMatrix(targetRoom, 6)
                        });
                        if (fleePath && fleePath.path && fleePath.path.length > 0) {
                            moveCreep(creep, fleePath.path[0], 0);
                        }
                    } else if (dist > 3) {
                        moveCreep(creep, moveGoal.pos, 3, { costMatrix: getCombatAvoidanceMatrix(targetRoom, 6) });
                    }
                } else if (hasMelee || hasWork) {
                    if (dist > 1) moveCreep(creep, moveGoal.pos, 1, { costMatrix: getCombatAvoidanceMatrix(targetRoom, 6) });
                } else if (hasRanged && dist > 3) {
                    moveCreep(creep, moveGoal.pos, 3, { costMatrix: getCombatAvoidanceMatrix(targetRoom, 6) });
                }
            }
            continue;
        }

        // 2. Stomp hostile construction sites by walking over them (still firing at any adjacent structs!)
        const hostileSiteConst = (typeof global !== 'undefined' && global.FIND_HOSTILE_CONSTRUCTION_SITES) ? global.FIND_HOSTILE_CONSTRUCTION_SITES : 115;
        const hostileSites = creep.room.find ? creep.room.find(hostileSiteConst) : [];
        if (hostileSites.length > 0) {
            executeDefenseWeaponFallback(creep, null, cState);
            moveCreep(creep, hostileSites[0].pos, 0);
            continue;
        }

        // 3. Destroy enemy remote spawns/extensions/ramparts/containers in rival outpost (lowest HP first fallback)
        if (!isFriendlyOrEmpireRoom(creep.room.name)) {
            const enemyStruct = hostileStructs.find(s => s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) ||
                ((cState && cState.containers) ? cState.containers.find(c => !c.my) : null) ||
                hostileStructs[0];
            if (enemyStruct) {
                const breachTarget = (combatOps && combatOps.solveBreachTarget && cState)
                    ? combatOps.solveBreachTarget(targetRoom, creep.pos, enemyStruct, cState)
                    : null;
                const moveGoal = breachTarget || enemyStruct;
                executeDefenseWeaponFallback(creep, enemyStruct, cState, breachTarget);
                const dist = calcDistance(creep.pos, moveGoal.pos);
                const desiredR = (hasRanged && !hasMelee && !hasWork) ? 3 : 1;
                if (dist > desiredR) moveCreep(creep, moveGoal.pos, desiredR, { costMatrix: getCombatAvoidanceMatrix(targetRoom, 15) });
                continue;
            }
        }

        // Room clean: rotate to next enemy outpost if multiple exist
        if (validEnemyOutposts.length > 1) {
            const nextIdx = (validEnemyOutposts.findIndex(e => e.roomName === targetRoom) + 1) % validEnemyOutposts.length;
            creep.memory.targetRoom = validEnemyOutposts[nextIdx].roomName;
        } else if (calcDistance(creep.pos, { x: 25, y: 25 }) > 5) {
            moveCreep(creep, roomCenterPos(targetRoom), 4);
        }
    }
}

function checkAutoSafeMode(room, roomState) {
    if (!getConfig().autoSafeMode) return;
    if (!room || !room.controller || !room.controller.my || !room.controller.activateSafeMode) return;
    const ctrl = room.controller;
    if (ctrl.safeMode || ctrl.safeModeCooldown || !ctrl.safeModeAvailable) return;
    const armed = roomState && roomState.armedHostiles ? roomState.armedHostiles : [];
    if (!armed.length) return;

    const rampartGrid = roomState ? roomState.rampartGrid : null;
    const ramparts = (!rampartGrid && roomState && roomState.ramparts) ? roomState.ramparts : [];
    const hasRampartAt = (pos) => {
        if (rampartGrid) return rampartGrid[pos.x * 50 + pos.y] === 1;
        for (let r = 0; r < ramparts.length; r++) {
            if (ramparts[r].hits >= 2000 && ramparts[r].pos.x === pos.x && ramparts[r].pos.y === pos.y) return true;
        }
        return false;
    };

    const coreCritical = []
        .concat(roomState.spawns || [])
        .concat(roomState.storage ? [roomState.storage] : [])
        .concat(roomState.towers || [])
        .concat(roomState.terminal ? [roomState.terminal] : []);

    for (let i = 0; i < coreCritical.length; i++) {
        const st = coreCritical[i];
        if (!st) continue;
        if (st.hits < st.hitsMax) {
            ctrl.activateSafeMode();
            return;
        }
        // Breach: an armed hostile this deep inside the bunker means the perimeter has failed
        for (let h = 0; h < armed.length; h++) {
            if (calcDistance(armed[h].pos, st.pos) <= 2) {
                ctrl.activateSafeMode();
                return;
            }
        }
        if (!hasRampartAt(st.pos)) {
            for (let h = 0; h < armed.length; h++) {
                if (calcDistance(armed[h].pos, st.pos) <= 3) {
                    ctrl.activateSafeMode();
                    return;
                }
            }
        }
    }
}

function runDrainers(roomName) {
    const heap = global.heap;
    if (!heap || !heap.colonies) return;
    const colony = heap.colonies[roomName];
    const drainers = (colony && colony.creepsByRole && colony.creepsByRole.drainer) || [];
    if (!drainers.length) return;

    for (let i = 0; i < drainers.length; i++) {
        const creep = drainers[i];
        if (!creep || creep.spawning) continue;
        if (!creep.heap) creep.heap = {};

        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) continue;

        const hasHeal = creep.getActiveBodyparts && creep.getActiveBodyparts(HEAL) > 0;
        const safeRoom = creep.memory.safeRoom || roomName;

        if (hasHeal && creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }

        if (creep.room.name === safeRoom) {
            if (creep.hits === creep.hitsMax) {
                moveToRoomViaExit(creep, targetRoom, roomCenterPos(targetRoom), 0);
            } else if (creep.pos.x <= 1 || creep.pos.x >= 48 || creep.pos.y <= 1 || creep.pos.y >= 48) {
                moveCreep(creep, roomCenterPos(safeRoom), 2);
            }
        } else if (creep.room.name === targetRoom) {
            const tState = heap.rooms ? heap.rooms[targetRoom] : null;
            const towers = (tState && tState.towers) || (creep.room.find ? creep.room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }) : []);
            const activeTowers = towers.filter(t => t.store && t.store[RESOURCE_ENERGY] > 10);
            if (activeTowers.length === 0 && typeof Memory !== 'undefined' && Memory.rooms) {
                if (!Memory.rooms[targetRoom]) Memory.rooms[targetRoom] = {};
                Memory.rooms[targetRoom].towersDrained = true;
            }
            moveToRoomViaExit(creep, safeRoom, roomCenterPos(safeRoom), 2);
        } else {
            moveToRoomViaExit(creep, safeRoom, roomCenterPos(safeRoom), 2);
        }
    }
}

function runSiegeWreckers(roomName, combatOps) {
    const heap = global.heap;
    if (!heap || !heap.colonies) return;
    const colony = heap.colonies[roomName];
    const wreckers = (colony && colony.creepsByRole && colony.creepsByRole.teamWrecker) || [];
    const healers = (colony && colony.creepsByRole && colony.creepsByRole.teamHealer) || [];
    if (!wreckers.length) return;
    const myUsername = resolveMyUsername();
    const inTargetByRoom = {};

    for (let i = 0; i < wreckers.length; i++) {
        const wrecker = wreckers[i];
        if (!wrecker || wrecker.spawning) continue;
        if (!wrecker.heap) wrecker.heap = {};
        const partner = healers[i] || null;
        if (partner && !partner.heap) partner.heap = {};

        const targetRoom = wrecker.memory.targetRoom;
        if (!targetRoom) continue;

        if (partner && !partner.spawning) {
            if (partner.getActiveBodyparts(HEAL) > 0) {
                if (wrecker.hits < wrecker.hitsMax) partner.heal(wrecker);
                else if (partner.hits < partner.hitsMax) partner.heal(partner);
                else partner.heal(wrecker);
            }
            if (partner.fatigue === 0 && calcDistance(wrecker.pos, partner.pos) > 1) {
                moveCreep(partner, wrecker.pos, 1);
            }
        }

        if (wrecker.room.name !== targetRoom) {
            executeDriveByCombat(wrecker);
            if (wrecker.fatigue === 0) moveToRoomViaExit(wrecker, targetRoom, roomCenterPos(targetRoom), 15);
            continue;
        }

        wrecker.heap.sleepUntil = 0;
        if (partner && partner.heap) partner.heap.sleepUntil = 0;

        if (combatOps && combatOps.executeCombatUnitDoctrine) {
            if (!inTargetByRoom[targetRoom]) inTargetByRoom[targetRoom] = [];
            inTargetByRoom[targetRoom].push(wrecker);
            continue;
        }

        const tState = heap.rooms ? heap.rooms[targetRoom] : null;
        const hostileStructs = collectDefenseHostileStructs(tState, wrecker.room, myUsername);

        const target = hostileStructs.find(s => s.structureType === STRUCTURE_TOWER) ||
                       hostileStructs.find(s => s.structureType === STRUCTURE_SPAWN) ||
                       hostileStructs.find(s => s.structureType === STRUCTURE_STORAGE) ||
                       hostileStructs[0];

        const breachTarget = (target && combatOps && combatOps.solveBreachTarget && tState)
            ? combatOps.solveBreachTarget(targetRoom, wrecker.pos, target, tState)
            : null;
        const moveGoal = breachTarget || target;
        executeDefenseWeaponFallback(wrecker, target, tState, breachTarget);
        if (wrecker.fatigue === 0 && moveGoal && calcDistance(wrecker.pos, moveGoal.pos) > 1) {
            moveCreep(wrecker, moveGoal.pos, 1, { costMatrix: getCombatAvoidanceMatrix(targetRoom, 6) });
        }
    }

    if (combatOps && combatOps.executeCombatUnitDoctrine) {
        for (const tRoom in inTargetByRoom) {
            const tState = heap.rooms ? heap.rooms[tRoom] : null;
            combatOps.executeCombatUnitDoctrine(inTargetByRoom[tRoom], tRoom, roomName, tState);
        }
    }
}

function runNukers(roomName) {
    if (typeof Game === 'undefined') return;
    const room = Game.rooms[roomName];
    if (!room || !room.controller || !room.controller.my || room.controller.level < 8) return;

    const heap = global.heap;
    const roomState = heap && heap.rooms ? heap.rooms[roomName] : null;

    const nuker = roomState ? roomState.nuker : null;
    if (!nuker || nuker.cooldown > 0) return;
    if (!nuker.store || nuker.store[RESOURCE_ENERGY] < 300000 || nuker.store[RESOURCE_GHODIUM] < 5000) return;

    if (typeof Memory === 'undefined') return;
    if (!Memory.empire) Memory.empire = {};
    if (!Array.isArray(Memory.empire.nukeStrikes)) Memory.empire.nukeStrikes = [];

    // Clean up old nuke strikes
    Memory.empire.nukeStrikes = Memory.empire.nukeStrikes.filter(s => s && s.impactTick > Game.time - 100);

    const targetRooms = [];
    if (Array.isArray(Memory.empire.enemyRooms)) {
        for (let i = 0; i < Memory.empire.enemyRooms.length; i++) {
            const eRoom = Memory.empire.enemyRooms[i];
            if (eRoom && !isFriendlyOrEmpireRoom(eRoom)) targetRooms.push(eRoom);
        }
    }
    if (Array.isArray(Memory.empire.raidTargets)) {
        for (let i = 0; i < Memory.empire.raidTargets.length; i++) {
            const rt = Memory.empire.raidTargets[i];
            const rName = rt && rt.roomName ? rt.roomName : rt;
            if (rName && !isFriendlyOrEmpireRoom(rName) && targetRooms.indexOf(rName) === -1) {
                targetRooms.push(rName);
            }
        }
    }

    // Evaluate target rooms within linear range 10
    for (let i = 0; i < targetRooms.length; i++) {
        const tRoom = targetRooms[i];
        if (Memory.empire.nukeStrikes.some(s => s.targetRoom === tRoom)) continue;

        const linDist = Game.map.getRoomLinearDistance(roomName, tRoom);
        if (linDist > 10) continue;

        let targetPos = null;
        const scout = Memory.rooms && Memory.rooms[tRoom] ? Memory.rooms[tRoom].scoutData : null;

        if (scout && scout.clusters && scout.clusters.length > 0) {
            targetPos = new RoomPosition(scout.clusters[0].x, scout.clusters[0].y, tRoom);
        } else if (Game.rooms[tRoom]) {
            const targetRoomObj = Game.rooms[tRoom];
            const criticals = targetRoomObj.find(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_SPAWN ||
                    s.structureType === STRUCTURE_STORAGE ||
                    s.structureType === STRUCTURE_TERMINAL ||
                    s.structureType === STRUCTURE_TOWER
            });
            if (criticals.length >= 2) {
                let bestTile = null;
                let maxHit = 0;
                for (let c = 0; c < criticals.length; c++) {
                    const cPos = criticals[c].pos;
                    const inRange = criticals.filter(other => calcDistance(cPos, other.pos) <= 2).length;
                    if (inRange > maxHit) {
                        maxHit = inRange;
                        bestTile = cPos;
                    }
                }
                if (bestTile && maxHit >= 2) {
                    targetPos = bestTile;
                }
            }
        }

        if (targetPos) {
            const res = nuker.launchNuke(targetPos);
            if (res === OK) {
                Memory.empire.nukeStrikes.push({
                    nukerRoom: roomName,
                    targetRoom: tRoom,
                    x: targetPos.x,
                    y: targetPos.y,
                    launchTick: Game.time,
                    impactTick: Game.time + 50000,
                    dispatched: false
                });
                console.log(`[IMPERIAL COMMAND] 🚀 NUKER LAUNCH CONFIRMED! Target: ${tRoom} (${targetPos.x},${targetPos.y}) from ${roomName}! Impact at tick ${Game.time + 50000}`);
                break;
            }
        }
    }
}

function checkNukeSynchronizedAssault() {
    if (typeof Memory === 'undefined' || !Memory.empire || !Array.isArray(Memory.empire.nukeStrikes)) return;
    for (let i = 0; i < Memory.empire.nukeStrikes.length; i++) {
        const strike = Memory.empire.nukeStrikes[i];
        if (!strike || strike.dispatched) continue;
        const timeToImpact = strike.impactTick - Game.time;
        const travelDistance = (typeof Game !== 'undefined' && Game.map) ? Game.map.getRoomLinearDistance(strike.nukerRoom, strike.targetRoom) : 5;
        const transitTicks = travelDistance * 50 + 150;
        if (timeToImpact <= transitTicks) {
            strike.dispatched = true;
            if (!Memory.empire.raidTargets) Memory.empire.raidTargets = [];
            if (!Memory.empire.raidTargets.some(r => (r.roomName || r) === strike.targetRoom)) {
                Memory.empire.raidTargets.unshift({ roomName: strike.targetRoom, priority: 100, assaultType: 'nukeBreach' });
            }
            console.log(`[IMPERIAL COMMAND] ⚔️ SYNCHRONIZED ASSAULT DISPATCHED: Striking ${strike.targetRoom} to breach on impact tick ${strike.impactTick}!`);
        }
    }
}

// Siege Economy Lockdown: armed hostiles within range 10 of the core and storage < 50k.
// Sticky for 100 ticks after the last sighting. Read via isLockdown(roomName).
function updateSiegeLockdown(roomName, roomState) {
    const heap = global.heap;
    if (!heap.lockdown) heap.lockdown = {};
    const armed = roomState.armedHostiles || [];
    const anchor = (roomState.spawns && roomState.spawns[0]) || roomState.storage;
    let sieged = false;
    if (anchor && armed.length > 0) {
        for (let i = 0; i < armed.length; i++) {
            if (calcDistance(armed[i].pos, anchor.pos) <= 10) { sieged = true; break; }
        }
    }
    const storage = roomState.storage;
    const storageEnergy = (storage && storage.store) ? (storage.store[RESOURCE_ENERGY] || 0) : 0;
    if (sieged && storageEnergy < 50000) heap.lockdown[roomName] = Game.time + 100;
    roomState.sieged = sieged;
}

function isLockdown(roomName) {
    const heap = global.heap;
    return !!(heap && heap.lockdown && heap.lockdown[roomName] > Game.time);
}

// Flag-gated Rampart Melee Assassins ([ATTACK, MOVE]): sit on interior ramparts and strike adjacent enemies.
function runAssassins(roomName) {
    if (!(typeof global !== 'undefined' && global.ENABLE_ASSASSINS) &&
        !(typeof Memory !== 'undefined' && Memory.empire && Memory.empire.enableAssassins)) return;
    const heap = global.heap;
    const rState = heap && heap.rooms ? heap.rooms[roomName] : null;
    if (!rState) return;
    const col = heap && heap.colonies ? heap.colonies[roomName] : null;
    const assassins = (col && col.creepsByRole && col.creepsByRole.assassin) ||
        (rState.creepsByRole && rState.creepsByRole.assassin) || [];
    if (assassins.length === 0) return;

    const hostiles = rState.armedHostiles && rState.armedHostiles.length > 0 ? rState.armedHostiles : (rState.hostiles || []);
    const ramparts = rState.ramparts || [];
    if (hostiles.length === 0 || ramparts.length === 0) return;

    for (let i = 0; i < assassins.length; i++) {
        const c = assassins[i];
        if (!c || c.spawning) continue;
        // Strike any adjacent hostile first (zero movement cost)
        let adj = null;
        for (let h = 0; h < hostiles.length; h++) {
            if (calcDistance(c.pos, hostiles[h].pos) <= 1) { adj = hostiles[h]; break; }
        }
        if (adj) {
            c.attack(adj);
            continue;
        }
        if (c.fatigue > 0) continue;
        // Find the rampart tile closest to the leading hostile and lock inside it
        const targetH = hostiles[0];
        let bestRamp = null;
        let bestDist = Infinity;
        for (let r = 0; r < ramparts.length; r++) {
            const d = calcDistance(ramparts[r].pos, targetH.pos);
            if (d < bestDist) { bestDist = d; bestRamp = ramparts[r]; }
        }
        if (bestRamp && (c.pos.x !== bestRamp.pos.x || c.pos.y !== bestRamp.pos.y)) {
            moveCreep(c, bestRamp.pos, 0);
        }
    }
}

function runDefense(roomName) {
    const heap = global.heap;
    if (!heap) return;

    if (heap.nukeCheckTick !== Game.time) {
        heap.nukeCheckTick = Game.time;
        checkNukeSynchronizedAssault();
    }

    for (const rName in Game.rooms) {
        if (roomName && rName !== roomName) continue;
        const room = Game.rooms[rName];
        const roomState = heap.rooms ? heap.rooms[rName] : null;
        if (room && room.controller && room.controller.my && roomState) {
            checkAutoSafeMode(room, roomState);
            updateSiegeLockdown(rName, roomState);
        }
        runTowers(rName);
        runDefenders(rName);
        runAssassins(rName);
        runNukers(rName);

        if (roomState && roomState.hostiles && roomState.hostiles.length > 0) {
            const defenders = roomState.creepsByRole.defender || [];
            if (defenders.length < roomState.hostiles.length) {
                requestGlobalReinforcements(rName, rName);
            }
        }
    }
}

module.exports = {
    isLockdown,
    executeDriveByCombat,
    isRoomHostile,
    requestGlobalReinforcements,
    runDefenders,
    runDefense,
    runDrainers,
    runNukers,
    runPowerCreeps,
    runPowerSpawn,
    runRaiders,
    runSiegeWreckers,
    runTowers
};
