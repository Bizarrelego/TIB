/**
 * Custom Sub-Millisecond Profiler
 * Wraps functions/managers to track CPU usage averages over 1000 ticks.
 * Operates purely natively without requiring external modules.
 */

class Profiler {
    static init() {
        if (!global.ProfilerStats) {
            global.ProfilerStats = new Map();
        }
    }

    /**
     * Wrap a function with profiling logic.
     * @param {string} name Identifier for the profiler logs
     * @param {Function} func Function to wrap
     * @returns {Function} Wrapped function
     */
    static wrap(name, func) {
        return function (...args) {
            Profiler.init();

            const start = Game.cpu.getUsed();
            const result = func(...args);
            const end = Game.cpu.getUsed();
            const cpuUsed = end - start;

            let stats = global.ProfilerStats.get(name);
            if (!stats) {
                stats = { totalCpu: 0, calls: 0, avg: 0, ticks: 0, lastTick: Game.time };
            }

            stats.totalCpu += cpuUsed;
            stats.calls += 1;

            if (stats.lastTick !== Game.time) {
                stats.ticks += 1;
                stats.lastTick = Game.time;
            }

            // Rolling average over 1000 ticks to prevent memory bloat
            if (stats.ticks > 1000) {
                stats.avg = stats.totalCpu / stats.ticks;
                // Reset rolling window
                stats.totalCpu = stats.avg;
                stats.ticks = 1;
            } else {
                stats.avg = stats.ticks === 0 ? stats.totalCpu : stats.totalCpu / stats.ticks;
            }

            global.ProfilerStats.set(name, stats);
            return result;
        };
    }

    /**
     * Print all profiled statistics to console
     */
    static report() {
        if (!global.ProfilerStats) return;
        if (Game.cpu.bucket < 9000) return;

        console.log('--- Profiler Report ---');
        let sorted = Array.from(global.ProfilerStats.entries())
            .sort((a, b) => b[1].avg - a[1].avg);

        for (const [name, stats] of sorted) {
            console.log(`[${name}] Avg: ${stats.avg.toFixed(4)} CPU | Calls: ${stats.calls}`);
        }
        console.log('-----------------------');
    }
}

module.exports = Profiler;
