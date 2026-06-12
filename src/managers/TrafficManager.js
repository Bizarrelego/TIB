const CacheLib = require('../lib/CacheLib');
const PathCache = require('../lib/PathCache');
const MemoryHeap = require('../state/MemoryHeap');

const ROLE_PRIORITY = {
    'meleecreep': 10,
    'rangercreep': 10,
    'mediccreep': 10,
    'defender': 10,
    'harvester': 8,
    'upgrader': 8,
    'fastfiller': 7,
    'bootstrapper': 6,
    'filler': 6,
    'hauler': 5,
    'builder': 4,
    'repairman': 4,
    'scout': 1
};

/**
 * Top-Down Traffic Manager
 * Bipartite Matching Problem (BMP) algorithm based on Ford-Fulkerson method.
 * Resolves movement overlaps orthogonally with zero collisions.
 */
class TrafficManager {
    static getPriority(creep) {
        return ROLE_PRIORITY[(creep.memory.role || '').toLowerCase()] || 0;
    }

    static isCreepStationaryLocked(creep) {
        const role = (creep.memory.role || '').toLowerCase();
        if (role === 'harvester' || role === 'upgrader' || role === 'fastfiller') {
            if (creep.heap && creep.heap.sitTargetId) {
                const sitTarget = CacheLib.getById(creep.heap.sitTargetId);
                if (sitTarget && creep.pos.isEqualTo(sitTarget)) return true;
            }
            if (creep.heap && creep.heap.targetId) {
                const workTarget = CacheLib.getById(creep.heap.targetId);
                if (workTarget && creep.pos.isNearTo(workTarget)) return true;
            }
        }
        return false;
    }

    static run() {
        if (!global.creepHeap) return;
        MemoryHeap.init();

        const creepsByRoom = new Map();

        // Pass 1: Global Path Generation & Collection
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            try {
                if (creep.spawning) continue;
                
                if (creep.fatigue > 0) {
                    TrafficManager.addCreepToRoom(creepsByRoom, creep);
                    continue;
                }

                const heap = creep.heap;
                if (!heap || (!heap.destination && (!heap.fleeGoals || heap.fleeGoals.length === 0))) {
                    if (heap && heap.path) heap.path = null;
                    TrafficManager.addCreepToRoom(creepsByRoom, creep);
                    continue;
                }

                const dest = heap.destination;
                
                // Check if arrived
                if (dest && creep.room.name === dest.roomName) {
                    const range = Math.max(Math.abs(creep.pos.x - dest.x), Math.abs(creep.pos.y - dest.y));
                    const destRange = dest.range !== undefined ? dest.range : 1;
                    if (range <= destRange) {
                        heap.destination = null;
                        heap.path = null;
                        TrafficManager.addCreepToRoom(creepsByRoom, creep);
                        continue;
                    }
                }

                // Stall detection
                if (!heap.lastPos) heap.lastPos = { x: -1, y: -1, roomName: '' };
                if (heap.lastPos.x === creep.pos.x && heap.lastPos.y === creep.pos.y && heap.lastPos.roomName === creep.room.name) {
                    heap.stallCount = (heap.stallCount || 0) + 1;
                } else {
                    heap.stallCount = 0;
                    heap.lastPos.x = creep.pos.x;
                    heap.lastPos.y = creep.pos.y;
                    heap.lastPos.roomName = creep.room.name;
                }

                // Advance path
                if (heap.path) {
                    if (heap.pathIndex === undefined) heap.pathIndex = 0;
                    while (heap.pathIndex < heap.path.length) {
                        const step = heap.path[heap.pathIndex];
                        if (step.x === creep.pos.x && step.y === creep.pos.y && step.roomName === creep.room.name) {
                            heap.pathIndex++;
                        } else {
                            break;
                        }
                    }
                }

                let needsPath = false;
                if (!heap.path || heap.pathIndex >= heap.path.length) needsPath = true;
                if (dest && heap.pathDest && (heap.pathDest.x !== dest.x || heap.pathDest.y !== dest.y || heap.pathDest.roomName !== dest.roomName)) needsPath = true;
                if (heap.fleeGoals && heap.pathDest) needsPath = true;

                if (!needsPath && heap.stallCount > 0 && heap.path && heap.pathIndex < heap.path.length) {
                    const nextStep = heap.path[heap.pathIndex];
                    if (nextStep.roomName === creep.room.name) {
                        const matrix = TrafficManager.getCostMatrix(creep.room.name);
                        if (matrix.get(nextStep.x, nextStep.y) === 255) {
                            // Try to patch using PathCache local A*
                            const patched = PathCache.patchPath(creep, heap.path, heap.pathIndex);
                            if (patched) {
                                heap.path = patched;
                                heap.stallCount = 0;
                            } else {
                                needsPath = true;
                                heap.stallCount = 0;
                            }
                        }
                    }
                }

                if (needsPath) {
                    const pathResult = PathCache.getPath(creep, dest || {x:0,y:0,roomName:''}, heap.fleeGoals);
                    if (!pathResult || pathResult.length === 0) {
                        heap.unreachableTargetId = heap.targetId;
                        heap.targetId = null;
                        heap.actionIntent = 'idle';
                        heap.destination = null;
                        heap.path = null;
                        if (heap.fleeGoals) heap.fleeGoals = null;
                        TrafficManager.addCreepToRoom(creepsByRoom, creep);
                        continue;
                    }
                    heap.path = pathResult;
                    heap.pathIndex = 0;
                    if (!heap.fleeGoals) {
                        heap.pathDest = { x: dest.x, y: dest.y, roomName: dest.roomName };
                    } else {
                        heap.pathDest = null;
                    }
                }

                TrafficManager.addCreepToRoom(creepsByRoom, creep);
            } catch (err) {
                console.log(`[ERROR] TrafficManager Pass 1 crashed for creep ${creepName}: ${err.message}\n${err.stack}`);
            }
        }

        // Pass 2: Per-Room Bipartite Traffic Resolution
        for (const [roomName, roomCreeps] of creepsByRoom) {
            try {
                TrafficManager.resolveRoomTraffic(roomName, roomCreeps);
            } catch (err) {
                console.log(`[ERROR] TrafficManager Pass 2 crashed for room ${roomName}: ${err.message}\n${err.stack}`);
            }
        }
    }

    static addCreepToRoom(map, creep) {
        let list = map.get(creep.room.name);
        if (!list) {
            list = [];
            map.set(creep.room.name, list);
        }
        list.push(creep);
    }

    static resolveRoomTraffic(roomName, creeps) {
        const len = creeps.length;
        if (len === 0) return;

        // Sort creeps by priority so high priority claims vertices first
        creeps.sort((a, b) => TrafficManager.getPriority(b) - TrafficManager.getPriority(a));

        const terrain = Game.map.getRoomTerrain(roomName);
        const matrix = TrafficManager.getCostMatrix(roomName);
        
        // assignment array maps tilePacked to creep index
        const assignment = new Int32Array(2500);
        assignment.fill(-1);

        const targetsMap = new Map();

        for (let i = 0; i < len; i++) {
            const creep = creeps[i];
            const origPacked = (creep.pos.y * 50) + creep.pos.x;
            const targets = [];

            if (TrafficManager.isCreepStationaryLocked(creep) || creep.fatigue > 0) {
                targets.push(origPacked);
            } else {
                let nextStepPacked = -1;
                let leavingRoom = false;
                if (creep.heap && creep.heap.path && creep.heap.pathIndex < creep.heap.path.length) {
                    const step = creep.heap.path[creep.heap.pathIndex];
                    if (step.roomName === roomName) {
                        nextStepPacked = (step.y * 50) + step.x;
                        targets.push(nextStepPacked);
                    } else {
                        leavingRoom = true;
                    }
                }

                if (!leavingRoom) {
                    // Adjacency fallback
                    const bx = creep.pos.x;
                    const by = creep.pos.y;
                    const dirs = [-51, -50, -49, -1, 1, 49, 50, 51];
                    for (let d = 0; d < 8; d++) {
                        const newPacked = (by * 50) + bx + dirs[d];
                        if (newPacked === nextStepPacked) continue;
                        
                        const nx = newPacked % 50;
                        const ny = Math.floor(newPacked / 50);
                        if (Math.abs(nx - bx) > 1 || Math.abs(ny - by) > 1) continue;
                        if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
                        if (terrain.get(nx, ny) === TERRAIN_MASK_WALL || matrix.get(nx, ny) === 255) continue;
                        
                        targets.push(newPacked);
                    }
                    targets.push(origPacked); // Staying still as last resort
                }
            }
            targetsMap.set(i, targets);
        }

        // Bipartite Matching via DFS Augmenting Paths
        for (let i = 0; i < len; i++) {
            const visited = new Uint8Array(2500);
            TrafficManager.bipartiteDFS(i, targetsMap, assignment, visited);
        }

        // Resolve intents and write to MemoryHeap
        const roomId = MemoryHeap.getRoomId(roomName);

        for (let tilePacked = 0; tilePacked < 2500; tilePacked++) {
            const creepIdx = assignment[tilePacked];
            if (creepIdx !== -1) {
                const creep = creeps[creepIdx];
                const tx = tilePacked % 50;
                const ty = Math.floor(tilePacked / 50);
                
                const origPacked = (creep.pos.y * 50) + creep.pos.x;
                if (tilePacked !== origPacked) {
                    // Creep is moving orthogonally
                    creep.heap.moveDirection = creep.pos.getDirectionTo(tx, ty);
                    
                    // Also write to MemoryHeap
                    const creepId = MemoryHeap.getCreepId(creep.name);
                    global.MemoryHeap.moveIntents[creepId] = (roomId << 12) | (tx << 6) | ty;
                } else if (creep.heap.path && creep.heap.pathIndex < creep.heap.path.length) {
                    // Creep is trying to leave room but staying on boundary
                    const step = creep.heap.path[creep.heap.pathIndex];
                    if (step.roomName !== roomName) {
                        creep.heap.moveDirection = TrafficManager.getSafeDirection(creep.pos, step);
                    }
                }
            }
        }
    }

    static bipartiteDFS(cIdx, targetsMap, assignment, visited) {
        const targets = targetsMap.get(cIdx);
        if (!targets) return false;

        for (let i = 0; i < targets.length; i++) {
            const tile = targets[i];
            if (visited[tile]) continue;
            visited[tile] = 1;

            const currentAssignee = assignment[tile];
            if (currentAssignee === -1 || TrafficManager.bipartiteDFS(currentAssignee, targetsMap, assignment, visited)) {
                assignment[tile] = cIdx;
                return true;
            }
        }
        return false;
    }

    static getSafeDirection(fromPos, toPos) {
        if (fromPos.roomName !== toPos.roomName) {
            if (fromPos.x === 0 && toPos.x === 49) return LEFT;
            if (fromPos.x === 49 && toPos.x === 0) return RIGHT;
            if (fromPos.y === 0 && toPos.y === 49) return TOP;
            if (fromPos.y === 49 && toPos.y === 0) return BOTTOM;
        }
        return fromPos.getDirectionTo(toPos.x, toPos.y);
    }

    static getCostMatrix(roomName) {
        if (!global.Cache) global.Cache = {};
        if (!global.Cache.costMatrices) global.Cache.costMatrices = new Map();

        const roomState = global.State && global.State.rooms ? global.State.rooms.get(roomName) : null;
        const currentStructCount = roomState ? roomState.structureIdCount + (roomState.constructionSiteCount || 0) : 0;
        
        const cached = global.Cache.costMatrices.get(roomName);
        let baseMatrix;
        if (cached && cached.structureCount === currentStructCount) {
            baseMatrix = PathFinder.CostMatrix.deserialize(cached.matrix);
        } else {
            baseMatrix = new PathFinder.CostMatrix();
            if (roomState && roomState.structureIds) {
                for (let i = 0; i < roomState.structureIdCount; i++) {
                    const s = CacheLib.getById(roomState.structureIds[i]);
                    if (s && s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_RAMPART) {
                        baseMatrix.set(s.pos.x, s.pos.y, 255);
                    } else if (s && s.structureType === STRUCTURE_ROAD) {
                        baseMatrix.set(s.pos.x, s.pos.y, 1);
                    }
                }
            }
            if (roomState && roomState.constructionSites) {
                const sites = Object.values(roomState.constructionSites);
                for (let i = 0; i < sites.length; i++) {
                    const s = sites[i];
                    if (s && s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_RAMPART) {
                        baseMatrix.set(s.pos.x, s.pos.y, 255);
                    }
                }
            }
            global.Cache.costMatrices.set(roomName, {
                matrix: baseMatrix.serialize(),
                structureCount: currentStructCount
            });
        }

        if (!global.Cache.tickMatrices) global.Cache.tickMatrices = new Map();
        if (global.Cache.tickMatricesTime !== Game.time) {
            global.Cache.tickMatrices.clear();
            global.Cache.tickMatricesTime = Game.time;
        }

        let tickMatrix = global.Cache.tickMatrices.get(roomName);
        if (tickMatrix) return tickMatrix;

        tickMatrix = baseMatrix.clone();
        
        if (roomState) {
            const hostiles = roomState.hostiles || [];
            for (let i = 0; i < hostiles.length; i++) {
                const hostile = hostiles[i];
                let isMelee = false;
                let isRanged = false;
                
                for (let j = 0; j < hostile.body.length; j++) {
                    const type = hostile.body[j].type;
                    if (type === ATTACK) isMelee = true;
                    if (type === RANGED_ATTACK) isRanged = true;
                }

                const dxRange = isRanged ? 3 : (isMelee ? 1 : 0);
                if (dxRange > 0) {
                    for (let dx = -dxRange; dx <= dxRange; dx++) {
                        for (let dy = -dxRange; dy <= dxRange; dy++) {
                            const x = hostile.pos.x + dx;
                            const y = hostile.pos.y + dy;
                            if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                                tickMatrix.set(x, y, Math.min(255, tickMatrix.get(x, y) + 50));
                            }
                        }
                    }
                }
            }

            for (const creepName in Game.creeps) {
                const c = Game.creeps[creepName];
                if (c.room.name !== roomName) continue;
                const role = (c.memory.role || '').toLowerCase();
                if (role === 'harvester' || role === 'upgrader' || (c.heap && c.heap.sitTargetId)) {
                    tickMatrix.set(c.pos.x, c.pos.y, 255);
                }
            }
        }

        global.Cache.tickMatrices.set(roomName, tickMatrix);
        return tickMatrix;
    }
}

module.exports = TrafficManager;
