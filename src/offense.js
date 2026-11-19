// src/offense.js
// The Imperial Plague: Sector Starvation (Hunter-Killers), Pest Border Dancing, FOB Hijack & Necrosis Swarm Siege
const { roomCenterPos, calcDistance, getOrCreateIntId, getRivalSafeModeRemaining, populateThreatField, evaluateKiteTile, hasSlowMoveRatio, calculateKillScore } = require('./constants');
const { getBaseTileCost, getCombatAvoidanceMatrix, moveCreep } = require('./traffic');
const { moveToRoomViaExit } = require('./remotes');
const { calcBodyPower, calcRoomHostilePower, calcUnitPower, getBoostMult, getRemoteSlot, getRoomThreatPower, isFriendlyOrEmpireRoom, setSegmentData, getSegmentData, requestSegment, resolveMyUsername } = require('./state');
const { executeDriveByCombat, runRaiders, runDrainers, runSiegeWreckers } = require('./defense');
const { getConfig, isOffenseAllowed } = require('./config');

function ensureOffenseBuffers() {
    if (!global.heap) global.heap = {};
    const h = global.heap;
    if (!h.rivalRemoteFlags) h.rivalRemoteFlags = new Uint8Array(256);   // bit0: activeWorkers, bit1: cleared, bit2: dropReady
    if (!h.rivalRemoteMeta) h.rivalRemoteMeta = new Uint16Array(256);    // low 8b: workerCount, high 8b: defenderThreat
    if (!h.rivalRemoteTick) h.rivalRemoteTick = new Int32Array(256);
    if (!h.rivalDropAmount) h.rivalDropAmount = new Uint32Array(256);
    if (!h.threatField) h.threatField = new Int16Array(2500);
    if (!h.rivalCitadelStorage) h.rivalCitadelStorage = {};
    if (!h.targetRoi) h.targetRoi = {};
    if (!h.roomIntel) h.roomIntel = {};
    if (!h.strikeGroups) h.strikeGroups = {};
    if (!h.stagingRouteCache) h.stagingRouteCache = {};
    if (!h.exitTilesCache) h.exitTilesCache = {};

    // Hydrate once per global reset from Memory.rooms if rivalCitadelStorage is empty
    if (!h._rivalCitadelHydrated) {
        h._rivalCitadelHydrated = true;
        if (Object.keys(h.rivalCitadelStorage).length === 0 && typeof Memory !== 'undefined' && Memory.rooms) {
            for (const rn in Memory.rooms) {
                const sd = Memory.rooms[rn].scoutData;
                if (sd && sd.controller && sd.controller.owner && !isFriendlyOrEmpireRoom(rn)) {
                    h.rivalCitadelStorage[rn] = {
                        roomName: rn,
                        owner: sd.controller.owner,
                        rcl: sd.controller.level || 1,
                        storageEnergy: sd.structuresSummary ? (sd.structuresSummary.storageEnergy || 0) : 0,
                        towers: sd.towersCount || 0,
                        safeMode: sd.controller.safeMode || 0,
                        safeModeUntil: sd.controller.safeModeUntil || (sd.controller.safeMode ? sd.lastSeen + sd.controller.safeMode : 0),
                        tick: sd.lastSeen || Game.time
                    };
                }
            }
        }
    }
    return h;
}

function recordRoomCombatRoi(roomName, damageDealtDelta, energyLostDelta) {
    if (!roomName) return null;
    const h = ensureOffenseBuffers();
    const now = (typeof Game !== 'undefined' && Game.time) ? Game.time : 0;
    let entry = h.targetRoi[roomName];
    if (!entry) {
        entry = { damageDealt: 0, energyLost: 0, haltedUntil: 0 };
        h.targetRoi[roomName] = entry;
    }
    if (damageDealtDelta > 0) entry.damageDealt += damageDealtDelta;
    if (energyLostDelta > 0) entry.energyLost += energyLostDelta;
    if (entry.energyLost >= 4000 && entry.damageDealt < entry.energyLost * 0.5) {
        if (!entry.haltedUntil || entry.haltedUntil <= now) {
            entry.haltedUntil = now + 500;
        }
    }
    return entry;
}

function isTargetRoiNegative(roomName) {
    if (!roomName || !global.heap || !global.heap.targetRoi) return false;
    const entry = global.heap.targetRoi[roomName];
    if (!entry) return false;
    const now = (typeof Game !== 'undefined' && Game.time) ? Game.time : 0;
    return !!(entry.haltedUntil && entry.haltedUntil > now);
}

function collectHostileCandidates(colonyName, maxRange) {
    const h = ensureOffenseBuffers();
    const limit = maxRange || 4;
    const now = (typeof Game !== 'undefined' && Game.time) ? Game.time : 0;
    const candidates = {};

    const addCandidate = (roomName, patch) => {
        if (!roomName || roomName === colonyName || isFriendlyOrEmpireRoom(roomName)) return;
        const dist = (typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance)
            ? Game.map.getRoomLinearDistance(colonyName, roomName)
            : 2;
        if (dist > limit) return;
        const cur = candidates[roomName] || {
            roomName,
            dist,
            isOwnedCore: false,
            isRemote: false,
            towers: 0,
            rcl: 0,
            hasRamparts: false,
            controllerExposed: false,
            upgradeBlocked: 0
        };
        if (patch.isOwnedCore) cur.isOwnedCore = true;
        if (patch.isRemote) cur.isRemote = true;
        if (patch.towers !== undefined && patch.towers > cur.towers) cur.towers = patch.towers;
        if (patch.rcl !== undefined && patch.rcl > cur.rcl) cur.rcl = patch.rcl;
        if (patch.hasRamparts) cur.hasRamparts = true;
        if (patch.controllerExposed) cur.controllerExposed = true;
        if (patch.upgradeBlocked) cur.upgradeBlocked = patch.upgradeBlocked;
        candidates[roomName] = cur;
    };

    if (h.remoteSlotMap) {
        for (const rName in h.remoteSlotMap) {
            const slot = h.remoteSlotMap[rName];
            if ((now - h.rivalRemoteTick[slot]) > 1500) continue;
            if ((h.rivalRemoteFlags[slot] & 1) || (h.rivalRemoteFlags[slot] & 4)) {
                addCandidate(rName, { isRemote: true, towers: 0 });
            }
        }
    }

    if (typeof Memory !== 'undefined' && Memory.empire) {
        if (Array.isArray(Memory.empire.enemyOutposts)) {
            for (let i = 0; i < Memory.empire.enemyOutposts.length; i++) {
                const e = Memory.empire.enemyOutposts[i];
                if (e && e.roomName) addCandidate(e.roomName, { isRemote: true, towers: e.towersCount || 0 });
            }
        }
        if (Array.isArray(Memory.empire.raidTargets)) {
            for (let i = 0; i < Memory.empire.raidTargets.length; i++) {
                const rt = Memory.empire.raidTargets[i];
                if (!rt || !rt.roomName) continue;
                const owned = !!rt.owner && !rt.reservation;
                addCandidate(rt.roomName, {
                    isOwnedCore: owned,
                    isRemote: !owned,
                    towers: rt.towersCount || 0
                });
            }
        }
    }

    if (h.rivalCitadelStorage) {
        for (const rName in h.rivalCitadelStorage) {
            const p = h.rivalCitadelStorage[rName];
            if (!p) continue;
            addCandidate(rName, {
                isOwnedCore: true,
                towers: p.towers || p.towersCount || 0,
                rcl: p.rcl || 0,
                hasRamparts: !!p.hasRamparts,
                controllerExposed: p.controllerExposed !== undefined ? !!p.controllerExposed : !p.hasRamparts,
                upgradeBlocked: p.upgradeBlocked || 0
            });
        }
    }

    if (h.roomIntel) {
        for (const rName in h.roomIntel) {
            const ri = h.roomIntel[rName];
            if (!ri || (ri.threatPower || 0) <= 0) continue;
            addCandidate(rName, { isRemote: (ri.activeTowers || 0) === 0, towers: ri.activeTowers || 0 });
        }
    }

    return candidates;
}

function getEffectiveCandidateThreat(rName, cand, h) {
    let tPower = getRoomThreatPower(rName);
    const hasIntel = !!(h && h.roomIntel && h.roomIntel[rName]);
    if (tPower === 0 && !hasIntel && cand && cand.towers > 0) {
        tPower = cand.towers * 600;
    }
    return tPower;
}

function selectHostileTarget(colonyName, role, cfg) {
    const h = ensureOffenseBuffers();
    const candidates = collectHostileCandidates(colonyName, 4);
    const isCoreRole = (role === 'quad' || role === 'drainer' || role === 'teamWrecker' || role === 'controllerAttacker');
    const c = cfg || getConfig();
    if (role === 'quad' && c && c.allowQuads === false) return null;
    if (role === 'pest' && c && c.allowPests === false) return null;

    const pestPower = (role === 'pest') ? calcBodyPower([ATTACK, MOVE]) : 0;
    let bestRoom = null;
    let bestScore = -Infinity;

    for (const rName in candidates) {
        if (isTargetRoiNegative(rName)) continue;
        if (getRivalSafeModeRemaining(rName) > 0) continue;

        const cand = candidates[rName];
        if (role === 'pest') {
            const threatPower = getEffectiveCandidateThreat(rName, cand, h);
            // Anti-Feed Gate: never send solo [ATTACK, MOVE] pests into a defended room
            if (threatPower > 0 && pestPower < threatPower * 1.25) continue;
        }

        if (isCoreRole) {
            if (!cand.isOwnedCore) continue;
            if (role === 'controllerAttacker') {
                if (!cand.controllerExposed || cand.upgradeBlocked > 0) continue;
            }
            const score = 1000
                - (cand.towers * 200)
                - (cand.hasRamparts ? 400 : 0)
                - (cand.rcl * 50)
                - (cand.dist * 30)
                + (cand.controllerExposed ? 150 : 0);
            if (score > bestScore) {
                bestScore = score;
                bestRoom = rName;
            }
        } else {
            const softBonus = cand.isRemote
                ? 1000
                : ((cand.towers === 0 ? 600 : -cand.towers * 150) + (cand.rcl > 0 && cand.rcl <= 4 ? 300 : 0) + (cand.hasRamparts ? -200 : 200));
            const score = softBonus - (cand.dist * 40);
            if (score > bestScore) {
                bestScore = score;
                bestRoom = rName;
            }
        }
    }

    return bestRoom;
}

function selectStrikeGroupTarget(colonyName, cfg) {
    const h = ensureOffenseBuffers();
    const c = cfg || getConfig();
    if (!isOffenseAllowed('hunter', c)) return null;
    const candidates = collectHostileCandidates(colonyName, 4);
    const pestPower = calcBodyPower([ATTACK, MOVE]);

    let best = null;
    let bestScore = -Infinity;

    for (const rName in candidates) {
        if (isTargetRoiNegative(rName)) continue;
        if (getRivalSafeModeRemaining(rName) > 0) continue;

        const cand = candidates[rName];
        const threatPower = getEffectiveCandidateThreat(rName, cand, h);
        if (threatPower <= 0 || pestPower >= threatPower * 1.25) continue;

        const score = (cand.towers === 0 ? 1000 : (300 - cand.towers * 150))
            - (cand.dist * 40)
            + Math.min(200, Math.round(threatPower * 0.2));
        if (score > bestScore) {
            bestScore = score;
            best = {
                roomName: rName,
                threatPower,
                requiredPower: Math.max(200, Math.ceil(threatPower * 1.35)),
                isOwnedCore: !!cand.isOwnedCore,
                towers: cand.towers || 0
            };
        }
    }
    return best;
}

function selectSofterRivalTarget(originRoom, maxThreatPower, excludeRoom) {
    const h = ensureOffenseBuffers();
    const candidates = collectHostileCandidates(originRoom, 5);
    let bestRoom = null;
    let bestScore = -Infinity;

    for (const rName in candidates) {
        if (rName === excludeRoom) continue;
        if (isTargetRoiNegative(rName)) continue;
        if (getRivalSafeModeRemaining(rName) > 0) continue;
        const cand = candidates[rName];
        const tPower = getEffectiveCandidateThreat(rName, cand, h);
        if (tPower >= maxThreatPower) continue;

        const score = (tPower === 0 ? 500 : 100 - tPower * 0.5)
            + (cand.isRemote ? 200 : 0)
            - (cand.dist * 60);
        if (score > bestScore) {
            bestScore = score;
            bestRoom = rName;
        }
    }
    return bestRoom;
}

function getCombatPartsCount(h) {
    if (!h || !h.getActiveBodyparts) return { heal: 0, ranged: 0, attack: 0, work: 0, carry: 0, claim: 0 };
    return {
        heal: h.getActiveBodyparts(HEAL),
        ranged: h.getActiveBodyparts(RANGED_ATTACK),
        attack: h.getActiveBodyparts(ATTACK),
        work: h.getActiveBodyparts(WORK),
        carry: h.getActiveBodyparts(CARRY),
        claim: h.getActiveBodyparts(CLAIM)
    };
}

function isBroken(creep) {
    if (!creep) return true;
    const atkType = typeof ATTACK !== 'undefined' ? ATTACK : 'attack';
    const rngType = typeof RANGED_ATTACK !== 'undefined' ? RANGED_ATTACK : 'ranged_attack';
    const healType = typeof HEAL !== 'undefined' ? HEAL : 'heal';

    if (Array.isArray(creep.body) && creep.body.length > 0) {
        let hadWeapon = false;
        let activeWeapon = 0;
        for (let i = 0; i < creep.body.length; i++) {
            const part = creep.body[i];
            if (!part) continue;
            const t = typeof part === 'string' ? part : part.type;
            if (t === atkType || t === rngType) {
                hadWeapon = true;
                if (part.hits === undefined || part.hits > 0) activeWeapon++;
            }
        }
        return hadWeapon && activeWeapon === 0;
    }

    if (creep.getActiveBodyparts) {
        const activeWeapons = (creep.getActiveBodyparts(atkType) || 0) + (creep.getActiveBodyparts(rngType) || 0);
        if (activeWeapons > 0) {
            if (!creep.heap) creep.heap = {};
            creep.heap._wasArmed = true;
            return false;
        }
        const activeHeal = creep.getActiveBodyparts(healType) || 0;
        if (creep.heap && creep.heap._wasArmed) return true;
        const role = (creep.memory && creep.memory.role) || (creep.heap && creep.heap.role);
        if (activeHeal === 0 && (role === 'hunter' || role === 'pest' || role === 'raider' || role === 'assassin') &&
            creep.hits !== undefined && creep.hitsMax !== undefined && creep.hits < creep.hitsMax) {
            return true;
        }
    }
    return false;
}

function summarizeSideCombatStats(units) {
    const atkType = typeof ATTACK !== 'undefined' ? ATTACK : 'attack';
    const rngType = typeof RANGED_ATTACK !== 'undefined' ? RANGED_ATTACK : 'ranged_attack';
    const healType = typeof HEAL !== 'undefined' ? HEAL : 'heal';
    const toughType = typeof TOUGH !== 'undefined' ? TOUGH : 'tough';
    let effectiveHp = 0;
    let dps = 0;
    let squadHeal = 0;
    let minToughMult = 1;

    for (let i = 0; i < (units ? units.length : 0); i++) {
        const u = units[i];
        if (!u || u.spawning || (u.hits !== undefined && u.hits <= 0)) continue;
        if (Array.isArray(u.body) && u.body.length > 0) {
            let unitToughMult = 1;
            let unitBoostedToughHits = 0;
            let unitEffHp = 0;
            let hasPartHits = false;
            for (let b = 0; b < u.body.length; b++) {
                const p = u.body[b];
                if (!p) continue;
                if (p.hits !== undefined) {
                    hasPartHits = true;
                    if (p.hits <= 0) continue;
                }
                const t = typeof p === 'string' ? p : p.type;
                const boost = typeof p === 'string' ? null : p.boost;
                const mult = boost ? getBoostMult(boost) : 1;
                const pHits = p.hits !== undefined ? p.hits : 100;
                let dmgMult = 1;
                if (t === toughType && boost) {
                    if (boost === 'XGHO2') dmgMult = 0.3;
                    else if (boost === 'GHO2') dmgMult = 0.5;
                    else if (boost === 'GO') dmgMult = 0.7;
                    else dmgMult = Math.max(0.3, 1 / mult);
                    if (dmgMult < unitToughMult && pHits > 0) {
                        unitToughMult = dmgMult;
                        unitBoostedToughHits += pHits;
                    }
                }
                unitEffHp += pHits / dmgMult;
                if (t === atkType) dps += 30 * mult;
                else if (t === rngType) dps += 10 * mult;
                else if (t === healType) squadHeal += 12 * mult;
            }
            if (!hasPartHits && u.hits !== undefined && u.hitsMax > 0 && u.hits < u.hitsMax) {
                unitEffHp *= (u.hits / u.hitsMax);
            }
            if (unitBoostedToughHits > 0 && unitToughMult < minToughMult) {
                minToughMult = unitToughMult;
            }
            effectiveHp += unitEffHp;
        } else if (u.getActiveBodyparts) {
            dps += (u.getActiveBodyparts(atkType) || 0) * 30;
            dps += (u.getActiveBodyparts(rngType) || 0) * 10;
            squadHeal += (u.getActiveBodyparts(healType) || 0) * 12;
            effectiveHp += (u.hits !== undefined ? u.hits : (u.hitsMax || 500));
        }
    }

    return {
        effectiveHp,
        dps,
        squadHeal,
        minToughMult,
        effectiveHeal: squadHeal / minToughMult
    };
}

function canWinFightFast(myCreeps, enemyCreeps) {
    if (!enemyCreeps || enemyCreeps.length === 0) {
        return { canWin: true, myTTL: Infinity, enemyTTL: 0, myDps: 0, enemyDps: 0 };
    }
    if (!myCreeps || myCreeps.length === 0) {
        return { canWin: false, myTTL: 0, enemyTTL: Infinity, myDps: 0, enemyDps: 0 };
    }
    const me = summarizeSideCombatStats(myCreeps);
    const enemy = summarizeSideCombatStats(enemyCreeps);
    const inDpsMe = Math.max(0, enemy.dps - me.effectiveHeal);
    const inDpsEnemy = Math.max(0, me.dps - enemy.effectiveHeal);
    const myTTL = inDpsMe > 0 ? (me.effectiveHp / inDpsMe) : Infinity;
    const enemyTTL = inDpsEnemy > 0 ? (enemy.effectiveHp / inDpsEnemy) : Infinity;
    const canWin = inDpsEnemy > 0 && (inDpsMe <= 0 || myTTL >= enemyTTL * 0.8);
    return { canWin, myTTL, enemyTTL, myDps: me.dps, enemyDps: enemy.dps };
}

function isGuardedByUnwinnable(softTarget, armedHostiles, friendlyPower, friendlyUnits) {
    if (!softTarget || !softTarget.pos || !armedHostiles || armedHostiles.length === 0) return false;
    for (let i = 0; i < armedHostiles.length; i++) {
        const g = armedHostiles[i];
        if (!g || !g.pos) continue;
        const gPower = calcUnitPower(g);
        if (gPower <= 0) continue;
        if (calcDistance(softTarget.pos, g.pos) <= 6) {
            if (gPower > friendlyPower * 0.9) return true;
            if (friendlyUnits && friendlyUnits.length > 0 && !canWinFightFast(friendlyUnits, [g]).canWin) {
                return true;
            }
        }
    }
    return false;
}

function computeRoomTargetDoctrine(roomName, friendlyOverride) {
    const h = ensureOffenseBuffers();
    const rState = h.rooms ? h.rooms[roomName] : null;
    if (!rState) return null;
    const now = (typeof Game !== 'undefined' && Game.time) ? Game.time : 0;
    if (!friendlyOverride && rState._doctrineTick === now && rState._doctrine) return rState._doctrine;

    const myUsername = resolveMyUsername();
    const rawHostiles = rState.hostiles || [];
    const structs = rState.hostileStructures || [];
    const rampartSet = new Set();
    for (let i = 0; i < structs.length; i++) {
        if (structs[i].structureType === STRUCTURE_RAMPART && structs[i].pos) {
            rampartSet.add(structs[i].pos.x * 50 + structs[i].pos.y);
        }
    }

    const friendlyUnits = [];
    let friendlyPower = 0;
    const fSource = friendlyOverride || rState.creeps || [];
    for (let i = 0; i < fSource.length; i++) {
        const fc = fSource[i];
        if (!fc || fc.spawning || fc.my === false) continue;
        friendlyUnits.push(fc);
        friendlyPower += calcUnitPower(fc);
    }

    const refPos = (friendlyUnits.length > 0 && friendlyUnits[0].pos)
        ? friendlyUnits[0].pos
        : roomCenterPos(roomName);

    const tierById = {};
    const scoreById = {};
    let openTier1Count = 0;
    let loneKiter = null;
    const hostileMeta = [];
    const armedGuardians = [];

    for (let i = 0; i < rawHostiles.length; i++) {
        const hs = rawHostiles[i];
        if (!hs || hs.my || (hs.owner && myUsername && hs.owner.username === myUsername)) continue;
        const parts = getCombatPartsCount(hs);
        const isTier1 = parts.heal > 0 || parts.ranged > 0 || parts.attack > 0;
        const underRampart = !!(hs.pos && rampartSet.has(hs.pos.x * 50 + hs.pos.y));
        if (isTier1) {
            armedGuardians.push(hs);
            if (!underRampart) {
                openTier1Count++;
                if ((parts.ranged + parts.attack) >= 1 && (parts.ranged + parts.attack) <= 2) {
                    loneKiter = hs;
                }
            }
        }
        hostileMeta.push({ hs, parts, isTier1, underRampart });
    }

    let primaryTarget = null;
    let primaryScore = -Infinity;
    let primaryTier = 99;

    for (let i = 0; i < hostileMeta.length; i++) {
        const { hs, parts, isTier1, underRampart } = hostileMeta[i];
        const dist = hs.pos ? calcDistance(refPos, hs.pos) : 25;
        let tier = 4;
        let score = 0;
        if (isTier1) {
            if (underRampart && openTier1Count > 0) {
                // Reachability filter: never bash ramparted target while open defenders shoot us
                tier = 5;
                score = 5000 - dist * 100;
            } else {
                tier = 1;
                score = 105000
                    + (parts.heal > 0 ? 20000 : 0)
                    + ((parts.ranged > 0 || parts.attack > 0) ? 10000 : 0)
                    + (hs.hits <= 300 ? 30000 : 0)
                    - dist * 100;
            }
        } else {
            // Guardian Avoidance: skip soft workers within range <= 6 of an unwinnable armed guardian
            if (friendlyUnits.length > 0 && armedGuardians.length > 0 &&
                isGuardedByUnwinnable(hs, armedGuardians, friendlyPower, friendlyUnits)) {
                continue;
            }
            tier = 4;
            score = 13000 + (parts.claim > 0 ? 500 : 0) + (parts.work > 0 ? 300 : 0) - dist * 50;
        }
        if (hs.id) {
            tierById[hs.id] = tier;
            scoreById[hs.id] = score;
        }
        if (score > primaryScore) {
            primaryScore = score;
            primaryTarget = hs;
            primaryTier = tier;
        }
    }

    for (let i = 0; i < structs.length; i++) {
        const st = structs[i];
        // Hard Ban: Ramparts & Walls are NEVER primary targets (only obstacles on the Breach Path)
        if (!st || st.structureType === STRUCTURE_CONTROLLER || st.structureType === STRUCTURE_RAMPART || st.structureType === STRUCTURE_WALL) continue;
        const dist = st.pos ? calcDistance(refPos, st.pos) : 25;
        let tier = 5;
        let score = 0;
        if (st.structureType === STRUCTURE_TOWER) {
            const towerEnergy = st.store ? (st.store[RESOURCE_ENERGY] || 0) : (st.energy || 0);
            if (towerEnergy >= 10) {
                tier = 2;
                score = 55000 - dist * 50;
            } else {
                tier = 5;
                score = 3000 - dist * 10;
            }
        } else if (st.structureType === STRUCTURE_SPAWN) {
            tier = 3;
            score = 28000 - dist * 50;
        } else {
            tier = 5;
            score = 2000 + (st.structureType === STRUCTURE_STORAGE || st.structureType === STRUCTURE_TERMINAL ? 400 : 0) - dist * 10;
        }

        if (openTier1Count > 0 && st.pos && rampartSet.has(st.pos.x * 50 + st.pos.y) && st.structureType !== STRUCTURE_RAMPART) {
            // Sealed behind rampart while open defenders are active -> demote below open Tier 1
            score = Math.min(score, 4000 - dist * 10);
        }

        if (st.id) {
            tierById[st.id] = tier;
            scoreById[st.id] = score;
        }
        if (score > primaryScore) {
            primaryScore = score;
            primaryTarget = st;
            primaryTier = tier;
        }
    }

    const primaryTargetInt = (primaryTarget && primaryTarget.id) ? getOrCreateIntId(primaryTarget.id) : 0;
    rState.primaryTargetInt = primaryTargetInt;

    const doctrine = {
        primaryTarget,
        primaryTier,
        primaryTargetInt,
        openTier1Count,
        interceptTarget: (openTier1Count === 1 && loneKiter) ? loneKiter : null,
        tierById,
        scoreById
    };
    rState._doctrineTick = now;
    rState._doctrine = doctrine;
    return doctrine;
}

function collectRoomHostileStructures(rState) {
    if (!rState) return [];
    const hs = rState.hostileStructures || [];
    const wl = rState.walls || [];
    if (wl.length === 0) return hs;
    if (hs.length === 0) return wl;
    const seen = new Set();
    const out = [];
    for (let i = 0; i < hs.length; i++) {
        const s = hs[i];
        if (!s) continue;
        const k = s.id || (s.pos ? `${s.structureType}:${s.pos.x},${s.pos.y}` : i);
        if (!seen.has(k)) { seen.add(k); out.push(s); }
    }
    for (let i = 0; i < wl.length; i++) {
        const w = wl[i];
        if (!w) continue;
        const k = w.id || (w.pos ? `${w.structureType}:${w.pos.x},${w.pos.y}` : `w${i}`);
        if (!seen.has(k)) { seen.add(k); out.push(w); }
    }
    return out;
}

function isRmaCountableStruct(st, myUsername) {
    if (!st || st.my === true) return false;
    if (st.owner && myUsername && st.owner.username === myUsername) return false;
    const t = st.structureType;
    if (!t || t === STRUCTURE_WALL || t === STRUCTURE_CONTROLLER || t === STRUCTURE_ROAD || t === STRUCTURE_CONTAINER) {
        return false;
    }
    if (st.hits !== undefined && st.hits <= 0) return false;
    return true;
}

function isDestructibleHostileStruct(st, myUsername) {
    if (!st || st.my === true) return false;
    if (st.owner && myUsername && st.owner.username === myUsername) return false;
    const t = st.structureType;
    if (!t || t === STRUCTURE_CONTROLLER) return false;
    if (st.hits !== undefined && st.hits <= 0) return false;
    return true;
}

function pickFallbackHostileStruct(structs, refPos, myUsername) {
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < structs.length; i++) {
        const st = structs[i];
        if (!isDestructibleHostileStruct(st, myUsername)) continue;
        const t = st.structureType;
        if (t === STRUCTURE_ROAD || t === STRUCTURE_CONTAINER) continue;
        let base = 1000;
        if (t === STRUCTURE_TOWER) base = 50000;
        else if (t === STRUCTURE_SPAWN) base = 30000;
        else if (t !== STRUCTURE_RAMPART && t !== STRUCTURE_WALL) base = 8000;
        else base = 2000;
        const dist = (refPos && st.pos) ? calcDistance(refPos, st.pos) : 0;
        const sc = base - ((st.hits || 0) / 1000) - dist * 20;
        if (sc > bestScore) { bestScore = sc; best = st; }
    }
    return best;
}

function buildBreachCostMatrix(roomName, rState) {
    const breachMat = new PathFinder.CostMatrix();
    const room = Game.rooms ? Game.rooms[roomName] : null;
    const terrain = room && room.getTerrain ? room.getTerrain() : null;
    const roadGrid = rState && rState.roadGrid ? rState.roadGrid : null;
    if (terrain && terrain.get) {
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) breachMat.set(x, y, 255);
                else if (roadGrid && roadGrid[x * 50 + y] === 1) breachMat.set(x, y, 1);
            }
        }
    }

    const barrierByKey = {};
    const barriers = [];
    const structs = collectRoomHostileStructures(rState);

    // Pass 1: Non-walkable hostile structures (strictly <= 254, additive over base terrain cost)
    for (let i = 0; i < structs.length; i++) {
        const st = structs[i];
        if (!st || !st.pos) continue;
        const t = st.structureType;
        if (t === STRUCTURE_ROAD) {
            if (breachMat.get(st.pos.x, st.pos.y) < 255) breachMat.set(st.pos.x, st.pos.y, 1);
            continue;
        }
        if (t === STRUCTURE_CONTAINER || t === STRUCTURE_RAMPART || t === STRUCTURE_WALL || t === STRUCTURE_CONTROLLER) continue;
        const base = getBaseTileCost(terrain, roadGrid, st.pos.x, st.pos.y, 2, 12);
        const cost = Math.min(254, base + 15 + Math.ceil((st.hits || 0) / 50000));
        const cur = breachMat.get(st.pos.x, st.pos.y);
        if (cur < 255 && cost > cur) breachMat.set(st.pos.x, st.pos.y, cost);
    }

    // Pass 2: Destructible barriers (Ramparts & Walls <= 254; additive over base terrain cost)
    for (let i = 0; i < structs.length; i++) {
        const st = structs[i];
        if (!st || !st.pos) continue;
        if (st.structureType !== STRUCTURE_RAMPART && st.structureType !== STRUCTURE_WALL) continue;
        if (st.hits !== undefined && st.hits <= 0) continue;
        const base = getBaseTileCost(terrain, roadGrid, st.pos.x, st.pos.y, 2, 12);
        const cost = Math.min(254, base + 20 + Math.ceil((st.hits || 0) / 100000));
        const k = st.pos.x * 50 + st.pos.y;
        const prevB = barrierByKey[k];
        if (!prevB || (st.hits || 0) < (prevB.hits || 0)) barrierByKey[k] = st;
        barriers.push(st);
        const curCost = breachMat.get(st.pos.x, st.pos.y);
        if (curCost < 255) {
            breachMat.set(st.pos.x, st.pos.y, Math.min(254, Math.max(curCost, cost)));
        }
    }

    return { breachMat, barrierByKey, barriers, structs };
}

function solveBreachTarget(roomName, leadPos, primaryTarget, rState) {
    if (!rState || !primaryTarget || !primaryTarget.pos || !leadPos) {
        if (rState) rState.breachTargetInt = 0;
        return null;
    }
    const now = (typeof Game !== 'undefined' && Game.time) ? Game.time : 0;
    const cached = rState._breachCache;
    if (cached && now < cached.expires && cached.targetId === primaryTarget.id) {
        if (!cached.breachId) {
            rState.breachTargetInt = 0;
            return null;
        }
        const liveBarrier = Game.getObjectById ? Game.getObjectById(cached.breachId) : null;
        if (liveBarrier && (!liveBarrier.hits || liveBarrier.hits > 0)) {
            rState.breachTargetInt = getOrCreateIntId(liveBarrier.id);
            return liveBarrier;
        }
        // Instant Re-Check: barrier died this tick -> invalidate immediately
        rState._breachCache = null;
    }

    if (typeof PathFinder === 'undefined' || !PathFinder.search || !PathFinder.CostMatrix) {
        rState.breachTargetInt = 0;
        return null;
    }

    const { breachMat, barrierByKey, barriers, structs } = buildBreachCostMatrix(roomName, rState);
    const goalKey = primaryTarget.pos.x * 50 + primaryTarget.pos.y;

    // Zero-distance guard: if leadPos equals goalPos directly, return barrier on goal tile if any
    if (leadPos.x === primaryTarget.pos.x && leadPos.y === primaryTarget.pos.y) {
        const directB = barrierByKey[goalKey] || null;
        if (directB) {
            rState.breachTargetInt = getOrCreateIntId(directB.id);
            rState._breachCache = { targetId: primaryTarget.id, breachId: directB.id, expires: now + 10 };
            return directB;
        }
        rState.breachTargetInt = 0;
        rState._breachCache = { targetId: primaryTarget.id, breachId: null, expires: now + 10 };
        return null;
    }

    const origin = (typeof RoomPosition !== 'undefined')
        ? new RoomPosition(leadPos.x, leadPos.y, roomName)
        : { x: leadPos.x, y: leadPos.y, roomName };
    const goalPos = (typeof RoomPosition !== 'undefined')
        ? new RoomPosition(primaryTarget.pos.x, primaryTarget.pos.y, primaryTarget.pos.roomName || roomName)
        : { x: primaryTarget.pos.x, y: primaryTarget.pos.y, roomName: primaryTarget.pos.roomName || roomName };

    const res = PathFinder.search(origin, { pos: goalPos, range: 1 }, {
        maxRooms: 1,
        plainCost: 2,
        swampCost: 12,
        roomCallback: () => breachMat
    });

    const path = (res && res.path) || [];
    let firstBarrier = null;
    for (let i = 0; i < path.length; i++) {
        const step = path[i];
        const b = barrierByKey[step.x * 50 + step.y];
        if (b) {
            firstBarrier = b;
            break;
        }
    }

    // Also catch a rampart sitting directly atop primaryTarget when outer ring is already open
    if (!firstBarrier && barrierByKey[goalKey]) {
        const stdCheckMat = new PathFinder.CostMatrix();
        for (let i = 0; i < structs.length; i++) {
            const st = structs[i];
            if (!st || !st.pos) continue;
            const k = st.pos.x * 50 + st.pos.y;
            if (k === goalKey) continue;
            if (st.structureType === STRUCTURE_ROAD) {
                stdCheckMat.set(st.pos.x, st.pos.y, 1);
            } else if (st.structureType !== STRUCTURE_CONTAINER && st.structureType !== STRUCTURE_CONTROLLER) {
                stdCheckMat.set(st.pos.x, st.pos.y, 255);
            }
        }
        const coverRes = PathFinder.search(origin, { pos: goalPos, range: 1 }, {
            maxRooms: 1,
            plainCost: 2,
            swampCost: 12,
            roomCallback: () => stdCheckMat
        });
        if (coverRes && !coverRes.incomplete && (calcDistance(origin, goalPos) <= 1 || (coverRes.path && coverRes.path.length > 0))) {
            firstBarrier = barrierByKey[goalKey];
        }
    }

    // Guaranteed Sealed Fallback: if barriers exist and standard matrix cannot reach primaryTarget, lock closest lowest-HP barrier
    if (!firstBarrier && barriers.length > 0) {
        const standardMat = new PathFinder.CostMatrix();
        const room = Game.rooms ? Game.rooms[roomName] : null;
        const terrain = room && room.getTerrain ? room.getTerrain() : null;
        if (terrain && terrain.get) {
            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) standardMat.set(x, y, 255);
                }
            }
        }
        for (let i = 0; i < structs.length; i++) {
            const st = structs[i];
            if (!st || !st.pos) continue;
            const t = st.structureType;
            if (t === STRUCTURE_ROAD) {
                if (standardMat.get(st.pos.x, st.pos.y) < 255) standardMat.set(st.pos.x, st.pos.y, 1);
            } else if (t !== STRUCTURE_CONTAINER && t !== STRUCTURE_CONTROLLER) {
                const k = st.pos.x * 50 + st.pos.y;
                if (k !== goalKey || barrierByKey[goalKey]) standardMat.set(st.pos.x, st.pos.y, 255);
            }
        }
        const stdRes = PathFinder.search(origin, { pos: goalPos, range: 1 }, {
            maxRooms: 1,
            plainCost: 2,
            swampCost: 12,
            roomCallback: () => standardMat
        });
        const unreachable = !stdRes || stdRes.incomplete ||
            (calcDistance(origin, goalPos) > 1 && (!stdRes.path || stdRes.path.length === 0));
        if (unreachable) {
            let bestB = null;
            let bestBScore = Infinity;
            let bestLeadD = Infinity;
            for (let i = 0; i < barriers.length; i++) {
                const b = barriers[i];
                const dGoal = calcDistance(b.pos, goalPos);
                const dLead = calcDistance(b.pos, origin);
                const sc = (dGoal * 50000) + (b.hits || 0);
                if (sc < bestBScore || (sc === bestBScore && dLead < bestLeadD)) {
                    bestBScore = sc;
                    bestLeadD = dLead;
                    bestB = b;
                }
            }
            firstBarrier = bestB;
        }
    }

    if (firstBarrier) {
        rState.breachTargetInt = getOrCreateIntId(firstBarrier.id);
        rState._breachCache = { targetId: primaryTarget.id, breachId: firstBarrier.id, expires: now + 10 };
        return firstBarrier;
    }

    rState.breachTargetInt = 0;
    rState._breachCache = { targetId: primaryTarget.id, breachId: null, expires: now + 10 };
    return null;
}

function executeCombatUnitDoctrine(creeps, roomName, homeColony, rState) {
    if (!creeps || !creeps.length || !rState) return;
    const doctrine = computeRoomTargetDoctrine(roomName);
    const myUsername = resolveMyUsername();
    const allHostileStructs = collectRoomHostileStructures(rState);
    const primaryTarget = (doctrine && doctrine.primaryTarget) ||
        pickFallbackHostileStruct(allHostileStructs, creeps[0].pos, myUsername);
    if (!primaryTarget) return;

    const hasDanger = !!((rState.hostiles && rState.hostiles.length > 0) || allHostileStructs.length > 0);
    let lead = creeps[0];
    for (let i = 0; i < creeps.length; i++) {
        if (creeps[i] && !creeps[i].spawning) {
            if (hasDanger && creeps[i].heap) creeps[i].heap.sleepUntil = 0;
            if (lead === creeps[0] && creeps[0].spawning) lead = creeps[i];
        }
    }
    const breachTarget = solveBreachTarget(roomName, lead.pos, primaryTarget, rState);

    if (breachTarget) {
        // BREACHING MODE: Melee/Dismantle Surround (up to 3) + Overflow Widening + Ranged Flanking (range 3)
        const meleeMatrix = getCombatAvoidanceMatrix(roomName, 25);
        const rangedMatrix = getCombatAvoidanceMatrix(roomName, 20);
        const room = Game.rooms ? Game.rooms[roomName] : null;
        const terrain = room && room.getTerrain ? room.getTerrain() : null;

        const blockedSet = new Set();
        const adjBarriers = [];
        for (let s = 0; s < allHostileStructs.length; s++) {
            const st = allHostileStructs[s];
            if (!st || !st.pos) continue;
            if (st.structureType !== STRUCTURE_ROAD && st.structureType !== STRUCTURE_CONTAINER) {
                blockedSet.add(st.pos.x * 50 + st.pos.y);
            }
            if ((st.structureType === STRUCTURE_RAMPART || st.structureType === STRUCTURE_WALL) &&
                st.id !== breachTarget.id && (!st.hits || st.hits > 0) &&
                calcDistance(breachTarget.pos, st.pos) === 1) {
                adjBarriers.push(st);
            }
        }

        const adjWalkable = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const ax = breachTarget.pos.x + dx;
                const ay = breachTarget.pos.y + dy;
                if (ax <= 0 || ax >= 49 || ay <= 0 || ay >= 49) continue;
                if (terrain && terrain.get(ax, ay) === TERRAIN_MASK_WALL) continue;
                if (blockedSet.has(ax * 50 + ay)) continue;
                adjWalkable.push({ x: ax, y: ay, roomName });
            }
        }

        const reservedTiles = new Set();
        let meleeSurroundCount = 0;

        for (let i = 0; i < creeps.length; i++) {
            const c = creeps[i];
            if (!c || c.spawning) continue;
            if (!c.heap) c.heap = {};
            if (hasDanger) c.heap.sleepUntil = 0;

            if (shouldBorderBounceHeal(c, rState)) {
                executeOpportunityFire(c, breachTarget, rState, { primaryTarget, breachTarget });
                if (c.fatigue === 0) moveToRoomViaExit(c, homeColony, roomCenterPos(homeColony), 2);
                continue;
            }

            const hasRanged = c.getActiveBodyparts && c.getActiveBodyparts(RANGED_ATTACK) > 0;
            const hasAttack = c.getActiveBodyparts && c.getActiveBodyparts(ATTACK) > 0;
            const hasWork = c.getActiveBodyparts && c.getActiveBodyparts(WORK) > 0;

            if (hasRanged && !hasAttack && !hasWork) {
                executeOpportunityFire(c, breachTarget, rState, { primaryTarget, breachTarget });
                if (c.fatigue === 0 && calcDistance(c.pos, breachTarget.pos) > 3) {
                    moveCreep(c, breachTarget.pos, 3, { costMatrix: rangedMatrix });
                }
            } else {
                if (meleeSurroundCount < 3 && adjWalkable.length > 0) {
                    let chosenTile = null;
                    let bestD = Infinity;
                    for (let t = 0; t < adjWalkable.length; t++) {
                        const tk = adjWalkable[t].x * 50 + adjWalkable[t].y;
                        if (reservedTiles.has(tk)) continue;
                        const d = calcDistance(c.pos, adjWalkable[t]);
                        if (d < bestD) { bestD = d; chosenTile = adjWalkable[t]; }
                    }
                    if (chosenTile) {
                        reservedTiles.add(chosenTile.x * 50 + chosenTile.y);
                        meleeSurroundCount++;
                        executeOpportunityFire(c, breachTarget, rState, { primaryTarget, breachTarget });
                        if (c.fatigue === 0 && (c.pos.x !== chosenTile.x || c.pos.y !== chosenTile.y)) {
                            moveCreep(c, chosenTile, 0, { costMatrix: meleeMatrix });
                        }
                        continue;
                    }
                }

                let widenTarget = breachTarget;
                if (adjBarriers.length > 0) {
                    let bestWidenDist = Infinity;
                    for (let ab = 0; ab < adjBarriers.length; ab++) {
                        const wd = calcDistance(c.pos, adjBarriers[ab].pos);
                        if (wd < bestWidenDist) {
                            bestWidenDist = wd;
                            widenTarget = adjBarriers[ab];
                        }
                    }
                }
                executeOpportunityFire(c, widenTarget, rState, { primaryTarget, breachTarget: widenTarget });
                if (c.fatigue === 0 && calcDistance(c.pos, widenTarget.pos) > 1) {
                    moveCreep(c, widenTarget.pos, 1, { costMatrix: meleeMatrix });
                }
            }
        }
        return;
    }

    // FLOOD MODE (breachTargetInt === 0): Pour through the open gap straight to primaryTarget while never stalling weapons
    const floodMatrix = getCombatAvoidanceMatrix(roomName, 15);
    for (let i = 0; i < creeps.length; i++) {
        const c = creeps[i];
        if (!c || c.spawning) continue;
        if (!c.heap) c.heap = {};
        if (hasDanger) c.heap.sleepUntil = 0;

        if (shouldBorderBounceHeal(c, rState)) {
            executeOpportunityFire(c, primaryTarget, rState, { primaryTarget, breachTarget: null });
            if (c.fatigue === 0) moveToRoomViaExit(c, homeColony, roomCenterPos(homeColony), 2);
            continue;
        }
        const hasRanged = c.getActiveBodyparts && c.getActiveBodyparts(RANGED_ATTACK) > 0;
        const hasAttack = c.getActiveBodyparts && c.getActiveBodyparts(ATTACK) > 0;
        const hasWork = c.getActiveBodyparts && c.getActiveBodyparts(WORK) > 0;
        const desiredRange = (hasRanged && !hasAttack && !hasWork) ? 3 : 1;
        executeOpportunityFire(c, primaryTarget, rState, { primaryTarget, breachTarget: null });
        if (c.fatigue === 0 && calcDistance(c.pos, primaryTarget.pos) > desiredRange) {
            moveCreep(c, primaryTarget.pos, desiredRange, { costMatrix: floodMatrix });
        }
    }
}

function scoreSingleRangedFallback(st, myUsername) {
    if (!st) return -Infinity;
    if (st.getActiveBodyparts) {
        const parts = getCombatPartsCount(st);
        const isArmed = parts.heal > 0 || parts.ranged > 0 || parts.attack > 0;
        if (isArmed) {
            return 1000000 + (parts.heal > 0 ? 50000 : 0) - (st.hits || 0) * 0.001;
        }
        return 100000 - (st.hits || 0) * 0.001;
    }
    if (!isDestructibleHostileStruct(st, myUsername)) return -Infinity;
    const t = st.structureType;
    if (t === STRUCTURE_TOWER) return 800000 - (st.hits || 0) * 0.0001;
    if (t === STRUCTURE_SPAWN) return 600000 - (st.hits || 0) * 0.0001;
    if (t === STRUCTURE_ROAD || t === STRUCTURE_CONTAINER) return 1000 - (st.hits || 0) * 0.0001;
    return 50000 - (st.hits || 0) * 0.0001;
}

function executePackCrossHeal(creep, allies, roomState, opts) {
    if (!creep || creep.spawning || !creep.getActiveBodyparts || creep.getActiveBodyparts(HEAL) <= 0) return false;
    const hasMelee = creep.getActiveBodyparts(ATTACK) > 0;
    const hasRanged = creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasWork = creep.getActiveBodyparts(WORK) > 0;
    const isCriticalSelf = (creep.hits || 0) < (creep.hitsMax || 1) * 0.5;
    const rState = roomState || (global.heap && global.heap.rooms && creep.room ? global.heap.rooms[creep.room.name] : null);

    // Melee attack() / heal() Exclusion: heal overrides attack at range 1 unless HP < 50%
    if (hasMelee && !isCriticalSelf && !(opts && opts.allowHealDespiteMelee)) {
        if (opts && opts.willMeleeAttack) return false;
        if (!opts || opts.willMeleeAttack === undefined) {
            const hostiles = (rState && rState.hostiles) || [];
            for (let i = 0; i < hostiles.length; i++) {
                if (hostiles[i] && hostiles[i].pos && calcDistance(creep.pos, hostiles[i].pos) <= 1) {
                    return false;
                }
            }
        }
    }

    const pool = allies || (rState && rState.creeps) || [];
    const candidates = [creep];
    const seen = new Set();
    seen.add(creep.id || creep.name);
    for (let i = 0; i < pool.length; i++) {
        const al = pool[i];
        if (!al || al.spawning) continue;
        const key = al.id || al.name;
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        candidates.push(al);
    }

    let lowAlly = null;
    let lowRatio = 1;
    let frontAlly = null;
    let frontScore = Infinity;

    for (let i = 0; i < candidates.length; i++) {
        const al = candidates[i];
        if (!al || !al.pos) continue;
        const d = calcDistance(creep.pos, al.pos);
        if (d > 3) continue;
        const maxHp = al.hitsMax || 1;
        const hp = al.hits !== undefined ? al.hits : maxHp;
        const ratio = hp / maxHp;
        if (al !== creep && d <= 1) {
            const fs = ratio * 1000 + d;
            if (fs < frontScore) { frontScore = fs; frontAlly = al; }
        }
        if (hp >= maxHp) continue;
        if (ratio < lowRatio - 0.0001 || (Math.abs(ratio - lowRatio) <= 0.0001 && lowAlly === creep && al !== creep)) {
            lowRatio = ratio;
            lowAlly = al;
        }
    }

    if (lowAlly) {
        const hd = calcDistance(creep.pos, lowAlly.pos);
        if (hd <= 1) {
            if (creep.heal) creep.heal(lowAlly);
            return true;
        }
        const pureHealer = !hasMelee && !hasRanged && !hasWork;
        if (hd <= 3 && (pureHealer || lowRatio < 0.75 || !(opts && opts.hasRangedTarget))) {
            if (creep.rangedHeal) creep.rangedHeal(lowAlly);
            return true;
        }
    } else if (!hasMelee && !hasRanged && !hasWork && frontAlly) {
        if (creep.heal) creep.heal(frontAlly);
        return true;
    }

    return false;
}

function executeOpportunityFire(creep, moveTarget, roomState, opts) {
    if (!creep || creep.spawning) return;
    const hasHeal = creep.getActiveBodyparts && creep.getActiveBodyparts(HEAL) > 0;
    const hasRanged = creep.getActiveBodyparts && creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasMelee = creep.getActiveBodyparts && creep.getActiveBodyparts(ATTACK) > 0;
    const hasWork = creep.getActiveBodyparts && creep.getActiveBodyparts(WORK) > 0;
    if (!hasHeal && !hasRanged && !hasMelee && !hasWork) return;

    const rState = roomState || (global.heap && global.heap.rooms ? global.heap.rooms[creep.room.name] : null);
    const doctrine = (rState && rState._doctrine) || (creep.room ? computeRoomTargetDoctrine(creep.room.name) : null);
    const scoreById = (doctrine && doctrine.scoreById) || {};
    const myUsername = resolveMyUsername();

    const hostiles = (rState && rState.hostiles) || [];
    const structs = collectRoomHostileStructures(rState);
    const primaryTarget = (opts && opts.primaryTarget !== undefined) ? opts.primaryTarget : (doctrine && doctrine.primaryTarget);
    const breachTarget = (opts && opts.breachTarget !== undefined) ? opts.breachTarget : (moveTarget && moveTarget !== primaryTarget ? moveTarget : null);
    const focusTarget = (opts && opts.focusTarget !== undefined) ? opts.focusTarget : null;

    // Resolve Melee target first so melee/heal exclusion knows whether attack() will run this tick
    let meleeTarget = null;
    if (hasMelee) {
        if (primaryTarget && primaryTarget.pos && calcDistance(creep.pos, primaryTarget.pos) <= 1 &&
            (!primaryTarget.structureType || isDestructibleHostileStruct(primaryTarget, myUsername))) {
            meleeTarget = primaryTarget;
        } else if (breachTarget && breachTarget.pos && calcDistance(creep.pos, breachTarget.pos) <= 1 &&
            (!breachTarget.structureType || isDestructibleHostileStruct(breachTarget, myUsername))) {
            meleeTarget = breachTarget;
        } else if (moveTarget && moveTarget.pos && calcDistance(creep.pos, moveTarget.pos) <= 1 &&
            (!moveTarget.structureType || isDestructibleHostileStruct(moveTarget, myUsername))) {
            meleeTarget = moveTarget;
        } else {
            let bestAdjCreep = null;
            let bestCreepScore = -Infinity;
            for (let i = 0; i < hostiles.length; i++) {
                const hs = hostiles[i];
                if (!hs || hs.my || (hs.owner && myUsername && hs.owner.username === myUsername)) continue;
                if (calcDistance(creep.pos, hs.pos) <= 1) {
                    const p = getCombatPartsCount(hs);
                    const sc = (p.attack > 0 || p.ranged > 0 ? 50000 : 0) + (p.heal > 0 ? 30000 : 0) + 10000 - (hs.hits || 0) * 0.01;
                    if (sc > bestCreepScore) { bestCreepScore = sc; bestAdjCreep = hs; }
                }
            }
            if (bestAdjCreep) {
                meleeTarget = bestAdjCreep;
            } else {
                let bestAdjStruct = null;
                let bestHits = Infinity;
                for (let s = 0; s < structs.length; s++) {
                    const st = structs[s];
                    if (!isDestructibleHostileStruct(st, myUsername)) continue;
                    if (calcDistance(creep.pos, st.pos) <= 1) {
                        const penalty = (st.structureType === STRUCTURE_ROAD || st.structureType === STRUCTURE_CONTAINER) ? 1000000000 : 0;
                        const hVal = (st.hits || 0) + penalty;
                        if (hVal < bestHits) { bestHits = hVal; bestAdjStruct = st; }
                    }
                }
                meleeTarget = bestAdjStruct;
            }
        }
    }

    // Resolve Ranged target (RMA vs unified alpha-strike focusTarget vs Zero-Idle fallback)
    let rmaDamage = 0;
    let hasArmedRange1 = false;
    let bestSingle = null;
    let bestSingleScore = -Infinity;
    let rangedFocusValid = false;

    if (hasRanged) {
        for (let i = 0; i < hostiles.length; i++) {
            const hs = hostiles[i];
            if (!hs || hs.my || (hs.owner && myUsername && hs.owner.username === myUsername)) continue;
            const d = calcDistance(creep.pos, hs.pos);
            if (d > 3) continue;
            if (d <= 1) {
                rmaDamage += 10;
                const p = getCombatPartsCount(hs);
                if (p.attack > 0 || p.ranged > 0 || p.heal > 0) hasArmedRange1 = true;
            } else if (d === 2) rmaDamage += 4;
            else rmaDamage += 1;

            const sc = scoreSingleRangedFallback(hs, myUsername) + ((hs.id && scoreById[hs.id]) ? scoreById[hs.id] * 0.01 : 0);
            if (sc > bestSingleScore) { bestSingleScore = sc; bestSingle = hs; }
        }

        // Only count owned destructible hostile structures (NEVER unowned STRUCTURE_WALL/ROAD/CONTAINER)
        for (let s = 0; s < structs.length; s++) {
            const st = structs[s];
            if (!isDestructibleHostileStruct(st, myUsername)) continue;
            const d = calcDistance(creep.pos, st.pos);
            if (d > 3) continue;
            if (isRmaCountableStruct(st, myUsername)) {
                if (d <= 1) rmaDamage += 10;
                else if (d === 2) rmaDamage += 4;
                else rmaDamage += 1;
            }

            let sc = scoreSingleRangedFallback(st, myUsername);
            if (breachTarget && st === breachTarget) sc = Math.max(sc, 450000);
            else if (moveTarget && st === moveTarget) sc = Math.max(sc, 400000);
            else if (primaryTarget && st === primaryTarget) sc = Math.max(sc, 850000);
            if (sc > bestSingleScore) { bestSingleScore = sc; bestSingle = st; }
        }

        if (focusTarget && focusTarget.pos && calcDistance(creep.pos, focusTarget.pos) <= 3 &&
            (!focusTarget.structureType || isDestructibleHostileStruct(focusTarget, myUsername))) {
            rangedFocusValid = true;
        }
    }

    const hasRangedAction = !!(hasRanged && (rmaDamage > 10 || hasArmedRange1 || rangedFocusValid || bestSingle ||
        (moveTarget && moveTarget.pos && calcDistance(creep.pos, moveTarget.pos) <= 3 &&
         (!moveTarget.structureType || isDestructibleHostileStruct(moveTarget, myUsername)))));

    // 1. Pack Cross-Heal (respecting melee attack()/heal() exclusion unless HP < 50%)
    const willMeleeAttack = !!(hasMelee && meleeTarget);
    const isCriticalSelf = (creep.hits || 0) < (creep.hitsMax || 1) * 0.5;
    let healedThisTick = false;
    if (hasHeal && (!willMeleeAttack || isCriticalSelf)) {
        healedThisTick = executePackCrossHeal(creep, opts && opts.packAllies, rState, {
            willMeleeAttack,
            allowHealDespiteMelee: isCriticalSelf,
            hasRangedTarget: hasRangedAction
        });
    }

    // 2. Ranged Zero-Idle Aggression (Mandatory Wall Exclusion on RMA + Unified Alpha-Strike Focus + 6-Tier Fallback)
    if (hasRanged) {
        if (rmaDamage > 10 || hasArmedRange1) {
            creep.rangedMassAttack();
        } else if (rangedFocusValid) {
            creep.rangedAttack(focusTarget);
        } else if (bestSingle) {
            creep.rangedAttack(bestSingle);
        } else if (moveTarget && moveTarget.pos && calcDistance(creep.pos, moveTarget.pos) <= 3 &&
            (!moveTarget.structureType || isDestructibleHostileStruct(moveTarget, myUsername))) {
            creep.rangedAttack(moveTarget);
        }
    }

    // 3. Melee (ATTACK) Zero-Idle Mandatory Fallback Chain (Range 1; skipped if emergency heal ran at < 50% HP)
    let meleeAttacked = false;
    if (willMeleeAttack && !(healedThisTick && isCriticalSelf)) {
        creep.attack(meleeTarget);
        meleeAttacked = true;
    }

    // 4. Dismantler (WORK) Zero-Idle Mandatory Fallback Chain (Range 1)
    if (hasWork && !meleeAttacked) {
        let disTarget = null;
        if (primaryTarget && primaryTarget.structureType && primaryTarget.pos &&
            calcDistance(creep.pos, primaryTarget.pos) <= 1 && isDestructibleHostileStruct(primaryTarget, myUsername)) {
            disTarget = primaryTarget;
        } else if (breachTarget && breachTarget.structureType && breachTarget.pos &&
            calcDistance(creep.pos, breachTarget.pos) <= 1 && isDestructibleHostileStruct(breachTarget, myUsername)) {
            disTarget = breachTarget;
        } else if (moveTarget && moveTarget.structureType && moveTarget.pos &&
            calcDistance(creep.pos, moveTarget.pos) <= 1 && isDestructibleHostileStruct(moveTarget, myUsername)) {
            disTarget = moveTarget;
        } else {
            let bestDis = null;
            let bestDisHits = Infinity;
            for (let s = 0; s < structs.length; s++) {
                const st = structs[s];
                if (!isDestructibleHostileStruct(st, myUsername)) continue;
                if (calcDistance(creep.pos, st.pos) <= 1) {
                    const penalty = (st.structureType === STRUCTURE_ROAD || st.structureType === STRUCTURE_CONTAINER) ? 1000000000 : 0;
                    const hVal = (st.hits || 0) + penalty;
                    if (hVal < bestDisHits) { bestDisHits = hVal; bestDis = st; }
                }
            }
            disTarget = bestDis;
        }
        if (disTarget && creep.dismantle) creep.dismantle(disTarget);
    }
}

function shouldBorderBounceHeal(creep, roomState) {
    if (!creep || !roomState) return false;
    const towers = roomState.hostileTowers || [];
    let hasActiveTower = false;
    for (let i = 0; i < towers.length; i++) {
        const te = towers[i].store ? (towers[i].store[RESOURCE_ENERGY] || 0) : (towers[i].energy || 0);
        if (te >= 10) { hasActiveTower = true; break; }
    }
    if (!hasActiveTower) {
        if (creep.heap) creep.heap.bouncingHeal = false;
        return false;
    }

    const hasHeal = creep.getActiveBodyparts && creep.getActiveBodyparts(HEAL) > 0;
    let nearbyHealer = hasHeal;
    if (!nearbyHealer && roomState.creeps) {
        for (let i = 0; i < roomState.creeps.length; i++) {
            const al = roomState.creeps[i];
            if (al && al.id !== creep.id && al.getActiveBodyparts && al.getActiveBodyparts(HEAL) > 0 && calcDistance(creep.pos, al.pos) <= 3) {
                nearbyHealer = true;
                break;
            }
        }
    }
    if (!nearbyHealer) return false;

    if (!creep.heap) creep.heap = {};
    if (creep.hits < creep.hitsMax * 0.55) {
        creep.heap.bouncingHeal = true;
        return true;
    }
    if (creep.heap.bouncingHeal) {
        if (creep.hits >= creep.hitsMax) {
            creep.heap.bouncingHeal = false;
            return false;
        }
        return true;
    }
    return false;
}

function moveWithCombatPathCache(creep, targetPos, range, roomState) {
    if (!creep || !targetPos) return;
    if (!creep.heap) creep.heap = {};
    const dist = calcDistance(creep.pos, targetPos);
    const armed = (roomState && roomState.armedHostiles) || [];
    let nearArmed = false;
    for (let i = 0; i < armed.length; i++) {
        if (calcDistance(creep.pos, armed[i].pos) <= 4) { nearArmed = true; break; }
    }

    if (dist > 3 && !nearArmed && creep.heap.combatPath instanceof Uint32Array && creep.heap.combatPathTargetId === (targetPos.x * 50 + targetPos.y)) {
        const idx = creep.heap.combatPathIdx || 0;
        if (idx < creep.heap.combatPath.length) {
            const packed = creep.heap.combatPath[idx];
            const nx = (packed >> 8) & 63;
            const ny = packed & 63;
            if (calcDistance(creep.pos, { x: nx, y: ny }) <= 1) {
                creep.heap.combatPathIdx = idx + 1;
                moveCreep(creep, { x: nx, y: ny, roomName: creep.room.name }, 0);
                return;
            }
        }
    }

    moveCreep(creep, targetPos, range);
    if (dist > 3 && !nearArmed && creep.room) {
        creep.heap.combatPathTargetId = targetPos.x * 50 + targetPos.y;
        const path = new Uint32Array(1);
        path[0] = (targetPos.x << 8) | targetPos.y;
        creep.heap.combatPath = path;
        creep.heap.combatPathIdx = 0;
    }
}

// Parse neutral room hostiles for rival CARRY/WORK creeps and dropped loot
function recordRivalRemoteIntel(roomName, s, myUsername) {
    if (!roomName || !s || (s.controller && s.controller.owner)) return;
    const h = ensureOffenseBuffers();
    const slot = getRemoteSlot(roomName);
    const hostiles = s.hostiles || [];
    let workerCount = 0;
    let threatScore = 0;

    for (let i = 0; i < hostiles.length; i++) {
        const cr = hostiles[i];
        const owner = cr && cr.owner ? cr.owner.username : null;
        if (!owner || owner === 'Invader' || owner === 'Source Keeper' || (myUsername && owner === myUsername)) continue;
        if (!cr.getActiveBodyparts) continue;
        const carryWork = cr.getActiveBodyparts(CARRY) + cr.getActiveBodyparts(WORK);
        const armed = cr.getActiveBodyparts(ATTACK) + cr.getActiveBodyparts(RANGED_ATTACK) + cr.getActiveBodyparts(HEAL);
        if (carryWork > 0) workerCount++;
        if (armed > 0) threatScore += armed;
    }

    let dropSum = 0;
    const drops = s.droppedEnergy || [];
    for (let d = 0; d < drops.length; d++) dropSum += drops[d].amount || 0;
    const tombs = s.tombstones || [];
    for (let t = 0; t < tombs.length; t++) dropSum += (tombs[t].store ? (tombs[t].store[RESOURCE_ENERGY] || 0) : 0);

    const prevFlags = h.rivalRemoteFlags[slot];
    if (workerCount > 0) {
        h.rivalRemoteFlags[slot] = (prevFlags | 1) & ~2;
    } else {
        let nextFlags = prevFlags & ~1;
        if (prevFlags & 1) nextFlags |= 2;
        if ((nextFlags & 2) && dropSum >= 300 && threatScore === 0) nextFlags |= 4;
        else if (dropSum < 150) nextFlags &= ~4;
        h.rivalRemoteFlags[slot] = nextFlags;
    }
    h.rivalRemoteMeta[slot] = (Math.min(255, threatScore) << 8) | Math.min(255, workerCount);
    h.rivalRemoteTick[slot] = typeof Game !== 'undefined' ? Game.time : 0;
    h.rivalDropAmount[slot] = dropSum;
}

// Track rival RCL storage reserves in heap + RawMemory Segment 12
function recordRivalStorageProfile(roomName, room) {
    if (!roomName || !room || !room.controller || !room.controller.owner || room.controller.my) return;
    if (isFriendlyOrEmpireRoom(roomName)) return;
    const h = ensureOffenseBuffers();
    const rcl = room.controller.level || 1;
    const storageEnergy = room.storage && room.storage.store ? (room.storage.store[RESOURCE_ENERGY] || 0) : (rcl >= 4 ? 0 : -1);
    let towers = 0;
    const rState = h.rooms ? h.rooms[roomName] : null;
    if (rState && rState.hostileStructures) {
        for (let i = 0; i < rState.hostileStructures.length; i++) {
            if (rState.hostileStructures[i].structureType === STRUCTURE_TOWER) towers++;
        }
    }
    h.rivalCitadelStorage[roomName] = {
        roomName: roomName,
        owner: room.controller.owner.username,
        rcl: rcl,
        storageEnergy: storageEnergy,
        towers: towers,
        safeMode: room.controller.safeMode || 0,
        safeModeUntil: room.controller.safeMode ? Game.time + room.controller.safeMode : 0,
        tick: Game.time
    };
    if (Game.time % 20 === 0) {
        setSegmentData(12, JSON.stringify(h.rivalCitadelStorage));
    }
}

function getNearbyRivalRemote(colonyName, maxRange) {
    const h = ensureOffenseBuffers();
    const map = h.remoteSlotMap;
    if (!map || typeof Game === 'undefined' || !Game.map) return null;
    const range = maxRange || 3;
    let bestRoom = null;
    let bestThreat = 0;
    let bestDist = Infinity;
    let lootRoom = null;

    for (const rName in map) {
        if (rName === colonyName || isFriendlyOrEmpireRoom(rName)) continue;
        const slot = map[rName];
        if ((Game.time - h.rivalRemoteTick[slot]) > 1500) continue;
        const flags = h.rivalRemoteFlags[slot];
        const dist = Game.map.getRoomLinearDistance(colonyName, rName);
        if (dist > range) continue;

        if ((flags & 1) && dist < bestDist) {
            bestDist = dist;
            bestRoom = rName;
            bestThreat = (h.rivalRemoteMeta[slot] >> 8) & 255;
        }
        if ((flags & 4) && !lootRoom) {
            lootRoom = rName;
        }
    }
    if (!bestRoom && !lootRoom) return null;
    return { roomName: bestRoom, threat: bestThreat, lootRoom: lootRoom };
}

function getNearestRivalCitadel(colonyName, maxRange, options) {
    const h = ensureOffenseBuffers();
    const profiles = h.rivalCitadelStorage;
    let best = null;
    let bestDist = Infinity;
    const limit = maxRange || 6;
    const allowSafeMode = !!(options && options.allowSafeMode);

    if (profiles && typeof Game !== 'undefined' && Game.map) {
        for (const rName in profiles) {
            const p = profiles[rName];
            if (!p || isFriendlyOrEmpireRoom(rName)) continue;
            if (!allowSafeMode && getRivalSafeModeRemaining(p) > 0) continue;

            const d = Game.map.getRoomLinearDistance(colonyName, rName);
            if (d <= limit && d < bestDist) {
                bestDist = d;
                best = rName;
            }
        }
    }
    if (!best && typeof Memory !== 'undefined' && Memory.empire && Array.isArray(Memory.empire.raidTargets)) {
        for (let i = 0; i < Memory.empire.raidTargets.length; i++) {
            const rt = Memory.empire.raidTargets[i];
            if (!rt || !rt.roomName || isFriendlyOrEmpireRoom(rt.roomName) || !rt.owner) continue;
            if (!allowSafeMode && getRivalSafeModeRemaining(rt.roomName) > 0) continue;

            const d = Game.map ? Game.map.getRoomLinearDistance(colonyName, rt.roomName) : 4;
            if (d <= limit && d < bestDist) {
                bestDist = d;
                best = rt.roomName;
            }
        }
    }
    return best;
}

// 4. NECROSIS STATE MACHINE: triggers across colonies when rival Storage drops < 50k energy
function evaluateNecrosis() {
    const h = ensureOffenseBuffers();
    if (h.necrosisEvalTick === Game.time) return h.necrosis || null;
    h.necrosisEvalTick = Game.time;

    if (!h._seg12Checked && Object.keys(h.rivalCitadelStorage).length === 0) {
        const seg12 = getSegmentData(12);
        if (seg12 !== null) {
            h._seg12Checked = true;
            if (seg12) {
                try {
                    const parsed = JSON.parse(seg12);
                    if (parsed && typeof parsed === 'object') h.rivalCitadelStorage = parsed;
                } catch (e) { /* ignore corrupt segment */ }
            }
        } else {
            requestSegment(12);
        }
    }

    const myColonies = [];
    for (const rn in Game.rooms) {
        const rm = Game.rooms[rn];
        if (rm && rm.controller && rm.controller.my && rm.controller.level >= 4) myColonies.push(rn);
    }
    if (myColonies.length === 0) {
        h.necrosis = null;
        return null;
    }

    let chosen = null;
    for (const rName in h.rivalCitadelStorage) {
        const p = h.rivalCitadelStorage[rName];
        if (!p || isFriendlyOrEmpireRoom(rName) || p.rcl < 6) continue;
        if ((Game.time - p.tick) > 400 || p.safeMode > 0) continue;
        if (p.storageEnergy < 0 || p.storageEnergy >= 50000) continue;

        let inRange = false;
        for (let c = 0; c < myColonies.length; c++) {
            if (Game.map && Game.map.getRoomLinearDistance(myColonies[c], rName) <= 6) {
                inRange = true;
                break;
            }
        }
        if (inRange) {
            chosen = p;
            break;
        }
    }

    if (chosen) {
        const prev = h.necrosis;
        let breachOpen = (prev && prev.targetRoom === chosen.roomName) ? prev.breachOpen : false;
        const visRoom = Game.rooms[chosen.roomName];
        const rState = h.rooms ? h.rooms[chosen.roomName] : null;
        if (visRoom && rState) {
            const structs = rState.hostileStructures || [];
            let hasRampart = false;
            for (let i = 0; i < structs.length; i++) {
                if (structs[i].structureType === STRUCTURE_RAMPART) { hasRampart = true; break; }
            }
            if (!hasRampart) breachOpen = true;
        }
        h.necrosis = {
            active: true,
            targetRoom: chosen.roomName,
            triggeredAt: (prev && prev.targetRoom === chosen.roomName) ? prev.triggeredAt : Game.time,
            breachOpen: breachOpen
        };
    } else {
        h.necrosis = null;
    }
    return h.necrosis;
}

function isFobColony(roomName) {
    return !!(typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].fob === true);
}

function isSkOrHighwayRoom(roomName) {
    const match = roomName && roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
    if (!match) return false;
    const x = parseInt(match[2], 10);
    const y = parseInt(match[4], 10);
    const modX = x % 10;
    const modY = y % 10;
    if (modX === 0 || modY === 0) return true;
    return modX >= 4 && modX <= 6 && modY >= 4 && modY <= 6;
}

function parseRoomLinearXY(roomName) {
    const match = roomName && roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
    if (!match) return null;
    const x = parseInt(match[2], 10);
    const y = parseInt(match[4], 10);
    return {
        x: match[1] === 'W' ? (-1 - x) : x,
        y: match[3] === 'N' ? (-1 - y) : y
    };
}

function resolveExitDirection(fromRoom, toRoom) {
    if (!fromRoom || !toRoom || fromRoom === toRoom) return ERR_NO_PATH;
    if (typeof Game !== 'undefined' && Game.map && Game.map.findExit) {
        const d = Game.map.findExit(fromRoom, toRoom);
        if (d >= 1 && d <= 8) return d;
    }
    const rmObj = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[fromRoom] : null;
    if (rmObj && rmObj.findExitTo) {
        const d = rmObj.findExitTo(toRoom);
        if (d >= 1 && d <= 8) return d;
    }
    const a = parseRoomLinearXY(fromRoom);
    const b = parseRoomLinearXY(toRoom);
    if (a && b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
            if (dx < 0) return typeof FIND_EXIT_LEFT !== 'undefined' ? FIND_EXIT_LEFT : 7;
            if (dx > 0) return typeof FIND_EXIT_RIGHT !== 'undefined' ? FIND_EXIT_RIGHT : 3;
        }
        if (dy < 0) return typeof FIND_EXIT_TOP !== 'undefined' ? FIND_EXIT_TOP : 1;
        if (dy > 0) return typeof FIND_EXIT_BOTTOM !== 'undefined' ? FIND_EXIT_BOTTOM : 5;
    }
    return ERR_NO_PATH;
}

function getSharedExitTiles(stagingRoom, targetRoom, exitDir) {
    const h = ensureOffenseBuffers();
    const dir = (exitDir >= 1 && exitDir <= 8) ? exitDir : resolveExitDirection(stagingRoom, targetRoom);
    if (dir < 1 || dir > 8) return [];
    const cacheKey = stagingRoom + ':' + dir;
    if (h.exitTilesCache[cacheKey] && h.exitTilesCache[cacheKey].length > 0) {
        return h.exitTilesCache[cacheKey];
    }

    const roomObj = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[stagingRoom] : null;
    let tiles = [];
    if (roomObj && roomObj.find) {
        const found = roomObj.find(dir) || [];
        for (let i = 0; i < found.length; i++) {
            const p = found[i];
            if (p && p.x !== undefined && p.y !== undefined) {
                tiles.push({ x: p.x, y: p.y, roomName: stagingRoom });
            }
        }
    }

    if (tiles.length === 0) {
        const terrain = (roomObj && roomObj.getTerrain)
            ? roomObj.getTerrain()
            : ((typeof Game !== 'undefined' && Game.map && Game.map.getRoomTerrain) ? Game.map.getRoomTerrain(stagingRoom) : null);
        const wallMask = typeof TERRAIN_MASK_WALL !== 'undefined' ? TERRAIN_MASK_WALL : 1;
        const topDir = typeof FIND_EXIT_TOP !== 'undefined' ? FIND_EXIT_TOP : 1;
        const rightDir = typeof FIND_EXIT_RIGHT !== 'undefined' ? FIND_EXIT_RIGHT : 3;
        const bottomDir = typeof FIND_EXIT_BOTTOM !== 'undefined' ? FIND_EXIT_BOTTOM : 5;
        for (let i = 1; i <= 48; i++) {
            let tx = i;
            let ty = 0;
            if (dir === topDir) { tx = i; ty = 0; }
            else if (dir === rightDir) { tx = 49; ty = i; }
            else if (dir === bottomDir) { tx = i; ty = 49; }
            else { tx = 0; ty = i; }
            if (!terrain || !terrain.get || terrain.get(tx, ty) !== wallMask) {
                tiles.push({ x: tx, y: ty, roomName: stagingRoom });
            }
        }
    }

    if (tiles.length > 0) h.exitTilesCache[cacheKey] = tiles;
    return tiles;
}

function distToExitTiles(pos, group) {
    if (!pos || !group) return Infinity;
    const tiles = group.exitTiles;
    if (tiles && tiles.length > 0) {
        let minD = Infinity;
        for (let i = 0; i < tiles.length; i++) {
            const d = calcDistance(pos, tiles[i]);
            if (d < minD) minD = d;
        }
        return minD;
    }
    return calcDistance(pos, { x: group.exitX || 25, y: group.exitY || 25 });
}

function resolveStagingRoom(originRoom, targetRoom, members) {
    const h = ensureOffenseBuffers();
    const origin = originRoom || (members && members[0] && members[0].room ? members[0].room.name : null);
    if (!origin || !targetRoom) return origin || targetRoom;
    if (origin === targetRoom) return origin;

    const now = typeof Game !== 'undefined' ? Game.time : 0;
    const key = origin + ':' + targetRoom;
    const cached = h.stagingRouteCache[key];
    if (cached && now < cached.expires && cached.stagingRoom && cached.stagingRoom !== targetRoom) {
        return cached.stagingRoom;
    }

    let stagingRoom = null;
    if (typeof Game !== 'undefined' && Game.map && Game.map.findRoute) {
        const route = Game.map.findRoute(origin, targetRoom, {
            routeCallback(rName) {
                if (rName === targetRoom || rName === origin) return 1;
                if (Game.map.getRoomStatus) {
                    const st = Game.map.getRoomStatus(rName);
                    if (st && st.status && st.status !== 'normal') return Infinity;
                }
                if (isSkOrHighwayRoom(rName)) return Infinity;
                if (getRoomThreatPower(rName) >= 600) return Infinity;
                return 1;
            }
        });
        if (Array.isArray(route) && route.length >= 2) {
            stagingRoom = route[route.length - 2].room;
        } else if (Array.isArray(route) && route.length === 1) {
            stagingRoom = origin;
        }
    } else if (typeof Game !== 'undefined' && Game.map && Game.map.findExit && Game.map.findExit(origin, targetRoom) >= 1) {
        stagingRoom = origin;
    }

    if (!stagingRoom && typeof Game !== 'undefined' && Game.map && Game.map.describeExits) {
        const exits = Game.map.describeExits(targetRoom) || {};
        let bestScore = -Infinity;
        for (const d in exits) {
            const adj = exits[d];
            if (!adj || adj === targetRoom) continue;
            const tp = getRoomThreatPower(adj);
            if (tp >= 600) continue;
            const od = Game.map.getRoomLinearDistance ? Game.map.getRoomLinearDistance(origin, adj) : 1;
            const sc = (tp === 0 ? 500 : -tp) - od * 40 - (isSkOrHighwayRoom(adj) ? 200 : 0);
            if (sc > bestScore) { bestScore = sc; stagingRoom = adj; }
        }
    }

    if (!stagingRoom && members) {
        for (let i = 0; i < members.length; i++) {
            const m = members[i];
            if (m && m.room && m.room.name !== targetRoom &&
                Game.map && Game.map.getRoomLinearDistance &&
                Game.map.getRoomLinearDistance(m.room.name, targetRoom) === 1) {
                stagingRoom = m.room.name;
                break;
            }
        }
    }

    if (!stagingRoom) stagingRoom = origin;
    h.stagingRouteCache[key] = { stagingRoom, expires: now + 200 };
    return stagingRoom;
}

function computeStagingRallyPos(group) {
    if (!group || !group.stagingRoom || !group.targetRoom) return;
    const h = ensureOffenseBuffers();
    const exitDir = resolveExitDirection(group.stagingRoom, group.targetRoom);
    const exitTiles = getSharedExitTiles(group.stagingRoom, group.targetRoom, exitDir);
    group.exitDir = exitDir;
    group.exitTiles = exitTiles;

    let exitX = 25;
    let exitY = 25;
    if (exitTiles.length > 0) {
        const sorted = exitTiles.slice().sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
        const mid = sorted[Math.floor(sorted.length / 2)];
        exitX = mid.x;
        exitY = mid.y;
    } else if (exitDir >= 1 && exitDir <= 8) {
        const topDir = typeof FIND_EXIT_TOP !== 'undefined' ? FIND_EXIT_TOP : 1;
        const rightDir = typeof FIND_EXIT_RIGHT !== 'undefined' ? FIND_EXIT_RIGHT : 3;
        const bottomDir = typeof FIND_EXIT_BOTTOM !== 'undefined' ? FIND_EXIT_BOTTOM : 5;
        if (exitDir === topDir) { exitX = 25; exitY = 0; }
        else if (exitDir === rightDir) { exitX = 49; exitY = 25; }
        else if (exitDir === bottomDir) { exitX = 25; exitY = 49; }
        else { exitX = 0; exitY = 25; }
    }
    group.exitX = exitX;
    group.exitY = exitY;

    const rState = h.rooms ? h.rooms[group.stagingRoom] : null;
    const roomObj = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[group.stagingRoom] : null;
    const terrain = (roomObj && roomObj.getTerrain)
        ? roomObj.getTerrain()
        : ((typeof Game !== 'undefined' && Game.map && Game.map.getRoomTerrain) ? Game.map.getRoomTerrain(group.stagingRoom) : null);
    const wallMask = typeof TERRAIN_MASK_WALL !== 'undefined' ? TERRAIN_MASK_WALL : 1;
    const swampMask = typeof TERRAIN_MASK_SWAMP !== 'undefined' ? TERRAIN_MASK_SWAMP : 2;
    const roadGrid = rState && rState.roadGrid ? rState.roadGrid : null;

    const roadSet = (!roadGrid && rState && rState.roads) ? new Set(rState.roads.map(r => r.pos.x * 50 + r.pos.y)) : null;
    const blockedSet = new Set();
    if (rState) {
        const lists = [rState.spawns, rState.extensions, rState.towers, rState.storage ? [rState.storage] : null, rState.terminal ? [rState.terminal] : null, rState.links, rState.labs, rState.keeperLairs, rState.walls];
        for (let l = 0; l < lists.length; l++) {
            const arr = lists[l];
            if (!arr) continue;
            for (let i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].pos) blockedSet.add(arr[i].pos.x * 50 + arr[i].pos.y);
            }
        }
        const hs = rState.hostileStructures || [];
        for (let i = 0; i < hs.length; i++) {
            const st = hs[i];
            if (st && st.pos && st.structureType !== STRUCTURE_ROAD && st.structureType !== STRUCTURE_CONTAINER) {
                blockedSet.add(st.pos.x * 50 + st.pos.y);
            }
        }
    }

    const inX = exitX <= 1 ? 1 : (exitX >= 48 ? -1 : 0);
    const inY = exitY <= 1 ? 1 : (exitY >= 48 ? -1 : 0);
    const idealX = Math.max(3, Math.min(46, exitX + inX * 3));
    const idealY = Math.max(3, Math.min(46, exitY + inY * 3));

    const candidates = [];
    const minX = Math.max(2, idealX - 6);
    const maxX = Math.min(47, idealX + 6);
    const minY = Math.max(2, idealY - 6);
    const maxY = Math.min(47, idealY + 6);

    for (let tx = minX; tx <= maxX; tx++) {
        for (let ty = minY; ty <= maxY; ty++) {
            const idx = tx * 50 + ty;
            if (blockedSet.has(idx)) continue;
            const terr = (terrain && terrain.get) ? terrain.get(tx, ty) : 0;
            if (terr === wallMask) continue;
            const dExit = exitTiles.length > 0
                ? distToExitTiles({ x: tx, y: ty }, group)
                : Math.max(Math.abs(tx - exitX), Math.abs(ty - exitY));
            if (dExit < 3 || dExit > 4) continue;
            const isRoad = roadGrid ? (roadGrid[idx] === 1) : (roadSet ? roadSet.has(idx) : false);
            const isEdgeBuf = (tx < 3 || tx > 46 || ty < 3 || ty > 46);
            const isSwamp = (terr & swampMask) !== 0;
            const anchorDist = Math.max(Math.abs(tx - idealX), Math.abs(ty - idealY));
            const score = (isRoad ? 1000 : 0) + (isEdgeBuf ? 100 : 0) + (isSwamp ? 20 : 0) + anchorDist;
            candidates.push({ x: tx, y: ty, roomName: group.stagingRoom, score });
        }
    }

    if (candidates.length === 0) {
        candidates.push({ x: idealX, y: idealY, roomName: group.stagingRoom, score: 0 });
    } else {
        candidates.sort((a, b) => a.score - b.score);
    }

    group.rallySlots = candidates.slice(0, 8);
    group.rallyX = group.rallySlots[0].x;
    group.rallyY = group.rallySlots[0].y;
}

function getSpawningPowerForTarget(targetRoom) {
    if (typeof Game === 'undefined' || !Game.spawns) return 0;
    let power = 0;
    for (const sName in Game.spawns) {
        const sp = Game.spawns[sName];
        if (!sp || !sp.spawning) continue;
        const cMem = (typeof Memory !== 'undefined' && Memory.creeps) ? Memory.creeps[sp.spawning.name] : null;
        if (!cMem || cMem.targetRoom !== targetRoom) continue;
        if (cMem.power > 0) {
            power += cMem.power;
        } else {
            const cap = sp.room ? (sp.room.energyCapacityAvailable || 300) : 300;
            power += Math.max(30, Math.round(Math.min(cap, 2100) * 0.14));
        }
    }
    return power;
}

function updateStrikeGroupState(group, members) {
    const h = ensureOffenseBuffers();
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    if (!group || group.lastEvalTick === now) return group;
    group.lastEvalTick = now;

    if (!group.rallySlots || group.rallySlots.length === 0 || (now % 20 === 0)) {
        computeStagingRallyPos(group);
    }

    const inTarget = [];
    const inStaging = [];
    const inTransit = [];
    let totalPower = 0;
    let engagedPower = 0;
    let stagedPower = 0;
    let inTransitPower = 0;
    const names = [];

    for (let i = 0; i < members.length; i++) {
        const c = members[i];
        if (!c || c.spawning) continue;
        names.push(c.name || c.id);
        const p = calcUnitPower(c);
        totalPower += p;
        const rn = c.room ? c.room.name : null;
        if (rn === group.targetRoom) {
            inTarget.push(c);
            engagedPower += p;
        } else if (rn === group.stagingRoom) {
            inStaging.push(c);
            stagedPower += p;
        } else {
            inTransit.push(c);
            inTransitPower += p;
        }
    }

    group.memberNames = names;
    group.totalPower = totalPower;
    group.stagedPower = stagedPower;
    group.engagedPower = engagedPower;

    const myUsername = resolveMyUsername();
    const tState = h.rooms ? h.rooms[group.targetRoom] : null;
    let targetThreatPower = getRoomThreatPower(group.targetRoom);
    let liveHostilePower = targetThreatPower;
    let liveActiveTowers = 0;
    let liveArmed = [];

    if (tState) {
        const liveInfo = calcRoomHostilePower(tState);
        liveHostilePower = liveInfo.threatPower;
        liveActiveTowers = liveInfo.activeTowers;
        targetThreatPower = liveHostilePower;
        h.roomIntel[group.targetRoom] = {
            threatPower: liveHostilePower,
            threatPowerTick: now,
            activeTowers: liveActiveTowers,
            armedCount: liveInfo.armedCount,
            lastSeen: now
        };
        const rawHostiles = tState.hostiles || [];
        for (let i = 0; i < rawHostiles.length; i++) {
            const hs = rawHostiles[i];
            if (!hs || hs.my || (hs.owner && myUsername && hs.owner.username === myUsername)) continue;
            if (calcUnitPower(hs) > 0) liveArmed.push(hs);
        }

        const allStructs = collectRoomHostileStructures(tState);
        let hasDestructible = false;
        for (let s = 0; s < allStructs.length; s++) {
            if (isDestructibleHostileStruct(allStructs[s], myUsername)) { hasDestructible = true; break; }
        }
        if (rawHostiles.length === 0 && !hasDestructible && liveHostilePower === 0) {
            delete h.strikeGroups[group.targetRoom];
            return null;
        }
    }

    const launchThreshold = Math.max(200, targetThreatPower * 1.35);
    const stagingState = h.rooms ? h.rooms[group.stagingRoom] : null;
    const hasHealerOrTower = inStaging.some(c => c.getActiveBodyparts && c.getActiveBodyparts(HEAL) > 0) ||
        !!(stagingState && stagingState.towers && stagingState.towers.length > 0);

    if (group.state === 'STAGING') {
        // Ready-Subset Launch Gate: only count ready creeps in stagingRoom within range <= 5, fatigue === 0, ready HP
        const readyStaged = [];
        let readyPower = 0;
        for (let i = 0; i < inStaging.length; i++) {
            const c = inStaging[i];
            if (isBroken(c)) continue;
            if ((c.fatigue || 0) > 0) continue;
            const hpOk = hasHealerOrTower ? (c.hits >= c.hitsMax) : (c.hits >= c.hitsMax * 0.65);
            if (!hpOk) continue;
            if (distToExitTiles(c.pos, group) > 5) continue;
            readyStaged.push(c);
            readyPower += calcUnitPower(c);
        }
        group.readyPower = readyPower;

        if (readyPower >= launchThreshold) {
            const canWinReady = (tState && liveArmed.length > 0 && liveActiveTowers === 0)
                ? canWinFightFast(readyStaged, liveArmed).canWin
                : true;
            if (canWinReady) {
                group.state = 'ENGAGING';
                group.stateChangedAt = now;
            }
        }

        // TTL Deadlock Escape (< 450 TTL): pivot to softer rival target instead of decaying idle
        if (group.state === 'STAGING' && inStaging.length > 0) {
            let lowTtl = false;
            for (let i = 0; i < inStaging.length; i++) {
                if (inStaging[i].ticksToLive !== undefined && inStaging[i].ticksToLive < 450) {
                    lowTtl = true;
                    break;
                }
            }
            const spawningPower = getSpawningPowerForTarget(group.targetRoom);
            if (lowTtl && (stagedPower + inTransitPower + spawningPower) < launchThreshold) {
                const softer = selectSofterRivalTarget(group.stagingRoom, Math.max(1, stagedPower * 0.8), group.targetRoom);
                if (softer) {
                    for (let i = 0; i < members.length; i++) {
                        if (members[i] && members[i].memory) members[i].memory.targetRoom = softer;
                    }
                    delete h.strikeGroups[group.targetRoom];
                    return null;
                }
            }
        }
    } else if (group.state === 'ENGAGING') {
        const crossingGrace = (now - (group.stateChangedAt || 0)) <= 4;
        if (inTarget.length === 0) {
            if (!crossingGrace && targetThreatPower > 0 && totalPower < targetThreatPower * 0.85) {
                group.state = 'STAGING';
                group.stateChangedAt = now;
            }
        } else if (liveHostilePower > 0) {
            const effectiveGroupPower = crossingGrace ? (engagedPower + stagedPower) : engagedPower;
            const ttlCheck = (liveArmed.length > 0 && liveActiveTowers === 0)
                ? canWinFightFast(inTarget, liveArmed)
                : { canWin: true };
            if (effectiveGroupPower < liveHostilePower * 0.85 || (!ttlCheck.canWin && effectiveGroupPower < liveHostilePower)) {
                group.state = 'RETREATING';
                group.stateChangedAt = now;
            }
        }
    } else if (group.state === 'RETREATING') {
        if (inTarget.length === 0) {
            const allHealed = inStaging.every(c => (c.hits || 0) >= (c.hitsMax || 1));
            if (!hasHealerOrTower || allHealed) {
                group.state = 'STAGING';
                group.stateChangedAt = now;
            }
        }
    }

    return group;
}

function pickPackVectorTile(creep, goalPos, avoidPos, opts) {
    if (!creep || !creep.pos) return null;
    const h = ensureOffenseBuffers();
    const roomName = creep.pos.roomName || (creep.room && creep.room.name);
    const room = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[roomName] : null;
    const terrain = (room && room.getTerrain) ? room.getTerrain() : null;
    const wallMask = typeof TERRAIN_MASK_WALL !== 'undefined' ? TERRAIN_MASK_WALL : 1;
    const swampMask = typeof TERRAIN_MASK_SWAMP !== 'undefined' ? TERRAIN_MASK_SWAMP : 2;
    const roadGrid = (h.rooms && h.rooms[roomName] && h.rooms[roomName].roadGrid) ? h.rooms[roomName].roadGrid : null;
    const swampWeight = hasSlowMoveRatio(creep) ? 60 : 35;
    const matrix = opts && opts.matrix ? opts.matrix : null;
    const threatField = h.threatField || null;
    const occupied = opts && opts.occupied ? opts.occupied : null;
    const desiredEnemyRange = (opts && opts.desiredEnemyRange !== undefined) ? opts.desiredEnemyRange : 0;
    const fleeWeight = (opts && opts.fleeWeight !== undefined) ? opts.fleeWeight : 0;

    let bestTile = null;
    let bestScore = Infinity;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const nx = creep.pos.x + dx;
            const ny = creep.pos.y + dy;
            if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
            const terr = (terrain && terrain.get) ? terrain.get(nx, ny) : 0;
            if (terr === wallMask) continue;
            if (matrix && matrix.get && matrix.get(nx, ny) === 255) continue;
            const key = nx * 50 + ny;
            if (occupied && occupied.has(key) && (nx !== creep.pos.x || ny !== creep.pos.y)) continue;

            const isRoad = !!(roadGrid && roadGrid[key] === 1);
            const isSwamp = !isRoad && ((terr & swampMask) !== 0);
            let sc = isRoad ? -2 : (isSwamp ? swampWeight : 0);
            if (threatField) sc += (threatField[key] || 0) * 10;
            if (goalPos) sc += calcDistance({ x: nx, y: ny }, goalPos) * 18;
            if (avoidPos) {
                const dEn = calcDistance({ x: nx, y: ny }, avoidPos);
                if (desiredEnemyRange > 0) {
                    sc += Math.abs(dEn - desiredEnemyRange) * 25;
                } else {
                    sc -= dEn * fleeWeight;
                }
            }
            if (sc < bestScore) {
                bestScore = sc;
                bestTile = { x: nx, y: ny, roomName };
            }
        }
    }
    return bestTile;
}

function pickStrikeFocusTarget(activePack, rState, doctrine, myUsername, allStructs) {
    const rawHostiles = (rState && rState.hostiles) || [];
    const rampartSet = new Set();
    for (let i = 0; i < allStructs.length; i++) {
        if (allStructs[i] && allStructs[i].structureType === STRUCTURE_RAMPART && allStructs[i].pos) {
            rampartSet.add(allStructs[i].pos.x * 50 + allStructs[i].pos.y);
        }
    }

    const armedHostiles = [];
    for (let i = 0; i < rawHostiles.length; i++) {
        const hs = rawHostiles[i];
        if (!hs || hs.my || (hs.owner && myUsername && hs.owner.username === myUsername)) continue;
        if (calcUnitPower(hs) > 0) armedHostiles.push(hs);
    }

    // Check combined pack weapon reachability for lowest effective-HP armed hostile
    let bestInRange = null;
    let bestScore = -Infinity;
    for (let i = 0; i < armedHostiles.length; i++) {
        const hs = armedHostiles[i];
        if (!hs.pos) continue;
        const underRampart = rampartSet.has(hs.pos.x * 50 + hs.pos.y);
        let inPackWeaponRange = false;
        let minCreepDist = Infinity;

        for (let m = 0; m < activePack.length; m++) {
            const al = activePack[m];
            const d = calcDistance(al.pos, hs.pos);
            if (d < minCreepDist) minCreepDist = d;
            const hasRng = al.getActiveBodyparts && al.getActiveBodyparts(RANGED_ATTACK) > 0;
            const hasAtk = al.getActiveBodyparts && al.getActiveBodyparts(ATTACK) > 0;
            if ((hasRng && d <= 3) || (hasAtk && d <= 1)) {
                inPackWeaponRange = true;
            }
        }
        if (!inPackWeaponRange) continue;

        const parts = getCombatPartsCount(hs);
        let sc = calculateKillScore(hs, 180, armedHostiles);
        if (!underRampart) sc += 50000;
        if (parts.heal > 0) sc += 20000;
        sc -= minCreepDist * 20;
        if (sc > bestScore) { bestScore = sc; bestInRange = hs; }
    }

    if (bestInRange) return bestInRange;
    if (doctrine && doctrine.primaryTarget) return doctrine.primaryTarget;
    return pickFallbackHostileStruct(allStructs, activePack[0].pos, myUsername);
}

function executeStrikeGroup(group, members) {
    if (!group || !members || !members.length) return;
    const h = ensureOffenseBuffers();
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    const myUsername = resolveMyUsername();

    const inStaging = [];
    const inTarget = [];
    const inTransit = [];
    for (let i = 0; i < members.length; i++) {
        const c = members[i];
        if (!c || c.spawning) continue;
        if (!c.heap) c.heap = {};
        c.heap._strikeHandledTick = now;
        c.heap.sleepUntil = 0;
        const rn = c.room ? c.room.name : null;
        if (rn === group.targetRoom) inTarget.push(c);
        else if (rn === group.stagingRoom) inStaging.push(c);
        else inTransit.push(c);
    }

    const stagingState = h.rooms ? h.rooms[group.stagingRoom] : null;
    const hasHealerOrTowerStaging = inStaging.some(c => c.getActiveBodyparts && c.getActiveBodyparts(HEAL) > 0) ||
        !!(stagingState && stagingState.towers && stagingState.towers.length > 0);
    const slots = (group.rallySlots && group.rallySlots.length > 0)
        ? group.rallySlots
        : [{ x: group.rallyX || 25, y: group.rallyY || 25, roomName: group.stagingRoom }];

    // Transit units route to stagingRoom (or catch up when ENGAGING if already adjacent/safe)
    for (let i = 0; i < inTransit.length; i++) {
        const c = inTransit[i];
        executeDriveByCombat(c);
        if (c.fatigue > 0) continue;
        if (isBroken(c)) {
            const home = (c.memory && (c.memory.colony || c.memory.homeRoom)) || group.stagingRoom;
            moveToRoomViaExit(c, home, roomCenterPos(home), 3);
        } else {
            moveToRoomViaExit(c, group.stagingRoom, { x: group.rallyX || 25, y: group.rallyY || 25, roomName: group.stagingRoom }, 2);
        }
    }

    if (group.state === 'STAGING' || group.state === 'RETREATING') {
        // Staged units park off-road/off-edge at range 3-4 from exit and cross-heal to 100% HP
        for (let i = 0; i < inStaging.length; i++) {
            const c = inStaging[i];
            if (isBroken(c) && !hasHealerOrTowerStaging) {
                if (c.fatigue === 0) {
                    const home = (c.memory && (c.memory.colony || c.memory.homeRoom)) || group.stagingRoom;
                    if (home && home !== c.room.name) moveToRoomViaExit(c, home, roomCenterPos(home), 3);
                }
                continue;
            }
            executePackCrossHeal(c, inStaging, stagingState, { allowHealDespiteMelee: false });
            if (c.fatigue === 0) {
                const slot = slots[i % slots.length];
                if (c.pos.x !== slot.x || c.pos.y !== slot.y) {
                    moveCreep(c, slot, 0);
                }
            }
        }

        // Retreating units inside targetRoom fire/cross-heal while withdrawing together to stagingRoom
        if (group.state === 'RETREATING' && inTarget.length > 0) {
            const rState = h.rooms ? h.rooms[group.targetRoom] : null;
            const doctrine = computeRoomTargetDoctrine(group.targetRoom, inTarget);
            const allStructs = collectRoomHostileStructures(rState);
            const focusTarget = pickStrikeFocusTarget(inTarget, rState, doctrine, myUsername, allStructs);
            if (focusTarget && focusTarget.id) group.primaryTargetInt = getOrCreateIntId(focusTarget.id);
            for (let i = 0; i < inTarget.length; i++) {
                const c = inTarget[i];
                executeOpportunityFire(c, focusTarget, rState, {
                    primaryTarget: focusTarget,
                    focusTarget,
                    packAllies: inTarget
                });
                if (c.fatigue === 0) {
                    moveToRoomViaExit(c, group.stagingRoom, { x: group.rallyX || 25, y: group.rallyY || 25, roomName: group.stagingRoom }, 2);
                }
            }
        }
        return;
    }

    // ENGAGING: 1) Staged non-broken units cross border simultaneously onto shared exit
    for (let i = 0; i < inStaging.length; i++) {
        const c = inStaging[i];
        if (isBroken(c)) {
            executePackCrossHeal(c, inStaging, stagingState, {});
            if (c.fatigue === 0) {
                const slot = slots[i % slots.length];
                if (c.pos.x !== slot.x || c.pos.y !== slot.y) moveCreep(c, slot, 0);
            }
            continue;
        }
        if (c.hits < c.hitsMax) executePackCrossHeal(c, inStaging, stagingState, {});
        if (c.fatigue > 0) continue;

        const exitTiles = group.exitTiles || [];
        let bestExit = null;
        let bestDist = Infinity;
        for (let e = 0; e < exitTiles.length; e++) {
            const d = calcDistance(c.pos, exitTiles[e]);
            if (d < bestDist) { bestDist = d; bestExit = exitTiles[e]; }
        }
        if (bestExit && bestDist === 1) {
            c.heap.nextStep = { x: bestExit.x, y: bestExit.y, roomName: group.stagingRoom };
        } else if (bestExit) {
            moveCreep(c, bestExit, 0);
        } else {
            moveToRoomViaExit(c, group.targetRoom, roomCenterPos(group.targetRoom), 3);
        }
    }

    if (inTarget.length === 0) return;

    // ENGAGING: 2) Active units inside targetRoom execute Hive-Mind Pack Micro (centroid, focus-fire, cross-heal, pullback, tether)
    const rState = h.rooms ? h.rooms[group.targetRoom] : null;
    const activePack = [];
    for (let i = 0; i < inTarget.length; i++) {
        const c = inTarget[i];
        if (isBroken(c)) {
            executePackCrossHeal(c, inTarget, rState, {});
            if (c.fatigue === 0) {
                moveToRoomViaExit(c, group.stagingRoom, { x: group.rallyX || 25, y: group.rallyY || 25, roomName: group.stagingRoom }, 2);
            }
        } else {
            activePack.push(c);
        }
    }
    if (activePack.length === 0) return;

    // Group-level metrics computed ONCE per tick per Strike Group
    let sumX = 0;
    let sumY = 0;
    let coreSumX = 0;
    let coreSumY = 0;
    let coreCount = 0;
    let healthyCount = 0;
    let lowestHurtAlly = null;
    let lowestHurtRatio = 1;

    for (let i = 0; i < activePack.length; i++) {
        const c = activePack[i];
        sumX += c.pos.x;
        sumY += c.pos.y;
        const hasAtk = c.getActiveBodyparts && c.getActiveBodyparts(ATTACK) > 0;
        const hasHeal = c.getActiveBodyparts && c.getActiveBodyparts(HEAL) > 0;
        if (hasAtk || hasHeal) {
            coreSumX += c.pos.x;
            coreSumY += c.pos.y;
            coreCount++;
        }
        const ratio = (c.hits || 1) / (c.hitsMax || 1);
        if (ratio >= 0.55) healthyCount++;
        if (ratio < lowestHurtRatio) { lowestHurtRatio = ratio; lowestHurtAlly = c; }
    }

    const centroidX = Math.round(sumX / activePack.length);
    const centroidY = Math.round(sumY / activePack.length);
    group.centroidX = centroidX;
    group.centroidY = centroidY;
    const centroidPos = { x: centroidX, y: centroidY, roomName: group.targetRoom };
    const corePos = coreCount > 0
        ? { x: Math.round(coreSumX / coreCount), y: Math.round(coreSumY / coreCount), roomName: group.targetRoom }
        : centroidPos;

    const hostiles = (rState && rState.hostiles) || [];
    const armed = (rState && rState.armedHostiles) || [];
    const hTowers = (rState && rState.hostileTowers) || [];
    const allStructs = collectRoomHostileStructures(rState);
    if (armed.length > 0 || hTowers.length > 0) {
        populateThreatField(h.threatField, hostiles);
    }

    const doctrine = computeRoomTargetDoctrine(group.targetRoom, activePack);
    const primaryTarget = pickStrikeFocusTarget(activePack, rState, doctrine, myUsername, allStructs);
    if (primaryTarget && primaryTarget.id) {
        group.primaryTargetInt = getOrCreateIntId(primaryTarget.id);
        if (rState) rState.primaryTargetInt = group.primaryTargetInt;
    } else {
        group.primaryTargetInt = 0;
    }

    const hasBarriers = allStructs.some(s => s && (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL) && (!s.hits || s.hits > 0));
    const breachTarget = (primaryTarget && rState && hasBarriers)
        ? solveBreachTarget(group.targetRoom, centroidPos, primaryTarget, rState)
        : null;
    const moveGoal = breachTarget || primaryTarget;

    let nearestEnemy = null;
    let nearestEnemyDist = Infinity;
    for (let i = 0; i < hostiles.length; i++) {
        const hs = hostiles[i];
        if (!hs || hs.my || (hs.owner && myUsername && hs.owner.username === myUsername) || !hs.pos) continue;
        if (calcUnitPower(hs) <= 0) continue;
        const d = calcDistance(corePos, hs.pos);
        if (d < nearestEnemyDist) { nearestEnemyDist = d; nearestEnemy = hs; }
    }

    const combatMat = getCombatAvoidanceMatrix(group.targetRoom, 15);
    const occupied = new Set();
    for (let i = 0; i < activePack.length; i++) {
        occupied.add(activePack[i].pos.x * 50 + activePack[i].pos.y);
    }

    // Per-creep O(1) execution inside targetRoom
    for (let i = 0; i < activePack.length; i++) {
        const c = activePack[i];
        executeOpportunityFire(c, moveGoal, rState, {
            primaryTarget,
            breachTarget,
            focusTarget: primaryTarget,
            packAllies: activePack
        });
        if (c.fatigue > 0) continue;

        const hasRanged = c.getActiveBodyparts && c.getActiveBodyparts(RANGED_ATTACK) > 0;
        const hasAttack = c.getActiveBodyparts && c.getActiveBodyparts(ATTACK) > 0;
        const hasWork = c.getActiveBodyparts && c.getActiveBodyparts(WORK) > 0;
        const hasHeal = c.getActiveBodyparts && c.getActiveBodyparts(HEAL) > 0;

        // 1. Frontline Pullback (< 45% HP): step behind centroid while healthier teammates absorb aggro
        if ((c.hits || 0) < (c.hitsMax || 1) * 0.45 && healthyCount > 0 && nearestEnemy) {
            const step = pickPackVectorTile(c, centroidPos, nearestEnemy.pos, { matrix: combatMat, occupied, fleeWeight: 32 });
            if (step) {
                occupied.add(step.x * 50 + step.y);
                c.heap.nextStep = step;
                continue;
            }
        }

        // 2. Cohesion Tether: never rush > 3 tiles ahead of pack core into an armed enemy alone
        if (activePack.length > 1 && !breachTarget && nearestEnemy) {
            const distToCore = calcDistance(c.pos, corePos);
            const myEnemyDist = calcDistance(c.pos, nearestEnemy.pos);
            const coreEnemyDist = calcDistance(corePos, nearestEnemy.pos);
            if (myEnemyDist <= 6 && distToCore > 3) {
                if (myEnemyDist < coreEnemyDist) {
                    const holdTile = pickPackVectorTile(c, corePos, nearestEnemy.pos, {
                        matrix: combatMat,
                        occupied,
                        desiredEnemyRange: (hasRanged || !hasAttack) ? 3 : 4
                    });
                    if (holdTile) {
                        occupied.add(holdTile.x * 50 + holdTile.y);
                        c.heap.nextStep = holdTile;
                        continue;
                    }
                } else if (!hasAttack || myEnemyDist > 1) {
                    moveCreep(c, centroidPos, 2, { costMatrix: combatMat });
                    continue;
                }
            }
        }

        // 3. Normal Strike Advance / Kite / Healer Assist
        if (moveGoal) {
            const desiredR = (hasRanged && !hasAttack && !hasWork) ? 3 : 1;
            if (!hasAttack && !hasRanged && !hasWork && hasHeal) {
                const assistTarget = (lowestHurtAlly && lowestHurtAlly !== c) ? lowestHurtAlly.pos : centroidPos;
                if (calcDistance(c.pos, assistTarget) > 1) {
                    moveCreep(c, assistTarget, 1, { costMatrix: combatMat });
                }
            } else if (!breachTarget && hasRanged && !hasAttack && !hasWork) {
                const roomObj = c.room;
                const terrain = roomObj && roomObj.getTerrain ? roomObj.getTerrain() : null;
                const kiteTile = evaluateKiteTile(c, moveGoal, h.threatField, terrain, combatMat);
                if (kiteTile && (activePack.length <= 1 || calcDistance(kiteTile, centroidPos) <= 3 || calcDistance(c.pos, centroidPos) <= 3)) {
                    c.heap.nextStep = kiteTile;
                } else {
                    const stepGoal = (activePack.length > 1 && calcDistance(c.pos, centroidPos) > 3) ? centroidPos : moveGoal.pos;
                    moveCreep(c, stepGoal, desiredR, { costMatrix: combatMat });
                }
            } else if (calcDistance(c.pos, moveGoal.pos) > desiredR) {
                moveCreep(c, moveGoal.pos, desiredR, { costMatrix: combatMat });
            }
        } else if (calcDistance(c.pos, centroidPos) > 2) {
            moveCreep(c, centroidPos, 2, { costMatrix: combatMat });
        } else if (calcDistance(c.pos, { x: 25, y: 25 }) > 5) {
            moveCreep(c, roomCenterPos(group.targetRoom), 4, { costMatrix: combatMat });
        }
    }
}

function syncStrikeGroups() {
    const h = ensureOffenseBuffers();
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    if (h._strikeSyncTick === now) return h.strikeGroups;
    h._strikeSyncTick = now;

    const cfg = getConfig();
    const eligibleRoles = { hunter: true, pest: true, raider: true, assassin: true };
    const seen = new Set();
    const byTarget = {};

    const collectCreep = (c) => {
        if (!c || c.spawning) return;
        const key = c.name || c.id;
        if (key && seen.has(key)) return;
        const role = (c.memory && c.memory.role) || (c.heap && c.heap.role);
        if (!role || !eligibleRoles[role]) return;
        if (!isOffenseAllowed(role, cfg)) return;
        const targetRoom = c.memory && c.memory.targetRoom;
        if (!targetRoom || isFriendlyOrEmpireRoom(targetRoom)) return;
        if (key) seen.add(key);
        if (!byTarget[targetRoom]) byTarget[targetRoom] = [];
        byTarget[targetRoom].push(c);
    };

    if (typeof Game !== 'undefined' && Game.creeps) {
        for (const name in Game.creeps) collectCreep(Game.creeps[name]);
    }
    if (h.colonies) {
        for (const colName in h.colonies) {
            const byRole = h.colonies[colName] && h.colonies[colName].creepsByRole;
            if (!byRole) continue;
            for (const role of ['hunter', 'pest', 'raider', 'assassin']) {
                const list = byRole[role] || [];
                for (let i = 0; i < list.length; i++) collectCreep(list[i]);
            }
        }
    }

    // Purge disbanded or newly friendly target groups
    for (const tRoom in h.strikeGroups) {
        if (!byTarget[tRoom] || byTarget[tRoom].length === 0 || isFriendlyOrEmpireRoom(tRoom)) {
            delete h.strikeGroups[tRoom];
        }
    }

    const active = {};
    for (const targetRoom in byTarget) {
        const members = byTarget[targetRoom];
        const threatPower = getRoomThreatPower(targetRoom);
        let group = h.strikeGroups[targetRoom];
        if (!group) {
            if (threatPower <= 0) continue;
            const origin = (members[0].memory && (members[0].memory.colony || members[0].memory.homeRoom)) ||
                (members[0].room ? members[0].room.name : null);
            const stagingRoom = resolveStagingRoom(origin, targetRoom, members);
            const alreadyInside = members.some(m => m.room && m.room.name === targetRoom);
            group = {
                targetRoom,
                stagingRoom,
                state: alreadyInside ? 'ENGAGING' : 'STAGING',
                memberNames: [],
                totalPower: 0,
                stagedPower: 0,
                readyPower: 0,
                engagedPower: 0,
                centroidX: 25,
                centroidY: 25,
                primaryTargetInt: 0,
                exitDir: 0,
                exitX: 25,
                exitY: 25,
                rallyX: 25,
                rallyY: 25,
                rallySlots: [],
                exitTiles: [],
                lastEvalTick: -1,
                stateChangedAt: now
            };
            h.strikeGroups[targetRoom] = group;
        }
        const updated = updateStrikeGroupState(group, members);
        if (updated) active[targetRoom] = members;
    }

    return active;
}

function runStrikeGroups() {
    const h = ensureOffenseBuffers();
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    if (h._strikeRunTick === now) return;
    h._strikeRunTick = now;

    const active = syncStrikeGroups();
    for (const targetRoom in active) {
        const group = h.strikeGroups[targetRoom];
        if (group) executeStrikeGroup(group, active[targetRoom]);
    }
}

// 1. HUNTER-KILLERS: Prioritizes rival haulers (CARRY) -> miners (WORK) -> escorts in RivalRemotes, plus QRF rallies
function runHunters(colonyName) {
    const h = ensureOffenseBuffers();
    const col = h.colonies ? h.colonies[colonyName] : null;
    const hunters = (col && col.creepsByRole && col.creepsByRole.hunter) || [];
    if (!hunters.length) return;

    const cfg = getConfig();
    const qrfTarget = (h && h.qrfTarget) || null;
    const maxColDist = cfg.maxColonyDistance !== undefined ? cfg.maxColonyDistance : 7;
    const qrfDist = (qrfTarget && typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance)
        ? Game.map.getRoomLinearDistance(colonyName, qrfTarget)
        : Infinity;
    const rallyQrf = !!(qrfTarget && qrfDist <= maxColDist);

    const myUsername = resolveMyUsername();
    for (let i = 0; i < hunters.length; i++) {
        const c = hunters[i];
        if (!c || c.spawning) continue;
        if (!c.heap) c.heap = {};
        if (c.heap._strikeHandledTick === Game.time) continue;

        const curState = h.rooms ? h.rooms[c.room.name] : null;
        if (curState && ((curState.hostiles && curState.hostiles.length > 0) || (curState.hostileStructures && curState.hostileStructures.length > 0))) {
            c.heap.sleepUntil = 0;
        }

        let targetRoom = c.memory.targetRoom;
        if (rallyQrf) {
            targetRoom = qrfTarget;
            c.memory.targetRoom = qrfTarget;
        } else if (!targetRoom || isFriendlyOrEmpireRoom(targetRoom) || isTargetRoiNegative(targetRoom) || getRivalSafeModeRemaining(targetRoom) > 0) {
            targetRoom = selectHostileTarget(colonyName, 'hunter');
            if (!targetRoom) {
                const intel = getNearbyRivalRemote(colonyName, 4);
                targetRoom = intel ? intel.roomName : null;
            }
            if (targetRoom) c.memory.targetRoom = targetRoom;
            else delete c.memory.targetRoom;
        }
        if (!targetRoom) continue;

        if (c.room.name !== targetRoom) {
            executeDriveByCombat(c);
            if (c.fatigue === 0) {
                moveToRoomViaExit(c, targetRoom, roomCenterPos(targetRoom), 3);
            }
            continue;
        }

        const rState = h.rooms ? h.rooms[targetRoom] : null;
        const hostiles = (rState && rState.hostiles) || [];
        const armed = (rState && rState.armedHostiles) || [];
        const hTowers = (rState && rState.hostileTowers) || [];
        const allStructs = collectRoomHostileStructures(rState);
        if (armed.length > 0 || hTowers.length > 0) {
            populateThreatField(h.threatField, hostiles);
        }

        const doctrine = computeRoomTargetDoctrine(targetRoom);
        const hasRanged = c.getActiveBodyparts && c.getActiveBodyparts(RANGED_ATTACK) > 0;
        const hasAttack = c.getActiveBodyparts && c.getActiveBodyparts(ATTACK) > 0;
        const hasWork = c.getActiveBodyparts && c.getActiveBodyparts(WORK) > 0;
        const best = (hasRanged && doctrine && doctrine.interceptTarget)
            ? doctrine.interceptTarget
            : ((doctrine ? doctrine.primaryTarget : null) || (rallyQrf ? (armed[0] || hostiles[0]) : null) || pickFallbackHostileStruct(allStructs, c.pos, myUsername));

        const hasBarriers = allStructs.some(s => s && (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL) && (!s.hits || s.hits > 0));
        const breachTarget = (best && rState && hasBarriers) ? solveBreachTarget(targetRoom, c.pos, best, rState) : null;
        const moveGoal = breachTarget || best;

        if (shouldBorderBounceHeal(c, rState)) {
            executeOpportunityFire(c, moveGoal, rState, { primaryTarget: best, breachTarget });
            if (c.fatigue === 0) moveToRoomViaExit(c, colonyName, roomCenterPos(colonyName), 2);
            continue;
        }

        if (moveGoal) {
            executeOpportunityFire(c, moveGoal, rState, { primaryTarget: best, breachTarget });
            if (c.fatigue > 0) continue;

            if (breachTarget) {
                const desiredR = (hasRanged && !hasAttack && !hasWork) ? 3 : 1;
                if (calcDistance(c.pos, breachTarget.pos) > desiredR) {
                    const cMat = getCombatAvoidanceMatrix(targetRoom, 20);
                    moveCreep(c, breachTarget.pos, desiredR, { costMatrix: cMat });
                }
            } else if (hasRanged && !hasAttack && !hasWork) {
                const room = c.room;
                const terrain = room && room.getTerrain ? room.getTerrain() : null;
                const matrix = getCombatAvoidanceMatrix(targetRoom, 20);
                const kiteTile = evaluateKiteTile(c, best, h.threatField, terrain, matrix);
                if (kiteTile) {
                    c.heap.nextStep = kiteTile;
                } else {
                    moveCreep(c, best.pos, 3, { costMatrix: matrix });
                }
            } else {
                const cMat = getCombatAvoidanceMatrix(targetRoom, 20);
                moveCreep(c, best.pos, 1, { costMatrix: cMat });
            }
        } else {
            executeOpportunityFire(c, null, rState, {});
            if (c.fatigue > 0) continue;
            if (!rallyQrf) {
                const nextIntel = getNearbyRivalRemote(colonyName, 4);
                if (nextIntel && nextIntel.roomName && nextIntel.roomName !== targetRoom) {
                    c.memory.targetRoom = nextIntel.roomName;
                } else if (calcDistance(c.pos, { x: 25, y: 25 }) > 5) {
                    moveCreep(c, roomCenterPos(targetRoom), 4);
                }
            } else if (calcDistance(c.pos, { x: 25, y: 25 }) > 5) {
                moveCreep(c, roomCenterPos(targetRoom), 4);
            }
        }
    }
}

// 3. PEST MICRO ([ATTACK, MOVE] 130e): Border-dances to drain tower energy or steps inward to punch extensions/walls
function runPests(colonyName) {
    const h = ensureOffenseBuffers();
    const col = h.colonies ? h.colonies[colonyName] : null;
    const pests = (col && col.creepsByRole && col.creepsByRole.pest) || [];
    if (!pests.length) return;
    const myUsername = resolveMyUsername();

    for (let i = 0; i < pests.length; i++) {
        const c = pests[i];
        if (!c || c.spawning) continue;
        if (!c.heap) c.heap = {};
        if (c.heap._strikeHandledTick === Game.time) continue;

        const curState = h.rooms ? h.rooms[c.room.name] : null;
        if (curState && ((curState.hostiles && curState.hostiles.length > 0) || (curState.hostileStructures && curState.hostileStructures.length > 0))) {
            c.heap.sleepUntil = 0;
        }

        let targetRoom = c.memory.targetRoom;

        // Active Safe Mode or negative ROI check: if current target popped safe mode or bled out, pivot immediately!
        if (targetRoom) {
            const smRemaining = getRivalSafeModeRemaining(targetRoom);
            if (smRemaining > 0 || isTargetRoiNegative(targetRoom)) {
                delete c.memory.targetRoom;
                targetRoom = selectHostileTarget(colonyName, 'pest');
                if (targetRoom) c.memory.targetRoom = targetRoom;
            }
        }

        if (!targetRoom || isFriendlyOrEmpireRoom(targetRoom)) {
            targetRoom = selectHostileTarget(colonyName, 'pest') || getNearestRivalCitadel(colonyName, 4);
            if (targetRoom) c.memory.targetRoom = targetRoom;
        }
        if (!targetRoom) {
            executeDriveByCombat(c);
            if (c.fatigue === 0 && c.room.name !== colonyName) {
                moveToRoomViaExit(c, colonyName, roomCenterPos(colonyName), 4);
            }
            continue;
        }

        if (c.room.name !== targetRoom) {
            executeDriveByCombat(c);
            if (c.fatigue === 0) {
                c.heap.safeRoom = c.room.name;
                moveToRoomViaExit(c, targetRoom, roomCenterPos(targetRoom), 0);
            }
            continue;
        }

        const safeRoom = c.heap.safeRoom || colonyName;
        const onExit = (c.pos.x === 0 || c.pos.x === 49 || c.pos.y === 0 || c.pos.y === 49);
        const rState = h.rooms ? h.rooms[targetRoom] : null;
        const doctrine = computeRoomTargetDoctrine(targetRoom);
        const allStructs = collectRoomHostileStructures(rState);
        const best = (doctrine ? doctrine.primaryTarget : null) || pickFallbackHostileStruct(allStructs, c.pos, myUsername);

        if (onExit && !c.heap.baitMode) {
            executeOpportunityFire(c, best, rState, { primaryTarget: best, breachTarget: null });
            if (c.fatigue > 0) continue;
            if (c.hits < c.hitsMax) {
                moveToRoomViaExit(c, safeRoom, roomCenterPos(safeRoom), 2);
                continue;
            }
            c.heap.borderWait = (c.heap.borderWait || 0) + 1;
            if (c.heap.borderWait >= 3) {
                c.heap.baitMode = true; // Enemy ignored us -> advance inward to punch exposed assets
            } else {
                moveToRoomViaExit(c, safeRoom, roomCenterPos(safeRoom), 2);
                continue;
            }
        }

        const hasBarriers = allStructs.some(s => s && (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL) && (!s.hits || s.hits > 0));
        const breachTarget = (best && rState && hasBarriers) ? solveBreachTarget(targetRoom, c.pos, best, rState) : null;
        const moveGoal = breachTarget || best;

        if (shouldBorderBounceHeal(c, rState)) {
            executeOpportunityFire(c, moveGoal, rState, { primaryTarget: best, breachTarget });
            if (c.fatigue === 0) moveToRoomViaExit(c, safeRoom, roomCenterPos(safeRoom), 2);
            continue;
        }
        executeOpportunityFire(c, moveGoal, rState, { primaryTarget: best, breachTarget });
        if (c.fatigue > 0) continue;
        if (moveGoal && calcDistance(c.pos, moveGoal.pos) > 1) {
            const pMat = getCombatAvoidanceMatrix(targetRoom, 20);
            moveCreep(c, moveGoal.pos, 1, { costMatrix: pMat });
        }
    }
}

// 4. NECROSIS SWARM: Floods unboosted Assassins into the cracked target room to suppress Spawns
function runNecrosisSwarm(colonyName) {
    const h = ensureOffenseBuffers();
    const col = h.colonies ? h.colonies[colonyName] : null;
    const necrosis = evaluateNecrosis();
    const fobTarget = (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[colonyName]) ? Memory.rooms[colonyName].fobTarget : null;
    const attackRoom = (necrosis && necrosis.active) ? necrosis.targetRoom : fobTarget;
    if (!attackRoom || getRivalSafeModeRemaining(attackRoom) > 0) return;

    const assassins = (col && col.creepsByRole && col.creepsByRole.assassin) || [];
    const inTargetByRoom = {};
    for (let i = 0; i < assassins.length; i++) {
        const c = assassins[i];
        if (!c || c.spawning) continue;
        if (c.heap && c.heap._strikeHandledTick === Game.time) continue;
        // Let home defenders stay inside homeland if room has active armed hostiles
        const homeState = h.rooms ? h.rooms[colonyName] : null;
        if (homeState && homeState.armedHostiles && homeState.armedHostiles.length > 0 && c.room.name === colonyName) continue;
        if (!c.heap) c.heap = {};

        const targetRoom = c.memory.targetRoom || attackRoom;
        if (c.room.name !== targetRoom) {
            executeDriveByCombat(c);
            if (c.fatigue === 0) moveToRoomViaExit(c, targetRoom, roomCenterPos(targetRoom), 3);
            continue;
        }

        // Push even fatigued creeps so executeCombatUnitDoctrine still executes weapons & heals
        c.heap.sleepUntil = 0;
        if (!inTargetByRoom[targetRoom]) inTargetByRoom[targetRoom] = [];
        inTargetByRoom[targetRoom].push(c);
    }

    for (const tRoom in inTargetByRoom) {
        const rState = h.rooms ? h.rooms[tRoom] : null;
        executeCombatUnitDoctrine(inTargetByRoom[tRoom], tRoom, colonyName, rState);
    }
}

function recallOffensiveCreeps(colonyName, roles) {
    if (typeof Game === 'undefined' || !Game.creeps) return;
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (!c || c.spawning) continue;
        const role = (c.memory && c.memory.role) || (c.heap && c.heap.role);
        if (!role || roles.indexOf(role) === -1) continue;
        const home = (c.memory && (c.memory.homeRoom || c.memory.colony)) || colonyName;
        if (colonyName && home && home !== colonyName) continue;
        if (c.heap) {
            c.heap.state = 'idle';
            c.heap.targetId = null;
        }
        if (home && c.room && c.room.name !== home) {
            moveToRoomViaExit(c, home, roomCenterPos(home), 4);
        }
    }
}

function runOffense(colonyName) {
    const cfg = getConfig();
    evaluateNecrosis();
    runStrikeGroups();
    if (isOffenseAllowed('hunter', cfg)) runHunters(colonyName);
    else recallOffensiveCreeps(colonyName, ['hunter']);

    if (isOffenseAllowed('pest', cfg)) runPests(colonyName);
    else recallOffensiveCreeps(colonyName, ['pest']);

    if (isOffenseAllowed('assassin', cfg)) runNecrosisSwarm(colonyName);
    else recallOffensiveCreeps(colonyName, ['assassin']);

    const combatOps = { computeRoomTargetDoctrine, solveBreachTarget, executeOpportunityFire, executeCombatUnitDoctrine };
    if (isOffenseAllowed('raider', cfg)) runRaiders(colonyName, combatOps);
    else recallOffensiveCreeps(colonyName, ['raider']);

    if (isOffenseAllowed('drainer', cfg)) runDrainers(colonyName);
    else recallOffensiveCreeps(colonyName, ['drainer']);

    if (isOffenseAllowed('wrecker', cfg)) runSiegeWreckers(colonyName, combatOps);
    else recallOffensiveCreeps(colonyName, ['teamWrecker', 'teamHealer']);
}

module.exports = {
    calcUnitPower,
    calculateKillScore,
    canWinFightFast,
    collectRoomHostileStructures,
    computeRoomTargetDoctrine,
    computeStagingRallyPos,
    ensureOffenseBuffers,
    evaluateKiteTile,
    evaluateNecrosis,
    executeCombatUnitDoctrine,
    executeOpportunityFire,
    executePackCrossHeal,
    executeStrikeGroup,
    getNearbyRivalRemote,
    getNearestRivalCitadel,
    getRivalSafeModeRemaining,
    getRoomThreatPower,
    isBroken,
    isDestructibleHostileStruct,
    isFobColony,
    isGuardedByUnwinnable,
    isRmaCountableStruct,
    isTargetRoiNegative,
    moveWithCombatPathCache,
    pickPackVectorTile,
    populateThreatField,
    recordRivalRemoteIntel,
    recordRivalStorageProfile,
    recordRoomCombatRoi,
    resolveStagingRoom,
    runHunters,
    runNecrosisSwarm,
    runOffense,
    runPests,
    runStrikeGroups,
    selectHostileTarget,
    selectSofterRivalTarget,
    selectStrikeGroupTarget,
    shouldBorderBounceHeal,
    solveBreachTarget,
    syncStrikeGroups,
    updateStrikeGroupState
};
