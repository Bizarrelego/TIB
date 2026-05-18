/**
 * @module heapValidator
 * @description Utility to perform integrity checks on the global heap state, verifying that critical caches and O(1) dictionaries are populated.
 */

const resetRecovery = require('./resetRecovery');

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
            needsRehydration = true;
        } else {
            for (const key of criticalKeys) {
                if (!global.Cache.has(key) || !(global.Cache.get(key) instanceof Map)) {
                    console.log(`[HeapValidator] Critical cache key '${key}' is missing or invalid. Triggering rehydration.`);
                    needsRehydration = true;
                    break;
                }
            }
        }

        if (needsRehydration) {
            // Unset the reset detected flag so checkAndRecover will actually run and rehydrate
            global.__resetDetected = undefined;
            resetRecovery.checkAndRecover();
        }
    }
}

module.exports = new HeapValidator();
