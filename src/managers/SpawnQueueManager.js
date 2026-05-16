/**
 * @file SpawnQueueManager.js
 * @description Manages prioritized spawn queue
 */

const ROLE_PRIORITIES = require('../constants/rolePriorities');
const eventBus = require('../os/eventBus');

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
            const buckets = new Array(120);
            for (let i = 0; i < 120; i++) buckets[i] = [];
            SpawnQueueManager.globalQueue.set(roomName, buckets);
        }

        const buckets = SpawnQueueManager.globalQueue.get(roomName);
        const targetRoom = opts && opts.memory ? opts.memory.targetRoom : undefined;
        const priority = ROLE_PRIORITIES.has(role) ? ROLE_PRIORITIES.get(role) : (ROLE_PRIORITIES.get('default') || 0);
        const bucket = buckets[priority];

        // Prevent duplicate requests in O(1) priority bucket
        const isDuplicate = bucket.some(req =>
            req.role === role &&
            (req.opts && req.opts.memory ? req.opts.memory.targetRoom : undefined) === targetRoom
        );

        if (!isDuplicate) {
            bucket.push({ role, body, name, opts, cost });
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

        const buckets = SpawnQueueManager.globalQueue.get(roomName);
        if (!buckets) return;

        let availableSpawns = spawns.filter(s => !spawnLedger.isSpawnBusy(s));
        if (availableSpawns.length === 0) return;

        for (let p = 119; p >= 0; p--) {
            const bucket = buckets[p];
            let i = 0;
            while (i < bucket.length && availableSpawns.length > 0) {
                const request = bucket[i];

                if (!spawnLedger.canSpawn(request.cost)) {
                    // Prevent lower-priority requests from taking the budget of a stalled high-priority creep
                    return;
                }

                const spawn = availableSpawns[0];
                const result = spawnLedger.requestSpawn(spawn, request.body, request.name, request.opts, request.cost);

                if (result === OK) {
                    bucket.splice(i, 1);
                    availableSpawns.shift();
                } else {
                    i++;
                }
            }
            if (availableSpawns.length === 0) break;
        }
    }
}

SpawnQueueManager.ROLE_PRIORITIES = ROLE_PRIORITIES;
SpawnQueueManager.globalQueue = new Map();

eventBus.subscribe('REQUEST_RAMPART_MELEE', (payload) => {
    if (payload && payload.room) {
        SpawnQueueManager.requestRampartMelee(payload.room);
    }
});

module.exports = SpawnQueueManager;
