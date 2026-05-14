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

        const queue = SpawnQueueManager.globalQueue.get(roomName);
        const targetRoom = opts && opts.memory ? opts.memory.targetRoom : undefined;

        // Prevent duplicate requests
        const isDuplicate = queue.some(req =>
            req.role === role &&
            (req.opts && req.opts.memory ? req.opts.memory.targetRoom : undefined) === targetRoom
        );

        if (!isDuplicate) {
            queue.push({ role, body, name, opts, cost });
        }
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
     * @param {StructureSpawn[]} spawns The spawns to execute the requests on
     * @param {Object} spawnLedger The ledger to verify and reserve energy
     */
    process(spawns, spawnLedger) {
        if (!Array.isArray(spawns)) {
            spawns = [spawns];
        }
        if (spawns.length === 0) return;
        const roomName = spawns[0].room.name;

        if (!SpawnQueueManager.globalQueue.has(roomName)) {
            return;
        }

        let queue = SpawnQueueManager.globalQueue.get(roomName);
        if (queue.length === 0) return;

        queue.sort((a, b) => {
            const prioA = ROLE_PRIORITIES.has(a.role) ? ROLE_PRIORITIES.get(a.role) : (ROLE_PRIORITIES.get('default') || 0);
            const prioB = ROLE_PRIORITIES.has(b.role) ? ROLE_PRIORITIES.get(b.role) : (ROLE_PRIORITIES.get('default') || 0);
            return prioB - prioA;
        });

        let availableSpawns = spawns.filter(s => !spawnLedger.isSpawnBusy(s));
        if (availableSpawns.length === 0) return;

        let i = 0;
        while (i < queue.length && availableSpawns.length > 0) {
            const request = queue[i];

            if (!spawnLedger.canSpawn(request.cost)) {
                // If we cannot afford the highest priority request, skip and return to prevent lower-priority
                // from taking its budget and causing a spawn stall.
                return;
            }

            const spawn = availableSpawns[0];
            const result = spawnLedger.requestSpawn(spawn, request.body, request.name, request.opts, request.cost);

            if (result === OK) {
                queue.splice(i, 1); // remove from queue
                availableSpawns.shift(); // remove from available spawns
            } else {
                // if it failed for some reason other than energy (e.g. invalid body), maybe skip it,
                // but for now let's just increment to prevent infinite loops if something goes wrong.
                i++;
            }
        }
    }
}

SpawnQueueManager.ROLE_PRIORITIES = ROLE_PRIORITIES;
SpawnQueueManager.globalQueue = new Map();

module.exports = SpawnQueueManager;
