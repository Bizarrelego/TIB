const SpawnQueueManager = require('./SpawnQueueManager');

/**
 * @file PreSpawnManager.js
 * @description Manages pre-spawning of replacement creeps to ensure 100% source saturation.
 */

class PreSpawnManager {
    /**
     * Initializes the global pre-spawn ledger if it doesn't exist.
     */
    static initLedger() {
        if (!global.State) global.State = new Map();
        if (!global.State.preSpawnLedger) {
            global.State.preSpawnLedger = new Map();
        }
    }

    /**
     * Registers a creep for pre-spawning.
     * @param {string} roomName
     * @param {string} role
     * @param {Array<string>} body
     * @param {string} name
     * @param {Object} opts
     * @param {number} cost
     * @param {string} creepToReplaceId The ID of the creep to replace
     * @param {number} spawnTime The time it takes to spawn the creep
     * @param {number} pathLength The distance from spawn to work location
     */
    static registerPreSpawn(roomName, role, body, name, opts, cost, creepToReplaceId, spawnTime, pathLength) {
        PreSpawnManager.initLedger();

        // Prevent duplicate pre-spawn requests for the same creep
        if (global.State.preSpawnLedger.has(creepToReplaceId)) {
            return;
        }

        global.State.preSpawnLedger.set(creepToReplaceId, {
            roomName,
            role,
            body,
            name,
            opts,
            cost,
            spawnTime,
            pathLength
        });
    }

    /**
     * Checks if a creep is registered for pre-spawning.
     * @param {string} creepId
     * @returns {boolean}
     */
    static isRegistered(creepId) {
        PreSpawnManager.initLedger();
        return global.State.preSpawnLedger.has(creepId);
    }

    /**
     * Called by managerOrchestrator to evaluate pre-spawn requests.
     */
    run() {
        PreSpawnManager.initLedger();

        if (global.State.preSpawnLedger.size === 0) return;

        const creepsToRemove = [];

        for (const [creepId, request] of global.State.preSpawnLedger.entries()) {
            // Must adhere to Zero Native Polling: fetch creep from global.State.creepLookup if possible, or Game.getObjectById
            let creepToReplace = null;
            if (global.State.creepLookup && global.State.creepLookup.has(creepId)) {
                creepToReplace = global.State.creepLookup.get(creepId);
            } else {
                creepToReplace = Game.getObjectById(creepId);
            }

            if (!creepToReplace) {
                // Creep died before pre-spawn could execute, just remove it from ledger
                creepsToRemove.push(creepId);
                continue;
            }

            const ticksNeeded = request.spawnTime + request.pathLength;

            if (creepToReplace.ticksToLive !== undefined && creepToReplace.ticksToLive <= ticksNeeded) {
                SpawnQueueManager.requestSpawn(
                    request.roomName,
                    request.role,
                    request.body,
                    request.name,
                    request.opts,
                    request.cost
                );
                creepsToRemove.push(creepId);
            }
        }

        for (const creepId of creepsToRemove) {
            global.State.preSpawnLedger.delete(creepId);
        }
    }
}

module.exports = PreSpawnManager;
