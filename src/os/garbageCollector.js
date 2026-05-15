const RawMemoryManager = require('./RawMemoryManager');

function garbageCollector() {
    if (Game.time % 100 !== 0) return;

    try {
        // Clean up dead creeps
        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }

        // Clean up stale intel
        let intelCacheMap = null;
        const rawIntelCache = RawMemoryManager.loadIntel();
        if (rawIntelCache) {
            // "V8 Map Optimization: Use Map() for O(1) lookups."
            // Ensure we treat intelCache as a map if it isn't one already for processing,
            // or if it's stored as an object, iterate over its keys properly.
            // RawMemoryManager returns a raw object from JSON.parse.
            // We should use Object.keys instead of for...in to avoid prototype chain iteration,
            // but the feedback specifically mentions using Map.

            intelCacheMap = new Map(Object.entries(rawIntelCache));
        }

        if (intelCacheMap) {
            let changed = false;
            for (const [roomName, intelData] of intelCacheMap.entries()) {
                if (Game.time - (intelData.lastSeen || 0) > 1000) {
                    intelCacheMap.delete(roomName);
                    changed = true;
                }
            }
            if (changed) {
                RawMemoryManager.saveIntel(Object.fromEntries(intelCacheMap));
            }
        }

        // Clean up stale intel in global.State.intel if it exists
        if (global.State && global.State.intel) {
            for (const [roomName, intelData] of global.State.intel.entries()) {
                if (Game.time - (intelData.lastSeen || 0) > 1000) {
                    global.State.intel.delete(roomName);
                }
            }
        }

    } catch (e) {
        console.log(`[GarbageCollector Error]: ${e.stack}`);
    }
}

module.exports = garbageCollector;
