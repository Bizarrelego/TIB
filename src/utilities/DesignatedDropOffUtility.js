const GameObjectUtility = require('./GameObjectUtility');
const cache = new Map();

class DesignatedDropOffUtility {
    /**
     * Gets the optimal drop-off position for a controller.
     * Hardcoded to return a position x+1 from the controller for early RCL.
     * @param {string} controllerId
     * @returns {RoomPosition|null}
     */
    static getUpgraderDropOffPosition(controllerId) {
        if (!controllerId) return null;

        const cacheKey = `upgrader_${controllerId}`;
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }

        const controller = GameObjectUtility.getById(controllerId);
        if (!controller) return null;

        // Hardcoded position relative to the controller (x + 1, y)
        // Ensures it stays within map bounds
        const x = Math.min(49, controller.pos.x + 1);
        const y = controller.pos.y;
        const pos = new RoomPosition(x, y, controller.pos.roomName);

        cache.set(cacheKey, pos);
        return pos;
    }

    /**
     * Gets the optimal drop-off position for a spawn.
     * Hardcoded to return a position x-1 from the spawn for early RCL.
     * @param {string} spawnId
     * @returns {RoomPosition|null}
     */
    static getSpawnDropOffPosition(spawnId) {
        if (!spawnId) return null;

        const cacheKey = `spawn_${spawnId}`;
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }

        const spawn = GameObjectUtility.getById(spawnId);
        if (!spawn) return null;

        // Hardcoded position relative to the spawn (x - 1, y)
        // Ensures it stays within map bounds
        const x = Math.max(0, spawn.pos.x - 1);
        const y = spawn.pos.y;
        const pos = new RoomPosition(x, y, spawn.pos.roomName);

        cache.set(cacheKey, pos);
        return pos;
    }
}

module.exports = DesignatedDropOffUtility;
