/**
 * @file SpawnQueueManager.js
 * @description Manages prioritized spawn queue
 */

const ROLE_PRIORITIES = new Map([
    ['reserver', 110],
    ['harvester', 100],
    ['remoteHarvester', 95],
    ['hauler', 90],
    ['remoteHauler', 85],
    ['fastFiller', 80],
    ['hubManager', 70],
    ['upgrader', 60],
    ['scout', 50],
    ['worker', 40]
]);

class SpawnQueueManager {
    constructor() {
        this.queue = [];
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

module.exports = SpawnQueueManager;
