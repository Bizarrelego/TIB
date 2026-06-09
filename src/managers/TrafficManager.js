const ActionConstants = require('../constants/ActionConstants');

const ROLE_PRIORITY = {
    'meleecreep': 10,
    'rangercreep': 10,
    'mediccreep': 10,
    'defender': 10,
    'harvester': 8,
    'upgrader': 8,
    'bootstrapper': 6,
    'filler': 6,
    'hauler': 5,
    'builder': 4,
    'repairman': 4,
    'scout': 1
};

/**
 * Top-Down Traffic Manager
 * Centralized intent graph resolver and path cache.
 */
class TrafficManager {
    static getPriority(creep) {
        return ROLE_PRIORITY[(creep.memory.role || '').toLowerCase()] || 0;
    }

    static run() {
        if (!global.creepHeap) return;

        const intendedMoves = new Map(); // creepName -> { x, y, roomName }
        const grid = new Map(); // `${x},${y},${roomName}` -> creepName

        // Pass 1: Register all creeps on the grid (including fatigued)
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            const currentKey = `${creep.pos.x},${creep.pos.y},${creep.room.name}`;
            grid.set(currentKey, creep.name);
        }

        // Pass 2: Path Generation & Caching
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            if (creep.spawning || creep.fatigue > 0) continue;

            const heap = creep.heap;
            if (!heap || !heap.destination) {
                if (heap && heap.path) heap.path = null;
                continue;
            }

            const dest = heap.destination;
            
            // Check if arrived
            if (creep.room.name === dest.roomName) {
                const range = Math.max(Math.abs(creep.pos.x - dest.x), Math.abs(creep.pos.y - dest.y));
                if (range <= (dest.range || 1)) {
                    heap.destination = null;
                    heap.path = null;
                    continue;
                }
            }

            // Stall detection
            if (heap.lastPos && heap.lastPos.x === creep.pos.x && heap.lastPos.y === creep.pos.y && heap.lastPos.roomName === creep.room.name) {
                heap.stallCount = (heap.stallCount || 0) + 1;
            } else {
                heap.stallCount = 0;
                heap.lastPos = { x: creep.pos.x, y: creep.pos.y, roomName: creep.room.name };
            }

            // Path caching and invalidation
            let needsPath = false;
            if (!heap.path || heap.path.length === 0) needsPath = true;
            if (heap.pathDest && (heap.pathDest.x !== dest.x || heap.pathDest.y !== dest.y || heap.pathDest.roomName !== dest.roomName)) needsPath = true;
            if (heap.stallCount > 2) {
                needsPath = true;
                heap.stallCount = 0; // Reset after forcing recalculation
            }

            if (needsPath) {
                const targetPos = new RoomPosition(dest.x, dest.y, dest.roomName);
                const pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: dest.range || 1 }, {
                    plainCost: 2,
                    swampCost: 10,
                    roomCallback: TrafficManager.getCostMatrix
                });

                if (pathResult.incomplete && pathResult.path.length === 0) {
                    heap.unreachableTargetId = heap.targetId;
                    heap.destination = null;
                    heap.path = null;
                    continue;
                }

                // Serialize path to simple objects
                heap.path = pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
                heap.pathDest = { x: dest.x, y: dest.y, roomName: dest.roomName };
            }

            // Pop next step
            if (heap.path && heap.path.length > 0) {
                const nextStep = heap.path[0];
                intendedMoves.set(creep.name, nextStep);
            }
        }

        // Pass 3: Issue Move Intents & Push Chains
        const processed = new Set();

        for (const [creepName, nextStep] of intendedMoves) {
            if (processed.has(creepName)) continue;

            const creep = Game.creeps[creepName];
            const nextKey = `${nextStep.x},${nextStep.y},${nextStep.roomName}`;
            const blockerName = grid.get(nextKey);

            if (blockerName && blockerName !== creepName) {
                const blocker = Game.creeps[blockerName];
                const blockerNext = intendedMoves.get(blockerName);

                const creepPriority = TrafficManager.getPriority(creep);
                const blockerPriority = TrafficManager.getPriority(blocker);

                if (!blockerNext) {
                    // Blocker is idle
                    if (creepPriority >= blockerPriority) {
                        // High priority creep pushes idle lower priority blocker
                        const emptyPos = TrafficManager.findEmptyAdjacent(blocker, grid);
                        if (emptyPos) {
                            const dirToEmpty = TrafficManager.getSafeDirection(blocker.pos, emptyPos);
                            blocker.move(dirToEmpty);
                            grid.set(`${emptyPos.x},${emptyPos.y},${emptyPos.roomName}`, blockerName);
                        } else {
                            // No empty tile, force a swap
                            const dirToCreep = TrafficManager.getSafeDirection(blocker.pos, creep.pos);
                            blocker.move(dirToCreep);
                        }
                        
                        const dirToBlocker = TrafficManager.getSafeDirection(creep.pos, nextStep);
                        creep.move(dirToBlocker);
                        
                        creep.heap.path.shift();
                        processed.add(blockerName);
                    } else {
                        // Creep is lower priority, it cannot move. It stalls.
                    }
                } else if (blockerNext.x === creep.pos.x && blockerNext.y === creep.pos.y && blockerNext.roomName === creep.room.name) {
                    // Direct swap scenario (they want to move into each other)
                    const dirToBlocker = TrafficManager.getSafeDirection(creep.pos, nextStep);
                    const dirToCreep = TrafficManager.getSafeDirection(blocker.pos, creep.pos);
                    
                    creep.move(dirToBlocker);
                    blocker.move(dirToCreep);
                    
                    creep.heap.path.shift();
                    if (blocker.heap && blocker.heap.path) blocker.heap.path.shift();
                    
                    processed.add(blockerName);
                } else {
                    // Blocker is moving somewhere else. Wait for the engine to resolve the train.
                    const dirToNext = TrafficManager.getSafeDirection(creep.pos, nextStep);
                    creep.move(dirToNext);
                    creep.heap.path.shift();
                }
            } else {
                // Tile is empty, just move
                const dirToNext = TrafficManager.getSafeDirection(creep.pos, nextStep);
                creep.move(dirToNext);
                creep.heap.path.shift();
            }
            processed.add(creepName);
        }
    }

    static getSafeDirection(fromPos, toPos) {
        if (fromPos.roomName !== toPos.roomName) {
            // Handle cross-room properly to avoid edge bouncing
            if (fromPos.x === 0 && toPos.x === 49) return LEFT;
            if (fromPos.x === 49 && toPos.x === 0) return RIGHT;
            if (fromPos.y === 0 && toPos.y === 49) return TOP;
            if (fromPos.y === 49 && toPos.y === 0) return BOTTOM;
        }
        return fromPos.getDirectionTo(toPos.x, toPos.y);
    }

    static findEmptyAdjacent(creep, grid) {
        const x = creep.pos.x;
        const y = creep.pos.y;
        const roomName = creep.room.name;
        
        const matrix = TrafficManager.getCostMatrix(roomName);
        const terrain = Game.map.getRoomTerrain(roomName);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                
                // Don't push into room exits
                if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
                
                // Check terrain
                if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
                
                // Check structures
                if (matrix.get(nx, ny) === 255) continue;
                
                // Check creeps
                const key = `${nx},${ny},${roomName}`;
                if (!grid.has(key)) {
                    return { x: nx, y: ny, roomName: roomName };
                }
            }
        }
        return null;
    }

    static getCostMatrix(roomName) {
        if (!global.Cache) global.Cache = {};
        if (!global.Cache.costMatrices) global.Cache.costMatrices = new Map();

        const roomState = global.State && global.State.rooms ? global.State.rooms.get(roomName) : null;
        const currentStructCount = roomState ? roomState.structureIdCount : 0;
        
        const cached = global.Cache.costMatrices.get(roomName);
        
        // Invalidate if structure count changes
        if (cached && cached.structureCount === currentStructCount) {
            return cached.matrix;
        }

        const matrix = new PathFinder.CostMatrix();

        if (roomState && roomState.structureIds) {
            for (let i = 0; i < roomState.structureIdCount; i++) {
                const s = Game.getObjectById(roomState.structureIds[i]);
                if (s && s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_RAMPART) {
                    matrix.set(s.pos.x, s.pos.y, 255);
                } else if (s && s.structureType === STRUCTURE_ROAD) {
                    matrix.set(s.pos.x, s.pos.y, 1);
                }
            }
        }

        global.Cache.costMatrices.set(roomName, {
            matrix: matrix,
            structureCount: currentStructCount
        });

        return matrix;
    }
}

module.exports = TrafficManager;
