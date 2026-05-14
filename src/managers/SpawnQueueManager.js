/**
 * @file SpawnQueueManager.js
 * @description Manages prioritized spawn queue
 */

const ROLE_PRIORITIES = require('../constants/rolePriorities');

class SpawnQueueManager {
    constructor() {
        this.queue = [];
    }

    /**
     * Adds a spawn request to the global queue
     * @param {string} roomName
     * @param {string} role
     * @param {Array<string>} body
     * @param {string} name
     * @param {Object} opts
     * @param {number} cost
     */
    static requestSpawn(roomName, role, body, name, opts, cost) {
        if (!SpawnQueueManager.globalQueue.has(roomName)) {
            SpawnQueueManager.globalQueue.set(roomName, []);
        }
        SpawnQueueManager.globalQueue.get(roomName).push({ role, body, name, opts, cost });
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
     * Adds a spawn request to the queue
     * @param {string} role
     * @param {Array<string>} body
     * @param {string} name
     * @param {Object} opts
     * @param {number} cost
     */
    add(role, body, name, opts, cost) {
        this.queue.push({ role, body, name, opts, cost });
    }

    /**
     * Processes the queue, prioritizing the highest priority request.
     * Prevents spawn blocking by stalling if the highest priority request cannot be afforded.
     * @param {StructureSpawn} spawn The spawn to execute the request on
     * @param {Object} spawnLedger The ledger to verify and reserve energy
     */
    process(spawn, spawnLedger) {
        // Pull requests from the global queue for this room
        if (SpawnQueueManager.globalQueue.has(spawn.room.name)) {
            const requests = SpawnQueueManager.globalQueue.get(spawn.room.name);
            for (const req of requests) {
                this.add(req.role, req.body, req.name, req.opts, req.cost);
            }
            SpawnQueueManager.globalQueue.delete(spawn.room.name);
        }

        if (this.queue.length === 0) return;

        this.queue.sort((a, b) => {
            const prioA = ROLE_PRIORITIES.get(a.role) || 0;
            const prioB = ROLE_PRIORITIES.get(b.role) || 0;
            return prioB - prioA;
        });

        const topRequest = this.queue[0];

        // Strict queue priority enforcement: stall the queue and return immediately
        // if the highest priority role cannot be afforded to prevent lower priority spawn blocking.
        if (!spawnLedger.canSpawn(topRequest.cost)) {
            return;
        }

        spawnLedger.requestSpawn(spawn, topRequest.body, topRequest.name, topRequest.opts, topRequest.cost);
    }
}

SpawnQueueManager.ROLE_PRIORITIES = ROLE_PRIORITIES;
SpawnQueueManager.globalQueue = new Map();

module.exports = SpawnQueueManager;
