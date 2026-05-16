const RawMemoryManager = require('./RawMemoryManager');

function garbageCollector() {
    try {
        // Clean up dead creeps
        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];

                // Clear the creep's heap memory proxy to prevent leaks
                if (global.Cache && global.Cache.has('creeps')) {
                    global.Cache.get('creeps').delete(name);
                }
            }
        }

        if (global.State && global.State.creepLookup) {
            for (const name of global.State.creepLookup.keys()) {
                if (!Game.creeps[name]) {
                    global.State.creepLookup.delete(name);

                    // Remove from creepsByRoom
                    if (global.State.creepsByRoom) {
                        for (const roomCreeps of global.State.creepsByRoom.values()) {
                            for (const creepsArray of roomCreeps.values()) {
                                const index = creepsArray.findIndex(c => c.name === name);
                                if (index !== -1) {
                                    creepsArray.splice(index, 1);
                                }
                            }
                        }
                    }

                    // Clear associated locked pipelines
                    if (global.State.pipelineLedger) {
                        for (const [lockId, lock] of global.State.pipelineLedger.entries()) {
                            if (lock.creepName === name) {
                                global.State.pipelineLedger.delete(lockId);
                            }
                        }
                    }
                }
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

        // Clean up stale enemy profiles
        if (global.State && global.State.enemyProfiles) {
            for (const id of global.State.enemyProfiles.keys()) {
                if (!Game.getObjectById(id)) {
                    global.State.enemyProfiles.delete(id);
                }
            }
        }

    } catch (e) {
        console.log(`[GarbageCollector Error]: ${e.stack}`);
    }
}

module.exports = garbageCollector;
