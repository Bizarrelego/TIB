const cache = new Map();
let cacheTick = 0;

class GameObjectUtility {
    /**
     * Safely retrieves a game object by its ID, minimizing repeated Game.getObjectById calls
     * within a tick by caching the result in a module-scoped Map.
     * @param {string} id
     * @returns {RoomObject | null}
     */
    static getById(id) {
        if (!id || typeof id !== 'string') return null;

        // Clear cache if tick has changed
        if (Game.time !== cacheTick) {
            cache.clear();
            cacheTick = Game.time;
        }

        if (cache.has(id)) {
            return cache.get(id);
        }

        const obj = Game.getObjectById(id);

        // Cache both successful retrievals and nulls (if object no longer exists)
        // to avoid repeated lookups for dead objects.
        cache.set(id, obj);

        return obj;
    }
}

module.exports = GameObjectUtility;
