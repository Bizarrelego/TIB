// Tigga-Style Optimized Cache Initialization
const CacheRegistry = {
    // Utilize direct reference assignment for O(1) performance
    init: () => {
        global.Cache = new Map([
            ['structures', new Map()],
            ['creeps', new Map()],
            ['sources', new Map()]
        ]);
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

module.exports = { CacheRegistry };
