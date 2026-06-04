class SourcePositionCacheUtility {
    /**
     * Retrieves the cached optimal harvest position for a given source.
     * @param {string} sourceId The ID of the source.
     * @returns {RoomPosition|null} The cached position, or null if not found.
     */
    static getOptimalHarvestPosition(sourceId) {
        if (!Memory.sourcePositions || !(Memory.sourcePositions instanceof Map) || !Memory.sourcePositions.has(sourceId)) {
            return null;
        }

        const cachedPos = Memory.sourcePositions.get(sourceId);
        // Validate properties before creating RoomPosition to avoid engine errors
        if (cachedPos && cachedPos.x !== undefined && cachedPos.y !== undefined && cachedPos.roomName) {
             return new RoomPosition(cachedPos.x, cachedPos.y, cachedPos.roomName);
        }

        return null;
    }

    /**
     * Stores the optimal harvest position for a given source in Memory.
     * @param {string} sourceId The ID of the source.
     * @param {RoomPosition} pos The optimal position to cache.
     */
    static setOptimalHarvestPosition(sourceId, pos) {
        if (!Memory.sourcePositions || !(Memory.sourcePositions instanceof Map)) {
            Memory.sourcePositions = new Map();
        }

        if (!pos) {
            return;
        }

        // Store plain object to save memory serialization overhead
        Memory.sourcePositions.set(sourceId, {
            x: pos.x,
            y: pos.y,
            roomName: pos.roomName
        });
    }
}

module.exports = SourcePositionCacheUtility;
