/**
 * @file SpawnQueueManager.js
 * @description Manages prioritized spawn queue
 */

const ROLE_PRIORITIES = {
    'harvester': 100,
    'hauler': 90,
    'fastFiller': 80,
    'hubManager': 70,
    'upgrader': 60,
    'scout': 50,
    'worker': 40
};

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
     * @param {StructureSpawn} spawn
     * @param {Object} spawnLedger
     */
    process(spawn, spawnLedger) {
        if (this.queue.length === 0) return;

        this.queue.sort((a, b) => {
            const prioA = ROLE_PRIORITIES[a.role] || 0;
            const prioB = ROLE_PRIORITIES[b.role] || 0;
            return prioB - prioA;
        });

        const topRequest = this.queue[0];
        if (spawnLedger.canSpawn(topRequest.cost)) {
            spawnLedger.requestSpawn(spawn, topRequest.body, topRequest.name, topRequest.opts, topRequest.cost);
        }
    }
}

module.exports = SpawnQueueManager;
