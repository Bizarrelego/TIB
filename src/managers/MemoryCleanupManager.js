/**
 * Clears memory of dead creeps and stale heap entries to prevent bloat.
 */
class MemoryCleanupManager {
    static run() {
        if (!global.creepHeap) global.creepHeap = new Map();

        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (!global.creepHeap.has(name)) {
                global.creepHeap.set(name, { state: 'idle', stallCount: 0 });
            }
            creep.heap = global.creepHeap.get(name);
        }

        for (const name of global.creepHeap.keys()) {
            if (!Game.creeps[name]) {
                global.creepHeap.delete(name);
            }
        }

        // Run every 10 ticks to save CPU for Memory cleanup
        if (Game.time % 10 !== 0) return;

        for (const name in Memory.creeps) {
            if (!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    }
}

module.exports = MemoryCleanupManager;