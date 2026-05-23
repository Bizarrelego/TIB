const { setHeapData, getHeapData, deleteHeapData } = require('../utils/creepHeapData');

/**
 * @fileoverview Manager for handling creep operational data exclusively on the heap.
 * This ensures that transient, tick-specific creep data does not pollute `creep.memory`,
 * adhering to the 'Heap Exclusivity' principle.
 */

class CreepOperationalDataManager {
    /**
     * Initializes the manager.
     */
    constructor() {
        // Track the keys used for operational data so they can be safely cleared
        this.trackedKeys = new Set();
    }

    /**
     * Helper to get a creep by its ID or Name using the global state lookup, Game.creeps, or Game.getObjectById.
     * Since screeps sometimes calls this ID but it is often the name (e.g. in Game.creeps and creepLookup),
     * we attempt both lookups to ensure robust retrieval.
     *
     * @param {string} creepId - The ID or name of the creep.
     * @returns {Creep|undefined} The creep object.
     */
    _getCreep(creepId) {
        if (!creepId) return undefined;

        if (global.State && global.State.creepLookup) {
            const creep = global.State.creepLookup.get(creepId);
            if (creep) return creep;
        }

        if (typeof Game !== 'undefined') {
            if (Game.creeps && Game.creeps[creepId]) {
                return Game.creeps[creepId];
            }
            if (Game.getObjectById) {
                const creepById = Game.getObjectById(creepId);
                if (creepById && creepById.id === creepId) {
                    return creepById;
                }
            }
        }
        return undefined;
    }

    /**
     * Sets operational data for a specific creep on its heap.
     *
     * @param {string} creepId - The ID or name of the creep.
     * @param {string} key - The key for the data.
     * @param {*} value - The value to store.
     */
    setOperationalData(creepId, key, value) {
        const creep = this._getCreep(creepId);
        if (creep) {
            setHeapData(creep, key, value);
            this.trackedKeys.add(key);
        }
    }

    /**
     * Retrieves operational data for a specific creep from its heap.
     *
     * @param {string} creepId - The ID or name of the creep.
     * @param {string} key - The key for the data to retrieve.
     * @returns {*} The value stored, or undefined if not found.
     */
    getOperationalData(creepId, key) {
        const creep = this._getCreep(creepId);
        if (creep) {
            return getHeapData(creep, key);
        }
        return undefined;
    }

    /**
     * Deletes operational data for a specific creep from its heap.
     *
     * @param {string} creepId - The ID or name of the creep.
     * @param {string} key - The key for the data to delete.
     */
    deleteOperationalData(creepId, key) {
        const creep = this._getCreep(creepId);
        if (creep) {
            deleteHeapData(creep, key);
        }
    }

    /**
     * Clears all operational data for all creeps by resetting their heap maps.
     * Useful to be called at the start of each tick or to clean up transient data.
     */
    clearAllData() {
        // Iterate through all creeps and clear only the tracked operational data keys
        let creepsIterable;

        if (global.State && global.State.creepLookup && global.State.creepLookup.size > 0) {
            creepsIterable = global.State.creepLookup.values();
        } else if (typeof Game !== 'undefined' && Game.creeps) {
            creepsIterable = Object.values(Game.creeps);
        } else {
            return;
        }

        for (const creep of creepsIterable) {
            for (const key of this.trackedKeys) {
                deleteHeapData(creep, key);
            }
        }

        this.trackedKeys.clear();
    }
}

module.exports = new CreepOperationalDataManager();
