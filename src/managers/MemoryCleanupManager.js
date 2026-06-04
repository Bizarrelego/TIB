/**
 * Clears memory of dead creeps to prevent heap bloat.
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
    }
}

module.exports = MemoryCleanupManager;