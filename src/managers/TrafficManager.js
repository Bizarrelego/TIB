const ActionConstants = require('../constants/ActionConstants');

/**
 * Top-Down Traffic Manager
 * Replaces individual `creep.moveTo` calls.
 * All creep modules write their intended destination to `creep.heap.destination`.
 * TrafficManager runs at the end of the tick, plots all intended moves on a grid,
 * resolves collisions (swaps), and issues bulk `creep.move(direction)` API calls.
 */
class TrafficManager {
    static run() {
        if (!global.creepHeap) return;

        const intendedMoves = new Map(); // creepName -> { x, y, roomName, range }
        const grid = new Map(); // `${x},${y},${roomName}` -> creepName

        // Pass 1: Collect destinations and execute pathfinder
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            if (creep.spawning || creep.fatigue > 0) continue;

            const heap = creep.heap;
            if (!heap || !heap.destination) continue;

            const dest = heap.destination;
            
            // If already in range, clear destination
            if (creep.room.name === dest.roomName) {
                const range = Math.max(Math.abs(creep.pos.x - dest.x), Math.abs(creep.pos.y - dest.y));
                if (range <= (dest.range || 1)) {
                    heap.destination = null;
                    continue;
                }
            }

            // Centralized pathing
            const targetPos = new RoomPosition(dest.x, dest.y, dest.roomName);
            const pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: dest.range || 1 }, {
                plainCost: 2,
                swampCost: 10,
                roomCallback: TrafficManager.getCostMatrix
            });

            if (pathResult.incomplete && pathResult.path.length === 0) {
                heap.unreachableTargetId = heap.targetId; // Tell Brain to drop this target next tick
                heap.destination = null;
                continue;
            }

            if (pathResult.path.length > 0) {
                const nextStep = pathResult.path[0];
                intendedMoves.set(creep.name, nextStep);

                const currentKey = `${creep.pos.x},${creep.pos.y},${creep.room.name}`;
                grid.set(currentKey, creep.name);
            }
        }

        // Pass 2: Issue Move Intents & Resolve Swaps
        for (const [creepName, nextStep] of intendedMoves) {
            const creep = Game.creeps[creepName];
            const nextKey = `${nextStep.x},${nextStep.y},${nextStep.roomName}`;
            
            const blockerName = grid.get(nextKey);
            if (blockerName && blockerName !== creepName) {
                const blocker = Game.creeps[blockerName];
                const blockerNext = intendedMoves.get(blockerName);

                // Swap check: If the blocker wants to move to our current spot, or is idle
                if (!blockerNext || (blockerNext.x === creep.pos.x && blockerNext.y === creep.pos.y)) {
                    const dirToBlocker = creep.pos.getDirectionTo(blocker);
                    const dirToCreep = blocker.pos.getDirectionTo(creep);
                    
                    creep.move(dirToBlocker);
                    if (!blockerNext) {
                        // Force the idle creep to swap
                        blocker.move(dirToCreep);
                    }
                    continue;
                }
            }

            const direction = creep.pos.getDirectionTo(nextStep);
            creep.move(direction);
        }
    }

    static getCostMatrix(roomName) {
        if (!global.State || !global.State.rooms) return new PathFinder.CostMatrix();
        
        // Return cached matrix if available
        if (global.Cache && global.Cache.costMatrices && global.Cache.costMatrices.has(roomName)) {
            return global.Cache.costMatrices.get(roomName);
        }

        const roomState = global.State.rooms.get(roomName);
        const matrix = new PathFinder.CostMatrix();

        if (roomState && roomState.structureIds) {
            for (let i = 0; i < roomState.structureIds.length; i++) {
                const s = Game.getObjectById(roomState.structureIds[i]);
                if (s && s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_RAMPART) {
                    matrix.set(s.pos.x, s.pos.y, 255);
                } else if (s && s.structureType === STRUCTURE_ROAD) {
                    matrix.set(s.pos.x, s.pos.y, 1);
                }
            }
        }

        if (!global.Cache) global.Cache = {};
        if (!global.Cache.costMatrices) global.Cache.costMatrices = new Map();
        global.Cache.costMatrices.set(roomName, matrix);

        return matrix;
    }
}

module.exports = TrafficManager;
