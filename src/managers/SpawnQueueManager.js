/**
 * @file SpawnQueueManager.js
 * @description Manages prioritized spawn queue
 */

const ROLE_PRIORITIES = require('../constants/rolePriorities');
const eventBus = require('../os/eventBus');
const CreepRoleBalancer = require('../colonies/CreepRoleBalancer');

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
        // Gatekeep using the reservation system.
        // Prevent adding to the queue if virtual available energy is less than the cost.
        const room = Game.rooms[roomName];
        if (!room) return;

        // "Sub-Tick Spawn Ledger: Virtual ledger for room energy capacity."
        // We track against the room's current energy capacity so managers don't over-queue total spawn potential for the tick.
        const capacity = room.energyCapacityAvailable;

        let totalQueuedCost = 0;
        if (SpawnQueueManager.globalQueue.has(roomName)) {
            const buckets = SpawnQueueManager.globalQueue.get(roomName);
            for (const bucket of buckets) {
                if (!bucket) continue;
                for (const req of bucket) {
                    totalQueuedCost += req.cost;
                }
            }
        }

        const virtualAvailable = Math.max(0, capacity - totalQueuedCost);

        if (virtualAvailable < cost) {
            return; // Not enough virtual capacity left to queue this creep
        }

        if (!SpawnQueueManager.globalQueue.has(roomName)) {
            const buckets = new Array(120);
            for (let i = 0; i < 120; i++) buckets[i] = [];
            SpawnQueueManager.globalQueue.set(roomName, buckets);
        }

        const buckets = SpawnQueueManager.globalQueue.get(roomName);
        const priority = CreepRoleBalancer.getRolePriority(role);
        const bucket = buckets[priority];

        // Prevent duplicate requests in O(1) priority bucket
        const reqTargetRoom = opts && opts.memory ? (opts.memory.targetRoom || opts.memory.remoteRoom) : undefined;
        const isDuplicate = bucket.some(req =>
            req.role === role &&
            (req.opts && req.opts.memory ? (req.opts.memory.targetRoom || req.opts.memory.remoteRoom) : undefined) === reqTargetRoom
        );

        if (!isDuplicate) {
            bucket.push({ role, body, name, opts, cost });
        }
    }

    /**
     * Calculates the number of CARRY parts already queued for a specific room and role
     * @param {string} roomName The spawn room name
     * @param {string} role The role of the creeps
     * @param {string} targetRoomName The target/remote room name
     * @returns {number} The total queued CARRY parts
     */
    static getQueuedCarryParts(roomName, role, targetRoomName) {
        if (!SpawnQueueManager.globalQueue.has(roomName)) return 0;

        let carryCount = 0;
        const buckets = SpawnQueueManager.globalQueue.get(roomName);
        for (const bucket of buckets) {
            for (const req of bucket) {
                const reqTargetRoom = req.opts && req.opts.memory ? (req.opts.memory.targetRoom || req.opts.memory.remoteRoom) : undefined;
                if (req.role === role && reqTargetRoom === targetRoomName) {
                    for (const part of req.body) {
                        if (part === CARRY) carryCount++;
                    }
                }
            }
        }
        return carryCount;
    }

    /**
     * Calculates the number of creeps of a given role queued for a specific target room
     * @param {string} roomName The spawn room name
     * @param {string} role The role of the creeps
     * @param {string} targetRoomName The target/remote room name
     * @returns {number} The count of queued creeps matching criteria
     */
    static getQueuedCount(roomName, role, targetRoomName) {
        if (!SpawnQueueManager.globalQueue.has(roomName)) return 0;

        let count = 0;
        const buckets = SpawnQueueManager.globalQueue.get(roomName);
        for (const bucket of buckets) {
            for (const req of bucket) {
                const reqTargetRoom = req.opts && req.opts.memory ? (req.opts.memory.targetRoom || req.opts.memory.remoteRoom) : undefined;
                if (req.role === role && reqTargetRoom === targetRoomName) {
                    count++;
                }
            }
        }
        return count;
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
                const spawn = availableSpawns[0];

                // Purge requests that exceed the room's absolute maximum capacity (e.g. extension destroyed)
                if (request.cost > spawn.room.energyCapacityAvailable) {
                    bucket.splice(i, 1);
                    continue;
                }

                if (!spawnLedger.canSpawn(request.cost)) {
                    // STALL the queue to prevent lower-priority creeps from stealing energy
                    // and causing an infinite spawn lock for expensive high-priority creeps.
                    return;
                }

                const result = spawnLedger.requestSpawn(spawn, request.body, request.name, request.opts, request.cost);

                if (result === OK) {
                    bucket.splice(i, 1);
                    availableSpawns.shift();
                } else if (result === ERR_NOT_ENOUGH_ENERGY || result === ERR_BUSY) {
                    return; // Stall if actual engine rejects due to energy or busy state
                } else {
                    // Purge invalid requests (e.g. ERR_INVALID_ARGS, ERR_NAME_EXISTS) to prevent permanent blocking
                    bucket.splice(i, 1);
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
