// src/spawning.js
// Top-Down Census Calculation, RCL 1 Sprint, Priority Spawn Queue, Dedicated Source Locking & Remote Spawning
const { BODY_COSTS, calcDistance } = require('./constants');
const { ROLE_ID, calcBodyPower, calcUnitPower, createCreepHeap, getRoomThreatPower, markMemoryDirty, recordSpawnEnergyDeduction, syncEmpireMissions } = require('./state');
const { computeMinCut } = require('./mincut');
const { getRoomBlueprint } = require('./bunker');
const { evaluateNecrosis, getNearbyRivalRemote, getNearestRivalCitadel, isFobColony, selectHostileTarget, selectStrikeGroupTarget } = require('./offense');
const { findBestExpansionTarget, getNextScoutTarget, getRemoteOutpostCap } = require('./remotes');
const { getConfig, getSiegeTier, isOffenseAllowed } = require('./config');

function calculateBodyCost(body) {
    return body.reduce((acc, part) => acc + (BODY_COSTS[part] || 0), 0);
}

function rep(part, n) {
    const count = Math.max(0, Math.floor(n) || 0);
    return new Array(count).fill(part);
}

// Finds the incomplete quad squad for this colony (or starts a new one) and its first empty slot
function pickQuadSlot(roomName) {
    const squads = {};
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        const m = c && c.memory;
        if (!m || m.role !== 'quad' || m.colony !== roomName || !m.squadId) continue;

        // Pre-Spawn Pipeline: If this quad member is expiring soon on foreign soil, don't count its slot as occupied!
        let expiringSoon = false;
        if (m.targetRoom && c.room && c.room.name !== roomName && c.ticksToLive !== undefined) {
            const dist = (Game.map && Game.map.getRoomLinearDistance(roomName, m.targetRoom)) || 1;
            const travelTicks = dist * 50;
            const spawnLead = travelTicks + 50 + ((c.body ? c.body.length : 20) * 3);
            if (c.ticksToLive <= spawnLead) {
                expiringSoon = true;
            }
        }

        if (!expiringSoon) {
            if (!squads[m.squadId]) squads[m.squadId] = 0;
            squads[m.squadId] |= (1 << (m.quadSlot || 0));
        }
    }
    for (const sid in squads) {
        const mask = squads[sid];
        if (mask === 15) continue;
        for (let s = 0; s < 4; s++) {
            if (!(mask & (1 << s))) return { squadId: sid, slot: s };
        }
    }
    return { squadId: roomName + '_' + Game.time, slot: 0 };
}

function hasXgho2Available(state) {
    if (!state) return false;
    const minAmount = 180; // 6 TOUGH * 30 compound units
    if (state.terminal && state.terminal.store && (state.terminal.store.XGHO2 || 0) >= minAmount) return true;
    if (state.storage && state.storage.store && (state.storage.store.XGHO2 || 0) >= minAmount) return true;
    if (Array.isArray(state.labs)) {
        for (let i = 0; i < state.labs.length; i++) {
            const lb = state.labs[i];
            if (lb && lb.store && (lb.store.XGHO2 || 0) >= minAmount) return true;
        }
    }
    return false;
}

// Paladin RCL 1-8 Strike Bodies: 1:1 MOVE ratio, ablative TOUGH at front, HEAL at tail
function getPaladinStrikeBody(rawEnergy, rcl, hasXgho2) {
    const energy = rawEnergy || 0;
    const lvl = rcl || 3;
    if (lvl >= 7) {
        if (hasXgho2 && energy >= 3340) {
            // Boosted (XGHO2 available, 50-part cap): 6T, 16A, 25M, 3H
            return [].concat(rep(TOUGH, 6), rep(ATTACK, 16), rep(MOVE, 25), rep(HEAL, 3));
        }
        if (energy >= 3930) {
            // Unboosted (50-part cap): 0T, 21A, 25M, 4H
            return [].concat(rep(ATTACK, 21), rep(MOVE, 25), rep(HEAL, 4));
        }
    }
    if (lvl >= 6 && energy >= 2080) {
        return [].concat(rep(TOUGH, 3), rep(ATTACK, 10), rep(MOVE, 15), rep(HEAL, 2)); // RCL 6: 3T, 10A, 15M, 2H (2080e)
    }
    if (lvl >= 5 && energy >= 1760) {
        return [].concat(rep(TOUGH, 2), rep(ATTACK, 8), rep(MOVE, 12), rep(HEAL, 2)); // RCL 5: 2T, 8A, 12M, 2H (1760e)
    }
    if (lvl >= 4 && energy >= 1200) {
        return [].concat(rep(TOUGH, 2), rep(ATTACK, 6), rep(MOVE, 9), rep(HEAL, 1)); // RCL 4: 2T, 6A, 9M, 1H (1200e)
    }
    if (energy >= 750) {
        return [].concat(rep(TOUGH, 1), rep(ATTACK, 3), rep(MOVE, 5), rep(HEAL, 1)); // RCL 3: 1T, 3A, 5M, 1H (750e)
    }
    if (energy >= 430) return [ATTACK, MOVE, MOVE, HEAL];
    if (energy >= 260) return [ATTACK, ATTACK, MOVE, MOVE];
    return [ATTACK, MOVE];
}

function getBodyDefinition(role, rawEnergy, opts) {
    const energy = Math.max(0, Number(rawEnergy) || 0);
    const o = opts || {};
    switch (role) {
        case 'harvester': {
            if (o.bootstrapMode === 1 || o.rcl === 1) return [WORK, WORK, MOVE]; // 250e sprint leaves 50e in spawn for +1 e/t regen
            if (energy >= 1350) return [].concat(rep(WORK, 10), rep(CARRY, 2), rep(MOVE, 5)); // 1350e 10W (depletes in 150t, sleeps 150t)
            if (energy >= 1050) return [].concat(rep(WORK, 8), [CARRY], rep(MOVE, 4)); // 1050e 8W (depletes in 188t, sleeps 112t)
            if (energy >= 700) return [].concat(rep(WORK, 5), [CARRY], rep(MOVE, 3));
            if (energy >= 550) return [].concat(rep(WORK, 5), [MOVE]); // 550e 5-WORK stationary miner (10 e/t saturation)
            if (energy >= 300) return [WORK, WORK, CARRY, MOVE]; // 300e has CARRY for container maintenance
            return [WORK, WORK, MOVE]; // 250e cold start
        }
        case 'hauler': {
            if (o.bootstrapMode === 2) {
                if (energy >= 300) return [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE]; // 300e recovery
                return [CARRY, CARRY, MOVE]; // 150e instant recovery
            }
            if ((o.bootstrapMode === 1 || o.rcl === 1) && energy < 200) {
                return [CARRY, CARRY, MOVE]; // 150e Paired Drop-Sprint hauler
            }
            if (energy >= 450 && (o.rcl >= 3 || o.hasRoads)) {
                const maxSets = Math.max(2, Math.min(8, Math.floor(energy / 150)));
                return [].concat(rep(CARRY, maxSets * 2), rep(MOVE, maxSets));
            }
            const maxPairs = Math.max(2, Math.ceil(0.4 * (o.pathDist || 10)));
            const pairs = Math.max(1, Math.min(maxPairs, Math.floor(energy / 100), 10));
            return [].concat(rep(CARRY, pairs), rep(MOVE, pairs));
        }
        case 'upgrader': {
            if (o.rcl === 8) {
                return [WORK, WORK, CARRY, MOVE]; // 300e RCL 8 maintenance upgrader (15 e/t cap)
            }
            if (o.hasStorage && o.storageEnergy !== undefined) {
                if (o.storageEnergy < 15000) return [].concat(rep(WORK, 2), rep(CARRY, 2), rep(MOVE, 2));
                if (o.storageEnergy >= 100000 && energy >= 1850) return [].concat(rep(WORK, 15), rep(CARRY, 3), rep(MOVE, 4));
                if (o.storageEnergy >= 75000 && energy >= 2100) return [].concat(rep(WORK, 15), rep(CARRY, 4), rep(MOVE, 8));
                if (o.storageEnergy >= 50000 && energy >= 1650) return [].concat(rep(WORK, 12), rep(CARRY, 3), rep(MOVE, 6));
                if (o.storageEnergy >= 30000 && energy >= 1200) return [].concat(rep(WORK, 8), rep(CARRY, 4), rep(MOVE, 4));
                if (energy >= 900) return [].concat(rep(WORK, 6), rep(CARRY, 3), rep(MOVE, 3));
                return [].concat(rep(WORK, 4), rep(CARRY, 3), rep(MOVE, 2));
            }
            if (energy >= 550) return [].concat(rep(WORK, 4), [CARRY], rep(MOVE, 2));
            if (energy >= 350) return [WORK, WORK, CARRY, MOVE, MOVE];
            return [WORK, CARRY, MOVE];
        }
        case 'builder': {
            if (o.isPhoenix && energy >= 1050) {
                return [].concat(rep(WORK, 6), rep(CARRY, 4), rep(MOVE, 5)); // 1050e Phoenix Swarm Builder
            }
            const n = Math.max(1, Math.min(4, Math.floor(energy / 200)));
            return [].concat(rep(WORK, n), rep(CARRY, n), rep(MOVE, n));
        }
        case 'remoteHauler': {
            if (energy >= 450 && (o.rcl >= 3 || o.hasRoads)) {
                // Include 1x WORK part for 0-delay on-the-move road repair
                const sets = Math.max(2, Math.min(8, Math.floor((energy - 100) / 150)));
                return [WORK].concat(rep(CARRY, sets * 2), rep(MOVE, sets + 1));
            }
            const pairs = Math.max(2, Math.min(8, Math.floor(energy / 100)));
            return [].concat(rep(CARRY, pairs), rep(MOVE, pairs));
        }
        case 'remoteMiner': {
            if (energy >= 750) return [].concat(rep(WORK, 6), rep(MOVE, 3));
            if (energy >= 650) return [].concat(rep(WORK, 5), rep(MOVE, 3));
            if (energy >= 500) return [].concat(rep(WORK, 4), rep(MOVE, 2));
            return [WORK, WORK, MOVE];
        }
        case 'reserver': {
            if (energy >= 1300) return [CLAIM, CLAIM, MOVE, MOVE];
            return [CLAIM, MOVE]; // 650e strictly CLAIM+MOVE (never WORK/CARRY!)
        }
        case 'filler': {
            if (energy >= 600) return [].concat(rep(CARRY, 8), rep(MOVE, 4));
            if (energy >= 450) return [].concat(rep(CARRY, 6), rep(MOVE, 3));
            return [].concat(rep(CARRY, 4), rep(MOVE, 2)); // 300e
        }
        case 'fastFiller': {
            if (energy >= 450) return [].concat(rep(CARRY, 8), [MOVE]); // 450e (400 capacity, fills an RCL 8 extension per action)
            if (energy >= 250) return [CARRY, CARRY, CARRY, CARRY, MOVE]; // 250e (4 CARRY, 1 MOVE)
            return [CARRY, CARRY, MOVE]; // 150e (2 CARRY, 1 MOVE)
        }
        case 'distributor': {
            const pairs = Math.max(2, Math.min(8, Math.floor(energy / 150)));
            return [].concat(rep(CARRY, pairs * 2), rep(MOVE, pairs));
        }
        case 'mineralMiner': {
            if (energy >= 800) return [].concat(rep(WORK, 6), [CARRY], rep(MOVE, 3));
            if (energy >= 650) return [].concat(rep(WORK, 5), [CARRY], rep(MOVE, 2));
            return [WORK, WORK, CARRY, MOVE];
        }
        case 'assassin': {
            if (o && o.isFob && energy >= 1300) return [].concat(rep(ATTACK, 10), rep(MOVE, 10)); // 1300e FOB wave assassin
            return [ATTACK, MOVE]; // 130e rampart/swarm assassin
        }
        case 'pest': {
            return [ATTACK, MOVE]; // 130e border-dancing / Safe Mode baiter
        }
        case 'hunter': {
            if (o && o.strikeMode) {
                return getPaladinStrikeBody(energy, o.rcl || 3, !!o.hasXgho2);
            }
            const rivalThreat = (o && o.rivalThreat) || 0;
            if (rivalThreat > 0) {
                if (energy >= 1200) return [].concat(rep(RANGED_ATTACK, 3), rep(HEAL, 2), rep(MOVE, 5));
                if (energy >= 500) return [RANGED_ATTACK, HEAL, MOVE, MOVE];
            }
            if (energy >= 520) return [].concat(rep(ATTACK, 4), rep(MOVE, 4));
            return [ATTACK, ATTACK, MOVE, MOVE]; // 260e worker hunter
        }
        case 'scavenger': {
            if (o && o.isRemoteLoot && energy >= 400) return [].concat(rep(CARRY, 4), rep(MOVE, 4));
            return [CARRY, MOVE]; // 100e emergency/scavenger
        }
        case 'outpostDefender': {
            if (o && o.outpostThreatKind === 'invaderCore') {
                if (energy >= 520) return [].concat(rep(ATTACK, 4), rep(MOVE, 4));
                return [ATTACK, ATTACK, MOVE, MOVE];
            }
            if (o && o.outpostThreatKind === 'rivalScout') {
                return energy >= 500 ? [RANGED_ATTACK, HEAL, MOVE, MOVE] : [RANGED_ATTACK, MOVE];
            }
            if (energy >= 1260) return [TOUGH].concat(rep(MOVE, 6), rep(RANGED_ATTACK, 3), rep(HEAL, 2));
            return [TOUGH, MOVE, MOVE, MOVE, RANGED_ATTACK, HEAL];
        }
        case 'defender': {
            if (energy >= 2300) return [].concat(rep(TOUGH, 3), rep(MOVE, 12), rep(ATTACK, 4), rep(RANGED_ATTACK, 5), rep(HEAL, 2)); // 2300e heavy fortress defender
            if (energy >= 1710) return [].concat(rep(TOUGH, 2), rep(MOVE, 10), rep(ATTACK, 3), rep(RANGED_ATTACK, 3), rep(HEAL, 2));
            if (energy >= 1260) return [].concat(rep(TOUGH, 2), rep(MOVE, 7), rep(ATTACK, 2), rep(RANGED_ATTACK, 3), [HEAL]); // 1260e RCL 4 siege brawler
            if (energy >= 1020) return [TOUGH].concat(rep(MOVE, 6), rep(ATTACK, 2), rep(RANGED_ATTACK, 2), [HEAL]);
            if (energy >= 690) return [TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK, RANGED_ATTACK, HEAL];
            if (energy >= 470) return [TOUGH, MOVE, MOVE, MOVE, ATTACK, ATTACK, RANGED_ATTACK];
            return [MOVE, MOVE, ATTACK, ATTACK]; // 260e emergency melee defender
        }
        case 'raider': {
            if (o && o.strikeMode) {
                return getPaladinStrikeBody(energy, o.rcl || 4, !!o.hasXgho2);
            }
            if (o && o.isFob && energy >= 1220) return [TOUGH, TOUGH].concat(rep(RANGED_ATTACK, 4), [HEAL], rep(MOVE, 7)); // 1220e FOB kiter
            if (energy >= 1260) return [TOUGH].concat(rep(MOVE, 6), rep(RANGED_ATTACK, 3), rep(HEAL, 2));
            if (energy >= 760) return [TOUGH, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, HEAL];
            if (energy >= 550) return [MOVE, MOVE, MOVE, RANGED_ATTACK, HEAL];
            return [MOVE, MOVE, ATTACK, ATTACK];
        }
        case 'claimer': {
            if (o.attackReservation && energy >= 1300) return [CLAIM, CLAIM, MOVE, MOVE];
            if (energy >= 750) return [CLAIM, MOVE, MOVE, MOVE];
            return [CLAIM, MOVE]; // 650e
        }
        case 'pioneer': {
            if (o.isColonizerHauler) {
                const sets = Math.max(2, Math.min(8, Math.floor(energy / 150)));
                return [].concat(rep(CARRY, sets * 2), rep(MOVE, sets));
            }
            // Vanguard Pioneer: Scale up to 8-WORK parts for 150-tick rapid Spawn construction
            if (energy >= 1400) {
                return [].concat(rep(WORK, 8), rep(CARRY, 4), rep(MOVE, 8)); // 1400e 8W Vanguard
            }
            if (energy >= 1000) {
                return [].concat(rep(WORK, 5), rep(CARRY, 4), rep(MOVE, 6)); // 1000e 5W Vanguard
            }
            const units = Math.max(1, Math.min(6, Math.floor(energy / 250)));
            return [].concat(rep(WORK, units), rep(CARRY, units), rep(MOVE, units * 2));
        }
        case 'janitor': {
            if (energy >= 800) return [].concat(rep(WORK, 2), rep(CARRY, 4), rep(MOVE, 6));
            if (energy >= 450) return [].concat(rep(WORK, 1), rep(CARRY, 3), rep(MOVE, 4));
            return [WORK, CARRY, CARRY, MOVE, MOVE]; // 300e
        }
        case 'outpostDefender': {
            if (energy >= 1400) return [].concat(rep(TOUGH, 2), rep(MOVE, 8), rep(RANGED_ATTACK, 4), [HEAL]);
            if (energy >= 760) return [TOUGH, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, HEAL];
            return [MOVE, MOVE, MOVE, RANGED_ATTACK, HEAL];
        }
        case 'skGuard': {
            if (energy >= 2300) return [].concat(rep(TOUGH, 4), rep(ATTACK, 16), rep(RANGED_ATTACK, 2), rep(MOVE, 11));
            return [].concat(rep(ATTACK, 5), rep(MOVE, 5));
        }
        case 'skHealer': {
            if (energy >= 1500) return [].concat(rep(MOVE, 5), rep(HEAL, 5));
            return [MOVE, HEAL];
        }
        case 'drainer': {
            if (energy >= 2300) return [].concat(rep(TOUGH, 4), rep(MOVE, 16), rep(HEAL, 10));
            if (energy >= 1260) return [].concat(rep(TOUGH, 2), rep(MOVE, 8), rep(HEAL, 4));
            return [MOVE, MOVE, HEAL];
        }
        case 'teamWrecker': {
            if (energy >= 2500) return [].concat(rep(TOUGH, 4), rep(WORK, 16), rep(MOVE, 10));
            if (energy >= 1300) return [].concat(rep(WORK, 8), rep(MOVE, 8));
            return [WORK, WORK, MOVE, MOVE];
        }
        case 'teamHealer': {
            if (energy >= 2400) return [].concat(rep(TOUGH, 4), rep(HEAL, 12), rep(MOVE, 8));
            if (energy >= 1200) return [].concat(rep(HEAL, 4), rep(MOVE, 4));
            return [MOVE, HEAL];
        }
        case 'bankAttacker': {
            if (energy >= 2600) return [].concat(rep(ATTACK, 20), rep(MOVE, 20));
            if (energy >= 1300) return [].concat(rep(ATTACK, 10), rep(MOVE, 10));
            return [].concat(rep(ATTACK, 5), rep(MOVE, 5));
        }
        case 'bankHealer': {
            if (energy >= 3000) return [].concat(rep(HEAL, 10), rep(MOVE, 10));
            if (energy >= 1500) return [].concat(rep(HEAL, 5), rep(MOVE, 5));
            return [MOVE, HEAL];
        }
        case 'bankHauler': {
            const pairs = Math.max(2, Math.min(16, Math.floor(energy / 100)));
            return [].concat(rep(CARRY, pairs), rep(MOVE, pairs));
        }
        case 'praiser': {
            if (energy >= 2050) return [].concat(rep(WORK, 15), rep(CARRY, 3), rep(MOVE, 8));
            if (energy >= 1100) return [].concat(rep(WORK, 8), rep(CARRY, 2), rep(MOVE, 4));
            return [WORK, WORK, CARRY, MOVE];
        }
        case 'quad': {
            // Slot roles: 0 = dismantler, 1-2 = ranged DPS, 3 = healer. -1 = legacy mixed body.
            const slot = opts && opts.quadSlot !== undefined ? opts.quadSlot : -1;
            if (slot === 0) {
                if (energy >= 3000) return [].concat(rep(TOUGH, 4), rep(WORK, 20), rep(MOVE, 24));
                if (energy >= 1700) return [].concat(rep(WORK, 12), rep(MOVE, 12));
                return [].concat(rep(WORK, 4), rep(MOVE, 4));
            }
            if (slot === 1 || slot === 2) {
                if (energy >= 3500) return [].concat(rep(TOUGH, 4), rep(RANGED_ATTACK, 20), rep(MOVE, 24));
                if (energy >= 2000) return [].concat(rep(TOUGH, 2), rep(RANGED_ATTACK, 12), rep(MOVE, 14));
                return [].concat(rep(RANGED_ATTACK, 4), rep(MOVE, 4));
            }
            if (slot === 3) {
                if (energy >= 3500) return [].concat(rep(TOUGH, 4), rep(HEAL, 20), rep(MOVE, 24));
                if (energy >= 2000) return [].concat(rep(TOUGH, 2), rep(HEAL, 12), rep(MOVE, 14));
                return [].concat(rep(HEAL, 4), rep(MOVE, 4));
            }
            if (energy >= 3500) return [].concat(rep(TOUGH, 5), rep(RANGED_ATTACK, 15), rep(HEAL, 5), rep(MOVE, 25));
            if (energy >= 2300) return [].concat(rep(TOUGH, 3), rep(RANGED_ATTACK, 10), rep(HEAL, 3), rep(MOVE, 16));
            if (energy >= 1500) return [].concat(rep(TOUGH, 2), rep(RANGED_ATTACK, 6), rep(HEAL, 2), rep(MOVE, 10));
            return [TOUGH, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, HEAL];
        }
        case 'depositHarvester': {
            if (energy >= 2500) return [].concat(rep(WORK, 15), rep(CARRY, 5), rep(MOVE, 10));
            if (energy >= 1400) return [].concat(rep(WORK, 8), rep(CARRY, 4), rep(MOVE, 6));
            return [WORK, WORK, CARRY, MOVE, MOVE];
        }
        case 'scout': {
            return [MOVE]; // 50e pure scout
        }
        default: return [WORK, CARRY, MOVE];
    }
}

function needsReplacement(creep) {
    if (!creep || creep.spawning || !creep.ticksToLive) return false;
    const bodyLen = creep.body ? creep.body.length : 5;
    const role = creep.memory ? creep.memory.role : null;
    const leadTicks = (creep.heap && creep.heap.spawnLeadTicks) || 10;
    const upgradeSmallHarvester = (role === 'harvester' && bodyLen <= 9 && creep.room && creep.room.energyCapacityAvailable >= 1350 && creep.room.energyAvailable >= 1350);
    const preSpawn = upgradeSmallHarvester
        ? 450
        : ((role === 'harvester' || role === 'remoteMiner')
            ? Math.min(90, bodyLen * 3 + leadTicks + 15)
            : (role === 'fastFiller' || role === 'distributor')
                ? Math.min(50, bodyLen * 3 + leadTicks + 5)
                : Math.min(60, bodyLen * 3 + leadTicks));
    return creep.ticksToLive <= preSpawn;
}

function getDiscoveredRemoteSources(homeRoomName) {
    const remoteRooms = (global.heap && global.heap.remoteRooms) || {};
    const colony = global.heap && global.heap.colonies ? global.heap.colonies[homeRoomName] : null;
    const candidates = (colony && Array.isArray(colony.outposts) && colony.outposts.length > 0)
        ? colony.outposts
        : ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[homeRoomName] && Memory.rooms[homeRoomName].outposts)
            ? Memory.rooms[homeRoomName].outposts
            : []);

    const list = [];
    for (let i = 0; i < candidates.length; i++) {
        const rName = candidates[i];
        if (homeRoomName && rName === homeRoomName) continue;
        // Strictly verify this outpost is assigned exclusively to this colony
        if (global.heap && global.heap.outpostOwners && global.heap.outpostOwners[rName] && global.heap.outpostOwners[rName] !== homeRoomName) {
            continue;
        }
        const info = remoteRooms[rName] || ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[rName]) ? Memory.rooms[rName].scoutData : null);
        if (info && info.safe !== false && Array.isArray(info.sources)) {
            for (let s = 0; s < info.sources.length; s++) {
                list.push(info.sources[s]);
            }
        }
    }
    return list;
}

function isSKOrCenterRoom(roomName) {
    if (!roomName) return false;
    const match = roomName.match(/^[WE](\d+)[NS](\d+)$/);
    if (!match) return false;
    const modX = parseInt(match[1], 10) % 10;
    const modY = parseInt(match[2], 10) % 10;
    return modX >= 4 && modX <= 6 && modY >= 4 && modY <= 6;
}

function getUnscoutedOutposts(homeRoomName) {
    const target = getNextScoutTarget(homeRoomName);
    return target ? [target] : [];
}

function getActiveExpansionTarget(homeRoomName) {
    if (typeof Memory === 'undefined' || !Memory.empire) return null;
    const cfg = getConfig();
    const minColonyDist = cfg.minColonyDistance !== undefined ? cfg.minColonyDistance : 4;
    const maxColonyDist = cfg.maxColonyDistance !== undefined ? cfg.maxColonyDistance : 7;
    const linearDist = (a, b) => (typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance) ? Game.map.getRoomLinearDistance(a, b) : 1;

    // Priority -1: Check Hive-Mind Bootstrap Missions first for any mission naming this colony an eligible sponsor
    const missions = global.heap && global.heap.state && global.heap.state.missions && global.heap.state.missions.bootstrap;
    if (missions) {
        let bestOwnedMission = null;
        let bestClaimMission = null;
        for (const tRoom in missions) {
            const m = missions[tRoom];
            if (!m || !Array.isArray(m.eligibleSponsors) || !m.eligibleSponsors.includes(homeRoomName)) continue;
            if (m.isOwned) {
                if (!bestOwnedMission) bestOwnedMission = m.targetRoom;
            } else if (!bestClaimMission) {
                bestClaimMission = m.targetRoom;
            }
        }
        if (bestOwnedMission) return bestOwnedMission;
        if (bestClaimMission) return bestClaimMission;
    }

    // Find all owned colonies
    const myColonies = [];
    for (const cName in Game.rooms) {
        const r = Game.rooms[cName];
        if (r && r.controller && r.controller.my) myColonies.push(cName);
    }

    // Identify all active remote outposts across all colonies
    const activeOutposts = new Set();
    if (Memory.empire && Memory.empire.outpostOwners) {
        for (const out in Memory.empire.outpostOwners) activeOutposts.add(out);
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

    // Priority 0: Never abandon an already-claimed, unbootstrapped colony (0 spawns)!
    let bestOwnedUnbootstrapped = null;
    let bestOwnedPioneers = Infinity;
    let bestOwnedDist = Infinity;
    for (let i = 0; i < myColonies.length; i++) {
        const cName = myColonies[i];
        if (cName === homeRoomName) continue;
        const cRoom = Game.rooms[cName];
        const cState = global.heap && global.heap.rooms ? global.heap.rooms[cName] : null;
        const spCount = (cState && cState.spawns) ? cState.spawns.length : (cRoom && cRoom.find ? cRoom.find(FIND_MY_SPAWNS).length : 0);
        if (spCount > 0) continue;
        const d = linearDist(homeRoomName, cName);
        if (d > maxColonyDist) continue;
        let pioCount = 0;
        if (typeof Game !== 'undefined' && Game.creeps) {
            for (const n in Game.creeps) {
                const cr = Game.creeps[n];
                if (cr && cr.memory && cr.memory.role === 'pioneer' && cr.memory.targetRoom === cName) pioCount++;
            }
        }
        if (pioCount < bestOwnedPioneers || (pioCount === bestOwnedPioneers && d < bestOwnedDist)) {
            bestOwnedPioneers = pioCount;
            bestOwnedDist = d;
            bestOwnedUnbootstrapped = cName;
        }
    }
    if (bestOwnedUnbootstrapped) return bestOwnedUnbootstrapped;

    const pinned = Memory.empire.expansionTarget;
    if (pinned && pinned !== homeRoomName) {
        // Territorial anti-tumor check: distance to all existing colonies must be >= minColonyDistance and <= maxColonyDistance
        const tooClose = myColonies.some(c => c !== pinned && linearDist(c, pinned) < minColonyDist);
        const tooFar = linearDist(homeRoomName, pinned) > maxColonyDist;
        const isOutpost = activeOutposts.has(pinned);
        const pinnedInfo = (global.heap && global.heap.remoteRooms && global.heap.remoteRooms[pinned]) ||
            (Memory.rooms && Memory.rooms[pinned] ? Memory.rooms[pinned].scoutData : null);
        const myUser = (Memory.empire && Memory.empire.myUsername) || null;
        const pinnedRes = pinnedInfo && ((pinnedInfo.controller && pinnedInfo.controller.reservation) || pinnedInfo.reservation);
        const isHostileOrCore = !!(pinnedInfo && (pinnedInfo.safe === false || pinnedInfo.invaderCoreLevel > 0 || pinnedInfo.threatLevel === 'invader_core' || pinnedInfo.threatLevel === 'hostile_active' ||
            (pinnedRes && (!myUser || pinnedRes !== myUser))));

        if (tooClose || tooFar || isOutpost || isHostileOrCore) {
            delete Memory.empire.expansionTarget;
            markMemoryDirty();
        } else {
            const pinnedRoom = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[pinned] : null;
            if (pinnedRoom && pinnedRoom.controller) {
                if (pinnedRoom.controller.owner && !pinnedRoom.controller.my) {
                    delete Memory.empire.expansionTarget;
                } else if (pinnedRoom.controller.my) {
                    const pinnedState = global.heap && global.heap.rooms ? global.heap.rooms[pinned] : null;
                    const spCount = pinnedState && pinnedState.spawns ? pinnedState.spawns.length : (pinnedRoom.find ? pinnedRoom.find(FIND_MY_SPAWNS).length : 0);
                    if (spCount > 0) {
                        delete Memory.empire.expansionTarget;
                    } else {
                        return pinned;
                    }
                } else {
                    return pinned;
                }
            } else {
                return pinned;
            }
        }
    }

    // Autonomous Imperial Expansion Selection: score all scouted candidate rooms
    const autoTarget = findBestExpansionTarget(homeRoomName);
    if (autoTarget) return autoTarget;

    const candidates = Memory.empire.expansionPoints;
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    for (let i = 0; i < candidates.length; i++) {
        const cand = candidates[i];
        const rName = typeof cand === 'string' ? cand : cand.roomName;
        if (!rName || rName === homeRoomName || isSKOrCenterRoom(rName)) continue;

        const distFromHome = linearDist(homeRoomName, rName);
        if (distFromHome < minColonyDist || distFromHome > maxColonyDist) continue;
        const tooCloseToOther = myColonies.some(c => c !== rName && linearDist(c, rName) < minColonyDist);
        if (tooCloseToOther || activeOutposts.has(rName)) continue;

        const scoutInfo = (global.heap && global.heap.remoteRooms && global.heap.remoteRooms[rName]) ||
            (Memory.rooms && Memory.rooms[rName] ? Memory.rooms[rName].scoutData : null);
        if (scoutInfo && scoutInfo.owner) continue;
        if (scoutInfo && scoutInfo.sourceCount !== undefined && scoutInfo.sourceCount < 2) continue; // Imperial Standard: 2 sources required!
        const myUserCand = (Memory.empire && Memory.empire.myUsername) || null;
        const candRes = scoutInfo && ((scoutInfo.controller && scoutInfo.controller.reservation) || scoutInfo.reservation);
        if (scoutInfo && (scoutInfo.safe === false || scoutInfo.invaderCoreLevel > 0 || scoutInfo.threatLevel === 'invader_core' || scoutInfo.threatLevel === 'hostile_active' ||
            (candRes && (!myUserCand || candRes !== myUserCand)))) {
            continue;
        }

        const visRoom = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[rName] : null;
        if (visRoom && visRoom.controller && visRoom.controller.owner) continue;

        // Min-Cut Rampart Gate: Reject rooms requiring > 28 rampart tiles to protect bunker + controller
        if (scoutInfo) {
            if (scoutInfo.minCutRampartCount !== undefined) {
                if (scoutInfo.minCutRampartCount > 28) continue;
            } else if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket >= 2000 && Game.map && Game.map.getRoomTerrain) {
                const terrain = Game.map.getRoomTerrain(rName);
                if (terrain) {
                    const cuts = computeMinCut(terrain);
                    scoutInfo.minCutRampartCount = cuts.length;
                    if (cuts.length > 28) continue;
                }
            }
        }

        Memory.empire.expansionTarget = rName;
        return rName;
    }
    return null;
}

function getBootstrapSpawnAssignment(roomName, cfg) {
    const empty = { targetRoom: null, claimer: 0, pioneer: 0, escort: 0 };
    if (!global.heap || !global.heap.state || !global.heap.state.missions || !global.heap.state.missions.bootstrap) {
        if (typeof Game !== 'undefined' && Game.rooms) syncEmpireMissions();
    }
    const missions = global.heap && global.heap.state && global.heap.state.missions && global.heap.state.missions.bootstrap;
    if (!missions) return empty;

    const candidates = [];
    for (const tRoom in missions) {
        const m = missions[tRoom];
        if (!m || !Array.isArray(m.eligibleSponsors) || !m.eligibleSponsors.includes(roomName)) continue;
        candidates.push(m);
    }
    if (candidates.length === 0) return empty;

    candidates.sort((a, b) => {
        const ownA = a.isOwned ? 1 : 0;
        const ownB = b.isOwned ? 1 : 0;
        if (ownB !== ownA) return ownB - ownA;
        return (b.wantPioneers - b.havePioneers) - (a.wantPioneers - a.havePioneers);
    });

    const minEnergy = (cfg && cfg.minSponsorEnergy !== undefined) ? cfg.minSponsorEnergy : 100000;
    const homeRoom = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[roomName] : null;
    const homeState = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    const storage = (homeState && homeState.storage) || (homeRoom && homeRoom.storage);
    if (storage && storage.store && (storage.store[RESOURCE_ENERGY] || 0) < minEnergy) return empty;

    for (let i = 0; i < candidates.length; i++) {
        const m = candidates[i];
        const bySp = (m.bySponsor && m.bySponsor[roomName]) ? m.bySponsor[roomName] : { spawningBootstrap: 0, livePioneers: 0, liveEscorts: 0 };
        if ((bySp.spawningBootstrap || 0) >= 1) return empty;

        const claimerNeed = (m.closestSponsor === roomName && (m.haveClaimer || 0) < (m.wantClaimer || 0)) ? 1 : 0;

        let sponsorIdx = m.eligibleSponsors.indexOf(roomName);
        if (sponsorIdx < 0) sponsorIdx = 0;

        const globalPioneerDeficit = Math.max(0, (m.wantPioneers || 0) - (m.havePioneers || 0));
        let pioneerNeed = 0;
        if (globalPioneerDeficit > 0 && (bySp.livePioneers || 0) < 2) {
            let slotsBefore = 0;
            for (let k = 0; k < sponsorIdx; k++) {
                const otherSp = m.eligibleSponsors[k];
                const otherBy = (m.bySponsor && m.bySponsor[otherSp]) ? m.bySponsor[otherSp] : { spawningBootstrap: 0, livePioneers: 0 };
                if ((otherBy.spawningBootstrap || 0) === 0 && (otherBy.livePioneers || 0) < 2) {
                    slotsBefore++;
                }
            }
            if (slotsBefore < globalPioneerDeficit) pioneerNeed = 1;
        }

        const globalEscortDeficit = Math.max(0, (m.wantEscorts || 0) - (m.haveEscorts || 0));
        const maxEscortPerSponsor = m.eligibleSponsors.length >= 2 ? 1 : 2;
        let escortNeed = 0;
        if (globalEscortDeficit > 0 && (bySp.liveEscorts || 0) < maxEscortPerSponsor) {
            let escortSlotsBefore = 0;
            for (let k = 0; k < sponsorIdx; k++) {
                const otherSp = m.eligibleSponsors[k];
                const otherBy = (m.bySponsor && m.bySponsor[otherSp]) ? m.bySponsor[otherSp] : { spawningBootstrap: 0, liveEscorts: 0 };
                if ((otherBy.spawningBootstrap || 0) === 0 && (otherBy.liveEscorts || 0) < maxEscortPerSponsor) {
                    escortSlotsBefore++;
                }
            }
            if (escortSlotsBefore < globalEscortDeficit) escortNeed = 1;
        }

        if (claimerNeed > 0 || pioneerNeed > 0 || escortNeed > 0) {
            return {
                targetRoom: m.targetRoom,
                claimer: claimerNeed,
                pioneer: pioneerNeed,
                escort: escortNeed
            };
        }
    }

    return empty;
}

// Exact Trip-Based Hauler Sizing: physics-mandated carry parts (round-trip * income / 50)
function calculateExactHaulerNeed(roomName, state, rcl, cap, hasStorage, hasRoads) {
    if (!state || !state.sources || state.sources.length === 0) return 1;

    const dropOff = state.storage || (state.spawns && state.spawns[0]);
    if (!dropOff) return 1;

    // Determine carry parts per hauler based on energy capacity and roads
    let carryPartsPerHauler = 2;
    if (rcl <= 2) {
        carryPartsPerHauler = 2; // 2 CARRY, 2 MOVE = 200e
    } else if (hasRoads && cap >= 450) {
        // 2:1 CARRY:MOVE ratio on paved network
        const sets = Math.max(2, Math.min(8, Math.floor(Math.min(cap, 900) / 150)));
        carryPartsPerHauler = sets * 2;
    } else {
        // 1:1 CARRY:MOVE ratio on unpaved terrain
        const pairs = Math.max(2, Math.min(6, Math.floor(Math.min(cap, 400) / 100)));
        carryPartsPerHauler = pairs;
    }

    let totalCarryPartsNeeded = 0;

    // 1. Unlinked Sources
    for (let i = 0; i < state.sources.length; i++) {
        const src = state.sources[i];
        let isLinked = false;
        if (rcl >= 5 && state.links && state.links.length >= 2) {
            isLinked = state.links.some(l => calcDistance(l.pos, src.pos) <= 2);
        }
        if (isLinked) continue;

        const dist = Math.max(4, calcDistance(dropOff.pos, src.pos));
        const roundTrip = dist * 2;
        const income = 10; // 10 energy/tick from saturated 5-WORK miner
        const carryNeeded = Math.ceil((roundTrip * income) / 50);
        totalCarryPartsNeeded += carryNeeded;
    }

    // 2. Controller hauling if controllerContainer exists and no controller link
    if (state.controller && state.controllerContainer && rcl < 7) {
        let isCtrlLinked = false;
        if (rcl >= 5 && state.links && state.links.length >= 2) {
            isCtrlLinked = state.links.some(l => calcDistance(l.pos, state.controller.pos) <= 3);
        }
        if (!isCtrlLinked) {
            const ctrlDist = Math.max(4, calcDistance(dropOff.pos, state.controller.pos));
            const storageEnergy = (hasStorage && state.storage.store) ? (state.storage.store[RESOURCE_ENERGY] || 0) : 0;
            const upgradeRate = (storageEnergy > 100000) ? 20 : (storageEnergy > 30000 ? 12 : 5);
            const ctrlCarryNeeded = Math.ceil((ctrlDist * 2 * upgradeRate) / 50);
            totalCarryPartsNeeded += Math.min(20, ctrlCarryNeeded);
        }
    }

    // Convert total carry parts needed into creep count
    let haulers = Math.ceil(totalCarryPartsNeeded / carryPartsPerHauler);

    // Dynamic ground energy buffer: if >2000 energy dropped on floor, provision an extra hauler
    const dropOnGround = (state.droppedEnergy ? state.droppedEnergy.reduce((a, d) => a + d.amount, 0) : 0);
    if (dropOnGround > 2000) {
        haulers += 1;
    }

    // If all sources are linked and controller is linked, hauler need is 0 (or 1 if storage is empty)
    if (totalCarryPartsNeeded === 0) {
        const storageEnergy = (hasStorage && state.storage.store) ? (state.storage.store[RESOURCE_ENERGY] || 0) : 0;
        return (hasStorage && storageEnergy < 1000) ? 1 : 0;
    }

    if (rcl >= 4 && hasStorage) return Math.max(1, Math.min(2, haulers));
    return Math.max(1, Math.min(5, haulers));
}

function getCensusRequirements(roomName) {
    const cfg = getConfig();
    const room = Game.rooms[roomName];
    const state = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    const have = {
        harvester: 0,
        hauler: 0,
        filler: 0,
        fastFiller: 0,
        distributor: 0,
        upgrader: 0,
        builder: 0,
        defender: 0,
        qrf: 0,
        escort: 0,
        raider: 0,
        claimer: 0,
        pioneer: 0,
        remoteMiner: 0,
        remoteHauler: 0,
        reserver: 0,
        scout: 0,
        mineralMiner: 0,
        janitor: 0,
        outpostDefender: 0,
        skGuard: 0,
        skHealer: 0,
        drainer: 0,
        teamWrecker: 0,
        teamHealer: 0,
        bankAttacker: 0,
        bankHealer: 0,
        bankHauler: 0,
        praiser: 0,
        quad: 0,
        depositHarvester: 0,
        assassin: 0,
        scavenger: 0,
        hunter: 0,
        pest: 0
    };

    const colRef = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
    const colonyCreeps = (colRef && colRef.creeps) ? colRef.creeps : Object.values(Game.creeps || {}).filter(c => c.memory && c.memory.colony === roomName);
    for (let i = 0; i < colonyCreeps.length; i++) {
        const c = colonyCreeps[i];
        if (needsReplacement(c)) continue;
        // Off-world QRF and Escort defenders never count against home citadel defender slots
        if (c.memory.role === 'defender' && (c.memory.subRole === 'QRF' || c.memory.subRole === 'ESCORT')) continue;
        if (have[c.memory.role] !== undefined) {
            have[c.memory.role]++;
        }
    }
    // Seamless Handoff: count active PIONEER_MINER creeps inside this room toward have.harvester
    if (state && state.creeps) {
        for (let i = 0; i < state.creeps.length; i++) {
            const c = state.creeps[i];
            if (c.memory && c.memory.role === 'pioneer' && c.heap && c.heap.subRole === 'PIONEER_MINER' && (c.ticksToLive || 0) >= 60) {
                have.harvester++;
            }
        }
    }

    const rcl = (room && room.controller && room.controller.level) || 1;
    const sources = (state && state.sources) || [];
    const totalSourceSpots = sources.reduce((acc, s) => acc + ((state && state.sourceSpots && state.sourceSpots[s.id] ? state.sourceSpots[s.id].length : 1) || 1), 0);
    const sourcesCount = sources.length > 0 ? Math.max(Math.min(2, totalSourceSpots), sources.length) : 2;
    const hasSites = (state && state.constructionSites && state.constructionSites.length > 0) || false;
    const colony = (global.heap && global.heap.colonies) ? global.heap.colonies[roomName] : null;
    const outpostList = (colony && colony.outposts) || (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) || [];
    let hasRemoteSites = false;
    for (let o = 0; o < outpostList.length; o++) {
        const oState = global.heap && global.heap.rooms ? global.heap.rooms[outpostList[o]] : null;
        if (oState && oState.constructionSites && oState.constructionSites.length > 0) {
            hasRemoteSites = true;
            break;
        }
    }

    const sourceEnergy = (state && state.containers ? state.containers.filter(cnt => !state.controller || calcDistance(cnt.pos, state.controller.pos) > 3).reduce((a, cnt) => a + (cnt.store ? cnt.store[RESOURCE_ENERGY] : 0), 0) : 0) +
        (state && state.droppedEnergy ? state.droppedEnergy.reduce((a, d) => a + d.amount, 0) : 0);
    const hasStorage = !!(state && state.storage);
    const storageEnergy = (hasStorage && state.storage.store) ? (state.storage.store[RESOURCE_ENERGY] || 0) : 0;
    const ctrlEnergy = (state && state.controllerContainer && state.controllerContainer.store ? (state.controllerContainer.store[RESOURCE_ENERGY] || 0) : 0) +
        (state && state.controller && state.droppedEnergy ? state.droppedEnergy.filter(d => calcDistance(d.pos, state.controller.pos) <= 4).reduce((a, d) => a + d.amount, 0) : 0);

    const want = {
        harvester: 0,
        hauler: 0,
        filler: 0,
        fastFiller: 0,
        distributor: 0,
        upgrader: 0,
        builder: 0,
        defender: 0,
        qrf: 0,
        escort: 0,
        raider: 0,
        claimer: 0,
        pioneer: 0,
        remoteMiner: 0,
        remoteHauler: 0,
        reserver: 0,
        scout: 0,
        mineralMiner: 0,
        janitor: 0,
        outpostDefender: 0,
        skGuard: 0,
        skHealer: 0,
        drainer: 0,
        teamWrecker: 0,
        teamHealer: 0,
        bankAttacker: 0,
        bankHealer: 0,
        bankHauler: 0,
        praiser: 0,
        quad: 0,
        depositHarvester: 0,
        assassin: 0,
        scavenger: 0,
        hunter: 0,
        pest: 0
    };

    // Dynamic Threat Assessment: Scale home siege defenders by attacker count vs outpost threats
    const threats = (colony && colony.threats) ? colony.threats : [];
    const homeArmed = (state && state.armedHostiles) ? state.armedHostiles.length : 0;
    let threatCount = threats.length;
    if (threatCount === 0 && typeof Memory !== 'undefined' && Memory.rooms) {
        for (let o = 0; o < outpostList.length; o++) {
            const r = outpostList[o];
            if (Memory.rooms[r] && Memory.rooms[r].threat && Memory.rooms[r].threat.expiresAt > Game.time) {
                threatCount++;
            }
        }
        if (Memory.rooms[roomName] && Memory.rooms[roomName].threat && Memory.rooms[roomName].threat.expiresAt > Game.time) {
            threatCount++;
        }
    }
    want.defender = (homeArmed > 0)
        ? Math.min(4, Math.max(2, homeArmed + 1))
        : (threatCount > 0 ? Math.min(2, Math.max(1, threatCount)) : 0);

    // Flag-gated Rampart Melee Assassins: cheap [ATTACK, MOVE] garrisoned inside perimeter ramparts
    if (homeArmed > 0 && state && state.ramparts && state.ramparts.length > 0 &&
        ((typeof global !== 'undefined' && global.ENABLE_ASSASSINS) || (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.enableAssassins))) {
        want.assassin = Math.min(2, homeArmed);
    }

    // Empire QRF Dispatch: top 2 closest safe mature sponsors rush QRF defenders to besieged footholds
    if (homeArmed === 0 && global.heap && global.heap.qrfTarget && Array.isArray(global.heap.qrfSponsors) &&
        global.heap.qrfSponsors.includes(roomName) && (!hasStorage || storageEnergy >= cfg.siegeTier3Energy)) {
        const qrfTarget = global.heap.qrfTarget;
        let haveGlobalQrf = 0;
        let myQrf = 0;
        const seenQrfNames = {};
        if (typeof Game !== 'undefined' && Game.creeps) {
            for (const cn in Game.creeps) {
                const c = Game.creeps[cn];
                if (!c || needsReplacement(c)) continue;
                const cm = c.memory || {};
                const ch = c.heap || {};
                if ((cm.role || ch.role) === 'defender' && (cm.subRole || ch.subRole) === 'QRF' && (cm.targetRoom || ch.targetRoom) === qrfTarget) {
                    seenQrfNames[c.name] = true;
                    haveGlobalQrf++;
                    if (cm.colony === roomName) myQrf++;
                }
            }
        }
        if (typeof Game !== 'undefined' && Game.spawns) {
            for (const sn in Game.spawns) {
                const sp = Game.spawns[sn];
                if (!sp || !sp.spawning || !sp.spawning.name || seenQrfNames[sp.spawning.name]) continue;
                const spm = (typeof Memory !== 'undefined' && Memory.creeps && Memory.creeps[sp.spawning.name]) ||
                    (global.heap.creeps && global.heap.creeps[sp.spawning.name]);
                if (spm && spm.role === 'defender' && spm.subRole === 'QRF' && spm.targetRoom === qrfTarget) {
                    haveGlobalQrf++;
                    if (spm.colony === roomName) myQrf++;
                }
            }
        }
        const totalQrfWant = Math.min(4, Math.max(2, global.heap.qrfThreatCount || 1));
        const perSponsorShare = Math.ceil(totalQrfWant / Math.max(1, global.heap.qrfSponsors.length));
        if (haveGlobalQrf < totalQrfWant && myQrf < perSponsorShare) {
            want.qrf = 1;
        }
    }

    const cap = (room && room.energyCapacityAvailable) || 300;
    const hasRoads = !!(state && state.roads && state.roads.length >= 20);
    const exactHaulers = calculateExactHaulerNeed(roomName, state, rcl, cap, hasStorage, hasRoads);

    if (rcl === 1) {
        want.harvester = Math.min(2, sourcesCount);
        want.hauler = 1;
        want.upgrader = 2;
        want.builder = 0;
    } else if (rcl === 2) {
        want.harvester = sourcesCount;
        want.hauler = exactHaulers;
        want.upgrader = 4;
        want.builder = (hasSites || hasRemoteSites) ? 1 : 0;

        if (have.harvester >= sourcesCount && have.hauler >= 1) {
            const unscouted = getUnscoutedOutposts(roomName);
            if (unscouted.length > 0) want.scout = 1;
            const remSources = getDiscoveredRemoteSources(roomName);
            const activeRemoteCount = (outpostList.length > 0) ? Math.min(3, remSources.length) : 0;
            want.remoteMiner = activeRemoteCount;
            want.remoteHauler = activeRemoteCount;
        }
    } else if (rcl === 3) {
        want.harvester = sourcesCount;
        want.hauler = exactHaulers;
        want.upgrader = cap >= 800 ? 1 : 2;
        const hasWeakRamparts = !!(state && state.ramparts && state.ramparts.some(r => r.hits < 15000));
        want.builder = (hasSites || hasRemoteSites || hasWeakRamparts) ? 1 : 0;

        if (have.harvester >= sourcesCount && have.hauler >= 1) {
            const bucket = (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket !== undefined) ? Game.cpu.bucket : 10000;
            const sUtil = (global.heap && global.heap.spawnUtil && global.heap.spawnUtil[roomName] !== undefined) ? global.heap.spawnUtil[roomName] : 0;
            const outpostCap = (global.heap && global.heap.remoteCaps && global.heap.remoteCaps[roomName] !== undefined) ? global.heap.remoteCaps[roomName] : getRemoteOutpostCap(rcl, storageEnergy, bucket, sUtil, cfg);
            const unscouted = getUnscoutedOutposts(roomName);
            if (unscouted.length > 0 && outpostCap > 0) want.scout = 1;
            const remSources = getDiscoveredRemoteSources(roomName);
            const activeRemoteCount = (outpostList.length > 0 && outpostCap > 0) ? Math.min(outpostCap * 2, remSources.length) : 0;
            want.remoteMiner = activeRemoteCount;
            want.remoteHauler = activeRemoteCount;

            if (cfg.posture === 'hostile' && homeArmed === 0) {
                const pestTarget = selectHostileTarget(roomName, 'pest', cfg);
                const hunterTarget = selectHostileTarget(roomName, 'hunter', cfg);
                if (pestTarget && isOffenseAllowed('pest', cfg)) want.pest = 1;
                if (hunterTarget && isOffenseAllowed('hunter', cfg)) want.hunter = 1;
            }
        }
    } else {
        // RCL 4+: Only spawn dedicated Filler ONCE Storage is actually built!
        want.harvester = sourcesCount;
        want.filler = hasStorage ? 1 : 0;
        want.hauler = exactHaulers;

        // Dynamic Upgraders: Prefer 1 heavy max-size upgrader over swarms of small creeps (cuts 0.2 CPU intent tax)
        if (!hasStorage) {
            want.upgrader = (cap >= 800 && ctrlEnergy <= 2000) ? 1 : 2;
        } else if (rcl === 8) {
            want.upgrader = ((state.controller && state.controller.ticksToDowngrade < 100000) || storageEnergy >= cfg.rcl8UpgradeSurplus) ? 1 : 0;
        } else if (storageEnergy > 250000) {
            want.upgrader = 2;
        } else {
            want.upgrader = 1;
        }

        // Emergency Scavengers ([CARRY, MOVE]) when sources are hostile-blocked or storage is empty with loot on the floor
        const dropPlusRuins = sourceEnergy +
            (state && state.tombstones ? state.tombstones.reduce((a, t) => a + (t.store ? (t.store[RESOURCE_ENERGY] || 0) : 0), 0) : 0) +
            (state && state.ruins ? state.ruins.reduce((a, r) => a + (r.store ? (r.store[RESOURCE_ENERGY] || 0) : 0), 0) : 0);
        if (have.hauler === 0 && storageEnergy < 500 && dropPlusRuins >= 50) {
            want.scavenger = 1;
        }

        // Downgrade Prevention Guarantee + Siege Lockdown + FOB RCL 4 Economy Lock + Necrosis Flood
        const downgradeNear = !!(state && state.controller && state.controller.ticksToDowngrade < 5000);
        const isFobLocked = isFobColony(roomName) && rcl >= 4 && (room.energyCapacityAvailable || 0) >= 1300;
        const necrosis = evaluateNecrosis();
        const isNecrosisActive = !!(necrosis && necrosis.active);
        const lockedDown = (global.heap && global.heap.lockdown && global.heap.lockdown[roomName] > Game.time) || isFobLocked || isNecrosisActive;
        if (downgradeNear) want.upgrader = Math.max(1, lockedDown ? 1 : want.upgrader);
        else if (lockedDown) want.upgrader = 0;

        // Rival Remote Denial (Hunter-Killers + Loot Scavengers within range 4)
        if (homeArmed === 0 && rcl >= 3) {
            const rivalIntel = getNearbyRivalRemote(roomName, 4);
            if (rivalIntel) {
                if (rivalIntel.roomName && isOffenseAllowed('hunter', cfg)) want.hunter = 1;
                if (rivalIntel.lootRoom && !want.scavenger) want.scavenger = 1;
            }
            if (cfg.posture === 'hostile') {
                if (!want.hunter && selectHostileTarget(roomName, 'hunter', cfg) && isOffenseAllowed('hunter', cfg)) {
                    want.hunter = 1;
                }
                if (selectHostileTarget(roomName, 'pest', cfg) && isOffenseAllowed('pest', cfg)) {
                    want.pest = 1;
                }
            } else {
                const gt = getNearestRivalCitadel(roomName, 4);
                if (gt && getRoomThreatPower(gt) === 0 && isOffenseAllowed('pest', cfg)) {
                    want.pest = 1;
                }
            }
        }

        // FOB Military Output Lock: pump 1300e waves of assassins & kiters toward fobTarget
        if (isFobLocked && homeArmed === 0) {
            if (isOffenseAllowed('assassin', cfg)) want.assassin = 4;
            if (isOffenseAllowed('raider', cfg)) want.raider = 2;
        }

        // Necrosis Flood: RCL 7+ deploys 2x Dismantle Quads (want.quad = 8); RCL 4-6 & FOBs flood [ATTACK, MOVE] assassins
        if (isNecrosisActive && homeArmed === 0 && rcl >= 4) {
            if (rcl >= 7) {
                if (isOffenseAllowed('quad', cfg)) want.quad = 8;
                if (isOffenseAllowed('assassin', cfg)) want.assassin = Math.max(want.assassin, 4);
            } else if (isOffenseAllowed('assassin', cfg)) {
                want.assassin = Math.max(want.assassin, 8);
            }
        }

        // Dynamic Builders: 1 max-size builder (2 only when >= 8 sites & healthy storage)
        const minRampartFloor = 15000;
        const hasWeakRamparts = !!(state && state.ramparts && state.ramparts.some(r => r.hits < minRampartFloor));
        const siteCount = (state && state.constructionSites) ? state.constructionSites.length : 0;
        if (!hasSites && !hasRemoteSites) {
            want.builder = (hasWeakRamparts && storageEnergy >= 10000) ? 1 : 0;
        } else if (siteCount >= 8 && storageEnergy >= 30000) {
            want.builder = 2;
        } else {
            want.builder = 1;
        }

        // Mineral Extraction at RCL >= 6
        if (rcl >= 6) {
            const hasExtractor = !!(state && state.extractor);
            if (hasExtractor && state.mineral && state.mineral.mineralAmount > 0 && storageEnergy >= 20000) {
                want.mineralMiner = 1;
            }
        }

        if (have.harvester >= sourcesCount && (have.hauler >= 1 || have.filler >= 1 || have.fastFiller >= 1 || have.distributor >= 1)) {
            want.scout = getNextScoutTarget(roomName) ? 1 : 0;
            const remSources = getDiscoveredRemoteSources(roomName);
            const bucket = (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket !== undefined) ? Game.cpu.bucket : 10000;
            const sUtil = (global.heap && global.heap.spawnUtil && global.heap.spawnUtil[roomName] !== undefined) ? global.heap.spawnUtil[roomName] : 0;
            const outpostCap = (global.heap && global.heap.remoteCaps && global.heap.remoteCaps[roomName] !== undefined) ? global.heap.remoteCaps[roomName] : getRemoteOutpostCap(rcl, storageEnergy, bucket, sUtil, cfg);
            const maxRemoteSources = outpostCap * 2;
            const activeRemoteCount = (outpostList.length > 0 && outpostCap > 0) ? Math.min(maxRemoteSources, remSources.length) : 0;
            want.remoteMiner = activeRemoteCount;

            // Calculate exact haulers needed from calculated outpost income & distance!
            let totalHaulersNeeded = 0;
            const econMap = (colony && colony.outpostEconomics) ||
                ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName]) ? Memory.rooms[roomName].outpostEconomics : null);
            if (econMap && activeRemoteCount > 0) {
                for (let o = 0; o < outpostList.length; o++) {
                    const outName = outpostList[o];
                    if (econMap[outName]) {
                        totalHaulersNeeded += (econMap[outName].haulersNeeded || 1);
                    }
                }
            } else {
                totalHaulersNeeded = activeRemoteCount;
            }
            want.remoteHauler = (activeRemoteCount > 0 ? Math.min(activeRemoteCount, Math.max(1, totalHaulersNeeded)) : 0);

            if (room && room.energyCapacityAvailable >= 650 && activeRemoteCount > 0) {
                want.reserver = Math.min(outpostList.length, activeRemoteCount > 0 ? outpostList.length : 0);
            }

            // Remote Maintenance Janitor: only when active remote construction sites exist
            if (hasRemoteSites && have.harvester >= sourcesCount && (have.hauler >= 2 || have.filler >= 1 || have.fastFiller >= 1)) {
                want.janitor = 1;
            }

            // Outpost Defender: Intercept invaders attacking remote outposts
            let remoteThreatCount = 0;
            const skOutposts = [];
            for (let o = 0; o < outpostList.length; o++) {
                const outName = outpostList[o];
                if (isSKOrCenterRoom(outName)) {
                    skOutposts.push(outName);
                } else if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[outName] && Memory.rooms[outName].threat && Memory.rooms[outName].threat.expiresAt > Game.time) {
                    remoteThreatCount++;
                }
            }
            if (remoteThreatCount > 0 && rcl >= 3 && isOffenseAllowed('outpostDefender', cfg)) {
                want.outpostDefender = Math.min(2, remoteThreatCount);
            }

            // Source Keeper Lair Farming: 1 Guard + 1 Healer pair per SK outpost at RCL 7+
            if (skOutposts.length > 0 && rcl >= 7 && storageEnergy >= 50000) {
                want.skGuard = Math.min(2, skOutposts.length);
                want.skHealer = Math.min(2, skOutposts.length);
            }

            // Highway Power Bank Strike Teams (KasamiBot Power Harvesting)
            if (rcl >= 7 && storageEnergy >= 50000 && typeof Memory !== 'undefined' && Memory.empire && Memory.empire.powerBanks) {
                const activeBank = Object.values(Memory.empire.powerBanks).find(b => b && b.decayAt > Game.time + 1500);
                if (activeBank) {
                    want.bankAttacker = 1;
                    want.bankHealer = 1;
                    want.bankHauler = Math.min(3, Math.ceil(activeBank.power / 1600));
                }
            }

            // Tower Draining Operations
            if (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.drainOperations && isOffenseAllowed('drainer', cfg)) {
                const drainOp = Object.keys(Memory.empire.drainOperations).length > 0;
                if (drainOp && rcl >= 6 && storageEnergy >= 30000) {
                    want.drainer = 1;
                }
            }

            // Siege Dismantling Operations
            if (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.siegeOperations && isOffenseAllowed('wrecker', cfg)) {
                const siegeOp = Object.keys(Memory.empire.siegeOperations).length > 0;
                if (siegeOp && rcl >= 6 && storageEnergy >= 40000) {
                    want.teamWrecker = 1;
                    want.teamHealer = 1;
                }
            }

            // Praiseroom GCL Boosting
            if (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.praiseRoom === roomName) {
                want.praiser = storageEnergy >= 30000 ? 3 : 1;
            }

            // Highway Deposits Harvesting (silicon, metal, biomass, mist)
            if (rcl >= 7 && storageEnergy >= 30000 && typeof Memory !== 'undefined' && Memory.empire && Memory.empire.deposits) {
                const activeDeposit = Object.values(Memory.empire.deposits).find(d => d && d.decayAt > Game.time + 1000 && (!d.colony || d.colony === roomName));
                if (activeDeposit) {
                    want.depositHarvester = 1;
                }
            }

            // Imperial Strike Quads (2x2 Quad columns for vulnerable rival cores at RCL 6-8)
            if (homeArmed === 0 && rcl >= 6 && storageEnergy >= cfg.siegeTier3Energy && isOffenseAllowed('quad', cfg)) {
                const quadTarget = selectHostileTarget(roomName, 'quad', cfg);
                if (quadTarget) {
                    want.quad = 4;
                }
                if (cfg.posture === 'hostile' && !want.claimer && room.energyCapacityAvailable >= 650) {
                    const ctrlTarget = selectHostileTarget(roomName, 'controllerAttacker', cfg);
                    if (ctrlTarget) want.claimer = 1;
                }
            }

            // Aggressive Outpost Choking: Deploy 1-2 Raiders against rival outposts / soft targets within 4 rooms
            if (homeArmed === 0 && isOffenseAllowed('raider', cfg)) {
                const raidTarget = selectHostileTarget(roomName, 'raider', cfg);
                if (raidTarget && (!hasStorage || storageEnergy >= cfg.siegeTier3Energy)) {
                    want.raider = storageEnergy >= cfg.siegeTier2Energy ? 2 : 1;
                }
            }

            // Hive-Mind Joint Bootstrapping: distribute Claimer, Pioneers & Escorts across eligible sponsors
            if (global.heap) {
                if (!global.heap._bootstrapAssign) global.heap._bootstrapAssign = {};
                global.heap._bootstrapAssign[roomName] = null;
            }
            if (homeArmed === 0 && room.energyCapacityAvailable >= 650) {
                if (typeof Memory !== 'undefined' && (!Memory.empire || !Memory.empire.expansionTarget)) {
                    findBestExpansionTarget(roomName);
                    if (typeof Game !== 'undefined' && Game.rooms) syncEmpireMissions();
                }
                const assign = getBootstrapSpawnAssignment(roomName, cfg);
                if (assign && assign.targetRoom) {
                    if (!global.heap._bootstrapAssign) global.heap._bootstrapAssign = {};
                    global.heap._bootstrapAssign[roomName] = assign;
                    if (assign.claimer > 0) want.claimer = (have.claimer || 0) + assign.claimer;
                    if (assign.pioneer > 0) want.pioneer = (have.pioneer || 0) + assign.pioneer;
                    if (assign.escort > 0) want.escort = assign.escort;
                    if (global.heap && global.heap.expansion) {
                        const linearDistExp = (Game.map && Game.map.getRoomLinearDistance) ? Game.map.getRoomLinearDistance(roomName, assign.targetRoom) : 4;
                        global.heap.expansion.targetRoom = assign.targetRoom;
                        global.heap.expansion.travelTicks = linearDistExp * 50;
                    }
                }
            }
        }
    }

    // Anti-Feed Mission Escalation (RCL 3+): Size coordinated Strike Groups / Quads against defended rooms (threatPower > 0)
    if (global.heap) {
        if (!global.heap._strikeMission) global.heap._strikeMission = {};
        global.heap._strikeMission[roomName] = null;
    }
    const econReadyForStrike = have.harvester >= sourcesCount && (have.hauler >= 1 || have.filler >= 1 || have.fastFiller >= 1 || have.distributor >= 1);
    const strikeTarget = (homeArmed === 0 && rcl >= 3 && econReadyForStrike && (rcl >= 4 || cfg.posture === 'hostile'))
        ? selectStrikeGroupTarget(roomName, cfg)
        : null;
    if (strikeTarget) {
        const hasXgho2 = hasXgho2Available(state);
        const paladinBody = getPaladinStrikeBody(cap, rcl, hasXgho2);
        const paladinCost = calculateBodyCost(paladinBody);
        const unitPower = Math.max(1, calcBodyPower(paladinBody));
        const softFallbackHunter = selectHostileTarget(roomName, 'hunter', cfg);
        const softFallbackUndefended = softFallbackHunter && getRoomThreatPower(softFallbackHunter) === 0;

        let existingEmpirePower = 0;
        const sg = global.heap && global.heap.strikeGroups ? global.heap.strikeGroups[strikeTarget.roomName] : null;
        if (sg && sg.totalPower > 0) {
            existingEmpirePower = sg.totalPower;
        } else if (typeof Game !== 'undefined' && Game.creeps) {
            for (const cn in Game.creeps) {
                const c = Game.creeps[cn];
                if (!c || c.spawning || !c.memory || c.memory.targetRoom !== strikeTarget.roomName) continue;
                const r = c.memory.role;
                if (r === 'hunter' || r === 'raider' || r === 'assassin' || r === 'pest') {
                    existingEmpirePower += calcUnitPower(c);
                }
            }
        }
        if (typeof Game !== 'undefined' && Game.spawns) {
            for (const sn in Game.spawns) {
                const sp = Game.spawns[sn];
                if (!sp || !sp.spawning) continue;
                const cm = (typeof Memory !== 'undefined' && Memory.creeps) ? Memory.creeps[sp.spawning.name] : null;
                if (cm && cm.targetRoom === strikeTarget.roomName && (cm.role === 'hunter' || cm.role === 'raider')) {
                    existingEmpirePower += (cm.power > 0 ? cm.power : unitPower);
                }
            }
        }

        const isToweredOrHeavy = (strikeTarget.threatPower >= 600 || strikeTarget.towers > 0);
        const econAllowsHeavy = (!hasStorage || storageEnergy >= cfg.siegeTier3Energy);
        if (isToweredOrHeavy && rcl >= 6 && econAllowsHeavy && isOffenseAllowed('quad', cfg)) {
            want.quad = Math.max(want.quad, 4);
            if (!softFallbackUndefended) {
                want.hunter = 0;
                want.raider = 0;
            }
            if (global.heap) {
                global.heap._strikeMission[roomName] = Object.assign({ mode: 'quad', paladinCost }, strikeTarget);
            }
        } else if (!isToweredOrHeavy || !strikeTarget.isOwnedCore || cfg.posture === 'hostile') {
            if (econAllowsHeavy && (existingEmpirePower + unitPower * 4) >= strikeTarget.requiredPower) {
                const remainingPower = Math.max(0, strikeTarget.requiredPower - existingEmpirePower);
                const neededAdditional = Math.ceil(remainingPower / unitPower);
                const packGoal = Math.min(4, (have.hunter || 0) + (have.raider || 0) + neededAdditional);
                want.hunter = Math.max(want.hunter || 0, Math.min(4, Math.max(have.hunter || 0, packGoal - (have.raider || 0))));
                if (global.heap) {
                    global.heap._strikeMission[roomName] = Object.assign({ mode: 'pack', paladinCost, strikeEscalated: true }, strikeTarget);
                }
            } else if (!softFallbackUndefended) {
                // Refuse to feed doomed units if colony cannot mathematically reach threatPower * 1.35
                want.hunter = 0;
                want.raider = 0;
            }
        }
    }

    // FastFiller & Distributor Census (Decoupled from container existence; uses stamp geometry / core extensions / container sites)
    const blueprint = getRoomBlueprint(room || roomName);
    const hasAnchor = !!(blueprint && blueprint.anchor);
    const ax = hasAnchor ? blueprint.anchor.x : 0;
    const ay = hasAnchor ? blueprint.anchor.y : 0;
    const hasCoreContainerOrLink = !!(state && hasAnchor && (
        (state.containers || []).some(c => Math.abs(c.pos.x - ax) <= 2 && Math.abs(c.pos.y - ay) <= 2) ||
        (state.links || []).some(l => l.pos.x === ax && l.pos.y === ay)
    ));
    const hasCoreExtension = !!(state && hasAnchor && (state.extensions || []).some(e => Math.abs(e.pos.x - ax) <= 2 && Math.abs(e.pos.y - ay) <= 2));
    const hasCoreContainerSite = !!(state && hasAnchor && (state.constructionSites || []).some(s =>
        s.structureType === STRUCTURE_CONTAINER && Math.abs(s.pos.x - ax) <= 2 && Math.abs(s.pos.y - ay) <= 2
    ));

    if (hasAnchor && rcl >= 2 && (hasCoreContainerOrLink || hasCoreExtension || hasCoreContainerSite)) {
        want.fastFiller = (rcl >= 7 || (rcl >= 4 && cap < 1300)) ? 2 : 1;
        want.filler = 0; // Stationary fast-fillers replace generic roaming fillers
    }

    // Operation Phoenix Builder Override (States 1 & 2)
    if (room && room.memory && (room.memory.phoenix === 1 || room.memory.phoenix === 2)) {
        want.builder = Math.max(want.builder, 4);
    }

    const terminalEnergy = (state && state.terminal && state.terminal.store) ? (state.terminal.store[RESOURCE_ENERGY] || 0) : 0;
    const linkCount = (state && state.links) ? state.links.length : 0;
    if (rcl >= 4 && hasStorage && (storageEnergy >= 1000 || terminalEnergy >= 2000 || linkCount >= 2)) {
        want.distributor = 1;
    }

    // Source Link Automation at RCL >= 5 with strict Domestic Hauler Floor:
    if (rcl >= 5 && state && state.links && sources.length > 0) {
        const sourceLinksCount = state.links.filter(l => {
            return sources.some(s => calcDistance(l.pos, s.pos) <= 2);
        }).length;
        const hasCtrlLink = !!(state.controller && state.links.some(l => calcDistance(l.pos, state.controller.pos) <= 3));
        const hasCoreLink = !!(hasAnchor && state.links.some(l => l.pos.x === ax && l.pos.y === ay));
        const hasTowersOrLabs = !!((state.towers && state.towers.length > 0) || (state.labs && state.labs.length > 0));
        const needsDedicatedHauler = (sourceLinksCount < sources.length) ||
            (!!state.controllerContainer && !hasCtrlLink) ||
            hasTowersOrLabs ||
            !hasCoreLink;

        if (sourceLinksCount >= sources.length) {
            // Maintain at least 1 utility hauler to service Towers, Labs, Controller Container, Core Containers & Loot
            want.hauler = (hasStorage && !want.distributor) ? 1 : (needsDedicatedHauler ? 1 : 1);
        } else if (sourceLinksCount > 0) {
            want.hauler = Math.max(1, (want.hauler || 2) - sourceLinksCount);
        }
    }

    const bucketNow = (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket !== undefined) ? Game.cpu.bucket : 10000;
    const cpuThrottled = !!(global.heap && (global.heap.remoteThrottleActive || (global.heap.cpuMean50 !== undefined && global.heap.cpuMean50 > cfg.cpuTarget)));
    if (bucketNow < cfg.cpuBucketFloor || cpuThrottled) {
        if (want.remoteMiner > (have.remoteMiner || 0)) want.remoteMiner = have.remoteMiner || 0;
        if (want.remoteHauler > (have.remoteHauler || 0)) want.remoteHauler = have.remoteHauler || 0;
        if (want.reserver > (have.reserver || 0)) want.reserver = have.reserver || 0;
        if (want.scout > (have.scout || 0)) want.scout = have.scout || 0;
    }

    // 3-Tier Siege Economy Lock & Per-Colony Offensive Cap Enforcement:
    if (hasStorage) {
        const tier = getSiegeTier(storageEnergy, cfg);
        if (tier >= 3) {
            // Tier 3: Survival Lock - Freeze all offensive spawning completely!
            want.quad = 0;
            want.raider = 0;
            want.hunter = 0;
            want.pest = 0;
            want.praiser = 0;
            want.drainer = 0;
            want.teamWrecker = 0;
            want.teamHealer = 0;
            if (homeArmed === 0) want.assassin = 0;
            if (cfg.posture === 'hostile' && !getActiveExpansionTarget(roomName)) want.claimer = 0;
        } else if (tier === 2) {
            // Tier 2: Attrition Mode - Cap quad squad to 1 (4 creeps) and raider to 1
            if (want.quad > 4) want.quad = 4;
            if (want.raider > 1) want.raider = 1;
        }
    }
    // Hard cap: max 1 active Quad (4 creeps), max 4 Strike Group attackers when escalated (else 2 combined pests/hunters)
    if (want.quad > 4) want.quad = 4;
    const strikeEscalated = !!(global.heap && global.heap._strikeMission && global.heap._strikeMission[roomName] && global.heap._strikeMission[roomName].strikeEscalated);
    if (strikeEscalated) {
        if ((want.pest || 0) > 1) want.pest = 1;
        if ((want.hunter || 0) > 4) want.hunter = 4;
        if ((want.hunter || 0) + (want.raider || 0) > 4) {
            want.raider = Math.max(0, 4 - (want.hunter || 0));
        }
    } else if ((want.pest || 0) + (want.hunter || 0) > 2) {
        if ((want.pest || 0) > 1) want.pest = 1;
        if ((want.pest || 0) + (want.hunter || 0) > 2) want.hunter = Math.max(0, 2 - (want.pest || 0));
    }

    const need = {};
    for (const role in want) {
        need[role] = Math.max(0, want[role] - (have[role] || 0));
    }
    return need;
}

function createSpawnLedger(room) { return { energy: (room && room.energyAvailable) || 0, used: {} }; }

function trySpawn(spawn, ledger, body, memory) {
    if (spawn.spawning || ledger.used[spawn.id]) return false;
    const cost = calculateBodyCost(body);
    if (cost > ledger.energy) return false;
    const name = memory.role + '_' + Game.time + '_' + Math.floor(Math.random() * 1000);

    // Direction locking away from bunker core to avoid stepping on stationary fast-fillers
    const blueprint = getRoomBlueprint(spawn.room.name);
    let spawnDirs = null;
    if (blueprint && blueprint.anchor) {
        const dx = spawn.pos.x - blueprint.anchor.x;
        const dy = spawn.pos.y - blueprint.anchor.y;
        if (dx === -2 && dy === -1) {
            spawnDirs = [LEFT, TOP_LEFT, BOTTOM_LEFT, TOP];
        } else if (dx === 2 && dy === -1) {
            spawnDirs = [RIGHT, TOP_RIGHT, BOTTOM_RIGHT, TOP];
        } else if (dx === 0 && dy === 2) {
            spawnDirs = [BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT];
        }
    }

    if (!spawnDirs) {
        const terrain = spawn.room.getTerrain ? spawn.room.getTerrain() : null;
        const allDirs = [TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT];
        const dirOffsets = {
            [TOP]: { dx: 0, dy: -1 },
            [TOP_RIGHT]: { dx: 1, dy: -1 },
            [RIGHT]: { dx: 1, dy: 0 },
            [BOTTOM_RIGHT]: { dx: 1, dy: 1 },
            [BOTTOM]: { dx: 0, dy: 1 },
            [BOTTOM_LEFT]: { dx: -1, dy: 1 },
            [LEFT]: { dx: -1, dy: 0 },
            [TOP_LEFT]: { dx: -1, dy: -1 }
        };
        const validDirs = [];
        for (let d = 0; d < allDirs.length; d++) {
            const dir = allDirs[d];
            const off = dirOffsets[dir];
            const x = spawn.pos.x + off.dx;
            const y = spawn.pos.y + off.dy;
            if (x < 1 || x > 48 || y < 1 || y > 48) continue;
            if (terrain && terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            validDirs.push(dir);
        }
        spawnDirs = validDirs;
    }

    const state = global.heap && global.heap.rooms ? global.heap.rooms[spawn.room.name] : null;
    const energyStructures = (state && state.energyStructures && state.energyStructures.length > 0)
        ? state.energyStructures
        : undefined;

    const memCopy = Object.assign({}, memory);
    const opts = { memory: memCopy };
    if (spawnDirs && spawnDirs.length > 0) opts.directions = spawnDirs;
    if (energyStructures) opts.energyStructures = energyStructures;

    if (spawn.spawnCreep(body, name, opts) !== OK) return false;
    if (!global.heap) global.heap = {};
    if (!global.heap.creeps) global.heap.creeps = {};
    const roleStr = memCopy.role ? memCopy.role : 'unknown';
    const rId = (ROLE_ID && ROLE_ID[roleStr] !== undefined) ? ROLE_ID[roleStr] : 255;
    const cHeap = createCreepHeap(rId, roleStr);
    cHeap.mem = memCopy;
    cHeap.targetRoom = memCopy.targetRoom || null;
    cHeap.sourceId = memCopy.sourceId || null;
    if (memCopy.slotIndex !== undefined) {
        cHeap.slotIndex = memCopy.slotIndex;
        cHeap.targetSlotIndex = memCopy.slotIndex;
    }
    global.heap.creeps[name] = cHeap;
    global.heap[name] = cHeap;
    if (global.heap.state) {
        if (!global.heap.state.creeps) global.heap.state.creeps = {};
        global.heap.state.creeps[name] = memCopy;
    }
    if (typeof Memory !== 'undefined') {
        if (!Memory.creeps) Memory.creeps = {};
        Memory.creeps[name] = memCopy;
    }
    markMemoryDirty();
    ledger.energy -= cost;
    ledger.used[spawn.id] = true;
    recordSpawnEnergyDeduction(spawn.room.name, cost);
    return true;
}

function runSpawning(roomName) {
    const room = Game.rooms[roomName];
    if (!room) return;
    const state = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    const allSpawns = (state && state.spawns) || [];
    if (allSpawns.length > 0 && global.heap) {
        if (!global.heap.spawnUtil) global.heap.spawnUtil = {};
        let busy = 0;
        for (let i = 0; i < allSpawns.length; i++) {
            if (allSpawns[i].spawning) busy++;
        }
        const prev = global.heap.spawnUtil[roomName] || 0;
        global.heap.spawnUtil[roomName] = prev + ((busy / allSpawns.length) - prev) * 0.01;
    }
    const spawns = allSpawns.filter(s => !s.spawning);
    if (!spawns.length) return;

    const ledger = createSpawnLedger(room);
    const need = getCensusRequirements(roomName);
    const sources = (state && state.sources) || [];
    const rcl = (room.controller && room.controller.level) || 1;

    let livingHarvesters = 0;
    let livingHaulers = 0;
    const assignedSources = {};
    const assignedRemoteSources = {};
    const assignedRemoteHaulers = {};
    const assignedScoutRooms = {};
    const assignedReserverRooms = {};

    const colRef = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
    const colonyCreeps = (colRef && colRef.creeps) ? colRef.creeps : Object.values(Game.creeps || {}).filter(c => c.memory && c.memory.colony === roomName);
    for (let i = 0; i < colonyCreeps.length; i++) {
        const c = colonyCreeps[i];
        if (c.memory.role === 'harvester') {
            livingHarvesters++;
            if (!needsReplacement(c)) {
                const sId = c.memory.sourceId || (c.heap && c.heap.sourceId);
                if (sId) assignedSources[sId] = (assignedSources[sId] || 0) + 1;
            }
        } else if (c.memory.role === 'hauler') {
            livingHaulers++;
        } else if (c.memory.role === 'remoteMiner' && !needsReplacement(c)) {
            if (c.memory.sourceId) assignedRemoteSources[c.memory.sourceId] = (assignedRemoteSources[c.memory.sourceId] || 0) + 1;
        } else if (c.memory.role === 'remoteHauler' && !needsReplacement(c)) {
            if (c.memory.sourceId) assignedRemoteHaulers[c.memory.sourceId] = (assignedRemoteHaulers[c.memory.sourceId] || 0) + 1;
        } else if (c.memory.role === 'scout') {
            const sTarget = (c.heap && c.heap.targetRoom) || c.memory.targetRoom;
            if (sTarget) assignedScoutRooms[sTarget] = true;
        } else if (c.memory.role === 'reserver' && !needsReplacement(c)) {
            if (c.memory.targetRoom) assignedReserverRooms[c.memory.targetRoom] = true;
        }
    }

    const bootstrapMode = (state && state.bootstrapMode !== undefined) ? state.bootstrapMode : 0;

    // 1. MODE 2: LOGISTICS_RECOVERY (Unlock stored/dropped energy before spawning anything else)
    if (bootstrapMode === 2 && spawns.length > 0) {
        if (ledger.energy >= 150) {
            const recBody = ledger.energy >= 300 ? [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE] : [CARRY, CARRY, MOVE];
            if (trySpawn(spawns[0], ledger, recBody, { role: 'hauler', colony: roomName })) {
                spawns.shift();
            }
        }
        return;
    }

    // 2. MODE 1: COLD_START_SPRINT (Paired Drop-Sprint: 250e 2W1M miner -> 150e 2C1M hauler)
    if (livingHarvesters === 0 && spawns.length > 0) {
        if (ledger.energy >= 250) {
            const targetSrc = sources.length ? sources[0].id : undefined;
            const mem = { role: 'harvester', colony: roomName };
            if (targetSrc) mem.sourceId = targetSrc;
            if (trySpawn(spawns[0], ledger, [WORK, WORK, MOVE], mem)) {
                spawns.shift();
            }
        }
        return; // Never dilute 250e threshold with smaller creeps when harvesters === 0
    }

    if (livingHarvesters >= 1 && livingHaulers === 0 && (!state || !state.creepsByRole || !state.creepsByRole.fastFiller || state.creepsByRole.fastFiller.length === 0) && spawns.length > 0) {
        if (ledger.energy >= 150) {
            if (trySpawn(spawns[0], ledger, [CARRY, CARRY, MOVE], { role: 'hauler', colony: roomName })) {
                spawns.shift();
            }
        }
        if (bootstrapMode === 1 || spawns.length === 0) return;
    }

    // 3. EMERGENCY DEFENDER (P90): Active threat detected in home or outposts!
    if (need.defender > 0 && spawns.length > 0) {
        const defenderBudget = Math.min(room.energyCapacityAvailable, Math.max(260, room.energyAvailable));
        if (ledger.energy >= 260) {
            const body = getBodyDefinition('defender', Math.min(ledger.energy, defenderBudget), { rcl });
            const cost = calculateBodyCost(body);
            if (ledger.energy >= cost) {
                let targetThreatRoom = roomName;
                const col = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
                if (col && col.threats && col.threats.length > 0) {
                    targetThreatRoom = col.threats[0].roomName;
                } else if (typeof Memory !== 'undefined' && Memory.rooms) {
                    const outposts = (Memory.rooms[roomName] && Memory.rooms[roomName].outposts) || [];
                    for (let o = 0; o < outposts.length; o++) {
                        if (Memory.rooms[outposts[o]] && Memory.rooms[outposts[o]].threat && Memory.rooms[outposts[o]].threat.expiresAt > Game.time) {
                            targetThreatRoom = outposts[o];
                            break;
                        }
                    }
                }
                const mem = { role: 'defender', colony: roomName, targetRoom: targetThreatRoom };
                if (trySpawn(spawns[0], ledger, body, mem)) {
                    spawns.shift();
                    need.defender--;
                }
                if (spawns.length === 0) return;
            }
        }
    }

    // RCL 1 Sprint Order: 1st Harvester -> 1 Hauler -> 1st Upgrader -> 2nd Harvester -> 2nd Upgrader
    // RCL 2-3 Order: Harvesters -> Haulers -> Scout (50e!) -> Builder (1) -> Upgraders -> Remotes
    // RCL 4+ Order: Harvester -> Filler (Fast Base Distributor) -> Haulers -> Scout -> Builder -> Upgraders -> Remotes -> MineralMiner
    const hasSites = (state && state.constructionSites && state.constructionSites.length > 0) || false;
    const upCount = (state && state.creepsByRole && state.creepsByRole.upgrader) ? state.creepsByRole.upgrader.length : 0;
    const downgradeGuard = !!(state && state.controller && state.controller.ticksToDowngrade < 5000 && upCount === 0);
    const order = (rcl === 1 && livingHarvesters >= 1 && livingHaulers >= 1 && upCount === 0)
        ? ['defender', 'upgrader', 'harvester', 'hauler', 'scavenger', 'scout']
        : (rcl === 1
            ? ['defender', 'harvester', 'hauler', 'scavenger', 'upgrader', 'scout']
            : (rcl >= 4
                ? ['harvester', 'distributor', 'fastFiller', 'filler', 'hauler', 'defender', 'qrf', 'outpostDefender', 'scavenger', 'scout', 'builder', 'upgrader', 'remoteMiner', 'remoteHauler', 'reserver', 'pioneer', 'claimer', 'escort', 'janitor', 'mineralMiner', 'assassin', 'hunter', 'pest', 'raider', 'quad', 'drainer', 'teamWrecker', 'teamHealer', 'praiser', 'depositHarvester', 'skGuard', 'skHealer', 'bankAttacker', 'bankHealer', 'bankHauler']
                : (hasSites && upCount >= 2
                    ? ['harvester', 'fastFiller', 'hauler', 'defender', 'outpostDefender', 'scavenger', 'scout', 'builder', 'upgrader', 'remoteMiner', 'remoteHauler', 'reserver', 'janitor', 'assassin', 'hunter', 'pest']
                    : ['harvester', 'fastFiller', 'hauler', 'defender', 'outpostDefender', 'scavenger', 'scout', 'upgrader', 'remoteMiner', 'remoteHauler', 'builder', 'reserver', 'janitor', 'assassin', 'hunter', 'pest'])));

    let spawnOrder = order;
    // Downgrade guard: an upgrader jumps to right after fastFiller (below harvester/distributor/fastFiller only)
    if (downgradeGuard && rcl >= 2) {
        spawnOrder = order.filter(r => r !== 'upgrader');
        const ffIdx = spawnOrder.indexOf('fastFiller');
        spawnOrder.splice(ffIdx >= 0 ? ffIdx + 1 : 1, 0, 'upgrader');
    }

    // Dynamic energy budgets: at RCL 1-2 before extensions are built, don't stall waiting for 550e!
    const cap = room.energyCapacityAvailable || 300;
    const effectiveCap = (livingHarvesters < Math.min(sources.length, 2) || livingHaulers < 1 || cap <= 300) ? Math.min(cap, Math.max(250, room.energyAvailable)) : cap;
    const hasStorage = !!(state && state.storage);
    const storageEnergy = (hasStorage && state.storage.store) ? (state.storage.store[RESOURCE_ENERGY] || 0) : 0;
    const ctrlEnergy = (state && state.controllerContainer && state.controllerContainer.store ? (state.controllerContainer.store[RESOURCE_ENERGY] || 0) : 0) +
        (state && state.controller && state.droppedEnergy ? state.droppedEnergy.filter(d => calcDistance(d.pos, state.controller.pos) <= 4).reduce((a, d) => a + d.amount, 0) : 0);
    const sourceEnergy = (state && state.containers ? state.containers.filter(cnt => !state.controller || calcDistance(cnt.pos, state.controller.pos) > 3).reduce((a, cnt) => a + (cnt.store ? cnt.store[RESOURCE_ENERGY] : 0), 0) : 0) +
        (state && state.droppedEnergy ? state.droppedEnergy.reduce((a, d) => a + d.amount, 0) : 0);
    const fillersAlive = (state && state.creepsByRole && (
        (state.creepsByRole.fastFiller && state.creepsByRole.fastFiller.length > 0) ||
        (state.creepsByRole.filler && state.creepsByRole.filler.length > 0)
    )) ? 1 : 0;
    const canWaitForBigger = livingHarvesters >= sources.length && livingHaulers >= 1 && (!hasStorage || fillersAlive > 0);
    const hasRoads = !!(state && state.roads && state.roads.length >= 20);
    const allSourcesLinked = !!(rcl >= 5 && state && state.links && sources.length > 0 &&
        state.links.filter(l => sources.some(s => calcDistance(l.pos, s.pos) <= 2)).length >= sources.length);
    const homeArmed = (state && state.armedHostiles) ? state.armedHostiles.length : 0;

    const isFob = isFobColony(roomName);
    const necrosisNow = evaluateNecrosis();
    const rivalNear = getNearbyRivalRemote(roomName, 3);
    const strikeMission = (global.heap && global.heap._strikeMission) ? global.heap._strikeMission[roomName] : null;
    const hasXgho2 = hasXgho2Available(state);
    const strikePackActive = !!(strikeMission && strikeMission.mode === 'pack');

    const targetBudgets = {
        fastFiller: (rcl >= 5) ? Math.min(cap, 450) : Math.min(cap, 250),
        distributor: Math.min(cap, 600),
        assassin: (isFob && rcl >= 4 && cap >= 1300 && !(necrosisNow && necrosisNow.active && rcl <= 6)) ? 1300 : 130,
        pest: 130,
        hunter: strikePackActive
            ? Math.min(cap, strikeMission.paladinCost || 2080)
            : ((rivalNear && rivalNear.threat > 0) ? Math.min(cap, 1200) : Math.min(cap, 520)),
        scavenger: (rivalNear && rivalNear.lootRoom && storageEnergy >= 500) ? Math.min(cap, 400) : 100,
        defender: (homeArmed > 0) ? Math.min(cap, effectiveCap) : ((canWaitForBigger && cap >= 690) ? Math.min(cap, 690) : 260),
        qrf: (canWaitForBigger && cap >= 1020) ? Math.min(cap, 1020) : ((canWaitForBigger && cap >= 690) ? Math.min(cap, 690) : 260),
        escort: (canWaitForBigger && cap >= 690) ? Math.min(cap, 690) : 260,
        harvester: rcl === 1 ? 250 : (canWaitForBigger && cap >= 1350 ? Math.min(cap, 1350) : (canWaitForBigger && cap >= 1050 ? Math.min(cap, 1050) : (canWaitForBigger && cap >= 550 ? Math.min(cap, 550) : Math.min(cap, 300)))),
        filler: Math.min(cap, 300),
        hauler: rcl <= 2
            ? 200
            : (allSourcesLinked
                ? Math.min(effectiveCap, hasRoads ? 750 : 600)
                : Math.min(effectiveCap, hasRoads && cap >= 900 ? 900 : (hasRoads && cap >= 600 ? 600 : 400))),
        upgrader: (rcl === 8)
            ? 300
            : ((storageEnergy > 100000 && cap >= 2100)
                ? Math.min(cap, 2100)
                : ((hasStorage && storageEnergy >= 50000 && cap >= 1650)
                    ? Math.min(effectiveCap, 1650)
                    : ((hasStorage && storageEnergy >= 30000 && cap >= 1200)
                        ? Math.min(effectiveCap, 1200)
                        : ((hasStorage && storageEnergy >= 15000 && cap >= 900)
                            ? Math.min(effectiveCap, 900)
                            : ((!hasStorage && rcl >= 3 && (ctrlEnergy >= 500 || sourceEnergy >= 1000))
                                ? Math.min(effectiveCap, 700)
                                : (rcl <= 2 ? 200 : Math.min(effectiveCap, 500))))))),
        builder: rcl <= 2 ? 200 : Math.min(effectiveCap, 400),
        scout: 50,
        remoteMiner: (canWaitForBigger && cap >= 750) ? Math.min(cap, 750) : ((canWaitForBigger && cap >= 550) ? Math.min(cap, 550) : Math.min(cap, 300)),
        remoteHauler: canWaitForBigger ? Math.min(cap, hasRoads && cap >= 1200 ? 1250 : (cap >= 800 ? 850 : 550)) : Math.min(cap, 200),
        reserver: Math.min(cap, 650),
        mineralMiner: Math.min(cap, 650),
        raider: strikePackActive ? Math.min(effectiveCap, strikeMission.paladinCost || 2080) : Math.min(effectiveCap, 760),
        quad: Math.min(cap, 3500),
        depositHarvester: Math.min(effectiveCap, 2500),
        janitor: Math.min(effectiveCap, 450),
        outpostDefender: Math.min(cap, 760),
        skGuard: Math.min(cap, 2300),
        skHealer: Math.min(cap, 1500),
        claimer: Math.min(cap, 650),
        pioneer: (rcl >= 4 && cap >= 1400) ? Math.min(effectiveCap, 1400) : ((rcl >= 4 && cap >= 1000) ? Math.min(effectiveCap, 1000) : Math.min(effectiveCap, 500))
    };

    const remoteSources = getDiscoveredRemoteSources(roomName);
    const colObj = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
    const outpostList = (colObj && colObj.outposts) || (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) || [];

    const fastFillersLiving = (state && state.creepsByRole && state.creepsByRole.fastFiller) ? state.creepsByRole.fastFiller.length : 0;
    const logisticsHealthy = (livingHarvesters > 0 && (livingHaulers + fastFillersLiving) > 0);
    const stallTicks = (room.memory && room.memory.spawnStallTicks) || 0;

    for (const role of spawnOrder) {
        while (need[role] > 0 && spawns.length > 0) {
            let targetBudget = targetBudgets[role] || 200;
            if (!logisticsHealthy) {
                targetBudget = Math.min(targetBudget, Math.max(300, room.energyAvailable || 0));
            }

            const isStallTruncated = stallTicks > 25 && ledger.energy >= 200;
            if (ledger.energy < targetBudget && !isStallTruncated) {
                if (room.memory) room.memory.spawnStallTicks = stallTicks + 1;
                return;
            }

            const bootstrapAssign = (global.heap && global.heap._bootstrapAssign && global.heap._bootstrapAssign[roomName]) ? global.heap._bootstrapAssign[roomName] : null;
            let isColonizerHauler = false;
            let attackReservation = false;
            if (role === 'pioneer' || role === 'claimer') {
                const expT = (bootstrapAssign && bootstrapAssign.targetRoom) || getActiveExpansionTarget(roomName);
                const expR = expT && Game.rooms ? Game.rooms[expT] : null;
                const expSt = expT && global.heap && global.heap.rooms ? global.heap.rooms[expT] : null;
                const expSp = (expSt && expSt.spawns) ? expSt.spawns.length : 0;
                if (role === 'pioneer' && expR && expR.controller && expR.controller.my && expSp > 0 && storageEnergy >= 40000) {
                    isColonizerHauler = true;
                }
                if (role === 'claimer' && expR && expR.controller && expR.controller.reservation && !expR.controller.my) {
                    attackReservation = true;
                }
            }

            let outpostThreatKind = null;
            if (role === 'outpostDefender') {
                for (let o = 0; o < outpostList.length; o++) {
                    const oName = outpostList[o];
                    const oState = global.heap && global.heap.rooms ? global.heap.rooms[oName] : null;
                    if (oState && oState.invaderCore) { outpostThreatKind = 'invaderCore'; break; }
                    if (oState && oState.hostiles && oState.hostiles.length > 0 && (!oState.armedHostiles || oState.armedHostiles.length === 0)) {
                        outpostThreatKind = 'rivalScout';
                    }
                }
            }
            const isPhoenix = !!(room.memory && (room.memory.phoenix === 1 || room.memory.phoenix === 2));
            let bodyEnergy = (role === 'upgrader' && rcl === 1 && ledger.energy < 300)
                ? 200
                : ((role === 'hauler' && allSourcesLinked) ? Math.min(ledger.energy, targetBudget) : ledger.energy);
            if (!logisticsHealthy) {
                bodyEnergy = Math.min(ledger.energy, Math.max(300, room.energyAvailable || 0));
            } else if (isStallTruncated) {
                bodyEnergy = Math.max(200, room.energyAvailable || 0);
            }
            let quadPick = null;
            if (role === 'quad') quadPick = pickQuadSlot(roomName);
            const bodyRole = (role === 'qrf' || role === 'escort') ? 'defender' : role;
            const body = getBodyDefinition(bodyRole, bodyEnergy, {
                rcl, storageEnergy, hasStorage, ctrlEnergy, hasRoads, bootstrapMode,
                isColonizerHauler, attackReservation, isPhoenix, outpostThreatKind,
                isFob, rivalThreat: rivalNear ? rivalNear.threat : 0,
                strikeMode: strikePackActive,
                hasXgho2,
                isRemoteLoot: !!(rivalNear && rivalNear.lootRoom),
                quadSlot: quadPick ? quadPick.slot : -1
            });
            const cost = calculateBodyCost(body);
            if (ledger.energy < cost) {
                if (room.memory) room.memory.spawnStallTicks = stallTicks + 1;
                break;
            }

            const mem = { role: bodyRole, colony: roomName };
            if (quadPick) {
                mem.squadId = quadPick.squadId;
                mem.quadSlot = quadPick.slot;
            }

            if (role === 'fastFiller') {
                const livingFillers = (state && state.creepsByRole && state.creepsByRole.fastFiller) ? state.creepsByRole.fastFiller : [];
                const usedSlots = new Set();
                for (let f = 0; f < livingFillers.length; f++) {
                    if (livingFillers[f].memory && livingFillers[f].memory.slotIndex !== undefined) {
                        usedSlots.add(livingFillers[f].memory.slotIndex);
                    }
                }
                const slotPreferences = (rcl >= 6) ? [0, 3, 1, 2] : [0, 3, 1, 2];
                let assignedSlot = 0;
                for (let s = 0; s < slotPreferences.length; s++) {
                    if (!usedSlots.has(slotPreferences[s])) {
                        assignedSlot = slotPreferences[s];
                        break;
                    }
                }
                mem.slotIndex = assignedSlot;
            } else if (role === 'defender') {
                let targetThreatRoom = roomName;
                const col = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
                if (col && col.threats && col.threats.length > 0) {
                    targetThreatRoom = col.threats[0].roomName;
                }
                mem.targetRoom = targetThreatRoom;
            } else if (role === 'qrf' || role === 'escort') {
                mem.subRole = role === 'qrf' ? 'QRF' : 'ESCORT';
                mem.targetRoom = role === 'qrf'
                    ? ((global.heap && global.heap.qrfTarget) ? global.heap.qrfTarget : roomName)
                    : ((bootstrapAssign && bootstrapAssign.targetRoom) || getActiveExpansionTarget(roomName));
            } else if (role === 'raider') {
                mem.targetRoom = (strikePackActive && strikeMission.roomName)
                    ? strikeMission.roomName
                    : (selectHostileTarget(roomName, 'raider') || null);
            } else if (role === 'quad') {
                const targetRoom = (necrosisNow && necrosisNow.active)
                    ? necrosisNow.targetRoom
                    : ((strikeMission && strikeMission.mode === 'quad' && strikeMission.roomName)
                        ? strikeMission.roomName
                        : selectHostileTarget(roomName, 'quad'));
                mem.targetRoom = targetRoom;
            } else if (role === 'assassin') {
                if (necrosisNow && necrosisNow.active) mem.targetRoom = necrosisNow.targetRoom;
                else if (isFob && room.memory && room.memory.fobTarget) mem.targetRoom = room.memory.fobTarget;
            } else if (role === 'hunter') {
                mem.targetRoom = (strikePackActive && strikeMission.roomName)
                    ? strikeMission.roomName
                    : ((rivalNear && rivalNear.roomName) || selectHostileTarget(roomName, 'hunter'));
            } else if (role === 'pest') {
                mem.targetRoom = selectHostileTarget(roomName, 'pest') || getNearestRivalCitadel(roomName, 4);
            } else if (role === 'scavenger') {
                if (rivalNear && rivalNear.lootRoom && storageEnergy >= 500) mem.targetRoom = rivalNear.lootRoom;
            } else if (role === 'depositHarvester') {
                const activeDeposit = (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.deposits)
                    ? Object.values(Memory.empire.deposits).find(d => d && d.decayAt > Game.time + 1000 && (!d.colony || d.colony === roomName))
                    : null;
                mem.targetRoom = activeDeposit ? activeDeposit.roomName : null;
            } else if (role === 'claimer' || role === 'pioneer') {
                const expTarget = (bootstrapAssign && bootstrapAssign.targetRoom) || getActiveExpansionTarget(roomName);
                if (expTarget) {
                    mem.targetRoom = expTarget;
                } else if (role === 'claimer') {
                    mem.targetRoom = selectHostileTarget(roomName, 'controllerAttacker');
                    if (mem.targetRoom) mem.subRole = 'CONTROLLER_ATTACKER';
                }
                if (isColonizerHauler) mem.subRole = 'COLONIZER_HAULER';
            } else if (role === 'janitor') {
                const col = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
                const outposts = (col && col.outposts) || [];
                mem.targetRoom = outposts.length > 0 ? outposts[0] : null;
            } else if (role === 'outpostDefender') {
                const col = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
                const outposts = (col && col.outposts) || [];
                const threatOutpost = outposts.find(o => typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[o] && Memory.rooms[o].threat);
                mem.targetRoom = threatOutpost || (outposts.length > 0 ? outposts[0] : null);
            } else if (role === 'skGuard' || role === 'skHealer') {
                const col = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
                const outposts = (col && col.outposts) || [];
                const skOutpost = outposts.find(o => isSKOrCenterRoom(o));
                mem.targetRoom = skOutpost || null;
            } else if (role === 'harvester') {
                const spPos = (state && state.spawns && state.spawns[0]) ? state.spawns[0].pos : null;
                let chosenSource = null;
                if (rcl === 1 && cap < 550) {
                    chosenSource = sources.find(s => !assignedSources[s.id] && (!spPos || calcDistance(s.pos, spPos) <= 22 || !sources.some(o => calcDistance(o.pos, spPos) <= 18 && (assignedSources[o.id] || 0) < ((state.sourceSpots && state.sourceSpots[o.id] ? state.sourceSpots[o.id].length : 1) || 1))));
                    if (!chosenSource) {
                        chosenSource = sources.find(s => (assignedSources[s.id] || 0) < ((state.sourceSpots && state.sourceSpots[s.id] ? state.sourceSpots[s.id].length : 1) || 1));
                    }
                } else {
                    chosenSource = sources.find(s => !assignedSources[s.id]);
                }
                if (!chosenSource && sources.length > 0) {
                    chosenSource = sources.reduce((best, s) => ((assignedSources[s.id] || 0) < (assignedSources[best.id] || 0) ? s : best), sources[0]);
                }
                if (chosenSource) {
                    mem.sourceId = chosenSource.id;
                    assignedSources[chosenSource.id] = (assignedSources[chosenSource.id] || 0) + 1;
                }
            } else if (role === 'scout') {
                const targetRoom = getNextScoutTarget(roomName, null, assignedScoutRooms);
                if (!targetRoom) {
                    need[role] = 0;
                    break;
                }
                mem.targetRoom = targetRoom;
                assignedScoutRooms[targetRoom] = true;
            } else if (role === 'remoteMiner') {
                const freeRem = remoteSources.find(s => !assignedRemoteSources[s.id]) ||
                    (remoteSources.length > 0 ? remoteSources.reduce((best, s) => ((assignedRemoteSources[s.id] || 0) < (assignedRemoteSources[best.id] || 0) ? s : best), remoteSources[0]) : null);
                if (freeRem) {
                    mem.sourceId = freeRem.id;
                    mem.targetRoom = freeRem.roomName;
                    assignedRemoteSources[freeRem.id] = (assignedRemoteSources[freeRem.id] || 0) + 1;
                }
            } else if (role === 'remoteHauler') {
                const remSrc = remoteSources.length > 0
                    ? remoteSources.reduce((best, s) => ((assignedRemoteHaulers[s.id] || 0) < (assignedRemoteHaulers[best.id] || 0) ? s : best), remoteSources[0])
                    : null;
                if (remSrc) {
                    mem.targetRoom = remSrc.roomName;
                    mem.sourceId = remSrc.id;
                    assignedRemoteHaulers[remSrc.id] = (assignedRemoteHaulers[remSrc.id] || 0) + 1;
                } else if (outpostList.length > 0) {
                    mem.targetRoom = outpostList[0];
                }
            } else if (role === 'reserver') {
                const remSrc = remoteSources.find(s => !assignedReserverRooms[s.roomName]) || remoteSources[0];
                if (remSrc) {
                    mem.targetRoom = remSrc.roomName;
                    assignedReserverRooms[remSrc.roomName] = true;
                } else if (outpostList.length > 0) {
                    mem.targetRoom = outpostList[0];
                    assignedReserverRooms[outpostList[0]] = true;
                }
            }

            const spawn = spawns[0];
            if (trySpawn(spawn, ledger, body, mem)) {
                if (room.memory) room.memory.spawnStallTicks = 0;
                spawns.shift();
                need[role]--;
                if (role === 'pioneer' || role === 'claimer' || role === 'escort') {
                    // Enforce <= 1 bootstrap creep spawning per sponsor in the same tick across multiple spawns
                    need.pioneer = 0;
                    need.claimer = 0;
                    need.escort = 0;
                    const missions = global.heap && global.heap.state && global.heap.state.missions && global.heap.state.missions.bootstrap;
                    const activeM = mem.targetRoom && missions ? missions[mem.targetRoom] : null;
                    if (activeM) {
                        if (!activeM.bySponsor) activeM.bySponsor = {};
                        if (!activeM.bySponsor[roomName]) activeM.bySponsor[roomName] = { spawningBootstrap: 0, livePioneers: 0, liveEscorts: 0 };
                        activeM.bySponsor[roomName].spawningBootstrap++;
                        if (role === 'claimer') activeM.haveClaimer++;
                        else if (role === 'pioneer') activeM.havePioneers++;
                        else if (role === 'escort') activeM.haveEscorts++;
                    }
                }
            } else {
                break;
            }
        }
    }
}

module.exports = {
    calculateBodyCost,
    createSpawnLedger,
    getActiveExpansionTarget,
    getBodyDefinition,
    getBootstrapSpawnAssignment,
    getCensusRequirements,
    getDiscoveredRemoteSources,
    getPaladinStrikeBody,
    getUnscoutedOutposts,
    hasXgho2Available,
    needsReplacement,
    rep,
    runSpawning,
    trySpawn
};