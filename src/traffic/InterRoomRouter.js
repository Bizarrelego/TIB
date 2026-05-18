/**
 * @file InterRoomRouter.js
 * @description O(1) Cached Map-Level Routing System using Intel.
 */

class InterRoomRouter {
    /**
     * Calculates and caches a cross-room route avoiding hostile rooms.
     * @param {string} startRoom - The room the creep is starting in.
     * @param {string} targetRoom - The final destination room.
     * @returns {string[]} Array of room names to traverse.
     */
    static getRoute(startRoom, targetRoom) {
        if (!global.State) global.State = new Map();
        if (!global.State.routeCache) global.State.routeCache = new Map();

        const cacheKey = `${startRoom}_${targetRoom}`;

        if (global.State.routeCache.has(cacheKey)) {
            return [...global.State.routeCache.get(cacheKey)];
        }

        const route = Game.map.findRoute(startRoom, targetRoom, {
            routeCallback: (roomName) => {
                if (global.State.intel && global.State.intel.has(roomName)) {
                    const intel = global.State.intel.get(roomName);
                    if (intel.hostile) return 255; // Blocked (Enemy)
                    if (intel.type === 'sk') return 10; // High cost (Source Keeper)
                }
                return 1; // Friendly / Neutral / Unseen
            }
        });

        let roomArray = [];
        if (Array.isArray(route)) roomArray = route.map(r => r.room);

        global.State.routeCache.set(cacheKey, roomArray);
        return [...roomArray];
    }
}

module.exports = InterRoomRouter;