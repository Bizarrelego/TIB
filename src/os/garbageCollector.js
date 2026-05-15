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
        const intelCache = RawMemoryManager.loadIntel();
        if (intelCache) {
            let changed = false;
            for (const roomName in intelCache) {
                if (Game.time - (intelCache[roomName].lastSeen || 0) > 1000) {
                    delete intelCache[roomName];
                    changed = true;
                }
            }
            if (changed) {
                RawMemoryManager.saveIntel(intelCache);
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
        console.error(`[GarbageCollector Error]: ${e.stack}`);
    }
}

module.exports = garbageCollector;
