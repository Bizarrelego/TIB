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
 * Per-room packed coordinate recursive DFS traffic resolution.
 * Improves performance by replacing string concatenation with integer math.
 * Resolves multi-creep deadlocks via recursive displacement.
 */
class TrafficManager {
    static getPriority(creep) {
        return ROLE_PRIORITY[(creep.memory.role || '').toLowerCase()] || 0;
    }

    static run() {
        if (!global.creepHeap) return;

        const creepsByRoom = new Map();

        // Pass 1: Global Path Generation & Collection
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            if (creep.spawning) continue;
            
            if (creep.fatigue > 0) {
                TrafficManager.addCreepToRoom(creepsByRoom, creep);
                continue;
            }

            const heap = creep.heap;
            if (!heap || !heap.destination) {
                if (heap && heap.path) heap.path = null;
                TrafficManager.addCreepToRoom(creepsByRoom, creep);
                continue;
            }

            const dest = heap.destination;
            
            // Check if arrived
            if (creep.room.name === dest.roomName) {
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
            if (heap.lastPos && heap.lastPos.x === creep.pos.x && heap.lastPos.y === creep.pos.y && heap.lastPos.roomName === creep.room.name) {
                heap.stallCount = (heap.stallCount || 0) + 1;
            } else {
                heap.stallCount = 0;
                heap.lastPos = { x: creep.pos.x, y: creep.pos.y, roomName: creep.room.name };
            }

            // Advance path if creep successfully moved to the first step
            if (heap.path) {
                while (heap.path.length > 0 && heap.path[0].x === creep.pos.x && heap.path[0].y === creep.pos.y && heap.path[0].roomName === creep.room.name) {
                    heap.path.shift();
                }
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
                const destRange = dest.range !== undefined ? dest.range : 1;
                const pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: destRange }, {
                    plainCost: 2,
                    swampCost: 10,
                    roomCallback: TrafficManager.getCostMatrix
                });

                if (pathResult.incomplete && pathResult.path.length === 0) {
                    heap.unreachableTargetId = heap.targetId;
                    heap.destination = null;
                    heap.path = null;
                    TrafficManager.addCreepToRoom(creepsByRoom, creep);
                    continue;
                }

                heap.path = pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
                heap.pathDest = { x: dest.x, y: dest.y, roomName: dest.roomName };
            }

            TrafficManager.addCreepToRoom(creepsByRoom, creep);
        }

        // Pass 2: Per-Room DFS Traffic Resolution
        for (const [roomName, roomCreeps] of creepsByRoom) {
            TrafficManager.resolveRoomTraffic(roomName, roomCreeps);
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
        const grid = new Int32Array(2500);
        grid.fill(-1);
        
        const creepList = [];
        const nextSteps = new Int32Array(creeps.length);
        const resolvedIntents = new Int32Array(creeps.length);
        resolvedIntents.fill(-1);
        
        const priorityScore = new Int32Array(creeps.length);
        
        for (let i = 0; i < creeps.length; i++) {
            const creep = creeps[i];
            creepList.push(creep);
            const packed = (creep.pos.y * 50) + creep.pos.x;
            grid[packed] = i;
            
            priorityScore[i] = TrafficManager.getPriority(creep);
            
            if (creep.heap && creep.heap.path && creep.heap.path.length > 0 && creep.fatigue === 0) {
                const step = creep.heap.path[0];
                if (step.roomName === roomName) {
                    nextSteps[i] = (step.y * 50) + step.x;
                } else {
                    nextSteps[i] = -2; // Special flag: leaving room
                }
            } else {
                nextSteps[i] = -1; // Idle
            }
        }

        const terrain = Game.map.getRoomTerrain(roomName);
        const matrix = TrafficManager.getCostMatrix(roomName);
        
        // Sort indices by priority so high priority cascades first
        const sortedIndices = [];
        for (let i = 0; i < creeps.length; i++) sortedIndices.push(i);
        sortedIndices.sort((a, b) => priorityScore[b] - priorityScore[a]);

        const visited = new Uint8Array(creeps.length);

        for (let k = 0; k < sortedIndices.length; k++) {
            const i = sortedIndices[k];
            if (nextSteps[i] === -1 || nextSteps[i] === -2) continue;
            if (resolvedIntents[i] !== -1) continue; 
            
            const targetPacked = nextSteps[i];
            if (targetPacked < 0 || targetPacked >= 2500) continue;
            
            visited.fill(0);
            const success = TrafficManager.depthFirstSearch(i, targetPacked, priorityScore[i], terrain, matrix, grid, nextSteps, resolvedIntents, visited, creepList);
            
            if (success) {
                resolvedIntents[i] = targetPacked;
                const origPacked = (creepList[i].pos.y * 50) + creepList[i].pos.x;
                if (grid[origPacked] === i) grid[origPacked] = -1;
                grid[targetPacked] = i;
            } else {
                // Direct swap fallback if DFS fails but priorities allow
                const blockerIdx = grid[targetPacked];
                if (blockerIdx !== -1 && blockerIdx !== i) {
                    if (priorityScore[i] >= priorityScore[blockerIdx]) {
                        const origPacked = (creepList[i].pos.y * 50) + creepList[i].pos.x;
                        resolvedIntents[i] = targetPacked;
                        resolvedIntents[blockerIdx] = origPacked;
                        grid[origPacked] = blockerIdx;
                        grid[targetPacked] = i;
                    }
                }
            }
        }
        
        // Issue final intents
        for (let i = 0; i < creeps.length; i++) {
            const creep = creepList[i];
            let dir = null;
            
            if (resolvedIntents[i] >= 0) {
                const targetPacked = resolvedIntents[i];
                const tx = targetPacked % 50;
                const ty = Math.floor(targetPacked / 50);
                dir = creep.pos.getDirectionTo(tx, ty);
            } else if (resolvedIntents[i] === -2 || nextSteps[i] === -2) {
                const step = creep.heap.path[0];
                dir = TrafficManager.getSafeDirection(creep.pos, step);
            }
            
            if (dir) creep.move(dir);
        }
    }

    /**
     * Recursive DFS logic to push chains of creeps efficiently.
     * Replaces findEmptyAdjacent with multi-depth resolution.
     */
    static depthFirstSearch(creepIdx, targetPacked, minScore, terrain, matrix, grid, nextSteps, resolvedIntents, visited, creepList) {
        const tx = targetPacked % 50;
        const ty = Math.floor(targetPacked / 50);
        
        if (terrain.get(tx, ty) === TERRAIN_MASK_WALL || matrix.get(tx, ty) === 255) return false;

        const blockerIdx = grid[targetPacked];
        if (blockerIdx === -1) return true; // Target tile is completely empty

        if (visited[blockerIdx]) return false; // Cycle detection
        visited[blockerIdx] = 1;

        const blockerScore = TrafficManager.getPriority(creepList[blockerIdx]);
        if (minScore < blockerScore) return false; // Prevent low-priority creeps from displacing high-priority

        // If the blocker is already leaving the room, we can just assume the tile opens up
        if (nextSteps[blockerIdx] === -2) {
            resolvedIntents[blockerIdx] = -2;
            grid[targetPacked] = -1;
            return true;
        }

        // Try blocker's intended move first (Chain continuation)
        if (nextSteps[blockerIdx] >= 0 && nextSteps[blockerIdx] !== targetPacked) {
            const bTarget = nextSteps[blockerIdx];
            if (TrafficManager.depthFirstSearch(blockerIdx, bTarget, blockerScore, terrain, matrix, grid, nextSteps, resolvedIntents, visited, creepList)) {
                resolvedIntents[blockerIdx] = bTarget;
                grid[targetPacked] = -1;
                grid[bTarget] = blockerIdx;
                return true;
            }
        }

        // Try pushing blocker to adjacent empty tiles
        const bx = tx;
        const by = ty;
        const dirs = [-51, -50, -49, -1, 1, 49, 50, 51];
        
        for (let d = 0; d < 8; d++) {
            const newPacked = targetPacked + dirs[d];
            const nx = newPacked % 50;
            const ny = Math.floor(newPacked / 50);
            
            if (Math.abs(nx - bx) > 1 || Math.abs(ny - by) > 1) continue;
            if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
            
            // Pass minScore through to let the heavy pusher force the blocker's DFS
            if (TrafficManager.depthFirstSearch(blockerIdx, newPacked, minScore, terrain, matrix, grid, nextSteps, resolvedIntents, visited, creepList)) {
                resolvedIntents[blockerIdx] = newPacked;
                grid[targetPacked] = -1;
                grid[newPacked] = blockerIdx;
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
        const currentStructCount = roomState ? roomState.structureIdCount : 0;
        
        const cached = global.Cache.costMatrices.get(roomName);
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
