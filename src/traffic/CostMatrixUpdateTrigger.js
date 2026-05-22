const RoomHasher = require('../os/roomHasher');

/**
 * Module responsible for determining if a CostMatrix needs to be recalculated
 * based on changes to room terrain or structure layout.
 * @module CostMatrixUpdateTrigger
 */
const CostMatrixUpdateTrigger = {
    /**
     * Determines whether the CostMatrix for a given room should be updated
     * by comparing the current room hash with the cached version.
     * If the hash has changed, it updates the cached hash and returns true.
     *
     * @param {string} roomName - The name of the room to check.
     * @returns {boolean} True if the CostMatrix should be updated, false otherwise.
     */
    shouldUpdateCostMatrix: (roomName) => {
        if (!global.State) global.State = new Map();
        if (!global.State.has('roomHashes')) global.State.set('roomHashes', new Map());

        const currentHash = RoomHasher.generate(roomName);
        let cachedHash = null;

        const roomHashes = global.State.get('roomHashes');

        if (roomHashes.has(roomName)) {
            cachedHash = roomHashes.get(roomName);
        } else if (global.Cache && global.Cache.has('roomHashes')) {
            const roomHashesCache = global.Cache.get('roomHashes');
            if (roomHashesCache.has(roomName)) {
                cachedHash = roomHashesCache.get(roomName);
            }
        }

        if (currentHash === cachedHash) {
            return false;
        }

        // Hash changed or doesn't exist, update cache and trigger recalculation
        roomHashes.set(roomName, currentHash);

        if (global.Cache) {
            if (!global.Cache.has('roomHashes')) {
                global.Cache.set('roomHashes', new Map());
            }
            global.Cache.get('roomHashes').set(roomName, currentHash);
        }

        return true;
    }
};

module.exports = CostMatrixUpdateTrigger;
