const { setHeapData, getHeapData, deleteHeapData } = require('../utils/creepHeapData');

/**
 * @fileoverview Manager for handling creep operational data exclusively on the heap.
 * This ensures that transient, tick-specific creep data does not pollute `creep.memory`,
 * adhering to the 'Heap Exclusivity' principle.
 *
 * See `src/types/creepHeapSchema.js` for the expected schema and typings of operational data.
 */

require('../types/creepHeapSchema.js'); // For IDE intellisense

class CreepOperationalDataManager {
    /**
     * Initializes the manager.
     */
    constructor() {
        // Track the keys used for operational data so they can be safely cleared
        this.trackedKeys = new Set();
    }

    /**
     * Helper to get a creep by its ID or Name using exclusively the global state lookup
     * to adhere to the Zero Native Polling mandate.
     *
     * @param {string} creepId - The ID or name of the creep.
     * @returns {Creep|undefined} The creep object.
     */
    _getCreep(creepId) {
        if (!creepId) return undefined;

        if (global.State && global.State.creepLookup) {
            return global.State.creepLookup.get(creepId);
        }

        return undefined;
    }

    /**
     * Sets operational data for a specific creep on its heap.
     *
     * @param {string} creepId - The ID or name of the creep.
     * @param {string} key - The key for the data.
     * @param {CreepMovementData|CreepTargetData|CreepHarvestData|CreepCombatData|*} value - The value to store.
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
     * @returns {CreepMovementData|CreepTargetData|CreepHarvestData|CreepCombatData|undefined} The value stored, or undefined if not found.
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
        if (!global.State || !global.State.creepLookup) return;

        for (const creep of global.State.creepLookup.values()) {
            for (const key of this.trackedKeys) {
                deleteHeapData(creep, key);
            }
        }

        this.trackedKeys.clear();
    }
}

module.exports = new CreepOperationalDataManager();
