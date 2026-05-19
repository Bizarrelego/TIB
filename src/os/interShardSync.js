const interShardMemoryManager = require('./interShardMemoryManager');
const Logger = require('../utils/logger');

/**
 * @class InterShardSync
 * @description Manages synchronization of economy and expansion data across shards using InterShardMemory.
 */
class InterShardSync {
    constructor() {
        /**
         * @type {Map<string, any>} O(1) Map storing intel data across shards.
         */
        this.intel = new Map();

        /**
         * @type {Map<string, any>} O(1) Map storing market/resource request data across shards.
         */
        this.market = new Map();

        this.init();
    }

    /**
     * Initializes the synchronization engine, rehydrating Maps from local cache.
     * Invoked during initialization or shard reset.
     */
    init() {
        this.intel.clear();
        this.market.clear();

        const cachedIntel = interShardMemoryManager.localCache['INTEL'];
        if (cachedIntel) {
            for (const [key, value] of Object.entries(cachedIntel)) {
                this.intel.set(key, value);
            }
        }

        const cachedMarket = interShardMemoryManager.localCache['MARKET'];
        if (cachedMarket) {
            for (const [key, value] of Object.entries(cachedMarket)) {
                this.market.set(key, value);
            }
        }

        Logger.debug('InterShardSync: Initialized and rehydrated O(1) Maps.');
    }

    /**
     * Records intel data for a specific room.
     * @param {string} roomName The name of the room.
     * @param {any} data The intel data to record.
     */
    recordIntel(roomName, data) {
        this.intel.set(roomName, data);
        this.saveIntel();
    }

    /**
     * Records a resource request across shards.
     * @param {string} shard Target shard name.
     * @param {string} resourceType The type of resource requested.
     * @param {number} amount The amount of resource requested.
     */
    requestResource(shard, resourceType, amount) {
        const requestId = `${shard}_${resourceType}_${Game.time}`;
        this.market.set(requestId, { shard, resourceType, amount, time: Game.time });
        this.saveMarket();
    }

    /**
     * Serializes the intel Map back to a plain object and saves it via the manager.
     */
    saveIntel() {
        const dataObj = {};
        for (const [key, value] of this.intel.entries()) {
            dataObj[key] = value;
        }
        interShardMemoryManager.save('INTEL', dataObj);
    }

    /**
     * Serializes the market Map back to a plain object and saves it via the manager.
     */
    saveMarket() {
        const dataObj = {};
        for (const [key, value] of this.market.entries()) {
            dataObj[key] = value;
        }
        interShardMemoryManager.save('MARKET', dataObj);
    }
}

module.exports = new InterShardSync();
