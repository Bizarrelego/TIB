// Tigga-Style Optimized Cache Initialization
const eventBus = require('./eventBus');
const CostMatrixCache = require('../traffic/costMatrixCache');
const RoomHasher = require('./roomHasher');

const CacheRegistry = {
    // Utilize direct reference assignment for O(1) performance
    init: () => {
        global.Cache = new Map([
            ['structures', new Map()],
            ['creeps', new Map()],
            ['sources', new Map()],
            ['costMatrices', new Map()]
        ]);

        // Event-Driven Hydration: Only trigger on StateScanner update events
        eventBus.subscribe('INVALIDATE_COSTMATRIX', (data) => {
            const roomName = typeof data === 'string' ? data : data.roomName;

            const newHash = RoomHasher.generate(roomName);

            // Validate against cached hash
            let currentHash = null;
            if (global.State && global.State.roomHashes && global.State.roomHashes.has(roomName)) {
                currentHash = global.State.roomHashes.get(roomName);
            } else if (global.Cache && global.Cache.has('roomHashes') && global.Cache.get('roomHashes').has(roomName)) {
                currentHash = global.Cache.get('roomHashes').get(roomName);
            }

            if (newHash !== currentHash) {
                if (global.State && global.State.costMatrices) {
                    global.State.costMatrices.delete(roomName);
                }
                if (global.Cache && global.Cache.has('costMatrices')) {
                    const matrices = global.Cache.get('costMatrices');
                    matrices.delete(roomName);
                }
                CostMatrixCache.generate(roomName);
            }
        });
    },
    // Event-Driven Hydration: Only trigger on StateScanner update events
    hydrate: (key, dataMap) => {
        if (!global.Cache.has(key) || !(dataMap instanceof Map)) return;
        const target = global.Cache.get(key);
        // Clear and update only the delta to minimize CPU
        target.clear();
        for (const [k, v] of dataMap) {
            target.set(k, v);
        }
    }
};

module.exports = { CacheRegistry, CostMatrixCache };
