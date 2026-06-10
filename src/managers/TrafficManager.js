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

            // Advance path if creep successfully moved to the first step
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

            // Path caching and invalidation
            let needsPath = false;
            if (!heap.path || heap.pathIndex >= heap.path.length) needsPath = true;
            if (dest && heap.pathDest && (heap.pathDest.x !== dest.x || heap.pathDest.y !== dest.y || heap.pathDest.roomName !== dest.roomName)) needsPath = true;
            if (heap.fleeGoals && heap.pathDest) needsPath = true; // Invalidate if transitioning to flee logic
            if (heap.stallCount > 2) {
                needsPath = true;
                heap.stallCount = 0; // Reset after forcing recalculation
            }

            if (!needsPath && heap.stallCount > 0 && heap.path && heap.pathIndex < heap.path.length) {
                const nextStep = heap.path[heap.pathIndex];
                if (nextStep.roomName === creep.room.name) {
                    const matrix = TrafficManager.getCostMatrix(creep.room.name);
                    if (matrix.get(nextStep.x, nextStep.y) === 255) {
                        needsPath = true;
                        heap.stallCount = 0;
                    }
                }
            }

            if (needsPath) {
                let pathResult;
                
                if (heap.fleeGoals && heap.fleeGoals.length > 0) {
                    // Adds native support for multi-target fleeing intents, decoupling tactical evasion logic from low-level path caching.
                    pathResult = PathFinder.search(creep.pos, heap.fleeGoals, {
                        flee: true,
                        plainCost: 2,
                        swampCost: 10,
                        roomCallback: TrafficManager.getCostMatrix
                    });
                    heap.pathDest = null;
                } else {
                    const targetPos = new RoomPosition(dest.x, dest.y, dest.roomName);
                    const destRange = dest.range !== undefined ? dest.range : 1;
                    pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: destRange }, {
                        plainCost: 2,
                        swampCost: 10,
                        roomCallback: TrafficManager.getCostMatrix
                    });
                    heap.pathDest = { x: dest.x, y: dest.y, roomName: dest.roomName };
                }

                if (pathResult.incomplete && pathResult.path.length === 0) {
                    heap.unreachableTargetId = heap.targetId;
                    heap.targetId = null;
                    heap.actionIntent = 'idle';
                    heap.destination = null;
                    heap.path = null;
                    if (heap.fleeGoals) heap.fleeGoals = null;
                    TrafficManager.addCreepToRoom(creepsByRoom, creep);
                    continue;
                }

                heap.path = pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
                heap.pathIndex = 0;
            }

            TrafficManager.addCreepToRoom(creepsByRoom, creep);
        }

        // Pass 2: Per-Room DFS Traffic Resolution
        for (const [roomName, roomCreeps] of creepsByRoom) {
            TrafficManager.resolveRoomTraffic(roomName, roomCreeps);
        }

        if (Memory.debugTraffic) TrafficManager.visualize(creepsByRoom);
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
        if (len > TrafficManager.creepList.length) {
            // Dynamically expand buffers if limit is breached
            const newSize = len + 50;
            TrafficManager.creepList = new Array(newSize);
            TrafficManager.nextSteps = new Int32Array(newSize);
            TrafficManager.resolvedIntents = new Int32Array(newSize);
            TrafficManager.priorityScore = new Int32Array(newSize);
            TrafficManager.visited = new Uint8Array(newSize);
        }

        // Optimizes V8 heap usage by eliminating per-room TypedArray instantiations, reducing GC churn.
        TrafficManager.grid.fill(-1);
        TrafficManager.nextSteps.fill(-1, 0, len);
        TrafficManager.resolvedIntents.fill(-1, 0, len);
        TrafficManager.priorityScore.fill(0, 0, len);
        
        for (let i = 0; i < len; i++) {
            const creep = creeps[i];
            TrafficManager.creepList[i] = creep;
            const packed = (creep.pos.y * 50) + creep.pos.x;
            TrafficManager.grid[packed] = i;
            
            TrafficManager.priorityScore[i] = TrafficManager.getPriority(creep);
            
            if (creep.heap && creep.heap.path && creep.heap.pathIndex < creep.heap.path.length && creep.fatigue === 0) {
                const step = creep.heap.path[creep.heap.pathIndex];
                if (step.roomName === roomName) {
                    TrafficManager.nextSteps[i] = (step.y * 50) + step.x;
                } else {
                    TrafficManager.nextSteps[i] = -2; // Special flag: leaving room
                }
            } else {
                TrafficManager.nextSteps[i] = -1; // Idle
            }
        }

        const terrain = Game.map.getRoomTerrain(roomName);
        const matrix = TrafficManager.getCostMatrix(roomName);
        
        // Sort indices by priority so high priority cascades first
        if (!TrafficManager.sortedIndices || TrafficManager.sortedIndices.length < len) {
            TrafficManager.sortedIndices = new Uint16Array(len + 50);
        }
        const sortedIndices = TrafficManager.sortedIndices.subarray(0, len);
        for (let i = 0; i < len; i++) sortedIndices[i] = i;
        sortedIndices.sort((a, b) => TrafficManager.priorityScore[b] - TrafficManager.priorityScore[a]);

        for (let k = 0; k < len; k++) {
            const i = sortedIndices[k];
            if (TrafficManager.nextSteps[i] === -1 || TrafficManager.nextSteps[i] === -2) continue;
            if (TrafficManager.resolvedIntents[i] !== -1) continue; 
            
            const targetPacked = TrafficManager.nextSteps[i];
            if (targetPacked < 0 || targetPacked >= 2500) continue;
            
            TrafficManager.visited.fill(0, 0, creeps.length);
            const success = TrafficManager.depthFirstSearch(i, targetPacked, TrafficManager.priorityScore[i], terrain, matrix, creeps.length);
            
            if (success) {
                TrafficManager.resolvedIntents[i] = targetPacked;
                const origPacked = (TrafficManager.creepList[i].pos.y * 50) + TrafficManager.creepList[i].pos.x;
                if (TrafficManager.grid[origPacked] === i) TrafficManager.grid[origPacked] = -1;
                TrafficManager.grid[targetPacked] = i;
            } else {
                // Direct swap fallback if DFS fails but priorities allow
                const blockerIdx = TrafficManager.grid[targetPacked];
                if (blockerIdx !== -1 && blockerIdx !== i) {
                    if (TrafficManager.priorityScore[i] >= TrafficManager.priorityScore[blockerIdx]) {
                        const origPacked = (TrafficManager.creepList[i].pos.y * 50) + TrafficManager.creepList[i].pos.x;
                        TrafficManager.resolvedIntents[i] = targetPacked;
                        TrafficManager.resolvedIntents[blockerIdx] = origPacked;
                        TrafficManager.grid[origPacked] = blockerIdx;
                        TrafficManager.grid[targetPacked] = i;
                    }
                }
            }
        }
        
        // Issue final intents
        for (let i = 0; i < creeps.length; i++) {
            const creep = TrafficManager.creepList[i];
            if (Memory.debugTraffic) {
                creep.heap._debugResolved = TrafficManager.resolvedIntents[i];
                creep.heap._debugNext = TrafficManager.nextSteps[i];
            }
            
            let dir = null;
            
            if (TrafficManager.resolvedIntents[i] >= 0) {
                const targetPacked = TrafficManager.resolvedIntents[i];
                const tx = targetPacked % 50;
                const ty = Math.floor(targetPacked / 50);
                dir = creep.pos.getDirectionTo(tx, ty);
            } else if (TrafficManager.resolvedIntents[i] === -2 || TrafficManager.nextSteps[i] === -2) {
                const step = creep.heap.path[creep.heap.pathIndex];
                dir = TrafficManager.getSafeDirection(creep.pos, step);
            }
            
            if (dir) creep.move(dir);
            TrafficManager.creepList[i] = null; // Free reference to prevent memory leak
        }
    }

    /**
     * Recursive DFS logic to push chains of creeps efficiently.
     * Replaces findEmptyAdjacent with multi-depth resolution.
     */
    static depthFirstSearch(creepIdx, targetPacked, minScore, terrain, matrix, creepCount) {
        const tx = targetPacked % 50;
        const ty = Math.floor(targetPacked / 50);
        
        if (terrain.get(tx, ty) === TERRAIN_MASK_WALL || matrix.get(tx, ty) === 255) return false;

        const blockerIdx = TrafficManager.grid[targetPacked];
        if (blockerIdx === -1) return true; // Target tile is completely empty

        if (TrafficManager.visited[blockerIdx]) return false; // Cycle detection
        TrafficManager.visited[blockerIdx] = 1;

        const blocker = TrafficManager.creepList[blockerIdx];

        // Fixes engine-level move rejection by failing DFS against fatigued blockers.
        if (blocker.fatigue > 0) return false;

        const blockerScore = TrafficManager.getPriority(blocker);
        if (minScore < blockerScore) return false; // Prevent low-priority creeps from displacing high-priority

        // Prevents economic collapse by anchoring stationary creeps against high-priority displacement.
        const blockerRole = (blocker.memory.role || '').toLowerCase();
        if (blockerRole === 'harvester' || blockerRole === 'upgrader') {
            if (blocker.heap && blocker.heap.sitTargetId) {
                const sitTarget = Game.getObjectById(blocker.heap.sitTargetId);
                if (sitTarget && blocker.pos.isEqualTo(sitTarget)) return false;
            }
            if (blocker.heap && blocker.heap.targetId) {
                const workTarget = Game.getObjectById(blocker.heap.targetId);
                if (workTarget && blocker.pos.isNearTo(workTarget)) return false;
            }
        }

        // If the blocker is already leaving the room, we can just assume the tile opens up
        if (TrafficManager.nextSteps[blockerIdx] === -2) {
            TrafficManager.resolvedIntents[blockerIdx] = -2;
            TrafficManager.grid[targetPacked] = -1;
            return true;
        }

        // Try blocker's intended move first (Chain continuation)
        if (TrafficManager.nextSteps[blockerIdx] >= 0 && TrafficManager.nextSteps[blockerIdx] !== targetPacked) {
            const bTarget = TrafficManager.nextSteps[blockerIdx];
            if (TrafficManager.depthFirstSearch(blockerIdx, bTarget, blockerScore, terrain, matrix, creepCount)) {
                TrafficManager.resolvedIntents[blockerIdx] = bTarget;
                TrafficManager.grid[targetPacked] = -1;
                TrafficManager.grid[bTarget] = blockerIdx;
                return true;
            }
        }

        // Try pushing blocker to adjacent tiles
        const bx = tx;
        const by = ty;
        const dirs = [-51, -50, -49, -1, 1, 49, 50, 51];

        // Pass 1: Empty Tiles (O(1) resolution priority)
        for (let d = 0; d < 8; d++) {
            const newPacked = targetPacked + dirs[d];
            const nx = newPacked % 50;
            const ny = Math.floor(newPacked / 50);
            
            if (Math.abs(nx - bx) > 1 || Math.abs(ny - by) > 1) continue;
            if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
            if (terrain.get(nx, ny) === TERRAIN_MASK_WALL || matrix.get(nx, ny) === 255) continue;

            if (TrafficManager.grid[newPacked] === -1) {
                if (TrafficManager.depthFirstSearch(blockerIdx, newPacked, minScore, terrain, matrix, creepCount)) {
                    TrafficManager.resolvedIntents[blockerIdx] = newPacked;
                    TrafficManager.grid[targetPacked] = -1;
                    TrafficManager.grid[newPacked] = blockerIdx;
                    return true;
                }
            }
        }

        // Pass 2: Occupied Tiles (Recursive displacement chain)
        for (let d = 0; d < 8; d++) {
            const newPacked = targetPacked + dirs[d];
            const nx = newPacked % 50;
            const ny = Math.floor(newPacked / 50);
            
            if (Math.abs(nx - bx) > 1 || Math.abs(ny - by) > 1) continue;
            if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
            if (terrain.get(nx, ny) === TERRAIN_MASK_WALL || matrix.get(nx, ny) === 255) continue;

            if (TrafficManager.grid[newPacked] !== -1) {
                if (TrafficManager.depthFirstSearch(blockerIdx, newPacked, minScore, terrain, matrix, creepCount)) {
                    TrafficManager.resolvedIntents[blockerIdx] = newPacked;
                    TrafficManager.grid[targetPacked] = -1;
                    TrafficManager.grid[newPacked] = blockerIdx;
                    return true;
                }
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

    /**
     * Adds zero-overhead visual debugging for DFS traffic resolution and dynamic cost matrices, gated by Memory.debugTraffic.
     */
    static visualize(creepsByRoom) {
        for (const [roomName, roomCreeps] of creepsByRoom) {
            const visual = new RoomVisual(roomName);
            
            // Draw Threat & Cost Matrix Visualization
            const tickMatrix = global.Cache && global.Cache.tickMatrices ? global.Cache.tickMatrices.get(roomName) : null;
            if (tickMatrix) {
                for (let x = 0; x < 50; x++) {
                    for (let y = 0; y < 50; y++) {
                        if (tickMatrix.get(x, y) === 255) {
                            visual.rect(x - 0.5, y - 0.5, 1, 1, { fill: '#ff0000', opacity: 0.2 });
                        }
                    }
                }
            }

            // Draw Creep Intent Visualization
            for (let i = 0; i < roomCreeps.length; i++) {
                const creep = roomCreeps[i];
                const heap = creep.heap;
                if (!heap) continue;

                // Fatigue & Stationary Markers
                if (creep.fatigue > 0) {
                    visual.circle(creep.pos, { fill: '#0000ff', radius: 0.3, opacity: 0.5 });
                }
                const role = (creep.memory.role || '').toLowerCase();
                if (role === 'harvester' || role === 'upgrader' || heap.sitTargetId) {
                    visual.text('X', creep.pos.x, creep.pos.y + 0.25, { color: '#ffffff', size: 0.7, font: 'bold' });
                }

                // Traffic Resolution Lines
                const resolved = heap._debugResolved;
                const nextStepPacked = heap._debugNext;
                if (resolved !== undefined && resolved >= 0) {
                    const tx = resolved % 50;
                    const ty = Math.floor(resolved / 50);

                    // Did it successfully move to its intended next step?
                    if (resolved === nextStepPacked) {
                        visual.line(creep.pos.x, creep.pos.y, tx, ty, { color: '#00ff00', width: 0.15, opacity: 0.8 });
                    } else {
                        // Is it a direct swap?
                        let isSwap = false;
                        for (let j = 0; j < roomCreeps.length; j++) {
                            const other = roomCreeps[j];
                            if (other.name !== creep.name && other.pos.x === tx && other.pos.y === ty) {
                                if (other.heap && other.heap._debugResolved === (creep.pos.y * 50) + creep.pos.x) {
                                    isSwap = true;
                                    break;
                                }
                            }
                        }

                        if (isSwap) {
                            visual.line(creep.pos.x, creep.pos.y, tx, ty, { color: '#ffa500', width: 0.15, opacity: 0.8 });
                        } else {
                            // It pushed someone or successfully moved somewhere that wasn't its primary nextStep
                            visual.line(creep.pos.x, creep.pos.y, tx, ty, { color: '#00ff00', width: 0.15, opacity: 0.8 });
                        }
                    }
                } else if (heap.path && heap.path.length > 0 && creep.fatigue === 0) {
                    // It had a path, but its resolved intent is its own coordinate or -1
                    const origPacked = (creep.pos.y * 50) + creep.pos.x;
                    if (resolved === -1 || resolved === origPacked) {
                        visual.circle(creep.pos, { stroke: '#ff0000', radius: 0.45, fill: 'transparent', strokeWidth: 0.1 });
                    }
                }
            }
        }
    }

    static getCostMatrix(roomName) {
        if (!global.Cache) global.Cache = {};
        if (!global.Cache.costMatrices) global.Cache.costMatrices = new Map();

        const roomState = global.State && global.State.rooms ? global.State.rooms.get(roomName) : null;
        const currentStructCount = roomState ? roomState.structureIdCount + (roomState.constructionSiteCount || 0) : 0;
        
        const cached = global.Cache.costMatrices.get(roomName);
        let baseMatrix;
        if (cached && cached.structureCount === currentStructCount) {
            baseMatrix = cached.matrix;
        } else {
            baseMatrix = new PathFinder.CostMatrix();
            if (roomState && roomState.structureIds) {
                for (let i = 0; i < roomState.structureIdCount; i++) {
                    const s = Game.getObjectById(roomState.structureIds[i]);
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
                matrix: baseMatrix,
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
        
        // Injects dynamic threat zones into the tick-cached matrix, forcing civilian creeps to naturally route around danger and allowing rangers to kite along the cost gradient.
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

            // Fixes stationary creep deadlocks by injecting their positions as unwalkable (255) into a tick-cached cloned matrix, forcing PathFinder to route around them.
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

// Static Array Allocation for O(1) performance
TrafficManager.grid = new Int32Array(2500);
TrafficManager.creepList = new Array(250);
TrafficManager.nextSteps = new Int32Array(250);
TrafficManager.resolvedIntents = new Int32Array(250);
TrafficManager.priorityScore = new Int32Array(250);
TrafficManager.visited = new Uint8Array(250);

module.exports = TrafficManager;
