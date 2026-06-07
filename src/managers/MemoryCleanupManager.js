/**
 * Clears memory of dead creeps and stale heap entries to prevent bloat.
 */
class MemoryCleanupManager {
    static run() {
        // Run every 10 ticks to save CPU
        if (Game.time % 10 !== 0) return;

        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }

        // Clean stale heap entries for dead creeps
        if (global.creepHeap && global.creepHeap instanceof Map) {
            for (const name of global.creepHeap.keys()) {
                if (!Game.creeps[name]) {
                    global.creepHeap.delete(name);
                }
            }
        }
    }
}

module.exports = MemoryCleanupManager;