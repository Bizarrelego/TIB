/**
 * @file SpawnQueueManager.js
 * @description Manages prioritized spawn queue
 */

const ROLE_PRIORITIES = require('../constants/rolePriorities');

/**
 * @class SpawnQueueManager
 * @description Manages prioritized spawn queue
 */
class SpawnQueueManager {
    /**
     * Adds a spawn request to the global queue
     * @param {string} roomName
     * @param {string} role
     * @param {Array<string>} body
     * @param {string} name
     * @param {Object} opts
     * @param {number} cost
     */
    static requestSpawn(roomName, role, body, name, opts, cost, spawnLedger) {
        if (!SpawnQueueManager.globalQueue.has(roomName)) {
            SpawnQueueManager.globalQueue.set(roomName, []);
        }

        const queue = SpawnQueueManager.globalQueue.get(roomName);

        // Prevent duplicates based on role and targetRoom (if applicable)
        const isDuplicate = queue.some(req => {
            if (req.role !== role) return false;
            if (opts && opts.memory && req.opts && req.opts.memory) {
                if (opts.memory.targetRoom) {
                    return req.opts.memory.targetRoom === opts.memory.targetRoom;
                }
            }
            return true;
        });

        if (isDuplicate) return;

        // Validating energy using ledger before queuing
        if (spawnLedger && !spawnLedger.canSpawn(cost)) {
            return;
        }

        queue.push({ role, body, name, opts, cost });
    }

    /**
     * Helper to request rampartMelee dynamically
     * @param {Room} room
     */
    static requestRampartMelee(room) {
        const capacity = room.energyCapacityAvailable;
        let body = [];
        let cost = 0;

        // Basic rampartMelee body logic: ATTACK, MOVE
        const pairCost = BODYPART_COST[ATTACK] + BODYPART_COST[MOVE];
        while (cost + pairCost <= capacity && body.length < 50) {
            body.push(ATTACK, MOVE);
            cost += pairCost;
        }

        // Add 1 WORK and 1 CARRY if we can afford it (for repair)
        const repairCost = BODYPART_COST[WORK] + BODYPART_COST[CARRY];
        if (body.length < 48 && cost + repairCost <= capacity) {
            body.push(WORK, CARRY);
            cost += repairCost;
        } else if (body.length >= 2) {
            // Replace last ATTACK, MOVE with WORK, CARRY if we couldn't add them directly
            const tempCost = cost - BODYPART_COST[ATTACK] - BODYPART_COST[MOVE] + repairCost;
            if (tempCost <= capacity) {
                body.pop();
                body.pop();
                body.push(WORK, CARRY);
                cost = tempCost;
            }
        }

        if (body.length > 0) {
            SpawnQueueManager.requestSpawn(room.name, 'rampartMelee', body, 'rampartMelee_' + Game.time, {
                memory: { role: 'rampartMelee', colony: room.name }
            }, cost);
        }
    }

    /**
     * Processes the queue, prioritizing the highest priority request.
     * Prevents spawn blocking by stalling if the highest priority request cannot be afforded.
     * @param {StructureSpawn} spawn The spawn to execute the request on
     * @param {Object} spawnLedger The ledger to verify and reserve energy
     */
    static process(spawn, spawnLedger) {
        if (!SpawnQueueManager.globalQueue.has(spawn.room.name)) return;

        const queue = SpawnQueueManager.globalQueue.get(spawn.room.name);
        if (queue.length === 0) return;

        // Sort by role priorities
        queue.sort((a, b) => {
            const prioA = ROLE_PRIORITIES.get(a.role) || 0;
            const prioB = ROLE_PRIORITIES.get(b.role) || 0;
            return prioB - prioA; // Descending order (highest priority first)
        });

        for (let i = 0; i < queue.length; i++) {
            const request = queue[i];

            if (spawnLedger.canSpawn(request.cost) && !spawnLedger.isSpawnBusy(spawn)) {
                const result = spawnLedger.requestSpawn(spawn, request.body, request.name, request.opts, request.cost);
                if (result === OK) {
                    queue.splice(i, 1); // Remove the spawned request
                    return; // Spawn is now busy
                }
            } else {
                // If we cannot spawn the current highest priority creep (!canSpawn or ERR_NOT_ENOUGH_ENERGY),
                // we immediately return from the function. This prevents lower-priority creeps from
                // consuming energy and blocking the high-priority ones.
                return;
            }
        }
    }
}

SpawnQueueManager.ROLE_PRIORITIES = ROLE_PRIORITIES;
SpawnQueueManager.globalQueue = new Map();

module.exports = SpawnQueueManager;
