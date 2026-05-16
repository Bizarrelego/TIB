const MEMORY_SEGMENTS = require('../constants/memorySegments');
const Logger = require('../utils/logger');

/**
 * Manages serialization and deserialization of cross-shard data via InterShardMemory.
 */
class InterShardMemoryManager {
    constructor() {
        /**
         * @type {Object<string, any>} Cache of the current local InterShardMemory data.
         */
        this.localCache = {};
        this._loadLocal();
    }

    /**
     * Initializes the local cache by parsing InterShardMemory for the current shard.
     * @private
     */
    _loadLocal() {
        if (typeof InterShardMemory === 'undefined') return;

        const localData = InterShardMemory.getLocal();
        if (localData) {
            try {
                this.localCache = JSON.parse(localData);
            } catch (e) {
                Logger.error(`InterShardMemoryManager: Failed to parse local memory: ${e.message}`);
                this.localCache = {};
            }
        }
    }

    /**
     * Loads and deserializes data from a specific shard.
     * @param {string} shard The name of the shard to load data from (e.g., 'shard0').
     * @returns {Object|null} The parsed JSON object of the requested shard's memory, or null if empty/unavailable.
     */
    load(shard) {
        if (typeof InterShardMemory === 'undefined') return null;

        const remoteData = InterShardMemory.getRemote(shard);
        if (!remoteData) return null;

        try {
            return JSON.parse(remoteData);
        } catch (e) {
            Logger.error(`InterShardMemoryManager: Failed to parse remote memory for ${shard}: ${e.message}`);
            return null;
        }
    }

    /**
     * Serializes and saves data to a specific segment within the local InterShardMemory.
     * Respects the synchronization frequency defined in memorySegments.js.
     * @param {string} segmentName The name of the data segment (e.g., 'INTEL', 'MARKET').
     * @param {any} data The data payload to save.
     */
    save(segmentName, data) {
        if (typeof InterShardMemory === 'undefined' || typeof Game === 'undefined') return;

        const segmentConfig = MEMORY_SEGMENTS.INTER_SHARD[segmentName];
        if (!segmentConfig) {
            Logger.warn(`InterShardMemoryManager: Segment ${segmentName} is not configured.`);
            return;
        }

        if (Game.time % segmentConfig.frequency !== 0) return;

        this.localCache[segmentName] = data;

        try {
            const serialized = JSON.stringify(this.localCache);
            InterShardMemory.setLocal(serialized);
        } catch (e) {
            Logger.error(`InterShardMemoryManager: Failed to stringify local memory: ${e.message}`);
        }
    }
}

module.exports = new InterShardMemoryManager();
