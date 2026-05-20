/**
 * @module heapValidator
 * @description Utility to perform integrity checks on the global heap state, verifying that critical caches and O(1) dictionaries are populated.
 */

const resetRecovery = require('./resetRecovery');
const { CacheRegistry } = require('./cache');

class HeapValidator {
    /**
     * Validates the integrity of the global heap state.
     * Detects missing critical cache keys and triggers rehydration if corruption is found.
     * @returns {void}
     */
    validate() {
        const criticalKeys = ['structures', 'creeps', 'sources', 'costMatrices', 'objectPools', 'rooms'];
        let needsRehydration = false;

        if (!global.Cache || !(global.Cache instanceof Map)) {
            console.log('[HeapValidator] global.Cache is missing or invalid. Triggering rehydration.');
            global.Cache = new Map();
            needsRehydration = true;
        }

        for (const key of criticalKeys) {
            if (!global.Cache.has(key) || !(global.Cache.get(key) instanceof Map)) {
                console.log(`[HeapValidator] Critical cache key '${key}' is missing or invalid. Triggering rehydration.`);
                global.Cache.set(key, new Map());
                needsRehydration = true;
            }
        }

        if (needsRehydration) {
            // Unset the reset detected flag so checkAndRecover will actually run and rehydrate
            global.__resetDetected = undefined;
            // Build the Map infrastructure FIRST
            CacheRegistry.init();
            resetRecovery.checkAndRecover();
        }
    }
}

module.exports = new HeapValidator();
