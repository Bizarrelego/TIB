const CacheLib = require('../lib/CacheLib');
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
 * Per-room packed coordinate recursive DFS traffic resolution.
 * Improves performance by replacing string concatenation with integer math.
 * Resolves multi-creep deadlocks via recursive displacement.
 */
class TrafficManager {
    static getPriority(creep) {
        if (creep.heap && creep.heap.actionIntent === 'idle') {
            return -1; // Idle creeps turn into "liquid traffic" and yield to everyone
        }
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

                        if (!global.PathCache) global.PathCache = new Map();
                        const pathKey = `${creep.pos.roomName}_${creep.pos.x}_${creep.pos.y}_${dest.roomName}_${dest.x}_${dest.y}_${destRange}`;
                        const cached = global.PathCache.get(pathKey);

                        if (cached && Game.time < cached.expireTime) {
                            pathResult = { path: cached.path, incomplete: cached.incomplete, isSerialized: true };
                        } else {
                            const searchOptions = {
                                plainCost: 2,
                                swampCost: 10,
                                roomCallback: TrafficManager.getCostMatrix
                            };
                            if (creep.pos.roomName === targetPos.roomName) {
                                searchOptions.maxRooms = 1;
                            }

                            pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: destRange }, searchOptions);

                            const serializedPath = pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
                            global.PathCache.set(pathKey, {
                                path: serializedPath,
                                incomplete: pathResult.incomplete,
                                expireTime: Game.time + 1500
                            });

                            pathResult.path = serializedPath;
                            pathResult.isSerialized = true;
                        }

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

                    heap.path = pathResult.isSerialized ? pathResult.path : pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
                    heap.pathIndex = 0;
                }

                TrafficManager.addCreepToRoom(creepsByRoom, creep);
            } catch (err) {
                console.log(`[ERROR] TrafficManager Pass 1 crashed for creep ${creepName}: ${err.message}\n${err.stack}`);
            }
        }

        // Pass 2: Per-Room DFS Traffic Resolution
        for (const [roomName, roomCreeps] of creepsByRoom) {
            try {
                TrafficManager.resolveRoomTraffic(roomName, roomCreeps);
            } catch (err) {
                console.log(`[ERROR] TrafficManager Pass 2 crashed for room ${roomName}: ${err.message}\n${err.stack}`);
            }
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

        // --- Train Locking ---
        // High-priority creeps moving in a synchronized line project their paths onto the grid.
        // Intersecting intents from lower-priority creeps are proactively deleted.
        if (!TrafficManager.trainLocks) TrafficManager.trainLocks = new Uint8Array(2500);
        TrafficManager.trainLocks.fill(0);
        for (let k = 0; k < len; k++) {
            const i = sortedIndices[k];
            if (TrafficManager.priorityScore[i] >= 10 && TrafficManager.nextSteps[i] >= 0) {
                TrafficManager.trainLocks[TrafficManager.nextSteps[i]] = 1;
            } else if (TrafficManager.priorityScore[i] < 10 && TrafficManager.nextSteps[i] >= 0) {
                if (TrafficManager.trainLocks[TrafficManager.nextSteps[i]] === 1) {
                    TrafficManager.nextSteps[i] = -1; // Delete intersecting intent, forcing them to wait
                }
            }
        }

        const deadlocks = [];

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
                let swapped = false;
                const blockerIdx = TrafficManager.grid[targetPacked];
                if (blockerIdx !== -1 && blockerIdx !== i) {
                    if (TrafficManager.priorityScore[i] >= TrafficManager.priorityScore[blockerIdx]) {
                        const blocker = TrafficManager.creepList[blockerIdx];
                        if (blocker.fatigue === 0 && !TrafficManager.isCreepStationaryLocked(blocker)) {
                            const origPacked = (TrafficManager.creepList[i].pos.y * 50) + TrafficManager.creepList[i].pos.x;
                            TrafficManager.resolvedIntents[i] = targetPacked;
                            TrafficManager.resolvedIntents[blockerIdx] = origPacked;
                            TrafficManager.grid[origPacked] = blockerIdx;
                            TrafficManager.grid[targetPacked] = i;
                            swapped = true;
                        }
                    }
                }
                if (!swapped) deadlocks.push(i);
            }
        }

        // --- Bipartite Matching Resolution Fallback ---
        // Top-tier traffic managers model crowded gridlocks as a maximum flow problem.
        if (deadlocks.length >= 3) {
            TrafficManager.resolveBipartiteGridlock(deadlocks, terrain, matrix);
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

            if (dir) creep.heap.moveDirection = dir; // Transmit resolved orthogonal movement to ActionExecutor
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

        if (terrain.get(tx, ty) === TERRAIN_MASK_WALL) return false;

        const blockerIdx = TrafficManager.grid[targetPacked];
        if (blockerIdx === -1) {
            // Target tile is completely empty. Ensure it's walkable according to the tickMatrix (avoids threat zones).
            if (matrix.get(tx, ty) === 255) return false;
            return true;
        }

        if (TrafficManager.visited[blockerIdx]) return false; // Cycle detection
        TrafficManager.visited[blockerIdx] = 1;

        const blocker = TrafficManager.creepList[blockerIdx];

        // Fixes engine-level move rejection by failing DFS against fatigued blockers.
        if (blocker.fatigue > 0) return false;

        const blockerScore = TrafficManager.getPriority(blocker);
        if (minScore < blockerScore) return false; // Prevent low-priority creeps from displacing high-priority

        // Prevents economic collapse by anchoring stationary creeps against high-priority displacement.
        if (TrafficManager.isCreepStationaryLocked(blocker)) return false;

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

    /**
     * Resolves dense gridlocks by modeling the cluster as a maximum flow problem.
     * Uses augmenting paths to find a valid bipartite matching between creeps and tiles.
     */
    static resolveBipartiteGridlock(deadlocks, terrain, matrix) {
        const assignment = new Int32Array(2500);
        assignment.fill(-1);

        const targetsMap = new Map();

        // 1. Define edges (valid moves) for each deadlocked creep
        for (let i = 0; i < deadlocks.length; i++) {
            const cIdx = deadlocks[i];
            const creep = TrafficManager.creepList[cIdx];
            const origPacked = (creep.pos.y * 50) + creep.pos.x;

            if (TrafficManager.isCreepStationaryLocked(creep) || creep.fatigue > 0) {
                targetsMap.set(cIdx, [origPacked]);
                continue;
            }

            const targets = [];

            // Preference 1: Their intended next step
            const nextStep = TrafficManager.nextSteps[cIdx];
            if (nextStep >= 0) {
                const occupant = TrafficManager.grid[nextStep];
                if (occupant === -1 || deadlocks.includes(occupant)) {
                    targets.push(nextStep);
                }
            }

            // Preference 2: Any adjacent empty tile to break the jam
            const bx = creep.pos.x;
            const by = creep.pos.y;
            const dirs = [-51, -50, -49, -1, 1, 49, 50, 51];
            for (let d = 0; d < 8; d++) {
                const newPacked = (by * 50) + bx + dirs[d];
                if (newPacked === nextStep) continue;

                const nx = newPacked % 50;
                const ny = Math.floor(newPacked / 50);
                if (Math.abs(nx - bx) > 1 || Math.abs(ny - by) > 1) continue;
                if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
                if (terrain.get(nx, ny) === TERRAIN_MASK_WALL || matrix.get(nx, ny) === 255) continue;

                const occupant = TrafficManager.grid[newPacked];
                if (occupant === -1 || deadlocks.includes(occupant)) {
                    targets.push(newPacked);
                }
            }

            // Preference 3: Staying still
            targets.push(origPacked);

            targetsMap.set(cIdx, targets);
        }

        // 2. Compute Maximum Bipartite Matching using DFS Augmenting Paths
        for (let i = 0; i < deadlocks.length; i++) {
            const cIdx = deadlocks[i];
            const visited = new Uint8Array(2500);
            TrafficManager.bipartiteDFS(cIdx, targetsMap, assignment, visited);
        }

        // 3. Apply the results
        for (let i = 0; i < deadlocks.length; i++) {
            const cIdx = deadlocks[i];
            const origPacked = (TrafficManager.creepList[cIdx].pos.y * 50) + TrafficManager.creepList[cIdx].pos.x;
            TrafficManager.grid[origPacked] = -1;
        }

        for (let tilePacked = 0; tilePacked < 2500; tilePacked++) {
            const cIdx = assignment[tilePacked];
            if (cIdx !== -1) {
                TrafficManager.resolvedIntents[cIdx] = tilePacked;
                TrafficManager.grid[tilePacked] = cIdx;
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
            baseMatrix = cached.matrix.clone(); // Bolt: raw instance cache prevents serialization CPU spike, MUST BE CLONED
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
                matrix: baseMatrix, // Bolt: store raw CostMatrix instance
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