// src/constants.js
// Shared body costs, reaction recipes, and math utilities

const BODY_COSTS = {
    move: 50,
    work: 100,
    carry: 50,
    attack: 80,
    ranged_attack: 150,
    heal: 250,
    claim: 600,
    tough: 10
};

const REACTION_RECIPES = {
    OH: ['O', 'H'],
    ZK: ['Z', 'K'],
    UL: ['U', 'L'],
    G: ['ZK', 'UL'],
    UH: ['U', 'H'],
    UO: ['U', 'O'],
    KH: ['K', 'H'],
    KO: ['K', 'O'],
    LH: ['L', 'H'],
    LO: ['L', 'O'],
    ZH: ['Z', 'H'],
    ZO: ['Z', 'O'],
    GH: ['G', 'H'],
    GO: ['G', 'O'],
    UH2O: ['UH', 'OH'],
    UHO2: ['UO', 'OH'],
    KH2O: ['KH', 'OH'],
    KHO2: ['KO', 'OH'],
    LH2O: ['LH', 'OH'],
    LHO2: ['LO', 'OH'],
    ZH2O: ['ZH', 'OH'],
    ZHO2: ['ZO', 'OH'],
    GH2O: ['GH', 'OH'],
    GHO2: ['GO', 'OH'],
    XUH2O: ['X', 'UH2O'],
    XUHO2: ['X', 'UHO2'],
    XKH2O: ['X', 'KH2O'],
    XKHO2: ['X', 'KHO2'],
    XLH2O: ['X', 'LH2O'],
    XLHO2: ['X', 'LHO2'],
    XZH2O: ['X', 'ZH2O'],
    XZHO2: ['X', 'ZHO2'],
    XGH2O: ['X', 'GH2O'],
    XGHO2: ['X', 'GHO2']
};

function calcDistance(pos1, pos2) {
    if (!pos1 || !pos2) return 999;
    const p1 = pos1.pos || pos1;
    const p2 = pos2.pos || pos2;
    return Math.max(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y));
}

function getDirectionTo(fromPos, toPos) {
    const f = fromPos.pos || fromPos;
    const t = toPos.pos || toPos;
    const dx = t.x - f.x;
    const dy = t.y - f.y;
    if (dx === 0 && dy < 0) return 1;
    if (dx > 0 && dy < 0) return 2;
    if (dx > 0 && dy === 0) return 3;
    if (dx > 0 && dy > 0) return 4;
    if (dx === 0 && dy > 0) return 5;
    if (dx < 0 && dy > 0) return 6;
    if (dx < 0 && dy === 0) return 7;
    if (dx < 0 && dy < 0) return 8;
    return 0;
}

function roomCenterPos(roomName) {
    const h = global.heap || (global.heap = {});
    const cache = h.roomCenters || (h.roomCenters = {});
    return cache[roomName] || (cache[roomName] = new RoomPosition(25, 25, roomName));
}

// Profiler: lap timer. Records CPU since the previous lap/sandbox start under `name` (heap.prof, flushed by main.js).
function profLap(name) {
    const h = global.heap;
    if (!h || typeof Game === 'undefined' || !Game.cpu) return;
    const now = Game.cpu.getUsed();
    const p = h.prof || (h.prof = { phases: {}, ticks: 0, tickSum: 0, tickMax: 0, bucketMin: 10000, start: Game.time });
    const e = p.phases[name] || (p.phases[name] = { sum: 0, max: 0, n: 0 });
    const d = now - (h.profLast || now);
    e.sum += d;
    e.n++;
    if (d > e.max) e.max = d;
    h.profLast = now;
}

// Profiler counter: accumulate an integer metric (e.g. intents per role) in heap.prof.counters
function profCount(name, v) {
    const h = global.heap;
    if (!h) return;
    const p = h.prof || (h.prof = { phases: {}, ticks: 0, tickSum: 0, tickMax: 0, bucketMin: 10000, start: Game.time });
    const c = p.counters || (p.counters = {});
    c[name] = (c[name] || 0) + (v === undefined ? 1 : v);
}

// Computes remaining Safe Mode ticks for a rival room or controller profile
function getRivalSafeModeRemaining(profileOrRoomName) {
    if (!profileOrRoomName) return 0;
    let prof = profileOrRoomName;
    if (typeof profileOrRoomName === 'string') {
        const roomName = profileOrRoomName;
        const h = (typeof global !== 'undefined' && global.heap) || {};
        prof = (h.rivalCitadelStorage && h.rivalCitadelStorage[roomName]) ||
               (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].scoutData ? Memory.rooms[roomName].scoutData.controller : null);
        if (!prof && typeof Game !== 'undefined' && Game.rooms && Game.rooms[roomName]) {
            const r = Game.rooms[roomName];
            if (r.controller && r.controller.safeMode) {
                return r.controller.safeMode;
            }
        }
    }
    if (!prof) return 0;

    if (prof.safeMode && !prof.tick && !prof.safeModeUntil && typeof Game !== 'undefined' && prof.room && Game.rooms[prof.room.name]) {
        return prof.safeMode;
    }

    if (prof.safeModeUntil) {
        return Math.max(0, prof.safeModeUntil - Game.time);
    }

    const sm = prof.safeMode || 0;
    const tick = prof.tick || prof.lastSeen || 0;
    if (sm > 0 && tick > 0) {
        const elapsed = Game.time - tick;
        return Math.max(0, sm - elapsed);
    }
    return 0;
}

// BaseGrid Integer Enums for Topological Planner & RawMemory Segment Compression
const SEGMENT_BASE_PLAN = 1;

const GRID_EMPTY        = 0;
const GRID_ROAD         = 1;
const GRID_SPAWN        = 2;
const GRID_EXTENSION    = 3;
const GRID_TOWER        = 4;
const GRID_STORAGE      = 5;
const GRID_TERMINAL     = 6;
const GRID_CONTAINER    = 7;
const GRID_LINK         = 8;
const GRID_LAB_SUPPLIER = 9;
const GRID_LAB_REACTOR  = 10;
const GRID_FACTORY      = 11;
const GRID_POWER_SPAWN  = 12;
const GRID_NUKER        = 13;
const GRID_OBSERVER     = 14;
const GRID_EXTRACTOR    = 15;
const GRID_WALL         = 255;

// 32-bit RoomPosition Bit-Packing & O(1) Room Name Hashing
const ROOM_TO_HASH = new Map();
const HASH_TO_ROOM = [];
let nextRoomHash = 0;

function resetRoomHashDictionary() {
    ROOM_TO_HASH.clear();
    HASH_TO_ROOM.length = 0;
    nextRoomHash = 0;
}

function getRoomNameHash(roomName) {
    if (!roomName) return 0;
    let hash = ROOM_TO_HASH.get(roomName);
    if (hash === undefined) {
        hash = nextRoomHash++;
        if (nextRoomHash > 4095) nextRoomHash = 0; // 12-bit cyclic wrap guard
        ROOM_TO_HASH.set(roomName, hash);
        HASH_TO_ROOM[hash] = roomName;
    }
    return hash;
}

function getRoomNameFromHash(hash) {
    return HASH_TO_ROOM[hash] || 'W0N0';
}

function packPos(x, y, roomName) {
    const rHash = getRoomNameHash(roomName);
    return (x & 0x3F) | ((y & 0x3F) << 6) | ((rHash & 0xFFF) << 12);
}

function unpackPos(packed) {
    return {
        x: packed & 0x3F,
        y: (packed >>> 6) & 0x3F,
        roomName: HASH_TO_ROOM[(packed >>> 12) & 0xFFF] || 'W0N0'
    };
}

function packCoord(x, y) {
    return (x & 0x3F) | ((y & 0x3F) << 6);
}

function unpackCoord(packedCoord) {
    return {
        x: packedCoord & 0x3F,
        y: (packedCoord >>> 6) & 0x3F
    };
}

// 16-bit MongoDB Hex String to Integer Compressor (0 to 65535)
const ID_TO_INT = new Map();
const INT_TO_ID = [''];
let nextIntId = 1;

function resetIdDictionary() {
    ID_TO_INT.clear();
    INT_TO_ID.length = 1;
    INT_TO_ID[0] = '';
    nextIntId = 1;
}

function getOrCreateIntId(strId) {
    if (!strId || typeof strId !== 'string') return 0;
    let id = ID_TO_INT.get(strId);
    if (id === undefined) {
        id = nextIntId++;
        if (nextIntId > 65535) nextIntId = 1; // 16-bit wrap guard
        ID_TO_INT.set(strId, id);
        INT_TO_ID[id] = strId;
    }
    return id;
}

function getStrId(intId) {
    if (!intId || intId <= 0) return null;
    return INT_TO_ID[intId] || null;
}

// Populates an Int16Array(2500) with zero-GC threat values around hostile creeps without an artificial ceiling
function populateThreatField(threatField, hostiles) {
    if (!threatField) return;
    threatField.fill(0);
    if (!hostiles || hostiles.length === 0) return;
    const rangedType = (typeof RANGED_ATTACK !== 'undefined') ? RANGED_ATTACK : 'ranged_attack';

    for (let i = 0; i < hostiles.length; i++) {
        const h = hostiles[i];
        if (!h || !h.pos) continue;
        const hasRanged = h.getActiveBodyparts && h.getActiveBodyparts(rangedType) > 0;
        const mult = hasRanged ? 2 : 1;
        const hx = h.pos.x;
        const hy = h.pos.y;

        for (let dx = -3; dx <= 3; dx++) {
            const x = hx + dx;
            if (x < 0 || x > 49) continue;
            for (let dy = -3; dy <= 3; dy++) {
                const y = hy + dy;
                if (y < 0 || y > 49) continue;
                const d = Math.max(Math.abs(dx), Math.abs(dy));
                let threat = 0;
                if (d === 0) threat = 10 * mult;
                else if (d === 1) threat = 8 * mult;
                else if (d === 2) threat = 5 * mult;
                else if (d === 3) threat = 2 * mult;

                threatField[x * 50 + y] += threat;
            }
        }
    }
}

// O(1) 9-tile vector evaluator: selects the optimal Range-3 kite tile while avoiding border pins
function hasSlowMoveRatio(creep) {
    if (!creep || !Array.isArray(creep.body) || creep.body.length === 0) return false;
    let moveCount = 0;
    let otherCount = 0;
    const moveConst = (typeof MOVE !== 'undefined') ? MOVE : 'move';
    for (let i = 0; i < creep.body.length; i++) {
        const part = creep.body[i];
        if (!part || part.hits === 0) continue;
        if (part.type === moveConst) moveCount++;
        else otherCount++;
    }
    return moveCount < otherCount;
}

function evaluateKiteTile(creep, target, threatField, terrain, matrix, roadGrid) {
    if (!creep || !target || !target.pos) return null;
    const cx = creep.pos.x;
    const cy = creep.pos.y;
    const tx = target.pos.x;
    const ty = target.pos.y;
    const wallMask = (typeof TERRAIN_MASK_WALL !== 'undefined') ? TERRAIN_MASK_WALL : 1;
    const swampMask = (typeof TERRAIN_MASK_SWAMP !== 'undefined') ? TERRAIN_MASK_SWAMP : 2;
    const rGrid = roadGrid || (typeof global !== 'undefined' && global.heap && global.heap.rooms &&
        global.heap.rooms[creep.pos.roomName] ? global.heap.rooms[creep.pos.roomName].roadGrid : null);
    const swampWeight = hasSlowMoveRatio(creep) ? 60 : 35;

    let bestTile = null;
    let lowestCost = Infinity;

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (nx < 0 || nx > 49 || ny < 0 || ny > 49) continue;

            // Strict Room Edge Pin Avoidance: Never step onto border tiles (0/49) unless intentional flee
            if (nx === 0 || nx === 49 || ny === 0 || ny === 49) continue;

            const terr = (terrain && terrain.get) ? terrain.get(nx, ny) : 0;
            if ((terr & wallMask) !== 0 && terr === wallMask) continue;
            if (matrix && matrix.get && matrix.get(nx, ny) === 255) continue;

            const idx = nx * 50 + ny;
            const threat = threatField ? threatField[idx] : 0;
            const d = Math.max(Math.abs(nx - tx), Math.abs(ny - ty));

            // Range 3 is the ideal sweet spot for ranged kiting
            let rangePenalty = 0;
            if (d < 3) {
                rangePenalty = (3 - d) * 40; // Heavy penalty for closing distance
            } else if (d > 3) {
                rangePenalty = (d - 3) * 15; // Mild penalty for falling too far back
            }

            // Exit pin penalty: discourage getting within 2 tiles of room border
            const distToBorder = Math.min(nx, 49 - nx, ny, 49 - ny);
            const exitPinPenalty = distToBorder <= 2 ? (3 - distToBorder) * 30 : 0;

            const isRoad = !!(rGrid && rGrid[idx] === 1);
            const isSwamp = !isRoad && ((terr & swampMask) !== 0);
            const terrainPenalty = isRoad ? -2 : (isSwamp ? swampWeight : 0);

            const cost = (threat * 20) + rangePenalty + exitPinPenalty + terrainPenalty;

            if (cost < lowestCost) {
                lowestCost = cost;
                bestTile = { x: nx, y: ny, roomName: creep.pos.roomName };
            }
        }
    }

    return bestTile;
}

// Net-DPS Alpha-Strike Target Scorer: accounts for target hits, bodyparts, and incoming local healing
function calculateKillScore(target, ourRangedDmg, nearbyHealers) {
    if (!target) return -Infinity;
    let score = 1000 - ((target.hits || 0) * 0.1);
    const healType = (typeof HEAL !== 'undefined') ? HEAL : 'heal';
    const attackType = (typeof ATTACK !== 'undefined') ? ATTACK : 'attack';
    const rangedType = (typeof RANGED_ATTACK !== 'undefined') ? RANGED_ATTACK : 'ranged_attack';

    if (target.getActiveBodyparts) {
        if (target.getActiveBodyparts(healType) > 0) score += 1000;
        if (target.getActiveBodyparts(attackType) > 0 || target.getActiveBodyparts(rangedType) > 0) score += 500;
    }

    // Alpha-Strike Vulnerability Evaluation:
    let incomingHealing = 0;
    if (target.getActiveBodyparts) {
        incomingHealing += (target.getActiveBodyparts(healType) * 12);
    }
    if (nearbyHealers && nearbyHealers.length > 0) {
        for (let i = 0; i < nearbyHealers.length; i++) {
            const h = nearbyHealers[i];
            if (!h || h.id === target.id) continue;
            const hd = calcDistance(target.pos, h.pos);
            const healParts = h.getActiveBodyparts ? h.getActiveBodyparts(healType) : 0;
            if (hd <= 1) incomingHealing += healParts * 12;
            else if (hd <= 3) incomingHealing += healParts * 4;
        }
    }

    const effectiveHits = (target.hits || 0) + incomingHealing;
    if (ourRangedDmg && effectiveHits <= ourRangedDmg) {
        score += 2000; // Instant 1-tick deletion guaranteed!
    }

    return score;
}

module.exports = {
    profCount,
    profLap,
    roomCenterPos,
    BODY_COSTS,
    REACTION_RECIPES,
    calcDistance,
    getDirectionTo,
    getRivalSafeModeRemaining,
    SEGMENT_BASE_PLAN,
    GRID_EMPTY,
    GRID_ROAD,
    GRID_SPAWN,
    GRID_EXTENSION,
    GRID_TOWER,
    GRID_STORAGE,
    GRID_TERMINAL,
    GRID_CONTAINER,
    GRID_LINK,
    GRID_LAB_SUPPLIER,
    GRID_LAB_REACTOR,
    GRID_FACTORY,
    GRID_POWER_SPAWN,
    GRID_NUKER,
    GRID_OBSERVER,
    GRID_EXTRACTOR,
    GRID_WALL,
    // Bit-Packing & ID Compression
    packPos,
    unpackPos,
    packCoord,
    unpackCoord,
    getRoomNameHash,
    getRoomNameFromHash,
    resetRoomHashDictionary,
    getOrCreateIntId,
    getStrId,
    resetIdDictionary,
    // Tactical Combat Micro & Threat Field
    populateThreatField,
    evaluateKiteTile,
    hasSlowMoveRatio,
    calculateKillScore
};
