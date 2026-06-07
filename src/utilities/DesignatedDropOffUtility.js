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

        // Find a walkable tile within range 2 of the controller
        const terrain = Game.map.getRoomTerrain(controller.pos.roomName);
        let pos = null;

        for (let r = 1; r <= 3; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const x = controller.pos.x + dx;
                    const y = controller.pos.y + dy;
                    if (x >= 2 && x <= 47 && y >= 2 && y <= 47) {
                        if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                            pos = new RoomPosition(x, y, controller.pos.roomName);
                            break;
                        }
                    }
                }
                if (pos) break;
            }
            if (pos) break;
        }

        if (!pos) pos = controller.pos; // Fallback

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
