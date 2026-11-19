// src/bunker.js
// Dynamic Topological Base Planner (Fast-Filler Core, Command Hub, Lab Complex, Extension Pods, Towers, Dijkstra Roads)
// Zero-OOP Flat Functional Architecture, TypedArray Queues, Base36 RLE Serialization (RawMemory Segment 1)

const {
    calcDistance,
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
    GRID_WALL
} = require('./constants');

const {
    getAllStructures,
    getStaticTerrainBytes,
    isRemoteExcluded,
    markMemoryDirty,
    registerTaskHandler,
    requestSegment,
    getSegmentData,
    scheduleTask,
    setSegmentData
} = require('./state');

// Screeps constant fallbacks for offline testing
const S_SPAWN       = typeof STRUCTURE_SPAWN !== 'undefined' ? STRUCTURE_SPAWN : 'spawn';
const S_EXTENSION   = typeof STRUCTURE_EXTENSION !== 'undefined' ? STRUCTURE_EXTENSION : 'extension';
const S_CONTAINER   = typeof STRUCTURE_CONTAINER !== 'undefined' ? STRUCTURE_CONTAINER : 'container';
const S_TOWER       = typeof STRUCTURE_TOWER !== 'undefined' ? STRUCTURE_TOWER : 'tower';
const S_STORAGE     = typeof STRUCTURE_STORAGE !== 'undefined' ? STRUCTURE_STORAGE : 'storage';
const S_TERMINAL    = typeof STRUCTURE_TERMINAL !== 'undefined' ? STRUCTURE_TERMINAL : 'terminal';
const S_LINK        = typeof STRUCTURE_LINK !== 'undefined' ? STRUCTURE_LINK : 'link';
const S_LAB         = typeof STRUCTURE_LAB !== 'undefined' ? STRUCTURE_LAB : 'lab';
const S_FACTORY     = typeof STRUCTURE_FACTORY !== 'undefined' ? STRUCTURE_FACTORY : 'factory';
const S_POWER_SPAWN = typeof STRUCTURE_POWER_SPAWN !== 'undefined' ? STRUCTURE_POWER_SPAWN : 'powerSpawn';
const S_NUKER       = typeof STRUCTURE_NUKER !== 'undefined' ? STRUCTURE_NUKER : 'nuker';
const S_OBSERVER    = typeof STRUCTURE_OBSERVER !== 'undefined' ? STRUCTURE_OBSERVER : 'observer';
const S_EXTRACTOR   = typeof STRUCTURE_EXTRACTOR !== 'undefined' ? STRUCTURE_EXTRACTOR : 'extractor';
const S_ROAD        = typeof STRUCTURE_ROAD !== 'undefined' ? STRUCTURE_ROAD : 'road';
const S_RAMPART     = typeof STRUCTURE_RAMPART !== 'undefined' ? STRUCTURE_RAMPART : 'rampart';
const BLUEPRINT_VERSION = 5;

const BLUEPRINT_CACHE = new Map();

// --- 1. BASE36 RUN-LENGTH ENCODING (RLE) SERIALIZATION ---

/**
 * Compresses a 2500-byte room grid using Base36 Run-Length Encoding (RLE).
 * Values 0-15 map to 'A'-'P'. 255 (Walls) maps to 'Z'.
 * Format: [countBase36][ValueChar] -> "1aZ" = 46 walls.
 * Executes in < 0.1 CPU with zero object allocations.
 */
function serializeBaseGrid(grid) {
    let out = '';
    let count = 1;
    let current = grid[0];
    
    for (let i = 1; i < 2500; i++) {
        if (grid[i] === current) {
            count++;
        } else {
            const char = current === 255 ? 'Z' : String.fromCharCode(65 + current);
            out += count.toString(36) + char;
            current = grid[i];
            count = 1;
        }
    }
    const char = current === 255 ? 'Z' : String.fromCharCode(65 + current);
    out += count.toString(36) + char;
    return out;
}

/**
 * Decompresses the Base36 RLE string back into the provided Uint8Array.
 * Executes in < 0.05 CPU.
 */
function deserializeBaseGrid(str, grid) {
    let idx = 0;
    let numStr = '';
    
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char >= 'A' && char <= 'Z') {
            const count = parseInt(numStr, 36);
            const val = char === 'Z' ? 255 : char.charCodeAt(0) - 65;
            grid.fill(val, idx, idx + count);
            idx += count;
            numStr = '';
        } else {
            numStr += char;
        }
    }
}

// --- 2. BREADTH-FIRST SEARCH (BFS) MODULE GRAFTING ENGINE ---

/**
 * Expands BFS search by pushing 4 cardinal neighbors into queue.
 */
function expandBFS(cx, cy, idx, queue, visited, DIRS, tail) {
    for (let d = 0; d < 4; d++) {
        const nIdx = idx + DIRS[d];
        const nx = nIdx % 50;
        const ny = Math.floor(nIdx / 50);
        if (nx < 2 || nx > 47 || ny < 2 || ny > 47) continue;
        if (visited[nIdx] === 0) {
            visited[nIdx] = 1;
            queue[tail++] = nIdx;
        }
    }
    return tail;
}

function isTerrainWall(terrain, x, y) {
    if (!terrain) return false;
    if (typeof terrain.get === 'function') {
        return (terrain.get(x, y) & 1) > 0;
    }
    if (typeof terrain === 'string') {
        return (Number(terrain.charAt(y * 50 + x)) & 1) > 0;
    }
    return false;
}

/**
 * 2D Breadth-First Search (BFS) to organically graft a module stamp onto the nearest valid terrain clearing.
 * Uses a flat Uint16Array for the queue to guarantee zero GC spikes.
 * 
 * @param {Uint8Array} baseGrid - 2500-length array of the current room topological layout.
 * @param {RoomTerrain|string} terrain - Native Screeps terrain object or terrain string.
 * @param {Uint16Array} queue - Pre-populated queue containing perimeter indices.
 * @param {number} initialTail - Current length of the populated queue.
 * @param {Array} stamp - Array of {dx, dy, typeId} defining the module.
 * @returns {Object|null} { origin: { x, y }, newTail } or null if failed.
 */
function graftModuleBFS(baseGrid, terrain, queue, initialTail, stamp) {
    const visited = new Uint8Array(2500);
    let head = 0;
    let tail = initialTail;
    
    // Seed visited mask from the initial queue
    for (let i = 0; i < tail; i++) {
        visited[queue[i]] = 1;
    }

    const DIRS = [-50, 50, -1, 1]; // North, South, West, East

    // Dynamic bounding box of stamp
    let minDx = 0, maxDx = 0, minDy = 0, maxDy = 0;
    for (let i = 0; i < stamp.length; i++) {
        if (stamp[i].dx < minDx) minDx = stamp[i].dx;
        if (stamp[i].dx > maxDx) maxDx = stamp[i].dx;
        if (stamp[i].dy < minDy) minDy = stamp[i].dy;
        if (stamp[i].dy > maxDy) maxDy = stamp[i].dy;
    }

    while (head < tail) {
        const idx = queue[head++];
        const cx = idx % 50;
        const cy = Math.floor(idx / 50);

        // Bound check: keep modules strictly inside buildable area (2..47)
        if (cx + minDx < 2 || cx + maxDx > 47 || cy + minDy < 2 || cy + maxDy > 47) {
            tail = expandBFS(cx, cy, idx, queue, visited, DIRS, tail);
            continue;
        }

        // Validate clearing: check terrain and existing structures
        let isClear = true;
        for (let sx = cx + minDx; sx <= cx + maxDx; sx++) {
            for (let sy = cy + minDy; sy <= cy + maxDy; sy++) {
                if (isTerrainWall(terrain, sx, sy) || baseGrid[sy * 50 + sx] !== GRID_EMPTY) {
                    isClear = false;
                    break;
                }
            }
            if (!isClear) break;
        }

        // Module successfully grafted!
        if (isClear) {
            for (let i = 0; i < stamp.length; i++) {
                const st = stamp[i];
                baseGrid[(cy + st.dy) * 50 + (cx + st.dx)] = st.typeId;
            }
            return { origin: { x: cx, y: cy }, newTail: tail };
        }

        tail = expandBFS(cx, cy, idx, queue, visited, DIRS, tail);
    }
    
    return null;
}

// --- 3. MODULE STAMPS ---

// Fast Filler Stamp: 5x5 core (3 spawns, 2 containers, 1 center link, 15 extensions) + 20 perimeter roads.
// Internal filler spots (±1, ±1) remain walkable GRID_EMPTY tiles inside Core 5x5.
const FAST_FILLER_STAMP = [
    // Spawns (3)
    { typeId: GRID_SPAWN,     dx: -2, dy: -1, type: S_SPAWN },
    { typeId: GRID_SPAWN,     dx:  2, dy: -1, type: S_SPAWN },
    { typeId: GRID_SPAWN,     dx:  0, dy:  2, type: S_SPAWN },
    // Containers (2)
    { typeId: GRID_CONTAINER, dx: -2, dy:  0, type: S_CONTAINER },
    { typeId: GRID_CONTAINER, dx:  2, dy:  0, type: S_CONTAINER },
    // Center Link (1)
    { typeId: GRID_LINK,      dx:  0, dy:  0, type: S_LINK },
    // Extensions (15)
    { typeId: GRID_EXTENSION, dx: -2, dy: -2, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx: -1, dy: -2, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx:  0, dy: -2, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx:  1, dy: -2, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx:  2, dy: -2, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx:  0, dy: -1, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx: -1, dy:  0, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx:  1, dy:  0, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx: -2, dy:  1, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx:  0, dy:  1, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx:  2, dy:  1, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx: -2, dy:  2, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx: -1, dy:  2, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx:  1, dy:  2, type: S_EXTENSION },
    { typeId: GRID_EXTENSION, dx:  2, dy:  2, type: S_EXTENSION },
    // Perimeter Roads (20): (-2,-3)..(2,-3), (-2,3)..(2,3), (-3,-2)..(-3,2), (3,-2)..(3,2)
    { typeId: GRID_ROAD,      dx: -2, dy: -3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx: -1, dy: -3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  0, dy: -3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  1, dy: -3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  2, dy: -3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx: -2, dy:  3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx: -1, dy:  3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  0, dy:  3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  1, dy:  3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  2, dy:  3, type: S_ROAD },
    { typeId: GRID_ROAD,      dx: -3, dy: -2, type: S_ROAD },
    { typeId: GRID_ROAD,      dx: -3, dy: -1, type: S_ROAD },
    { typeId: GRID_ROAD,      dx: -3, dy:  0, type: S_ROAD },
    { typeId: GRID_ROAD,      dx: -3, dy:  1, type: S_ROAD },
    { typeId: GRID_ROAD,      dx: -3, dy:  2, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  3, dy: -2, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  3, dy: -1, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  3, dy:  0, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  3, dy:  1, type: S_ROAD },
    { typeId: GRID_ROAD,      dx:  3, dy:  2, type: S_ROAD }
];

const FAST_FILLER_POSITIONS = [
    { dx: -1, dy: -1 }, // Slot 0: Top-Left
    { dx: 1, dy: -1 },  // Slot 1: Top-Right
    { dx: -1, dy: 1 },  // Slot 2: Bottom-Left
    { dx: 1, dy: 1 }    // Slot 3: Bottom-Right
];

// Command Hub 2x3 C-Shape (Origin = Hub Creep Standing Tile (0,0), rotatable 0/90/180/270 deg)
const COMMAND_HUB_STAMP = [
    { typeId: GRID_ROAD,     dx:  0, dy:  0, rcl: 4 },
    { typeId: GRID_STORAGE,  dx: -1, dy: -1, rcl: 4 },
    { typeId: GRID_TERMINAL, dx: -1, dy:  0, rcl: 6 },
    { typeId: GRID_LINK,     dx: -1, dy:  1, rcl: 5 },
    { typeId: GRID_FACTORY,  dx:  0, dy:  1, rcl: 7 },
    { typeId: GRID_NUKER,    dx:  0, dy: -1, rcl: 8 }
];

// Infinity / Figure-8 Lab Complex (4x4, Origin = (0,0), Mirrorable; 2 Suppliers reach all 8 Reactors <= range 2)
const LAB_COMPLEX_STAMP = [
    // Supplier Labs (2)
    { typeId: GRID_LAB_SUPPLIER, dx:  0, dy:  0, rcl: 6 },
    { typeId: GRID_LAB_SUPPLIER, dx:  1, dy:  1, rcl: 6 },
    // Reaction Labs (8)
    { typeId: GRID_LAB_REACTOR,  dx:  0, dy: -1, rcl: 6 },
    { typeId: GRID_LAB_REACTOR,  dx:  1, dy: -1, rcl: 7 },
    { typeId: GRID_LAB_REACTOR,  dx: -1, dy:  0, rcl: 7 },
    { typeId: GRID_LAB_REACTOR,  dx: -1, dy:  1, rcl: 7 },
    { typeId: GRID_LAB_REACTOR,  dx:  1, dy:  2, rcl: 8 },
    { typeId: GRID_LAB_REACTOR,  dx:  0, dy:  2, rcl: 8 },
    { typeId: GRID_LAB_REACTOR,  dx:  2, dy:  1, rcl: 8 },
    { typeId: GRID_LAB_REACTOR,  dx:  2, dy:  0, rcl: 8 },
    // Hallway Roads (4)
    { typeId: GRID_ROAD,         dx:  0, dy:  1, rcl: 6 },
    { typeId: GRID_ROAD,         dx:  1, dy:  0, rcl: 6 },
    { typeId: GRID_ROAD,         dx:  2, dy: -1, rcl: 6 },
    { typeId: GRID_ROAD,         dx: -1, dy:  2, rcl: 6 }
];

// Extension Plus-Sign Stamp (5 Extensions + 8 Diamond Perimeter Roads, Origin = Center (0,0))
const EXTENSION_PLUS_STAMP = [
    // Extensions (5)
    { typeId: GRID_EXTENSION, dx:  0, dy:  0 },
    { typeId: GRID_EXTENSION, dx: -1, dy:  0 },
    { typeId: GRID_EXTENSION, dx:  1, dy:  0 },
    { typeId: GRID_EXTENSION, dx:  0, dy: -1 },
    { typeId: GRID_EXTENSION, dx:  0, dy:  1 },
    // Diamond Roads (8)
    { typeId: GRID_ROAD,      dx: -2, dy:  0 },
    { typeId: GRID_ROAD,      dx: -1, dy:  1 },
    { typeId: GRID_ROAD,      dx:  0, dy:  2 },
    { typeId: GRID_ROAD,      dx:  1, dy:  1 },
    { typeId: GRID_ROAD,      dx:  2, dy:  0 },
    { typeId: GRID_ROAD,      dx:  1, dy: -1 },
    { typeId: GRID_ROAD,      dx:  0, dy: -2 },
    { typeId: GRID_ROAD,      dx: -1, dy: -1 }
];

// --- 4. TOPOLOGICAL SOLVER & DISTANCE TRANSFORM ---

/**
 * 2-pass Chebyshev Distance Transform evaluating distance to walls and room edges.
 */
function computeDistanceTransform(terrain) {
    const dt = new Uint8Array(2500);
    for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
            const isWall = isTerrainWall(terrain, x, y) || x <= 4 || y <= 4 || x >= 45 || y >= 45;
            dt[y * 50 + x] = isWall ? 0 : 255;
        }
    }
    for (let y = 1; y < 49; y++) {
        for (let x = 1; x < 49; x++) {
            const idx = y * 50 + x;
            if (dt[idx] > 0) {
                dt[idx] = Math.min(
                    dt[idx - 50],
                    dt[idx - 1],
                    dt[idx - 51],
                    dt[idx - 49]
                ) + 1;
            }
        }
    }
    for (let y = 48; y >= 1; y--) {
        for (let x = 48; x >= 1; x--) {
            const idx = y * 50 + x;
            if (dt[idx] > 0) {
                dt[idx] = Math.min(
                    dt[idx],
                    Math.min(
                        dt[idx + 50],
                        dt[idx + 1],
                        dt[idx + 51],
                        dt[idx + 49]
                    ) + 1
                );
            }
        }
    }
    return dt;
}

/**
 * 2-pass Chebyshev Distance Transform computing distance from every tile to nearest open room exit.
 */
function computeExitDistanceGrid(terrain) {
    const exitDist = new Uint8Array(2500);
    exitDist.fill(50);
    let hasExit = false;

    for (let i = 0; i < 50; i++) {
        const edges = [
            [i, 0], [i, 49], [0, i], [49, i]
        ];
        for (let e = 0; e < 4; e++) {
            const ex = edges[e][0];
            const ey = edges[e][1];
            if (!isTerrainWall(terrain, ex, ey)) {
                exitDist[ey * 50 + ex] = 0;
                hasExit = true;
            }
        }
    }
    if (!hasExit) return exitDist;

    for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
            const idx = y * 50 + x;
            if (exitDist[idx] === 0) continue;
            let m = exitDist[idx];
            if (y > 0) m = Math.min(m, exitDist[idx - 50] + 1);
            if (x > 0) m = Math.min(m, exitDist[idx - 1] + 1);
            if (y > 0 && x > 0) m = Math.min(m, exitDist[idx - 51] + 1);
            if (y > 0 && x < 49) m = Math.min(m, exitDist[idx - 49] + 1);
            exitDist[idx] = m;
        }
    }
    for (let y = 49; y >= 0; y--) {
        for (let x = 49; x >= 0; x--) {
            const idx = y * 50 + x;
            if (exitDist[idx] === 0) continue;
            let m = exitDist[idx];
            if (y < 49) m = Math.min(m, exitDist[idx + 50] + 1);
            if (x < 49) m = Math.min(m, exitDist[idx + 1] + 1);
            if (y < 49 && x < 49) m = Math.min(m, exitDist[idx + 51] + 1);
            if (y < 49 && x > 0) m = Math.min(m, exitDist[idx + 49] + 1);
            exitDist[idx] = m;
        }
    }
    return exitDist;
}

/**
 * Locates the optimal anchor for the Citadel, balancing distance to walls, exit standoff, and POIs.
 */
function findOptimalAnchor(roomOrName, terrain, poiList) {
    const rName = typeof roomOrName === 'string' ? roomOrName : (roomOrName && roomOrName.name);
    const exitDist = computeExitDistanceGrid(terrain);
    if (rName && typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[rName] && Memory.rooms[rName].anchor) {
        const cached = Memory.rooms[rName].anchor;
        if (cached && cached.x >= 5 && cached.x <= 44 && cached.y >= 5 && cached.y <= 44 && exitDist[cached.y * 50 + cached.x] >= 7) {
            return cached;
        }
    }

    const dt = computeDistanceTransform(terrain);
    let bestScore = -Infinity;
    let bestAnchor = { x: 25, y: 25 };

    const pois = (poiList && poiList.length > 0) ? poiList : [{ x: 25, y: 25 }];

    for (let y = 6; y <= 43; y++) {
        for (let x = 6; x <= 43; x++) {
            const val = dt[y * 50 + x];
            if (val < 3) continue;
            if (exitDist[y * 50 + x] < 7) continue;

            let score = val * 20;

            let totalDist = 0;
            for (let i = 0; i < pois.length; i++) {
                const poi = pois[i];
                totalDist += Math.max(Math.abs(x - poi.x), Math.abs(y - poi.y));
            }
            score -= (totalDist / pois.length) * 3;

            // Parity bonus
            if ((x + y) % 2 === 0) score += 2;

            if (score > bestScore) {
                bestScore = score;
                bestAnchor = { x, y };
            }
        }
    }

    if (rName && typeof Memory !== 'undefined') {
        if (!Memory.rooms) Memory.rooms = {};
        if (!Memory.rooms[rName]) Memory.rooms[rName] = {};
        Memory.rooms[rName].anchor = bestAnchor;
    }

    return bestAnchor;
}

// Backwards-compatible findAnchor
function findAnchor(room, terrain) {
    return findOptimalAnchor(room, terrain, null);
}

// --- 5. ZERO-GC SPFA MAIN-NETWORK ROAD WIRING & HUB/STAMP VALIDATORS ---

const HUB_ROT_DIRS = [
    { dx: 1, dy: 0 },   // 0 deg: open mouth faces East (+1, 0)
    { dx: 0, dy: 1 },   // 90 deg: open mouth faces South (0, +1)
    { dx: -1, dy: 0 },  // 180 deg: open mouth faces West (-1, 0)
    { dx: 0, dy: -1 }   // 270 deg: open mouth faces North (0, -1)
];

function rotateOffset(dx, dy, rot) {
    if (rot === 1) return { dx: -dy, dy: dx };
    if (rot === 2) return { dx: -dx, dy: -dy };
    if (rot === 3) return { dx: dy, dy: -dx };
    return { dx, dy };
}

function isInsideCore5x5(x, y, anchor) {
    return !!(anchor && Math.abs(x - anchor.x) <= 2 && Math.abs(y - anchor.y) <= 2);
}

function isReservedTile(terrain, anchor, x, y, exitDist, allowRoad) {
    if (allowRoad) {
        if (x < 2 || x > 47 || y < 2 || y > 47) return true;
        if (exitDist && exitDist[y * 50 + x] < 4) return true;
    } else {
        if (x < 3 || x > 46 || y < 3 || y > 46) return true;
        if (exitDist && exitDist[y * 50 + x] < 5) return true;
    }
    if (isTerrainWall(terrain, x, y)) return true;
    return isInsideCore5x5(x, y, anchor);
}

function hasAdjacentGridRoad(baseGrid, x, y) {
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const rx = x + dx;
            const ry = y + dy;
            if (rx >= 1 && rx <= 48 && ry >= 1 && ry <= 48 && baseGrid[ry * 50 + rx] === GRID_ROAD) {
                return true;
            }
        }
    }
    return false;
}

function computeMainRoadMask(baseGrid, anchor) {
    const mask = new Uint8Array(2500);
    const q = new Uint16Array(2500);
    let head = 0;
    let tail = 0;

    if (anchor) {
        for (let dx = -3; dx <= 3; dx++) {
            for (let dy = -3; dy <= 3; dy++) {
                if (Math.abs(dx) !== 3 && Math.abs(dy) !== 3) continue;
                const px = anchor.x + dx;
                const py = anchor.y + dy;
                if (px < 1 || px > 48 || py < 1 || py > 48) continue;
                const idx = py * 50 + px;
                if (baseGrid[idx] === GRID_ROAD && mask[idx] === 0) {
                    mask[idx] = 1;
                    q[tail++] = idx;
                }
            }
        }
    }

    if (tail === 0) {
        for (let i = 0; i < 2500; i++) {
            if (baseGrid[i] === GRID_ROAD) {
                mask[i] = 1;
                q[tail++] = i;
                break;
            }
        }
    }

    const dirs = [-50, 50, -1, 1, -51, -49, 51, 49];
    while (head < tail) {
        const curr = q[head++];
        const cx = curr % 50;
        for (let d = 0; d < 8; d++) {
            const nIdx = curr + dirs[d];
            if (nIdx < 50 || nIdx >= 2450) continue;
            const nx = nIdx % 50;
            if (Math.abs(nx - cx) > 1 || nx < 1 || nx > 48) continue;
            if (mask[nIdx] === 0 && baseGrid[nIdx] === GRID_ROAD) {
                mask[nIdx] = 1;
                q[tail++] = nIdx;
            }
        }
    }
    return mask;
}

function connectToMainRoadNetwork(baseGrid, terrain, anchor, targetPos) {
    if (!targetPos) return;
    if (targetPos.x < 1 || targetPos.x > 48 || targetPos.y < 1 || targetPos.y > 48) return;

    const mainMask = computeMainRoadMask(baseGrid, anchor);
    const targetIdx = targetPos.y * 50 + targetPos.x;
    if (mainMask[targetIdx] === 1) return;

    const distMap = new Uint16Array(2500).fill(65535);
    const parentMap = new Int16Array(2500).fill(-1);
    const inQueue = new Uint8Array(2500);
    const q = new Int32Array(4096);
    let head = 0;
    let tail = 0;

    for (let i = 0; i < 2500; i++) {
        if (mainMask[i] === 1) {
            distMap[i] = 0;
            q[tail] = i;
            tail = (tail + 1) & 4095;
            inQueue[i] = 1;
        }
    }
    if (head === tail) return;

    const dirs = [-50, 50, -1, 1, -51, -49, 51, 49];
    while (head !== tail) {
        const curr = q[head];
        head = (head + 1) & 4095;
        inQueue[curr] = 0;

        const cDist = distMap[curr];
        if (cDist >= distMap[targetIdx]) continue;

        const cx = curr % 50;
        for (let d = 0; d < 8; d++) {
            const nIdx = curr + dirs[d];
            if (nIdx < 50 || nIdx >= 2450) continue;
            const nx = nIdx % 50;
            const ny = (nIdx / 50) | 0;
            if (Math.abs(nx - cx) > 1 || nx < 1 || nx > 48 || ny < 1 || ny > 48) continue;

            if (nIdx !== targetIdx && isTerrainWall(terrain, nx, ny)) continue;
            if (nIdx !== targetIdx && isInsideCore5x5(nx, ny, anchor)) continue;

            const curVal = baseGrid[nIdx];
            if (nIdx !== targetIdx && curVal !== GRID_EMPTY && curVal !== GRID_ROAD && curVal !== GRID_CONTAINER) continue;

            const isSwamp = (terrain && terrain.get ? terrain.get(nx, ny) === 2 : false);
            const stepCost = curVal === GRID_ROAD ? 1 : (isSwamp ? 20 : 8);
            const newDist = cDist + stepCost;

            if (newDist < distMap[nIdx] && newDist < distMap[targetIdx]) {
                distMap[nIdx] = newDist;
                parentMap[nIdx] = curr;
                if (nIdx !== targetIdx && !inQueue[nIdx]) {
                    q[tail] = nIdx;
                    tail = (tail + 1) & 4095;
                    inQueue[nIdx] = 1;
                }
            }
        }
    }

    let curr = parentMap[targetIdx];
    while (curr !== -1) {
        if (baseGrid[curr] === GRID_EMPTY) {
            baseGrid[curr] = GRID_ROAD;
        }
        curr = parentMap[curr];
    }
}

function hubCanReachRoad(baseGrid, terrain, anchor, hubOrigin, blockSet) {
    if (!hubOrigin) return true;
    const hubIdx = hubOrigin.y * 50 + hubOrigin.x;
    if (blockSet && blockSet.has(hubIdx)) return false;

    const mainMask = computeMainRoadMask(baseGrid, anchor);
    const visited = new Uint8Array(2500);
    const q = new Uint16Array(2500);
    let head = 0;
    let tail = 0;
    visited[hubIdx] = 1;
    q[tail++] = hubIdx;

    const dirs = [-50, 50, -1, 1, -51, -49, 51, 49];
    let steps = 0;
    while (head < tail && steps < 400) {
        steps++;
        const curr = q[head++];
        if (curr !== hubIdx && mainMask[curr] === 1) return true;
        const cx = curr % 50;
        for (let d = 0; d < 8; d++) {
            const nIdx = curr + dirs[d];
            if (nIdx < 50 || nIdx >= 2450 || visited[nIdx]) continue;
            const nx = nIdx % 50;
            const ny = (nIdx / 50) | 0;
            if (Math.abs(nx - cx) > 1 || nx < 2 || nx > 47 || ny < 2 || ny > 47) continue;
            if (blockSet && blockSet.has(nIdx)) continue;
            if (isTerrainWall(terrain, nx, ny) || isInsideCore5x5(nx, ny, anchor)) continue;
            const v = baseGrid[nIdx];
            if (v !== GRID_EMPTY && v !== GRID_ROAD) continue;
            visited[nIdx] = 1;
            q[tail++] = nIdx;
        }
    }
    return false;
}

function computeWalkDistancesFrom(baseGrid, terrain, anchor, seedPoints) {
    const dist = new Uint16Array(2500).fill(65535);
    const q = new Uint16Array(2500);
    let head = 0;
    let tail = 0;

    for (let i = 0; i < seedPoints.length; i++) {
        const sp = seedPoints[i];
        if (!sp || sp.x < 2 || sp.x > 47 || sp.y < 2 || sp.y > 47) continue;
        if (isTerrainWall(terrain, sp.x, sp.y) || isInsideCore5x5(sp.x, sp.y, anchor)) continue;
        const idx = sp.y * 50 + sp.x;
        if (dist[idx] === 65535) {
            dist[idx] = 0;
            q[tail++] = idx;
        }
    }

    const dirs = [-50, 50, -1, 1, -51, -49, 51, 49];
    while (head < tail) {
        const curr = q[head++];
        const cx = curr % 50;
        const nextD = dist[curr] + 1;
        for (let d = 0; d < 8; d++) {
            const nIdx = curr + dirs[d];
            if (nIdx < 100 || nIdx >= 2400) continue;
            const nx = nIdx % 50;
            const ny = (nIdx / 50) | 0;
            if (Math.abs(nx - cx) > 1 || nx < 2 || nx > 47 || ny < 2 || ny > 47) continue;
            if (dist[nIdx] <= nextD) continue;
            if (isTerrainWall(terrain, nx, ny) || isInsideCore5x5(nx, ny, anchor)) continue;
            const val = baseGrid[nIdx];
            if (val !== GRID_EMPTY && val !== GRID_ROAD) continue;
            dist[nIdx] = nextD;
            q[tail++] = nIdx;
        }
    }
    return dist;
}

function graftCommandHubBFS(baseGrid, terrain, anchor, roomState, exitDist) {
    const seeds = [];
    for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
            if (Math.abs(dx) === 3 || Math.abs(dy) === 3) {
                seeds.push({ x: anchor.x + dx, y: anchor.y + dy });
            }
        }
    }
    const walkDist = computeWalkDistancesFrom(baseGrid, terrain, anchor, seeds);

    function validateHubCandidate(cx, cy, rot) {
        const openDir = HUB_ROT_DIRS[rot];
        const mouthX = cx + openDir.dx;
        const mouthY = cy + openDir.dy;
        if (isReservedTile(terrain, anchor, mouthX, mouthY, exitDist, true)) return null;
        const mouthVal = baseGrid[mouthY * 50 + mouthX];
        if (mouthVal !== GRID_EMPTY && mouthVal !== GRID_ROAD) return null;

        for (let i = 0; i < COMMAND_HUB_STAMP.length; i++) {
            const st = COMMAND_HUB_STAMP[i];
            const r = rotateOffset(st.dx, st.dy, rot);
            const px = cx + r.dx;
            const py = cy + r.dy;
            const isRoad = st.typeId === GRID_ROAD;
            if (isReservedTile(terrain, anchor, px, py, exitDist, isRoad)) return null;
            const cur = baseGrid[py * 50 + px];
            if (isRoad) {
                if (cur !== GRID_EMPTY && cur !== GRID_ROAD) return null;
            } else if (cur !== GRID_EMPTY) {
                return null;
            }
        }

        const cDist = Math.max(Math.abs(cx - anchor.x), Math.abs(cy - anchor.y));
        const facesCore = (openDir.dx * (anchor.x - cx) + openDir.dy * (anchor.y - cy)) > 0 ? 1 : 0;
        const touchesRoad = (hasAdjacentGridRoad(baseGrid, cx, cy) || hasAdjacentGridRoad(baseGrid, mouthX, mouthY)) ? 1 : 0;
        const wd = walkDist[cy * 50 + cx];
        const reachBonus = wd < 65535 ? (100 - Math.min(100, wd)) : -1000;
        const score = reachBonus + facesCore * 40 + touchesRoad * 25 - cDist * 100;
        return { origin: { x: cx, y: cy }, rot, openDir, score };
    }

    let best = null;
    if (roomState && roomState.storage && roomState.storage.pos) {
        const sx = roomState.storage.pos.x;
        const sy = roomState.storage.pos.y;
        for (let rot = 0; rot < 4; rot++) {
            const rStorage = rotateOffset(-1, -1, rot);
            const cx = sx - rStorage.dx;
            const cy = sy - rStorage.dy;
            if (cx < 2 || cx > 47 || cy < 2 || cy > 47) continue;
            const cand = validateHubCandidate(cx, cy, rot);
            if (cand && walkDist[cy * 50 + cx] < 65535 && (!best || cand.score > best.score)) {
                best = cand;
            }
        }
    }

    if (!best) {
        for (let y = 3; y <= 46; y++) {
            for (let x = 3; x <= 46; x++) {
                if (walkDist[y * 50 + x] >= 65535) continue;
                for (let rot = 0; rot < 4; rot++) {
                    const cand = validateHubCandidate(x, y, rot);
                    if (cand && (!best || cand.score > best.score)) {
                        best = cand;
                    }
                }
            }
        }
    }

    if (!best) return null;

    for (let i = 0; i < COMMAND_HUB_STAMP.length; i++) {
        const st = COMMAND_HUB_STAMP[i];
        const r = rotateOffset(st.dx, st.dy, best.rot);
        baseGrid[(best.origin.y + r.dy) * 50 + (best.origin.x + r.dx)] = st.typeId;
    }

    const mouthPos = { x: best.origin.x + best.openDir.dx, y: best.origin.y + best.openDir.dy };
    if (!hasAdjacentGridRoad(baseGrid, best.origin.x, best.origin.y)) {
        connectToMainRoadNetwork(baseGrid, terrain, anchor, mouthPos);
    } else if (!computeMainRoadMask(baseGrid, anchor)[best.origin.y * 50 + best.origin.x]) {
        connectToMainRoadNetwork(baseGrid, terrain, anchor, best.origin);
    }
    return best;
}

function graftLabComplexBFS(baseGrid, terrain, anchor, hubOrigin, exitDist) {
    const startOrigin = hubOrigin || anchor;
    const walkDist = computeWalkDistancesFrom(baseGrid, terrain, anchor, [startOrigin]);
    const mirrors = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    let best = null;

    for (let y = 3; y <= 46; y++) {
        for (let x = 3; x <= 46; x++) {
            const wd = walkDist[y * 50 + x];
            if (wd >= 65535) continue;
            for (let m = 0; m < 4; m++) {
                const mx = mirrors[m][0];
                const my = mirrors[m][1];
                let valid = true;
                let sharedRoads = 0;
                const blockSet = new Set();

                for (let i = 0; i < LAB_COMPLEX_STAMP.length; i++) {
                    const st = LAB_COMPLEX_STAMP[i];
                    const px = x + st.dx * mx;
                    const py = y + st.dy * my;
                    const isRoad = st.typeId === GRID_ROAD;
                    if (isReservedTile(terrain, anchor, px, py, exitDist, isRoad)) {
                        valid = false;
                        break;
                    }
                    const cur = baseGrid[py * 50 + px];
                    if (isRoad) {
                        if (cur !== GRID_EMPTY && cur !== GRID_ROAD) {
                            valid = false;
                            break;
                        }
                        if (cur === GRID_ROAD || hasAdjacentGridRoad(baseGrid, px, py)) sharedRoads++;
                    } else {
                        if (cur !== GRID_EMPTY) {
                            valid = false;
                            break;
                        }
                        blockSet.add(py * 50 + px);
                    }
                }
                if (!valid) continue;
                if (hubOrigin && Math.max(Math.abs(x - hubOrigin.x), Math.abs(y - hubOrigin.y)) <= 3) {
                    if (!hubCanReachRoad(baseGrid, terrain, anchor, hubOrigin, blockSet)) continue;
                }

                const dHub = calcDistance({ x, y }, startOrigin);
                const dAnchor = calcDistance({ x, y }, anchor);
                const score = -wd * 40 - dHub * 20 - dAnchor * 10 + sharedRoads * 5;
                if (!best || score > best.score) {
                    best = { origin: { x, y }, mx, my, score };
                }
            }
        }
    }

    if (!best) return null;

    let sampleRoad = null;
    for (let i = 0; i < LAB_COMPLEX_STAMP.length; i++) {
        const st = LAB_COMPLEX_STAMP[i];
        const px = best.origin.x + st.dx * best.mx;
        const py = best.origin.y + st.dy * best.my;
        if (st.typeId !== GRID_ROAD || baseGrid[py * 50 + px] === GRID_EMPTY) {
            baseGrid[py * 50 + px] = st.typeId;
        }
        if (st.typeId === GRID_ROAD && !sampleRoad) {
            sampleRoad = { x: px, y: py };
        }
    }

    if (sampleRoad && !computeMainRoadMask(baseGrid, anchor)[sampleRoad.y * 50 + sampleRoad.x]) {
        connectToMainRoadNetwork(baseGrid, terrain, anchor, sampleRoad);
    }
    return best;
}

function tessellateExtensionPlusStamps(baseGrid, terrain, anchor, hubOrigin, exitDist) {
    let extCount = 15; // 15 in Fast-Filler Core
    const hubRef = hubOrigin || anchor;

    // 4a. Place up to 9 Extension Plus-Signs (5 extensions + 8 diamond perimeter roads = 45 extensions)
    for (let stampIdx = 0; stampIdx < 9 && extCount + 5 <= 60; stampIdx++) {
        let best = null;
        for (let cy = 4; cy <= 45; cy++) {
            for (let cx = 4; cx <= 45; cx++) {
                let valid = true;
                let overlapRoads = 0;
                let touchRoads = 0;
                let hubAdjPenalty = 0;
                const blockSet = new Set();

                for (let i = 0; i < EXTENSION_PLUS_STAMP.length; i++) {
                    const st = EXTENSION_PLUS_STAMP[i];
                    const px = cx + st.dx;
                    const py = cy + st.dy;
                    const isRoad = st.typeId !== GRID_EXTENSION;
                    if (isReservedTile(terrain, anchor, px, py, exitDist, isRoad)) {
                        valid = false;
                        break;
                    }
                    const pIdx = py * 50 + px;
                    const cur = baseGrid[pIdx];
                    if (st.typeId === GRID_EXTENSION) {
                        if (cur !== GRID_EMPTY) {
                            valid = false;
                            break;
                        }
                        blockSet.add(pIdx);
                        if (hubOrigin && Math.max(Math.abs(px - hubOrigin.x), Math.abs(py - hubOrigin.y)) <= 1) {
                            hubAdjPenalty += 300;
                        }
                    } else {
                        if (cur !== GRID_EMPTY && cur !== GRID_ROAD) {
                            valid = false;
                            break;
                        }
                        if (cur === GRID_ROAD) overlapRoads++;
                        else if (hasAdjacentGridRoad(baseGrid, px, py)) touchRoads++;
                    }
                }
                if (!valid) continue;
                if (hubOrigin && Math.max(Math.abs(cx - hubOrigin.x), Math.abs(cy - hubOrigin.y)) <= 3) {
                    if (!hubCanReachRoad(baseGrid, terrain, anchor, hubOrigin, blockSet)) continue;
                }

                const hasOverlap = overlapRoads > 0 ? 1 : 0;
                const distCore = Math.max(Math.abs(cx - anchor.x), Math.abs(cy - anchor.y));
                const distHub = Math.max(Math.abs(cx - hubRef.x), Math.abs(cy - hubRef.y));
                const score = hasOverlap * 5000 + overlapRoads * 150 + touchRoads * 30 - distCore * 40 - distHub * 15 - hubAdjPenalty;
                if (!best || score > best.score) {
                    best = { cx, cy, overlapRoads, score };
                }
            }
        }
        if (!best) break;

        let sampleRoad = null;
        for (let i = 0; i < EXTENSION_PLUS_STAMP.length; i++) {
            const st = EXTENSION_PLUS_STAMP[i];
            const px = best.cx + st.dx;
            const py = best.cy + st.dy;
            if (st.typeId === GRID_EXTENSION || baseGrid[py * 50 + px] === GRID_EMPTY) {
                baseGrid[py * 50 + px] = st.typeId;
            }
            if (st.typeId === GRID_ROAD && !sampleRoad) {
                sampleRoad = { x: px, y: py };
            }
        }
        extCount += 5;

        if (sampleRoad && best.overlapRoads === 0 && !computeMainRoadMask(baseGrid, anchor)[sampleRoad.y * 50 + sampleRoad.x]) {
            connectToMainRoadNetwork(baseGrid, terrain, anchor, sampleRoad);
        }
    }

    // 4b. Cramped-terrain fallback: pack remaining single extensions onto road-adjacent tiles up to 60 (respecting exitDist >= 5)
    let safetyIters = 0;
    while (extCount < 60 && safetyIters < 200) {
        safetyIters++;
        const candidates = [];
        for (let y = 3; y <= 46; y++) {
            for (let x = 3; x <= 46; x++) {
                if (isReservedTile(terrain, anchor, x, y, exitDist, false) || baseGrid[y * 50 + x] !== GRID_EMPTY) continue;
                if (!hasAdjacentGridRoad(baseGrid, x, y)) continue;
                const dAnchor = Math.max(Math.abs(x - anchor.x), Math.abs(y - anchor.y));
                const hubPenalty = (hubOrigin && Math.max(Math.abs(x - hubOrigin.x), Math.abs(y - hubOrigin.y)) <= 1) ? 100 : 0;
                candidates.push({ x, y, cost: dAnchor + hubPenalty });
            }
        }
        candidates.sort((a, b) => a.cost - b.cost);

        let placedOne = false;
        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            if (hubOrigin && Math.max(Math.abs(c.x - hubOrigin.x), Math.abs(c.y - hubOrigin.y)) <= 2) {
                if (!hubCanReachRoad(baseGrid, terrain, anchor, hubOrigin, new Set([c.y * 50 + c.x]))) continue;
            }
            baseGrid[c.y * 50 + c.x] = GRID_EXTENSION;
            extCount++;
            placedOne = true;
            break;
        }
        if (placedOne) continue;

        // Extend branch road by 1 tile to unlock fresh buildable pockets
        const walkDist = computeWalkDistancesFrom(baseGrid, terrain, anchor, [anchor]);
        let bestBranch = null;
        let bestBranchScore = -Infinity;
        for (let y = 2; y <= 47; y++) {
            for (let x = 2; x <= 47; x++) {
                if (isReservedTile(terrain, anchor, x, y, exitDist, true) || baseGrid[y * 50 + x] !== GRID_EMPTY) continue;
                if (walkDist[y * 50 + x] >= 65535 || !hasAdjacentGridRoad(baseGrid, x, y)) continue;
                let emptyAdj = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (!isReservedTile(terrain, anchor, nx, ny, exitDist, false) && baseGrid[ny * 50 + nx] === GRID_EMPTY) emptyAdj++;
                    }
                }
                const score = emptyAdj * 10 - Math.max(Math.abs(x - anchor.x), Math.abs(y - anchor.y));
                if (emptyAdj > 0 && score > bestBranchScore) {
                    bestBranchScore = score;
                    bestBranch = { x, y };
                }
            }
        }
        if (bestBranch) {
            baseGrid[bestBranch.y * 50 + bestBranch.x] = GRID_ROAD;
            continue;
        }

        // Last resort for extreme fragmented terrain: place on nearest walkable empty tile with exitDist >= 5
        let placedAny = false;
        for (let y = 3; y <= 46 && !placedAny; y++) {
            for (let x = 3; x <= 46 && !placedAny; x++) {
                if (isReservedTile(terrain, anchor, x, y, exitDist, false) || baseGrid[y * 50 + x] !== GRID_EMPTY) continue;
                if (walkDist[y * 50 + x] >= 65535) continue;
                baseGrid[y * 50 + x] = GRID_EXTENSION;
                extCount++;
                placedAny = true;
            }
        }
        if (!placedAny) break;
    }
    return extCount;
}

function placeSingletons(baseGrid, terrain, anchor, hubOrigin, hubRot, exitDist) {
    const hubRef = hubOrigin || anchor;
    const walkDist = computeWalkDistancesFrom(baseGrid, terrain, anchor, [hubRef, anchor]);

    // 5a. Power Spawn (1): prefer tile adjacent to Hub (0,0) leaving open road exit
    let psPlaced = false;
    if (hubOrigin) {
        const openDir = HUB_ROT_DIRS[hubRot || 0];
        const hubAdj = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const px = hubOrigin.x + dx;
                const py = hubOrigin.y + dy;
                if (isReservedTile(terrain, anchor, px, py, exitDist, false) || baseGrid[py * 50 + px] !== GRID_EMPTY) continue;
                if (!hubCanReachRoad(baseGrid, terrain, anchor, hubOrigin, new Set([py * 50 + px]))) continue;
                // Prefer corners beside the open mouth over the straight center mouth tile when tied
                const isDirectMouth = (dx === openDir.dx && dy === openDir.dy) ? 1 : 0;
                const nearRoad = hasAdjacentGridRoad(baseGrid, px, py) ? 1 : 0;
                const score = nearRoad * 20 - isDirectMouth * 5;
                hubAdj.push({ x: px, y: py, score });
            }
        }
        hubAdj.sort((a, b) => b.score - a.score);
        if (hubAdj.length > 0) {
            baseGrid[hubAdj[0].y * 50 + hubAdj[0].x] = GRID_POWER_SPAWN;
            psPlaced = true;
        }
    }

    if (!psPlaced) {
        let bestPs = null;
        let bestPsDist = Infinity;
        for (let y = 3; y <= 46; y++) {
            for (let x = 3; x <= 46; x++) {
                if (isReservedTile(terrain, anchor, x, y, exitDist, false) || baseGrid[y * 50 + x] !== GRID_EMPTY) continue;
                if (walkDist[y * 50 + x] >= 65535) continue;
                if (hubOrigin && !hubCanReachRoad(baseGrid, terrain, anchor, hubOrigin, new Set([y * 50 + x]))) continue;
                const d = calcDistance({ x, y }, hubRef) + (hasAdjacentGridRoad(baseGrid, x, y) ? 0 : 10);
                if (d < bestPsDist) {
                    bestPsDist = d;
                    bestPs = { x, y };
                }
            }
        }
        if (bestPs) baseGrid[bestPs.y * 50 + bestPs.x] = GRID_POWER_SPAWN;
    }

    // 5b. 6 Towers: BFS outward from Hub / Core tightly adjacent to existing roads
    let towerCount = 0;
    const collectTowerCands = (requireRoadAdj) => {
        const list = [];
        for (let y = 3; y <= 46; y++) {
            for (let x = 3; x <= 46; x++) {
                if (isReservedTile(terrain, anchor, x, y, exitDist, false) || baseGrid[y * 50 + x] !== GRID_EMPTY) continue;
                if (walkDist[y * 50 + x] >= 65535) continue;
                if (requireRoadAdj && !hasAdjacentGridRoad(baseGrid, x, y)) continue;
                const dHub = calcDistance({ x, y }, hubRef);
                const dAnchor = calcDistance({ x, y }, anchor);
                list.push({ x, y, cost: dHub + dAnchor });
            }
        }
        list.sort((a, b) => a.cost - b.cost);
        return list;
    };

    const roadAdjTowers = collectTowerCands(true);
    for (let i = 0; i < roadAdjTowers.length && towerCount < 6; i++) {
        const c = roadAdjTowers[i];
        if (hubOrigin && Math.max(Math.abs(c.x - hubOrigin.x), Math.abs(c.y - hubOrigin.y)) <= 2) {
            if (!hubCanReachRoad(baseGrid, terrain, anchor, hubOrigin, new Set([c.y * 50 + c.x]))) continue;
        }
        baseGrid[c.y * 50 + c.x] = GRID_TOWER;
        towerCount++;
    }
    if (towerCount < 6) {
        const fallbackTowers = collectTowerCands(false);
        for (let i = 0; i < fallbackTowers.length && towerCount < 6; i++) {
            const c = fallbackTowers[i];
            if (baseGrid[c.y * 50 + c.x] !== GRID_EMPTY) continue;
            if (hubOrigin && Math.max(Math.abs(c.x - hubOrigin.x), Math.abs(c.y - hubOrigin.y)) <= 2) {
                if (!hubCanReachRoad(baseGrid, terrain, anchor, hubOrigin, new Set([c.y * 50 + c.x]))) continue;
            }
            baseGrid[c.y * 50 + c.x] = GRID_TOWER;
            towerCount++;
        }
    }

    // 5c. Observer (1): nearest reachable tile inside/adjacent to planned bunker footprint
    let bestObs = null;
    let bestObsCost = Infinity;
    for (let y = 3; y <= 46; y++) {
        for (let x = 3; x <= 46; x++) {
            if (isReservedTile(terrain, anchor, x, y, exitDist, false) || baseGrid[y * 50 + x] !== GRID_EMPTY) continue;
            if (walkDist[y * 50 + x] >= 65535) continue;
            if (hubOrigin && Math.max(Math.abs(x - hubOrigin.x), Math.abs(y - hubOrigin.y)) <= 2) {
                if (!hubCanReachRoad(baseGrid, terrain, anchor, hubOrigin, new Set([y * 50 + x]))) continue;
            }
            const roadBonus = hasAdjacentGridRoad(baseGrid, x, y) ? 0 : 2;
            const cost = calcDistance({ x, y }, hubRef) + calcDistance({ x, y }, anchor) + roadBonus;
            if (cost < bestObsCost) {
                bestObsCost = cost;
                bestObs = { x, y };
            }
        }
    }
    if (bestObs) baseGrid[bestObs.y * 50 + bestObs.x] = GRID_OBSERVER;
}

// --- 6. BLUEPRINT GENERATOR & POJO BUILDER ---

function generateTopologicalBlueprint(roomOrName, terrain, roomState) {
    const room = (typeof roomOrName === 'string' && typeof Game !== 'undefined' && Game.rooms)
        ? Game.rooms[roomOrName]
        : (typeof roomOrName === 'object' ? roomOrName : null);

    const poiList = [];
    if (roomState) {
        if (roomState.sources) for (let i = 0; i < roomState.sources.length; i++) poiList.push(roomState.sources[i].pos);
        if (roomState.controller) poiList.push(roomState.controller.pos);
        if (roomState.mineral) poiList.push(roomState.mineral.pos);
    } else if (room && room.find) {
        const sources = room.find(FIND_SOURCES);
        for (let i = 0; i < sources.length; i++) poiList.push(sources[i].pos);
        if (room.controller) poiList.push(room.controller.pos);
        const minerals = room.find(FIND_MINERALS);
        if (minerals.length > 0) poiList.push(minerals[0].pos);
    }

    const exitDist = computeExitDistanceGrid(terrain);
    const anchor = findOptimalAnchor(roomOrName, terrain, poiList);
    const baseGrid = new Uint8Array(2500);

    // Mark terrain walls
    for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
            if (isTerrainWall(terrain, x, y)) baseGrid[y * 50 + x] = GRID_WALL;
        }
    }

    // 1. Paint 5x5 Fast-Filler Core + 20 Perimeter Roads
    for (let i = 0; i < FAST_FILLER_STAMP.length; i++) {
        const st = FAST_FILLER_STAMP[i];
        const px = anchor.x + st.dx;
        const py = anchor.y + st.dy;
        if (px < 1 || px > 48 || py < 1 || py > 48) continue;
        if (isTerrainWall(terrain, px, py)) continue;
        if (st.typeId === GRID_ROAD && exitDist[py * 50 + px] < 4) continue;
        if (st.typeId !== GRID_ROAD && exitDist[py * 50 + px] < 5) continue;
        baseGrid[py * 50 + px] = st.typeId;
    }

    // 2. Graft Rotatable 2x3 C-Shape Command Hub
    const hubRes = graftCommandHubBFS(baseGrid, terrain, anchor, roomState, exitDist);
    const hubOrigin = hubRes ? hubRes.origin : null;

    // 3. Graft Mirrorable 4x4 Infinity Lab Complex
    graftLabComplexBFS(baseGrid, terrain, anchor, hubOrigin, exitDist);

    // 4. Diagonal Tessellation of 9 Extension Plus-Signs (+ Road-Adjacent Cramped Fallback -> 60 total)
    tessellateExtensionPlusStamps(baseGrid, terrain, anchor, hubOrigin, exitDist);

    // 5. Place Singletons (Power Spawn adjacent to Hub, 6 Road-Adjacent Towers, Observer)
    placeSingletons(baseGrid, terrain, anchor, hubOrigin, hubRes ? hubRes.rot : 0, exitDist);

    // 6. Connect Sources, Controller, and Mineral to nearest stamp GRID_ROAD via 8:1 trunk wiring
    for (let i = 0; i < poiList.length; i++) {
        connectToMainRoadNetwork(baseGrid, terrain, anchor, poiList[i]);
    }

    const blueprint = baseGridToBlueprint(baseGrid, anchor);
    const serialized = serializeBaseGrid(baseGrid);
    blueprint._serialized = serialized;
    blueprint._version = BLUEPRINT_VERSION;
    return { blueprint, baseGrid, serialized };
}

const LAB_REACTOR_TIERS = {
    '0,-1': { rcl: 6, order: 0 },
    '1,-1': { rcl: 7, order: 1 },
    '-1,0': { rcl: 7, order: 2 },
    '-1,1': { rcl: 7, order: 3 },
    '1,2': { rcl: 8, order: 4 },
    '0,2': { rcl: 8, order: 5 },
    '2,1': { rcl: 8, order: 6 },
    '2,0': { rcl: 8, order: 7 }
};

function assignBlueprintLabs(blueprint, rawSuppliers, rawReactors) {
    const hubRef = (blueprint.terminal && blueprint.terminal[0]) ||
        (blueprint.storage && blueprint.storage[0]) ||
        blueprint.anchor;

    const suppliers = rawSuppliers.slice();
    if (suppliers.length > 1 && hubRef) {
        suppliers.sort((a, b) => calcDistance(a, hubRef) - calcDistance(b, hubRef) || (a.y - b.y) || (a.x - b.x));
    }

    for (let i = 0; i < suppliers.length; i++) {
        const s = suppliers[i];
        blueprint.supplierLabs.push({ x: s.x, y: s.y, rcl: 6, isSupplier: true });
        blueprint.labs.push({ x: s.x, y: s.y, rcl: 6, isSupplier: true });
    }

    let s0 = suppliers[0] || null;
    let s1 = suppliers[1] || null;
    let mx = 1;
    let my = 1;
    if (s0 && s1) {
        mx = Math.sign(s1.x - s0.x) || 1;
        my = Math.sign(s1.y - s0.y) || 1;
        const h1 = { x: s0.x, y: s0.y + my };
        const h2 = { x: s0.x + mx, y: s0.y };
        if (h1.x >= 1 && h1.x <= 48 && h1.y >= 1 && h1.y <= 48) blueprint.labHallway.push(h1);
        if (h2.x >= 1 && h2.x <= 48 && h2.y >= 1 && h2.y <= 48) blueprint.labHallway.push(h2);
    }

    const mapped = [];
    const unmatched = [];
    const usedRcl6 = [];
    const usedRcl7 = [];
    const usedRcl8 = [];

    for (let i = 0; i < rawReactors.length; i++) {
        const r = rawReactors[i];
        let tier = null;
        if (s0 && s1 && Math.abs(s1.x - s0.x) === 1 && Math.abs(s1.y - s0.y) === 1) {
            const dx = (r.x - s0.x) * mx;
            const dy = (r.y - s0.y) * my;
            tier = LAB_REACTOR_TIERS[`${dx},${dy}`] || null;
        }
        if (tier) {
            mapped.push({ x: r.x, y: r.y, rcl: tier.rcl, isSupplier: false, _order: tier.order });
            if (tier.rcl === 6) usedRcl6.push(1);
            else if (tier.rcl === 7) usedRcl7.push(1);
            else usedRcl8.push(1);
        } else {
            unmatched.push(r);
        }
    }

    if (unmatched.length > 0) {
        unmatched.sort((a, b) => {
            const da = s0 ? (calcDistance(a, s0) + (s1 ? calcDistance(a, s1) : 0)) : calcDistance(a, hubRef);
            const db = s0 ? (calcDistance(b, s0) + (s1 ? calcDistance(b, s1) : 0)) : calcDistance(b, hubRef);
            return da - db || (a.y - b.y) || (a.x - b.x);
        });
        for (let i = 0; i < unmatched.length; i++) {
            let rcl = 8;
            if (usedRcl6.length < 1) { rcl = 6; usedRcl6.push(1); }
            else if (usedRcl7.length < 3) { rcl = 7; usedRcl7.push(1); }
            else { usedRcl8.push(1); }
            mapped.push({ x: unmatched[i].x, y: unmatched[i].y, rcl, isSupplier: false, _order: 100 + i });
        }
    }

    mapped.sort((a, b) => (a.rcl - b.rcl) || (a._order - b._order));
    for (let i = 0; i < mapped.length; i++) {
        const labEntry = { x: mapped[i].x, y: mapped[i].y, rcl: mapped[i].rcl, isSupplier: false };
        blueprint.reactorLabs.push(labEntry);
        blueprint.labs.push(labEntry);
    }
}

function baseGridToBlueprint(baseGrid, anchor) {
    const extRcls = [2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8];
    const towerRcls = [3, 5, 7, 8, 8, 8];

    const blueprint = {
        anchor: { x: anchor.x, y: anchor.y },
        baseGrid: baseGrid,
        spawns: [],
        storage: [],
        terminal: [],
        factory: [],
        powerSpawn: [],
        nuker: [],
        observer: [],
        towers: [],
        links: [],
        labs: [],
        supplierLabs: [],
        reactorLabs: [],
        labHallway: [],
        containers: [],
        extensions: [],
        roads: [],
        ramparts: [],
        outpostRamparts: []
    };

    let extIdx = 0;
    let towerIdx = 0;
    let spawnIdx = 0;
    const rawSuppliers = [];
    const rawReactors = [];

    for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
            const val = baseGrid[y * 50 + x];
            if (val === GRID_EMPTY || val === GRID_WALL) continue;

            if (val === GRID_ROAD) {
                blueprint.roads.push({ x, y, rcl: 3 });
            } else if (val === GRID_SPAWN) {
                const rcl = spawnIdx === 0 ? 1 : (spawnIdx === 1 ? 7 : 8);
                blueprint.spawns.push({ x, y, rcl });
                spawnIdx++;
            } else if (val === GRID_EXTENSION) {
                blueprint.extensions.push({ x, y, rcl: extRcls[extIdx++] || 8 });
            } else if (val === GRID_TOWER) {
                blueprint.towers.push({ x, y, rcl: towerRcls[towerIdx++] || 8 });
            } else if (val === GRID_STORAGE) {
                blueprint.storage.push({ x, y, rcl: 4 });
            } else if (val === GRID_TERMINAL) {
                blueprint.terminal.push({ x, y, rcl: 6 });
            } else if (val === GRID_FACTORY) {
                blueprint.factory.push({ x, y, rcl: 7 });
            } else if (val === GRID_POWER_SPAWN) {
                blueprint.powerSpawn.push({ x, y, rcl: 8 });
            } else if (val === GRID_NUKER) {
                blueprint.nuker.push({ x, y, rcl: 8 });
            } else if (val === GRID_OBSERVER) {
                blueprint.observer.push({ x, y, rcl: 8 });
            } else if (val === GRID_LINK) {
                if (x === anchor.x && y === anchor.y) {
                    blueprint.links.push({ x, y, rcl: 5, intent: 'filler' });
                } else {
                    blueprint.links.push({ x, y, rcl: 5, intent: 'hub' });
                }
            } else if (val === GRID_CONTAINER) {
                const isCore = Math.abs(x - anchor.x) <= 2 && Math.abs(y - anchor.y) <= 2;
                blueprint.containers.push({ x, y, rcl: 2, intent: isCore ? 'filler' : 'poi' });
            } else if (val === GRID_LAB_SUPPLIER) {
                rawSuppliers.push({ x, y });
            } else if (val === GRID_LAB_REACTOR) {
                rawReactors.push({ x, y });
            } else if (val === GRID_EXTRACTOR) {
                // Extractor tile handled directly
            }
        }
    }

    assignBlueprintLabs(blueprint, rawSuppliers, rawReactors);

    return blueprint;
}

// --- 7. BLUEPRINT GETTER WITH RAWMEMORY SEGMENT 1 PAGING ---

function cacheGlobalBlueprint(rName, blueprint) {
    if (typeof global !== 'undefined' && blueprint) {
        if (!global.heap) global.heap = {};
        if (!global.heap.blueprints) global.heap.blueprints = {};
        global.heap.blueprints[rName] = blueprint;
    }
    return blueprint;
}

function getRoomBlueprint(roomOrName) {
    const rName = typeof roomOrName === 'string' ? roomOrName : (roomOrName && roomOrName.name) || 'W1N1';
    requestSegment(SEGMENT_BASE_PLAN);

    // If already in heap cache, check version and flush to Segment 1 if needed
    if (BLUEPRINT_CACHE.has(rName)) {
        let cached = BLUEPRINT_CACHE.get(rName);
        if (cached && cached._version === BLUEPRINT_VERSION) {
            if ((!Array.isArray(cached.reactorLabs) || !Array.isArray(cached.labHallway)) && cached.baseGrid && cached.anchor) {
                const upgraded = baseGridToBlueprint(cached.baseGrid, cached.anchor);
                upgraded._serialized = cached._serialized;
                upgraded._version = BLUEPRINT_VERSION;
                BLUEPRINT_CACHE.set(rName, upgraded);
                cached = upgraded;
            }
            if (!BLUEPRINT_CACHE._persisted || !BLUEPRINT_CACHE._persisted.has(rName)) {
                const rawSeg = getSegmentData(SEGMENT_BASE_PLAN);
                if (rawSeg !== null) {
                    let segMap = {};
                    try { segMap = rawSeg ? JSON.parse(rawSeg) : {}; } catch (e) { segMap = {}; }
                    if (!segMap || typeof segMap !== 'object' || segMap._version !== BLUEPRINT_VERSION) {
                        segMap = { _version: BLUEPRINT_VERSION };
                    }
                    const isDirty = BLUEPRINT_CACHE._dirty && BLUEPRINT_CACHE._dirty.has(rName);
                    if ((!segMap[rName] || isDirty) && cached._serialized) {
                        segMap._version = BLUEPRINT_VERSION;
                        segMap[rName] = cached._serialized;
                        setSegmentData(SEGMENT_BASE_PLAN, JSON.stringify(segMap));
                        if (isDirty) BLUEPRINT_CACHE._dirty.delete(rName);
                    }
                    if (!BLUEPRINT_CACHE._persisted) BLUEPRINT_CACHE._persisted = new Set();
                    BLUEPRINT_CACHE._persisted.add(rName);
                }
            }
            return cacheGlobalBlueprint(rName, cached);
        }
        BLUEPRINT_CACHE.delete(rName);
    }

    const room = (typeof roomOrName === 'string' && typeof Game !== 'undefined' && Game.rooms)
        ? Game.rooms[roomOrName]
        : (typeof roomOrName === 'object' ? roomOrName : null);
    const terrain = room && room.getTerrain
        ? room.getTerrain()
        : (typeof Game !== 'undefined' && Game.map && Game.map.getRoomTerrain ? Game.map.getRoomTerrain(rName) : { get: () => 0 });

    const roomState = (typeof global !== 'undefined' && global.heap && global.heap.rooms) ? global.heap.rooms[rName] : null;

    const rawSeg = getSegmentData(SEGMENT_BASE_PLAN);
    let segMap = {};
    if (rawSeg) {
        try {
            segMap = JSON.parse(rawSeg);
        } catch (e) {
            segMap = {};
        }
    }

    // Check if blueprint already serialized in Segment 1 at current version
    const versionMatches = segMap && segMap._version === BLUEPRINT_VERSION;
    if (segMap && segMap[rName] && versionMatches) {
        const baseGrid = new Uint8Array(2500);
        deserializeBaseGrid(segMap[rName], baseGrid);
        const anchor = findOptimalAnchor(roomOrName, terrain, null);
        const blueprint = baseGridToBlueprint(baseGrid, anchor);
        blueprint._serialized = segMap[rName];
        blueprint._version = BLUEPRINT_VERSION;
        BLUEPRINT_CACHE.set(rName, blueprint);
        if (!BLUEPRINT_CACHE._persisted) BLUEPRINT_CACHE._persisted = new Set();
        BLUEPRINT_CACHE._persisted.add(rName);
        return cacheGlobalBlueprint(rName, blueprint);
    }

    // Generate topological blueprint organically
    const { blueprint, serialized } = generateTopologicalBlueprint(roomOrName, terrain, roomState);
    blueprint._version = BLUEPRINT_VERSION;

    // Save to Segment 1 if accessible (resetting stale v1 map if _version !== BLUEPRINT_VERSION)
    if (rawSeg !== null) {
        if (!segMap || typeof segMap !== 'object' || segMap._version !== BLUEPRINT_VERSION) {
            segMap = { _version: BLUEPRINT_VERSION };
        }
        segMap._version = BLUEPRINT_VERSION;
        segMap[rName] = serialized;
        setSegmentData(SEGMENT_BASE_PLAN, JSON.stringify(segMap));
        if (!BLUEPRINT_CACHE._persisted) BLUEPRINT_CACHE._persisted = new Set();
        BLUEPRINT_CACHE._persisted.add(rName);
    }

    BLUEPRINT_CACHE.set(rName, blueprint);
    return cacheGlobalBlueprint(rName, blueprint);
}

if (typeof global !== 'undefined') {
    global.getRoomBlueprint = getRoomBlueprint;
}

/**
 * Stitches active, non-excluded remote outpost routes into the home room's baseGrid (GRID_ROAD).
 * Heavily favors existing GRID_ROAD tiles and avoids non-road structures.
 * Updates blueprint.roads and RawMemory Segment 1 when new tiles are painted.
 */
function stitchRemoteRoads(roomName, baseGridArg) {
    if (!roomName) return 0;
    const blueprint = BLUEPRINT_CACHE.get(roomName) || getRoomBlueprint(roomName);
    const baseGrid = baseGridArg || (blueprint && blueprint.baseGrid);
    if (!baseGrid || typeof PathFinder === 'undefined' || !PathFinder.search) return 0;

    const heap = typeof global !== 'undefined' ? (global.heap || (global.heap = {})) : {};
    const col = heap.colonies ? heap.colonies[roomName] : null;
    const rawOutposts = (col && Array.isArray(col.outposts) && col.outposts.length > 0)
        ? col.outposts
        : ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Array.isArray(Memory.rooms[roomName].outposts))
            ? Memory.rooms[roomName].outposts
            : []);

    const outposts = [];
    for (let i = 0; i < rawOutposts.length; i++) {
        const o = rawOutposts[i];
        if (o && (!isRemoteExcluded || !isRemoteExcluded(o))) {
            outposts.push(o);
        }
    }
    if (outposts.length === 0) return 0;

    const room = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[roomName] : null;
    const roomState = heap.rooms ? heap.rooms[roomName] : null;
    const rcl = (room && room.controller) ? (room.controller.level || 1) : 1;

    const anchor = (blueprint && blueprint.anchor) ? blueprint.anchor : { x: 25, y: 25 };
    let origin = anchor;
    if (rcl >= 4) {
        if (roomState && roomState.storage) {
            origin = roomState.storage.pos;
        } else if (blueprint && blueprint.storage && blueprint.storage[0]) {
            origin = blueprint.storage[0];
        }
    }
    const hubAnchor = (roomState && roomState.storage && roomState.storage.pos)
        ? roomState.storage.pos
        : ((blueprint && blueprint.storage && blueprint.storage[0]) ? blueprint.storage[0] : origin);
    const hubPos = (typeof RoomPosition !== 'undefined')
        ? new RoomPosition(origin.x, origin.y, roomName)
        : { x: origin.x, y: origin.y, roomName: roomName };

    const matrixCache = {};
    function getStitchCostMatrix(rName) {
        if (matrixCache[rName]) return matrixCache[rName];
        const cm = new PathFinder.CostMatrix();
        const rObj = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[rName] : null;
        const terrain = (rObj && rObj.getTerrain)
            ? rObj.getTerrain()
            : ((typeof Game !== 'undefined' && Game.map && Game.map.getRoomTerrain) ? Game.map.getRoomTerrain(rName) : null);
        const tBytes = (!terrain && getStaticTerrainBytes) ? getStaticTerrainBytes(rName) : null;

        if (rName === roomName) {
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    const idx = y * 50 + x;
                    const gVal = baseGrid[idx];
                    const tVal = terrain ? terrain.get(x, y) : (tBytes ? tBytes[idx] : 0);
                    if (gVal === GRID_WALL || (tVal & 1) > 0) {
                        cm.set(x, y, 255);
                    } else if (gVal === GRID_ROAD) {
                        cm.set(x, y, 1);
                    } else if (gVal !== GRID_EMPTY && gVal !== GRID_CONTAINER) {
                        cm.set(x, y, 255);
                    } else {
                        const inCoreNoPave = Math.max(Math.abs(x - anchor.x), Math.abs(y - anchor.y)) <= 4;
                        const inHubNoPave = Math.max(Math.abs(x - hubAnchor.x), Math.abs(y - hubAnchor.y)) <= 4;
                        if (inCoreNoPave || inHubNoPave) {
                            cm.set(x, y, 25);
                        } else {
                            let baseCost = (tVal & 2) > 0 ? 20 : 8;
                            if (x === 1 || x === 48 || y === 1 || y === 48) baseCost += 4;
                            cm.set(x, y, baseCost);
                        }
                    }
                }
            }
            if (roomState) {
                const structs = getAllStructures(roomState);
                for (let i = 0; i < structs.length; i++) {
                    const st = structs[i];
                    if (!st || !st.pos) continue;
                    // Do not mark stray live S_ROAD in home room as cost=1; baseGrid is authoritative
                    if (st.structureType !== S_ROAD && st.structureType !== S_RAMPART && st.structureType !== S_CONTAINER) {
                        cm.set(st.pos.x, st.pos.y, 255);
                    }
                }
            }
        } else {
            for (let y = 0; y < 50; y++) {
                for (let x = 0; x < 50; x++) {
                    const tVal = terrain ? terrain.get(x, y) : (tBytes ? tBytes[y * 50 + x] : 0);
                    if ((tVal & 1) > 0) cm.set(x, y, 255);
                    else if ((tVal & 2) > 0) cm.set(x, y, 20);
                    else cm.set(x, y, 8);
                }
            }
            const oState = heap.rooms ? heap.rooms[rName] : null;
            if (oState) {
                const structs = getAllStructures(oState);
                for (let i = 0; i < structs.length; i++) {
                    const st = structs[i];
                    if (!st || !st.pos) continue;
                    if (st.structureType === S_ROAD) {
                        if (cm.get(st.pos.x, st.pos.y) < 255) cm.set(st.pos.x, st.pos.y, 1);
                    } else if (st.structureType !== S_RAMPART && st.structureType !== S_CONTAINER) {
                        cm.set(st.pos.x, st.pos.y, 255);
                    }
                }
            }
        }

        matrixCache[rName] = cm;
        return cm;
    }

    let painted = 0;
    let totalRemoteSources = 0;
    for (let o = 0; o < outposts.length; o++) {
        const outName = outposts[o];
        const goals = [];

        const remMeta = (heap.remoteRooms && heap.remoteRooms[outName]) ||
            ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[outName]) ? Memory.rooms[outName].scoutData : null);
        if (remMeta && remMeta.safe !== false && Array.isArray(remMeta.sources)) {
            totalRemoteSources += remMeta.sources.length;
        }
        const oState = heap.rooms ? heap.rooms[outName] : null;
        const srcList = (remMeta && Array.isArray(remMeta.sources) && remMeta.sources.length > 0)
            ? remMeta.sources
            : ((oState && Array.isArray(oState.sources)) ? oState.sources.map(s => s.pos) : null);

        if (srcList && srcList.length > 0) {
            for (let s = 0; s < srcList.length; s++) {
                const src = srcList[s];
                if (!src) continue;
                const pos = (typeof RoomPosition !== 'undefined')
                    ? new RoomPosition(src.x, src.y, outName)
                    : { x: src.x, y: src.y, roomName: outName };
                goals.push({ pos, range: 1 });
            }
        } else if (room && room.find && typeof Game !== 'undefined' && Game.map && Game.map.findExit) {
            const exitDir = Game.map.findExit(roomName, outName);
            if (exitDir > 0) {
                const exits = room.find(exitDir);
                if (exits && exits.length > 0) {
                    const mid = exits[Math.floor(exits.length / 2)];
                    goals.push({ pos: mid, range: 0 });
                }
            }
        }

        for (let g = 0; g < goals.length; g++) {
            const res = PathFinder.search(hubPos, goals[g], {
                plainCost: 8,
                swampCost: 20,
                maxRooms: 4,
                roomCallback: getStitchCostMatrix
            });
            if (!res || !Array.isArray(res.path)) continue;
            for (let p = 0; p < res.path.length; p++) {
                const pt = res.path[p];
                if (!pt || (pt.roomName && pt.roomName !== roomName)) continue;
                if (pt.x <= 0 || pt.x >= 49 || pt.y <= 0 || pt.y >= 49) continue;
                const idx = pt.y * 50 + pt.x;
                if (baseGrid[idx] === GRID_EMPTY) {
                    baseGrid[idx] = GRID_ROAD;
                    if (matrixCache[roomName]) {
                        matrixCache[roomName].set(pt.x, pt.y, 1);
                    }
                    painted++;
                }
            }
        }
    }

    if (!heap.remoteStitchState) heap.remoteStitchState = {};
    heap.remoteStitchState[roomName] = {
        sig: `${outposts.slice().sort().join(',')}:${totalRemoteSources}`,
        tick: typeof Game !== 'undefined' ? Game.time : 0
    };

    if (painted > 0) {
        if (blueprint) {
            if (!Array.isArray(blueprint.roads)) blueprint.roads = [];
            const roadSet = new Set();
            for (let i = 0; i < blueprint.roads.length; i++) {
                roadSet.add(blueprint.roads[i].x + ':' + blueprint.roads[i].y);
            }
            for (let y = 1; y < 49; y++) {
                for (let x = 1; x < 49; x++) {
                    if (baseGrid[y * 50 + x] === GRID_ROAD) {
                        const key = x + ':' + y;
                        if (!roadSet.has(key)) {
                            roadSet.add(key);
                            blueprint.roads.push({ x, y, rcl: 3 });
                        }
                    }
                }
            }
        }

        const serialized = serializeBaseGrid(baseGrid);
        if (blueprint) {
            blueprint._serialized = serialized;
            blueprint._version = BLUEPRINT_VERSION;
        }
        requestSegment(SEGMENT_BASE_PLAN);
        const rawSeg = getSegmentData(SEGMENT_BASE_PLAN);
        if (rawSeg !== null) {
            let segMap = {};
            try { segMap = rawSeg ? JSON.parse(rawSeg) : {}; } catch (e) { segMap = {}; }
            if (!segMap || typeof segMap !== 'object' || segMap._version !== BLUEPRINT_VERSION) {
                segMap = { _version: BLUEPRINT_VERSION };
            }
            segMap._version = BLUEPRINT_VERSION;
            segMap[roomName] = serialized;
            setSegmentData(SEGMENT_BASE_PLAN, JSON.stringify(segMap));
            if (!BLUEPRINT_CACHE._persisted) BLUEPRINT_CACHE._persisted = new Set();
            BLUEPRINT_CACHE._persisted.add(roomName);
            if (BLUEPRINT_CACHE._dirty) BLUEPRINT_CACHE._dirty.delete(roomName);
        } else {
            if (!BLUEPRINT_CACHE._dirty) BLUEPRINT_CACHE._dirty = new Set();
            BLUEPRINT_CACHE._dirty.add(roomName);
            if (BLUEPRINT_CACHE._persisted) BLUEPRINT_CACHE._persisted.delete(roomName);
        }
        markMemoryDirty();
    }

    return painted;
}

const STRUCTURE_TO_GRID = {
    [S_ROAD]: GRID_ROAD,
    [S_SPAWN]: GRID_SPAWN,
    [S_EXTENSION]: GRID_EXTENSION,
    [S_TOWER]: GRID_TOWER,
    [S_STORAGE]: GRID_STORAGE,
    [S_TERMINAL]: GRID_TERMINAL,
    [S_CONTAINER]: GRID_CONTAINER,
    [S_LINK]: GRID_LINK,
    [S_FACTORY]: GRID_FACTORY,
    [S_POWER_SPAWN]: GRID_POWER_SPAWN,
    [S_NUKER]: GRID_NUKER,
    [S_OBSERVER]: GRID_OBSERVER
};

function matchesExpectedGrid(structureType, gridVal) {
    if (structureType === S_LAB) {
        return gridVal === GRID_LAB_SUPPLIER || gridVal === GRID_LAB_REACTOR;
    }
    return STRUCTURE_TO_GRID[structureType] === gridVal;
}

function isPoiContainerOrLink(pos, sources, controller, mineral) {
    if (!pos) return false;
    if (sources) {
        for (let i = 0; i < sources.length; i++) {
            if (sources[i] && sources[i].pos && calcDistance(pos, sources[i].pos) <= 2) return true;
        }
    }
    if (controller && controller.pos && calcDistance(pos, controller.pos) <= 3) return true;
    if (mineral && mineral.pos && calcDistance(pos, mineral.pos) <= 1) return true;
    return false;
}

function pruneNonBlueprintRoadSites(room, sites, baseGrid, roomState) {
    if (!room || !baseGrid || !Array.isArray(sites) || sites.length === 0) return sites || [];
    const sources = (roomState && roomState.sources) ||
        (room.find && typeof FIND_SOURCES !== 'undefined' ? (room.find(FIND_SOURCES) || []) : []);
    const controller = room.controller || (roomState && roomState.controller) || null;
    const mineral = (roomState && roomState.mineral) ||
        (room.find && typeof FIND_MINERALS !== 'undefined' ? ((room.find(FIND_MINERALS) || [])[0] || null) : null);
    const kept = [];
    for (let i = 0; i < sites.length; i++) {
        const cs = sites[i];
        if (!cs || !cs.pos) continue;
        const st = cs.structureType;
        if (st === S_RAMPART || st === S_EXTRACTOR) {
            kept.push(cs);
            continue;
        }
        const gVal = baseGrid[cs.pos.y * 50 + cs.pos.x];
        if (matchesExpectedGrid(st, gVal)) {
            kept.push(cs);
            continue;
        }
        if ((st === S_CONTAINER || st === S_LINK) && isPoiContainerOrLink(cs.pos, sources, controller, mineral)) {
            kept.push(cs);
            continue;
        }
        if ((st === S_LAB || st === S_TERMINAL || st === S_FACTORY || st === S_NUKER ||
            st === S_POWER_SPAWN || st === S_OBSERVER || st === S_STORAGE || st === S_TOWER ||
            st === S_SPAWN || st === S_EXTENSION || st === S_ROAD || st === S_CONTAINER || st === S_LINK) &&
            typeof cs.remove === 'function') {
            cs.remove();
            continue;
        }
        kept.push(cs);
    }
    return kept;
}

function reconcileBunkerLayout(room, roomState, blueprint, opts) {
    const stats = {
        destroyedBlockingRoads: 0,
        destroyedStrayRoads: 0,
        destroyedExtensions: 0,
        destroyedTowers: 0,
        destroyedSingletons: 0,
        destroyedContainers: 0,
        destroyedSpawns: 0
    };
    if (!room || !room.controller || !room.controller.my || !blueprint || !blueprint.baseGrid) return stats;
    if (roomState && roomState.hostiles && roomState.hostiles.length > 0) return stats;

    const baseGrid = blueprint.baseGrid;
    const okCode = typeof OK !== 'undefined' ? OK : 0;
    const sources = (roomState && roomState.sources) ||
        (room.find && typeof FIND_SOURCES !== 'undefined' ? (room.find(FIND_SOURCES) || []) : []);
    const controller = room.controller;
    const rcl = controller.level || 1;
    const allStructs = roomState
        ? getAllStructures(roomState)
        : (room.find && typeof FIND_STRUCTURES !== 'undefined' ? (room.find(FIND_STRUCTURES) || []) : []);
    const siteCount = (roomState && roomState.constructionSites) ? roomState.constructionSites.length : 0;
    const heap = typeof global !== 'undefined' ? (global.heap || (global.heap = {})) : null;
    const nowTick = typeof Game !== 'undefined' ? Game.time : 0;
    const forceReconcile = !!(opts && opts.force);

    if (!forceReconcile && heap) {
        if (!heap.reconciledLayoutState) heap.reconciledLayoutState = {};
        const rCache = heap.reconciledLayoutState[room.name];
        if (rCache && rCache.version === BLUEPRINT_VERSION && rCache.rcl === rcl &&
            rCache.structCount === allStructs.length && rCache.siteCount === siteCount &&
            nowTick >= rCache.tick && (nowTick - rCache.tick) < 250) {
            return stats;
        }
    }

    // 1. Decommission obsolete built roads (immediate if blocking planned structure; 15/tick if stray)
    const MAX_STRAY_ROADS_PER_TICK = 15;
    const destroyedRoadIds = new Set();
    for (let i = 0; i < allStructs.length; i++) {
        const st = allStructs[i];
        if (!st || !st.pos || st.structureType !== S_ROAD || typeof st.destroy !== 'function') continue;
        const gVal = baseGrid[st.pos.y * 50 + st.pos.x];
        if (gVal === GRID_ROAD) continue;
        const isBlocking = gVal !== GRID_EMPTY && gVal !== GRID_WALL;
        if (isBlocking || stats.destroyedStrayRoads < MAX_STRAY_ROADS_PER_TICK) {
            if (st.destroy() === okCode) {
                if (st.id) destroyedRoadIds.add(st.id);
                if (roomState && roomState.roadGrid) {
                    roomState.roadGrid[st.pos.x * 50 + st.pos.y] = 0;
                }
                if (isBlocking) stats.destroyedBlockingRoads++;
                else stats.destroyedStrayRoads++;
            }
        }
    }
    if (destroyedRoadIds.size > 0 && roomState && Array.isArray(roomState.roads)) {
        roomState.roads = roomState.roads.filter(r => r && !destroyedRoadIds.has(r.id));
    }

    // 2. Rolling Extension migration (up to 6/tick; prioritize extensions blocking v4 tiles)
    const extList = (roomState && Array.isArray(roomState.extensions))
        ? roomState.extensions
        : allStructs.filter(s => s && s.structureType === S_EXTENSION);
    const misExts = [];
    for (let i = 0; i < extList.length; i++) {
        const ext = extList[i];
        if (!ext || !ext.pos || typeof ext.destroy !== 'function') continue;
        const gVal = baseGrid[ext.pos.y * 50 + ext.pos.x];
        if (gVal !== GRID_EXTENSION) {
            const prio = (gVal !== GRID_EMPTY && gVal !== GRID_WALL) ? 0 : 1;
            misExts.push({ ext, prio });
        }
    }
    if (misExts.length > 0) {
        misExts.sort((a, b) => a.prio - b.prio);
        const destroyedExtIds = new Set();
        const MAX_EXT_DESTROY_PER_TICK = 6;
        for (let i = 0; i < misExts.length && stats.destroyedExtensions < MAX_EXT_DESTROY_PER_TICK; i++) {
            const ext = misExts[i].ext;
            if (ext.destroy() === okCode) {
                if (ext.id) destroyedExtIds.add(ext.id);
                stats.destroyedExtensions++;
            }
        }
        if (destroyedExtIds.size > 0 && roomState && Array.isArray(roomState.extensions)) {
            roomState.extensions = roomState.extensions.filter(e => e && !destroyedExtIds.has(e.id));
        }
    }

    // 3. Rolling Tower migration (max 1/tick so >= N-1 towers remain operational)
    const towerList = (roomState && Array.isArray(roomState.towers))
        ? roomState.towers
        : allStructs.filter(s => s && s.structureType === S_TOWER);
    for (let i = 0; i < towerList.length; i++) {
        const tw = towerList[i];
        if (!tw || !tw.pos || typeof tw.destroy !== 'function') continue;
        if (baseGrid[tw.pos.y * 50 + tw.pos.x] !== GRID_TOWER) {
            if (tw.destroy() === okCode) {
                stats.destroyedTowers++;
                if (roomState && Array.isArray(roomState.towers)) {
                    roomState.towers = roomState.towers.filter(t => t && t.id !== tw.id);
                }
            }
            break;
        }
    }

    // 4. Singletons & Labs migration
    const spawns = (roomState && Array.isArray(roomState.spawns))
        ? roomState.spawns
        : (room.find && typeof FIND_MY_SPAWNS !== 'undefined' ? (room.find(FIND_MY_SPAWNS) || []) : []);
    if (spawns.length > 0 && room.storage && room.storage.pos && typeof room.storage.destroy === 'function') {
        if (baseGrid[room.storage.pos.y * 50 + room.storage.pos.x] !== GRID_STORAGE) {
            if (room.storage.destroy() === okCode) {
                stats.destroyedSingletons++;
                if (roomState) roomState.storage = null;
                if (blueprint.storage && blueprint.storage[0] && room.createConstructionSite) {
                    room.createConstructionSite(blueprint.storage[0].x, blueprint.storage[0].y, S_STORAGE);
                }
            }
        }
    }

    const singletonTypes = new Set([S_TERMINAL, S_FACTORY, S_NUKER, S_POWER_SPAWN, S_OBSERVER, S_LAB]);
    const destroyedSingletonIds = new Set();
    for (let i = 0; i < allStructs.length; i++) {
        const st = allStructs[i];
        if (!st || !st.pos || !singletonTypes.has(st.structureType) || typeof st.destroy !== 'function') continue;
        if (!matchesExpectedGrid(st.structureType, baseGrid[st.pos.y * 50 + st.pos.x])) {
            if (st.destroy() === okCode) {
                if (st.id) destroyedSingletonIds.add(st.id);
                stats.destroyedSingletons++;
                if (roomState) {
                    if (st.structureType === S_TERMINAL) roomState.terminal = null;
                    else if (st.structureType === S_FACTORY) roomState.factory = null;
                    else if (st.structureType === S_NUKER) roomState.nuker = null;
                    else if (st.structureType === S_OBSERVER) roomState.observer = null;
                }
            }
        }
    }
    if (destroyedSingletonIds.size > 0 && roomState) {
        if (Array.isArray(roomState.labs)) {
            roomState.labs = roomState.labs.filter(l => l && !destroyedSingletonIds.has(l.id));
        }
        if (Array.isArray(roomState.powerSpawns)) {
            roomState.powerSpawns = roomState.powerSpawns.filter(p => p && !destroyedSingletonIds.has(p.id));
        }
    }

    // 5. Safe Spawn migration (never destroy the sole remaining spawn or an actively spawning spawn)
    if (spawns.length > 1) {
        for (let i = 0; i < spawns.length; i++) {
            const sp = spawns[i];
            if (!sp || !sp.pos || sp.spawning || typeof sp.destroy !== 'function') continue;
            if (baseGrid[sp.pos.y * 50 + sp.pos.x] !== GRID_SPAWN) {
                if (sp.destroy() === okCode) {
                    stats.destroyedSpawns++;
                    if (roomState && Array.isArray(roomState.spawns)) {
                        roomState.spawns = roomState.spawns.filter(s => s && s.id !== sp.id);
                    }
                }
                break;
            }
        }
    }

    // 6. Obsolete non-POI Containers
    const contList = (roomState && Array.isArray(roomState.containers))
        ? roomState.containers
        : allStructs.filter(s => s && s.structureType === S_CONTAINER);
    const mineral = (roomState && roomState.mineral) || null;
    const destroyedContIds = new Set();
    for (let i = 0; i < contList.length; i++) {
        const c = contList[i];
        if (!c || !c.pos || typeof c.destroy !== 'function') continue;
        if (baseGrid[c.pos.y * 50 + c.pos.x] === GRID_CONTAINER) continue;
        const isSrcCont = sources.some(s => s && s.pos && calcDistance(c.pos, s.pos) <= 1);
        const isCtrlCont = controller && controller.pos && calcDistance(c.pos, controller.pos) <= 3;
        const isMinCont = mineral && mineral.pos && calcDistance(c.pos, mineral.pos) <= 1;
        if (!isSrcCont && !isCtrlCont && !isMinCont && c.destroy() === okCode) {
            if (c.id) destroyedContIds.add(c.id);
            stats.destroyedContainers++;
        }
    }
    if (destroyedContIds.size > 0 && roomState && Array.isArray(roomState.containers)) {
        roomState.containers = roomState.containers.filter(c => c && !destroyedContIds.has(c.id));
    }

    const totalDestroyed = stats.destroyedBlockingRoads + stats.destroyedStrayRoads + stats.destroyedExtensions +
        stats.destroyedTowers + stats.destroyedSingletons + stats.destroyedContainers + stats.destroyedSpawns;
    if (heap) {
        if (!heap.reconciledLayoutState) heap.reconciledLayoutState = {};
        if (totalDestroyed === 0) {
            heap.reconciledLayoutState[room.name] = {
                version: BLUEPRINT_VERSION,
                rcl,
                structCount: allStructs.length,
                siteCount,
                tick: nowTick
            };
        } else {
            delete heap.reconciledLayoutState[room.name];
            if (heap.staticRooms && heap.staticRooms[room.name]) {
                heap.staticRooms[room.name].valid = false;
            }
        }
    }

    return stats;
}

function rebakeRoomRoads(roomName) {
    if (!roomName) return null;
    const heap = typeof global !== 'undefined' ? (global.heap || (global.heap = {})) : {};
    const room = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[roomName] : null;
    const roomState = heap.rooms ? heap.rooms[roomName] : null;
    const terrain = room && room.getTerrain
        ? room.getTerrain()
        : (typeof Game !== 'undefined' && Game.map && Game.map.getRoomTerrain
            ? Game.map.getRoomTerrain(roomName)
            : { get: () => 0 });

    BLUEPRINT_CACHE.delete(roomName);
    if (heap.remoteStitchState) delete heap.remoteStitchState[roomName];
    if (heap.roadCostMatrices) delete heap.roadCostMatrices[roomName];
    if (heap.roadPlanCache) delete heap.roadPlanCache[roomName];
    if (heap.reconciledLayoutState) delete heap.reconciledLayoutState[roomName];
    if (heap.roadPlacementState) delete heap.roadPlacementState[roomName];

    const { blueprint, baseGrid, serialized } = generateTopologicalBlueprint(room || roomName, terrain, roomState);
    blueprint._version = BLUEPRINT_VERSION;
    blueprint._serialized = serialized;
    BLUEPRINT_CACHE.set(roomName, blueprint);

    const rcl = (room && room.controller) ? (room.controller.level || 1) : 1;
    if (!room || !room.controller || rcl >= 3) {
        stitchRemoteRoads(roomName, baseGrid);
    }

    const finalSerialized = serializeBaseGrid(baseGrid);
    blueprint._serialized = finalSerialized;
    blueprint._version = BLUEPRINT_VERSION;

    requestSegment(SEGMENT_BASE_PLAN);
    const rawSeg = getSegmentData(SEGMENT_BASE_PLAN);
    if (rawSeg !== null) {
        let segMap = {};
        try { segMap = rawSeg ? JSON.parse(rawSeg) : {}; } catch (e) { segMap = {}; }
        if (!segMap || typeof segMap !== 'object' || segMap._version !== BLUEPRINT_VERSION) {
            segMap = { _version: BLUEPRINT_VERSION };
        }
        segMap._version = BLUEPRINT_VERSION;
        segMap[roomName] = finalSerialized;
        setSegmentData(SEGMENT_BASE_PLAN, JSON.stringify(segMap));
        if (!BLUEPRINT_CACHE._persisted) BLUEPRINT_CACHE._persisted = new Set();
        BLUEPRINT_CACHE._persisted.add(roomName);
        if (BLUEPRINT_CACHE._dirty) BLUEPRINT_CACHE._dirty.delete(roomName);
    } else {
        if (!BLUEPRINT_CACHE._dirty) BLUEPRINT_CACHE._dirty = new Set();
        BLUEPRINT_CACHE._dirty.add(roomName);
        if (BLUEPRINT_CACHE._persisted) BLUEPRINT_CACHE._persisted.delete(roomName);
    }

    if (room) {
        const sites = roomState && roomState.constructionSites
            ? roomState.constructionSites
            : (room.find && typeof FIND_MY_CONSTRUCTION_SITES !== 'undefined' ? (room.find(FIND_MY_CONSTRUCTION_SITES) || []) : []);
        const filtered = pruneNonBlueprintRoadSites(room, sites, baseGrid, roomState);
        if (roomState && roomState.constructionSites) roomState.constructionSites = filtered;
    }

    if (!heap.rebakedVersion) heap.rebakedVersion = {};
    heap.rebakedVersion[roomName] = BLUEPRINT_VERSION;
    markMemoryDirty();

    let roadCount = 0;
    for (let i = 0; i < 2500; i++) {
        if (baseGrid[i] === GRID_ROAD) roadCount++;
    }
    return { roomName, roadCount, version: BLUEPRINT_VERSION };
}

if (typeof registerTaskHandler === 'function') {
    registerTaskHandler('stitchRemoteRoads', (task) => {
        if (task && task.data && task.data.roomName) {
            stitchRemoteRoads(task.data.roomName);
        }
        return true;
    });
}

// --- 8. CONSTRUCTION SITES, PHOENIX & ACCESS CHECKS ---

function placeBunkerSites(room) {
    if (!room || !room.controller || !room.controller.my || !room.createConstructionSite) return;
    const rcl = room.controller.level || 1;
    const roomState = global.heap && global.heap.rooms ? global.heap.rooms[room.name] : null;
    if (rcl === 1) {
        const r1Spawns = (roomState && roomState.spawns) || (room.find ? room.find(FIND_MY_SPAWNS) : []);
        const r1Sites = (roomState && roomState.constructionSites) || (room.find ? room.find(FIND_MY_CONSTRUCTION_SITES) : []);
        if (r1Spawns.length === 0 && !r1Sites.some(s => s.structureType === S_SPAWN)) {
            const bp1 = getRoomBlueprint(room);
            const sp1 = (bp1 && bp1.spawns && bp1.spawns[0]) || (bp1 && bp1.anchor) || { x: 25, y: 25 };
            room.createConstructionSite(sp1.x, sp1.y, S_SPAWN);
        }
        return;
    }

    requestSegment(SEGMENT_BASE_PLAN);
    const rawSeg = getSegmentData(SEGMENT_BASE_PLAN);
    if (rawSeg !== null) {
        let segMap = null;
        try { segMap = rawSeg ? JSON.parse(rawSeg) : {}; } catch (e) { segMap = {}; }
        if (!segMap || segMap._version !== BLUEPRINT_VERSION || !segMap[room.name]) {
            rebakeRoomRoads(room.name);
        }
    }

    const rawSites = roomState && roomState.constructionSites
        ? roomState.constructionSites
        : (room.find ? (room.find(FIND_MY_CONSTRUCTION_SITES) || []) : []);

    const MAX_SITES = 6;
    const terrain = room.getTerrain ? room.getTerrain() : { get: () => 0 };

    const fastBlueprint = getRoomBlueprint(room);
    const prunedSites = pruneNonBlueprintRoadSites(room, rawSites, fastBlueprint && fastBlueprint.baseGrid, roomState);
    reconcileBunkerLayout(room, roomState, fastBlueprint);
    const currentSites = prunedSites;
    if (roomState && roomState.constructionSites) roomState.constructionSites = currentSites;
    const nonRampartSites = currentSites.filter(s => s.structureType !== S_RAMPART);
    const fastAnchor = fastBlueprint && fastBlueprint.anchor;
    const fastContainers = (roomState && roomState.containers) || [];

    if (fastAnchor && currentSites.length < 90) {
        const coreSlots = (rcl >= 3) ? [{ x: fastAnchor.x - 2, y: fastAnchor.y }, { x: fastAnchor.x + 2, y: fastAnchor.y }] : [{ x: fastAnchor.x - 2, y: fastAnchor.y }];
        for (let i = 0; i < coreSlots.length; i++) {
            const cx = coreSlots[i].x;
            const cy = coreSlots[i].y;
            if (cx < 2 || cx > 47 || cy < 2 || cy > 47 || isTerrainWall(terrain, cx, cy)) continue;
            const hasC = fastContainers.some(c => c.pos.x === cx && c.pos.y === cy) ||
                currentSites.some(cs => cs.structureType === S_CONTAINER && cs.pos.x === cx && cs.pos.y === cy);
            if (!hasC) room.createConstructionSite(cx, cy, S_CONTAINER);
        }
    }

    if (nonRampartSites.length >= MAX_SITES) return;

    const blueprint = fastBlueprint;
    const spawns = (roomState && roomState.spawns) || (room.find ? room.find(FIND_MY_SPAWNS) : []);
    const hubPos = spawns.length > 0 ? spawns[0].pos : (blueprint && blueprint.anchor ? blueprint.anchor : { x: 25, y: 25 });

    let activeSites = nonRampartSites.length;

    function isValidBuildTile(x, y, allowWall) {
        if (allowWall) return x >= 1 && x <= 48 && y >= 1 && y <= 48;
        if (x < 2 || x > 47 || y < 2 || y > 47) return false;
        if (isTerrainWall(terrain, x, y)) return false;
        return true;
    }

    function tryPlace(x, y, type) {
        if (type !== S_RAMPART && activeSites >= MAX_SITES) return false;
        if (currentSites.length >= 80) return false;
        if (!isValidBuildTile(x, y, type === S_EXTRACTOR)) return false;
        if (room.createConstructionSite(x, y, type) === (typeof OK !== 'undefined' ? OK : 0)) {
            if (type !== S_RAMPART) activeSites++;
            return true;
        }
        return false;
    }

    const sources = (roomState && roomState.sources) || (room.find ? room.find(FIND_SOURCES) : []);
    const extensions = (roomState && roomState.extensions) || [];
    const extSites = currentSites.filter(s => s.structureType === S_EXTENSION);
    const containerSites = currentSites.filter(s => s.structureType === S_CONTAINER);

    const anchor = (blueprint && blueprint.anchor) ? blueprint.anchor : hubPos;
    const containers = (roomState && roomState.containers) || [];

    // Priority 0a: Spawn 1 (always highest priority if missing)
    if (spawns.length === 0 && activeSites < MAX_SITES && !currentSites.some(s => s.structureType === S_SPAWN)) {
        const sp0 = (blueprint && blueprint.spawns && blueprint.spawns[0]) || anchor;
        if (sp0) tryPlace(sp0.x, sp0.y, S_SPAWN);
    }

    // Priority 0b: Core Container 0 at (-2, 0)
    if (anchor && activeSites < MAX_SITES) {
        const c0x = anchor.x - 2;
        const c0y = anchor.y;
        const hasC0 = containers.some(c => c.pos.x === c0x && c.pos.y === c0y) ||
                      containerSites.some(cs => cs.pos.x === c0x && cs.pos.y === c0y);
        if (!hasC0) tryPlace(c0x, c0y, S_CONTAINER);
    }
    if (rcl === 1) return;

    // Priority 1a: Fast-Filler Extensions (first 5 only before Tower-Rush at RCL 3)
    const extLimits = [0, 0, 5, 10, 20, 30, 40, 50, 60];
    const maxExt = extLimits[rcl] || 0;
    const priorityExtCap = Math.min(5, maxExt);
    let extTotal = extensions.length + extSites.length;
    if (extTotal < priorityExtCap && blueprint && blueprint.extensions) {
        const slot0Offsets = [
            { dx: -2, dy: -2 }, { dx: -1, dy: -2 }, { dx: 0, dy: -2 },
            { dx: 0, dy: -1 }, { dx: -1, dy: 0 }
        ];
        for (let i = 0; i < slot0Offsets.length && activeSites < MAX_SITES && extTotal < priorityExtCap; i++) {
            const ex = anchor.x + slot0Offsets[i].dx;
            const ey = anchor.y + slot0Offsets[i].dy;
            const exists = extensions.some(e => e.pos.x === ex && e.pos.y === ey) ||
                           extSites.some(s => s.pos.x === ex && s.pos.y === ey);
            if (!exists && tryPlace(ex, ey, S_EXTENSION)) {
                extTotal++;
            }
        }
        if (extTotal < priorityExtCap) {
            const candidates = blueprint.extensions
                .filter(e => (e.rcl || 2) <= rcl)
                .slice()
                .sort((a, b) => calcDistance(a, anchor) - calcDistance(b, anchor));

            for (let i = 0; i < candidates.length && activeSites < MAX_SITES && extTotal < priorityExtCap; i++) {
                if (tryPlace(candidates[i].x, candidates[i].y, S_EXTENSION)) {
                    extTotal++;
                }
            }
        }
    }

    // Priority 1b: Tower-Rush (place Towers at rcl >= 3 ahead of extra extensions & source/controller containers)
    const allMyStructs = (roomState && roomState.towers && roomState.ramparts)
        ? null
        : (room.find && typeof FIND_MY_STRUCTURES !== 'undefined' ? room.find(FIND_MY_STRUCTURES) : []);
    const towers = (roomState && roomState.towers) || (allMyStructs ? allMyStructs.filter(s => s.structureType === S_TOWER) : []);
    const towerSites = currentSites.filter(s => s.structureType === S_TOWER);
    if (rcl >= 3 && activeSites < MAX_SITES && blueprint && blueprint.towers) {
        const towerLimits = [0, 0, 0, 1, 1, 2, 2, 3, 6];
        const maxTowers = towerLimits[rcl] || 0;
        let towerTotal = towers.length + towerSites.length;
        for (let i = 0; i < blueprint.towers.length && activeSites < MAX_SITES && towerTotal < maxTowers; i++) {
            const t = blueprint.towers[i];
            if ((t.rcl || 3) <= rcl && tryPlace(t.x, t.y, S_TOWER)) {
                towerTotal++;
            }
        }
    }

    // Priority 1c: Critical Core Ramparts at rcl >= 3 (Spawn 1, Tower 1, Storage)
    if (rcl >= 3) {
        const existingRamparts = (roomState && roomState.ramparts) || (allMyStructs ? allMyStructs.filter(s => s.structureType === S_RAMPART) : []);
        const hasRampartOrSite = (rx, ry) => existingRamparts.some(r => r.pos.x === rx && r.pos.y === ry) ||
            currentSites.some(cs => cs.structureType === S_RAMPART && cs.pos.x === rx && cs.pos.y === ry);
        for (let sp = 0; sp < spawns.length; sp++) {
            const sx = spawns[sp].pos.x;
            const sy = spawns[sp].pos.y;
            if (!hasRampartOrSite(sx, sy)) tryPlace(sx, sy, S_RAMPART);
        }
        for (let tw = 0; tw < towers.length; tw++) {
            const tx = towers[tw].pos.x;
            const ty = towers[tw].pos.y;
            if (!hasRampartOrSite(tx, ty)) tryPlace(tx, ty, S_RAMPART);
        }
        for (let ts = 0; ts < towerSites.length; ts++) {
            const tsx = towerSites[ts].pos.x;
            const tsy = towerSites[ts].pos.y;
            if (!hasRampartOrSite(tsx, tsy)) tryPlace(tsx, tsy, S_RAMPART);
        }
        if (room.storage && !hasRampartOrSite(room.storage.pos.x, room.storage.pos.y)) {
            tryPlace(room.storage.pos.x, room.storage.pos.y, S_RAMPART);
        }
    }

    // Priority 2: Second Core Container at (+2, 0) & Source Containers
    if (rcl >= 3 && anchor && activeSites < MAX_SITES) {
        const c1x = anchor.x + 2;
        const c1y = anchor.y;
        const hasC1 = containers.some(c => c.pos.x === c1x && c.pos.y === c1y) ||
                      containerSites.some(cs => cs.pos.x === c1x && cs.pos.y === c1y);
        if (!hasC1) tryPlace(c1x, c1y, S_CONTAINER);
    }

    if (rcl >= 3) {
        for (let i = 0; i < sources.length && activeSites < MAX_SITES; i++) {
            const src = sources[i];
            const hasCont = (roomState && roomState.containerBySource && roomState.containerBySource[src.id]) ||
                            containers.some(c => calcDistance(c.pos, src.pos) <= 1);
            const hasSite = containerSites.some(cs => calcDistance(cs.pos, src.pos) <= 1);
            if (!hasCont && !hasSite) {
                const openAdj = [];
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = src.pos.x + dx;
                        const ny = src.pos.y + dy;
                        if (nx === hubPos.x && ny === hubPos.y) continue;
                        if (!isValidBuildTile(nx, ny)) continue;
                        openAdj.push({ x: nx, y: ny, d: calcDistance({ x: nx, y: ny }, hubPos) });
                    }
                }
                openAdj.sort((a, b) => a.d - b.d);
                const bestSpot = openAdj.length > 1 && sources.length === 1 ? openAdj[1] : openAdj[0];
                if (bestSpot) tryPlace(bestSpot.x, bestSpot.y, S_CONTAINER);
            }
        }
    }

    // Priority 3: Controller Container
    if ((extensions.length >= 3 || rcl >= 3) && activeSites < MAX_SITES) {
        const ctrl = room.controller;
        const hasCtrlCont = (roomState && roomState.controllerContainer) ||
                            (roomState && roomState.containers && roomState.containers.some(c => calcDistance(c.pos, ctrl.pos) <= 3));
        const hasCtrlSite = containerSites.some(cs => calcDistance(cs.pos, ctrl.pos) <= 3);
        if (!hasCtrlCont && !hasCtrlSite) {
            let bestSpot = null;
            let bestDist = Infinity;
            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
                    const nx = ctrl.pos.x + dx;
                    const ny = ctrl.pos.y + dy;
                    if (!isValidBuildTile(nx, ny)) continue;
                    const d = calcDistance({ x: nx, y: ny }, hubPos);
                    if (d < bestDist) {
                        bestDist = d;
                        bestSpot = { x: nx, y: ny };
                    }
                }
            }
            if (bestSpot) tryPlace(bestSpot.x, bestSpot.y, S_CONTAINER);
        }
    }

    // Priority 5a: Storage
    if (rcl >= 4 && activeSites < MAX_SITES && !room.storage && blueprint && blueprint.storage && blueprint.storage.length > 0) {
        const hasStorageSite = currentSites.some(s => s.structureType === S_STORAGE);
        if (!hasStorageSite) {
            tryPlace(blueprint.storage[0].x, blueprint.storage[0].y, S_STORAGE);
        }
    }

    // Priority 5b: Remaining Extensions
    if (extTotal < maxExt && activeSites < MAX_SITES && blueprint && blueprint.extensions) {
        const candidates = blueprint.extensions
            .filter(e => (e.rcl || 2) <= rcl)
            .slice()
            .sort((a, b) => calcDistance(a, blueprint.anchor || hubPos) - calcDistance(b, blueprint.anchor || hubPos));

        for (let i = 0; i < candidates.length && activeSites < MAX_SITES && extTotal < maxExt; i++) {
            if (tryPlace(candidates[i].x, candidates[i].y, S_EXTENSION)) {
                extTotal++;
            }
        }
    }

    // Priority 6: Links (RCL 5: Hub + Furthest Source -> RCL 6: 2nd Source/Core -> RCL 7: Core + Controller -> RCL 8: Remaining)
    if (rcl >= 5 && activeSites < MAX_SITES) {
        const linkLimits = [0, 0, 0, 0, 0, 2, 3, 4, 6];
        const maxLinks = linkLimits[rcl] || 0;
        const links = (roomState && roomState.links) || [];
        const linkSites = currentSites.filter(s => s.structureType === S_LINK);
        let linkTotal = links.length + linkSites.length;

        // Clean up any misplaced links if over quota or misaligned with baseGrid / POI ranges
        for (let i = 0; i < links.length; i++) {
            const l = links[i];
            const isCore = anchor && l.pos.x === anchor.x && l.pos.y === anchor.y;
            const isBlueprintLink = !!(blueprint && blueprint.baseGrid && blueprint.baseGrid[l.pos.y * 50 + l.pos.x] === GRID_LINK);
            const isSrc = sources.some(s => calcDistance(l.pos, s.pos) <= 2);
            const isCtrl = (rcl >= 7) && room.controller && calcDistance(l.pos, room.controller.pos) <= 3;
            const isHub = (rcl >= 5) && room.storage && calcDistance(l.pos, room.storage.pos) <= 2;
            if (!isCore && !isBlueprintLink && !isSrc && !isCtrl && !isHub && l.destroy) {
                l.destroy();
                linkTotal--;
                if (roomState && Array.isArray(roomState.links)) {
                    roomState.links = roomState.links.filter(lk => lk && lk.id !== l.id);
                }
            }
        }

        // 6a: Hub Link FIRST (RCL 5+) - prevents trapped linked energy in Fast-Filler stamp
        if (linkTotal < maxLinks && activeSites < MAX_SITES) {
            const hubBlueprints = (blueprint && blueprint.links) ? blueprint.links.filter(bl => bl.intent === 'hub') : [];
            let hasHubLink = hubBlueprints.some(bl =>
                links.some(l => l.pos.x === bl.x && l.pos.y === bl.y) ||
                linkSites.some(ls => ls.pos.x === bl.x && ls.pos.y === bl.y)
            ) || !!(room.storage && (
                links.some(l => (!anchor || l.pos.x !== anchor.x || l.pos.y !== anchor.y) && calcDistance(l.pos, room.storage.pos) <= 2) ||
                linkSites.some(ls => (!anchor || ls.pos.x !== anchor.x || ls.pos.y !== anchor.y) && calcDistance(ls.pos, room.storage.pos) <= 2)
            ));

            if (!hasHubLink) {
                for (let i = 0; i < hubBlueprints.length && !hasHubLink && linkTotal < maxLinks && activeSites < MAX_SITES; i++) {
                    const bl = hubBlueprints[i];
                    if (tryPlace(bl.x, bl.y, S_LINK)) {
                        linkTotal++;
                        hasHubLink = true;
                    }
                }
                if (!hasHubLink && room.storage && linkTotal < maxLinks && activeSites < MAX_SITES) {
                    const stPos = room.storage.pos;
                    let bestHubSpot = null;
                    let bestHubScore = Infinity;
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = stPos.x + dx;
                            const ny = stPos.y + dy;
                            if (anchor && nx === anchor.x && ny === anchor.y) continue;
                            if (!isValidBuildTile(nx, ny)) continue;
                            const dHub = calcDistance({ x: nx, y: ny }, hubPos);
                            const dSt = calcDistance({ x: nx, y: ny }, stPos);
                            const sc = dSt * 10 + dHub;
                            if (sc < bestHubScore) {
                                bestHubScore = sc;
                                bestHubSpot = { x: nx, y: ny };
                            }
                        }
                    }
                    if (bestHubSpot && tryPlace(bestHubSpot.x, bestHubSpot.y, S_LINK)) {
                        linkTotal++;
                    }
                }
            }
        }

        // 6b: Source Links sorted FURTHEST-first from Hub (RCL 5: furthest source; RCL 6: 2nd source)
        const sourcesFurthestFirst = sources.slice().sort((a, b) => calcDistance(b.pos, hubPos) - calcDistance(a.pos, hubPos));
        for (let s = 0; s < sourcesFurthestFirst.length && linkTotal < maxLinks && activeSites < MAX_SITES; s++) {
            const src = sourcesFurthestFirst[s];
            const hasSrcLink = links.some(l => calcDistance(l.pos, src.pos) <= 2) ||
                               linkSites.some(ls => calcDistance(ls.pos, src.pos) <= 2);
            if (!hasSrcLink) {
                const srcCont = (roomState && roomState.containerBySource && roomState.containerBySource[src.id]) ||
                                (roomState && roomState.containers && roomState.containers.find(c => calcDistance(c.pos, src.pos) <= 1));
                const refPos = srcCont ? srcCont.pos : src.pos;
                let bestSpot = null;
                let bestDist = Infinity;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = refPos.x + dx, ny = refPos.y + dy;
                        if (!isValidBuildTile(nx, ny)) continue;
                        if (calcDistance({ x: nx, y: ny }, src.pos) > 2) continue;
                        if (anchor && nx === anchor.x && ny === anchor.y) continue;
                        const d = calcDistance({ x: nx, y: ny }, hubPos);
                        if (d < bestDist) {
                            bestDist = d;
                            bestSpot = { x: nx, y: ny };
                        }
                    }
                }
                if (bestSpot && tryPlace(bestSpot.x, bestSpot.y, S_LINK)) {
                    linkTotal++;
                }
            }
        }

        // 6c: Core Fast-Filler Link at (anchor.x, anchor.y) (RCL 6 on 1-source rooms, RCL 7 on 2-source rooms)
        if (anchor && linkTotal < maxLinks && activeSites < MAX_SITES) {
            const hasCoreLink = links.some(l => l.pos.x === anchor.x && l.pos.y === anchor.y) ||
                                linkSites.some(ls => ls.pos.x === anchor.x && ls.pos.y === anchor.y);
            if (!hasCoreLink) {
                if (tryPlace(anchor.x, anchor.y, S_LINK)) linkTotal++;
            }
        }

        // 6d: Controller Link (RCL >= 7, within range 3 of controller)
        if (rcl >= 7 && linkTotal < maxLinks && activeSites < MAX_SITES && room.controller) {
            const ctrl = room.controller;
            const hasCtrlLink = links.some(l => calcDistance(l.pos, ctrl.pos) <= 3) ||
                                linkSites.some(ls => calcDistance(ls.pos, ctrl.pos) <= 3);
            if (!hasCtrlLink) {
                const ctrlCont = roomState && roomState.controllerContainer;
                const refPos = ctrlCont ? ctrlCont.pos : ctrl.pos;
                let bestSpot = null;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = refPos.x + dx, ny = refPos.y + dy;
                        if (!isValidBuildTile(nx, ny)) continue;
                        if (calcDistance({ x: nx, y: ny }, ctrl.pos) > 3) continue;
                        bestSpot = { x: nx, y: ny };
                        break;
                    }
                    if (bestSpot) break;
                }
                if (bestSpot && tryPlace(bestSpot.x, bestSpot.y, S_LINK)) {
                    linkTotal++;
                }
            }
        }

        // 6e: Any remaining Blueprint Links at RCL 8
        if (rcl >= 8 && blueprint && blueprint.links && linkTotal < maxLinks && activeSites < MAX_SITES) {
            for (let i = 0; i < blueprint.links.length && linkTotal < maxLinks && activeSites < MAX_SITES; i++) {
                const bl = blueprint.links[i];
                const hasLinkAt = links.some(l => l.pos.x === bl.x && l.pos.y === bl.y) ||
                                  linkSites.some(ls => ls.pos.x === bl.x && ls.pos.y === bl.y);
                if (!hasLinkAt && tryPlace(bl.x, bl.y, S_LINK)) {
                    linkTotal++;
                }
            }
        }
    }

    // Priority 7: Extractor, Mineral Container, Terminal, Labs, Spawns
    if (rcl >= 6 && activeSites < MAX_SITES) {
        const mineral = (roomState && roomState.mineral) ||
            (room.find && typeof FIND_MINERALS !== 'undefined' ? ((room.find(FIND_MINERALS) || [])[0] || null) : null);
        if (mineral) {
            const hasExt = !!(roomState && roomState.extractor) || currentSites.some(s => s.structureType === S_EXTRACTOR);
            if (!hasExt) tryPlace(mineral.pos.x, mineral.pos.y, S_EXTRACTOR);

            const hasMinCont = containers.some(c => calcDistance(c.pos, mineral.pos) <= 1) ||
                containerSites.some(cs => calcDistance(cs.pos, mineral.pos) <= 1);
            if (!hasMinCont && activeSites < MAX_SITES) {
                let bestMinSpot = null;
                let bestMinScore = Infinity;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = mineral.pos.x + dx;
                        const ny = mineral.pos.y + dy;
                        if (!isValidBuildTile(nx, ny, false)) continue;
                        const gVal = blueprint && blueprint.baseGrid ? blueprint.baseGrid[ny * 50 + nx] : GRID_EMPTY;
                        if (gVal !== GRID_EMPTY && gVal !== GRID_ROAD && gVal !== GRID_CONTAINER) continue;
                        const score = calcDistance({ x: nx, y: ny }, hubPos) + (gVal === GRID_ROAD ? 10 : 0);
                        if (score < bestMinScore) {
                            bestMinScore = score;
                            bestMinSpot = { x: nx, y: ny };
                        }
                    }
                }
                if (bestMinSpot) tryPlace(bestMinSpot.x, bestMinSpot.y, S_CONTAINER);
            }
        }

        if (!room.terminal && blueprint && blueprint.terminal && blueprint.terminal.length > 0 && activeSites < MAX_SITES) {
            if (!currentSites.some(s => s.structureType === S_TERMINAL)) {
                tryPlace(blueprint.terminal[0].x, blueprint.terminal[0].y, S_TERMINAL);
            }
        }

        if (blueprint && blueprint.labs && activeSites < MAX_SITES) {
            const labLimits = [0, 0, 0, 0, 0, 0, 3, 6, 10];
            const maxLabs = labLimits[rcl] || 0;
            const labs = (roomState && roomState.labs) || [];
            const labSites = currentSites.filter(s => s.structureType === S_LAB);
            let labTotal = labs.length + labSites.length;
            for (let i = 0; i < blueprint.labs.length && activeSites < MAX_SITES && labTotal < maxLabs; i++) {
                const l = blueprint.labs[i];
                if ((l.rcl || 6) > rcl) continue;
                const exists = labs.some(x => x.pos && x.pos.x === l.x && x.pos.y === l.y) ||
                    labSites.some(cs => cs.pos && cs.pos.x === l.x && cs.pos.y === l.y);
                if (!exists && tryPlace(l.x, l.y, S_LAB)) labTotal++;
            }
        }

        if (rcl >= 7 && blueprint && blueprint.spawns) {
            const maxSpawns = rcl >= 8 ? 3 : 2;
            let spTotal = spawns.length + currentSites.filter(s => s.structureType === S_SPAWN).length;
            for (let i = 0; i < blueprint.spawns.length && activeSites < MAX_SITES && spTotal < maxSpawns; i++) {
                const sp = blueprint.spawns[i];
                if ((sp.rcl || 1) <= rcl && tryPlace(sp.x, sp.y, S_SPAWN)) spTotal++;
            }
            if (blueprint.factory && blueprint.factory.length > 0 && !(roomState && roomState.factory)) {
                tryPlace(blueprint.factory[0].x, blueprint.factory[0].y, S_FACTORY);
            }
        }

        if (rcl >= 8 && blueprint) {
            const hasType = (t) => {
                if (t === S_OBSERVER) return !!(roomState && roomState.observer) || currentSites.some(s => s.structureType === t);
                if (t === S_POWER_SPAWN) return !!(roomState && roomState.powerSpawns && roomState.powerSpawns.length > 0) || currentSites.some(s => s.structureType === t);
                if (t === S_NUKER) return !!(roomState && roomState.nuker) || currentSites.some(s => s.structureType === t);
                return currentSites.some(s => s.structureType === t);
            };
            if (blueprint.observer && blueprint.observer[0] && !hasType(S_OBSERVER)) tryPlace(blueprint.observer[0].x, blueprint.observer[0].y, S_OBSERVER);
            if (blueprint.powerSpawn && blueprint.powerSpawn[0] && !hasType(S_POWER_SPAWN)) tryPlace(blueprint.powerSpawn[0].x, blueprint.powerSpawn[0].y, S_POWER_SPAWN);
            if (blueprint.nuker && blueprint.nuker[0] && !hasType(S_NUKER)) tryPlace(blueprint.nuker[0].x, blueprint.nuker[0].y, S_NUKER);
        }
    }

    // Priority 9: Retroactive & Throttled GRID_ROAD Placement + 500-Tick Decayed-Road Watchdog
    if (rcl >= 3 && blueprint && blueprint.baseGrid) {
        const stitchMeta = (typeof global !== 'undefined' && global.heap && global.heap.remoteStitchState)
            ? global.heap.remoteStitchState[room.name]
            : null;
        if (!stitchMeta || (typeof Game !== 'undefined' && (Game.time - stitchMeta.tick) >= 1000)) {
            if (stitchMeta) stitchMeta.tick = typeof Game !== 'undefined' ? Game.time : 0;
            if (typeof scheduleTask === 'function') {
                scheduleTask('stitchRemoteRoads', { roomName: room.name }, 'stitch:' + room.name);
            } else {
                stitchRemoteRoads(room.name, blueprint.baseGrid);
            }
        }
    }

    const criticalSiteTypes = new Set([S_SPAWN, S_EXTENSION, S_CONTAINER, S_TOWER, S_STORAGE, S_LINK, S_TERMINAL, S_EXTRACTOR, S_LAB, S_FACTORY, S_POWER_SPAWN, S_NUKER, S_OBSERVER]);
    const initialCriticalSites = currentSites.filter(s => criticalSiteTypes.has(s.structureType)).length;
    const newCriticalPlaced = activeSites - nonRampartSites.length;
    const hasCriticalSites = (initialCriticalSites + newCriticalPlaced) > 0;

    if (!hasCriticalSites && rcl >= 2 && blueprint && blueprint.baseGrid && currentSites.length < 80) {
        const heap = typeof global !== 'undefined' ? (global.heap || (global.heap = {})) : {};
        if (!heap.roadWatchdogTick) heap.roadWatchdogTick = {};
        if (!heap.roadPlacementState) heap.roadPlacementState = {};
        const nowTick = typeof Game !== 'undefined' ? Game.time : 0;
        const rpRoadCount = (roomState && roomState.roadIds) ? roomState.roadIds.length : -1;
        const rpCache = heap.roadPlacementState[room.name];
        const doWatchdogSync = !!(roomState && roomState.roadGrid && (!heap.roadWatchdogTick[room.name] || (nowTick - heap.roadWatchdogTick[room.name]) >= 500));

        if (!doWatchdogSync && rpCache && rpCache.version === BLUEPRINT_VERSION && rpCache.rcl === rcl &&
            rpRoadCount >= 0 && rpCache.roadCount === rpRoadCount && currentSites.length === 0 &&
            nowTick >= rpCache.tick && (nowTick - rpCache.tick) < 250) {
            return;
        }

        const impassable = new Uint8Array(2500);
        const liveRoadMask = new Uint8Array(2500);
        const allStructs = roomState
            ? getAllStructures(roomState)
            : (room.find && typeof FIND_STRUCTURES !== 'undefined' ? (room.find(FIND_STRUCTURES) || []) : []);

        if (doWatchdogSync) {
            roomState.roadGrid.fill(0);
            heap.roadWatchdogTick[room.name] = nowTick;
        }

        for (let i = 0; i < allStructs.length; i++) {
            const st = allStructs[i];
            if (!st || !st.pos) continue;
            const bIdx = st.pos.y * 50 + st.pos.x;
            if (st.structureType === S_ROAD) {
                liveRoadMask[bIdx] = 1;
                if (roomState && roomState.roadGrid) {
                    roomState.roadGrid[st.pos.x * 50 + st.pos.y] = 1;
                }
            } else if (st.structureType !== S_RAMPART && st.structureType !== S_CONTAINER) {
                impassable[bIdx] = 1;
            }
        }

        let existingRoadSites = 0;
        for (let i = 0; i < currentSites.length; i++) {
            const cs = currentSites[i];
            if (!cs || !cs.pos) continue;
            impassable[cs.pos.y * 50 + cs.pos.x] = 1;
            if (cs.structureType === S_ROAD) existingRoadSites++;
        }

        const MAX_ROAD_SITES_PER_PASS = 5;
        if (existingRoadSites < MAX_ROAD_SITES_PER_PASS) {
            const roadCandidates = [];
            for (let y = 1; y < 49; y++) {
                for (let x = 1; x < 49; x++) {
                    const bIdx = y * 50 + x;
                    if (blueprint.baseGrid[bIdx] !== GRID_ROAD) continue;
                    const gridHasRoad = liveRoadMask[bIdx] === 1 ||
                        (roomState && roomState.roadGrid && !doWatchdogSync && roomState.roadGrid[x * 50 + y] === 1 && liveRoadMask[bIdx] === 1);
                    if (gridHasRoad || impassable[bIdx] === 1) continue;
                    if (isTerrainWall(terrain, x, y)) continue;
                    const dist = calcDistance({ x, y }, anchor);
                    if (rcl === 2 && dist > 3) continue;
                    roadCandidates.push({ x, y, dist });
                }
            }
            roadCandidates.sort((a, b) => a.dist - b.dist);

            let roadsPlaced = 0;
            const roadBudget = MAX_ROAD_SITES_PER_PASS - existingRoadSites;
            const okCode = typeof OK !== 'undefined' ? OK : 0;
            for (let i = 0; i < roadCandidates.length && roadsPlaced < roadBudget && (currentSites.length + roadsPlaced) < 80; i++) {
                const rc = roadCandidates[i];
                if (room.createConstructionSite(rc.x, rc.y, S_ROAD) === okCode) {
                    roadsPlaced++;
                }
            }

            if (roadCandidates.length === 0 && rpRoadCount >= 0) {
                heap.roadPlacementState[room.name] = { version: BLUEPRINT_VERSION, rcl, roadCount: rpRoadCount, tick: nowTick };
            } else if (roadCandidates.length > 0 || roadsPlaced > 0) {
                delete heap.roadPlacementState[room.name];
            }
        }
    }
}

function runPhoenixStateMachine(room, roomState) {
    if (!room || !room.controller || !room.controller.my || !room.memory) return;
    if (room.memory.phoenixComplete === true) return;

    const rcl = room.controller.level || 1;
    if (rcl < 4 || !room.storage || !room.storage.store) return;

    const state = room.memory.phoenix || 0;
    if (state === 0 && (room.storage.store[typeof RESOURCE_ENERGY !== 'undefined' ? RESOURCE_ENERGY : 'energy'] || 0) < 100000) return;

    const blueprint = getRoomBlueprint(room);
    if (!blueprint || !blueprint.anchor) return;

    const tx = blueprint.anchor.x - 2;
    const ty = blueprint.anchor.y - 1;
    const spawns = (roomState && roomState.spawns) || (room.find ? room.find(FIND_MY_SPAWNS) : []);
    const hostiles = (roomState && roomState.hostiles) || [];

    if (state === 0) {
        if (spawns.some(s => s.pos.x === tx && s.pos.y === ty)) {
            room.memory.phoenixComplete = true;
            delete room.memory.phoenix;
            return;
        }
        if (spawns.length > 0 && hostiles.length === 0) {
            room.memory.phoenix = 1;
        }
        return;
    }

    if (state === 1) {
        if (hostiles.length > 0) {
            room.memory.phoenix = 0;
            return;
        }
        let blocked = false;
        if (room.lookForAt) {
            const structs = room.lookForAt(LOOK_STRUCTURES, tx, ty);
            for (let i = 0; i < structs.length; i++) {
                const st = structs[i];
                if (st.structureType !== S_SPAWN && st.structureType !== S_RAMPART && st.destroy) {
                    st.destroy();
                    blocked = true;
                }
            }
        }
        if (!blocked) {
            room.memory.phoenix = 2;
        }
        return;
    }

    if (state === 2) {
        if (hostiles.length > 0) {
            room.memory.phoenix = 0;
            return;
        }
        const builders = (roomState && roomState.creepsByRole && roomState.creepsByRole.builder) || [];
        let readyCount = 0;
        for (let i = 0; i < builders.length; i++) {
            const b = builders[i];
            if (!b || b.spawning) continue;
            if (calcDistance(b.pos, { x: tx, y: ty }) <= 2 && b.store && (b.store[typeof RESOURCE_ENERGY !== 'undefined' ? RESOURCE_ENERGY : 'energy'] || 0) > 0) {
                readyCount++;
            }
        }
        if (readyCount >= 4) {
            room.memory.phoenix = 3;
        }
        return;
    }

    if (state === 3) {
        if (spawns.length > 0) {
            const oldSpawn = spawns.find(s => s.pos.x !== tx || s.pos.y !== ty);
            if (oldSpawn && oldSpawn.destroy) {
                oldSpawn.destroy();
            }
        }
        room.createConstructionSite(tx, ty, S_SPAWN);
        room.memory.phoenix = 4;
        return;
    }

    if (state === 4) {
        if (spawns.some(s => s.pos.x === tx && s.pos.y === ty)) {
            room.memory.phoenixComplete = true;
            delete room.memory.phoenix;
            return;
        }
        const sites = room.lookForAt ? room.lookForAt(LOOK_CONSTRUCTION_SITES, tx, ty) : [];
        if (!sites.some(s => s.structureType === S_SPAWN)) {
            room.createConstructionSite(tx, ty, S_SPAWN);
        }
    }
}

function addRoadRamparts() {
    // Disabled: Prevents multiple/double rows of ramparts at road entrances.
    // Dinic's Min-Cut provides an exact single-choke cut.
    return;
}

function addRampartRoads() {
    return;
}

function addOutpostRamparts() {
    // Disabled: Prevents scattering indefensible 3x3 rings of ramparts around remote sources/controller/mineral.
    // Colony defense focuses exclusively on the fortified Citadel perimeter.
    return;
}

function validateGlobalAccessibility(blueprint, terrain, anchor) {
    if (!blueprint || !anchor) return;
    const reachable = new Uint8Array(2500);
    const q = new Int32Array(2500);
    let head = 0, tail = 0;

    const startKey = anchor.x * 50 + anchor.y;
    reachable[startKey] = 1;
    q[tail++] = startKey;

    const blockSet = new Uint8Array(2500);
    const groups = [
        blueprint.spawns, blueprint.extensions, blueprint.towers, blueprint.storage,
        blueprint.terminal, blueprint.factory, blueprint.labs, blueprint.nuker,
        blueprint.observer, blueprint.powerSpawn
    ];
    for (let g = 0; g < groups.length; g++) {
        const arr = groups[g];
        if (!arr) continue;
        for (let j = 0; j < arr.length; j++) {
            blockSet[arr[j].x * 50 + arr[j].y] = 1;
        }
    }

    const dirs = [
        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
        { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }
    ];
    while (head < tail) {
        const cur = q[head++];
        const cx = Math.floor(cur / 50);
        const cy = cur % 50;
        for (let i = 0; i < 8; i++) {
            const nx = cx + dirs[i].x;
            const ny = cy + dirs[i].y;
            if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
            if (isTerrainWall(terrain, nx, ny)) continue;
            const key = nx * 50 + ny;
            if (reachable[key] || blockSet[key]) continue;
            reachable[key] = 1;
            q[tail++] = key;
        }
    }

    const filterAccessible = (keyName) => {
        const arr = blueprint[keyName];
        if (!arr || !arr.length) return;
        const kept = [];
        for (let i = 0; i < arr.length; i++) {
            const p = arr[i];
            let hasAccess = false;
            for (let dx = -1; dx <= 1 && !hasAccess; dx++) {
                for (let dy = -1; dy <= 1 && !hasAccess; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = p.x + dx, ny = p.y + dy;
                    if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50 && reachable[nx * 50 + ny]) {
                        hasAccess = true;
                    }
                }
            }
            if (hasAccess) kept.push(p);
        }
        blueprint[keyName] = kept;
    };

    filterAccessible('extensions');
    filterAccessible('towers');
    filterAccessible('labs');
}

module.exports = {
    FAST_FILLER_POSITIONS,
    FAST_FILLER_STAMP,
    COMMAND_HUB_STAMP,
    LAB_COMPLEX_STAMP,
    addOutpostRamparts,
    addRampartRoads,
    addRoadRamparts,
    findAnchor,
    findOptimalAnchor,
    getRoomBlueprint,
    placeBunkerSites,
    runPhoenixStateMachine,
    validateGlobalAccessibility,
    serializeBaseGrid,
    deserializeBaseGrid,
    graftModuleBFS,
    expandBFS,
    generateTopologicalBlueprint,
    stitchRemoteRoads,
    rebakeRoomRoads,
    reconcileBunkerLayout,
    baseGridToBlueprint,
    EXTENSION_PLUS_STAMP
};
