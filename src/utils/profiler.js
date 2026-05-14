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
                stats = { totalCpu: 0, calls: 0, ticks: 0, lastTick: -1, avg: 0 };
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
                stats.calls = 1;
                stats.ticks = 1;
            } else {
                stats.avg = stats.totalCpu / stats.ticks;
            }

            global.ProfilerStats.set(name, stats);
            return result;
        };
    }

    /**
     * Wrap all static methods of an ES6 class individually.
     * @param {string} className Identifier prefix for the profiler logs
     * @param {class} clazz The class to wrap
     * @returns {class} The original class (methods are wrapped in-place)
     */
    static wrapClass(className, clazz) {
        for (const methodName of Object.getOwnPropertyNames(clazz)) {
            const method = clazz[methodName];
            if (typeof method === 'function' && methodName !== 'length' && methodName !== 'name' && methodName !== 'prototype') {
                clazz[methodName] = Profiler.wrap(`${className}.${methodName}`, method);
            }
        }
        return clazz;
    }

    /**
     * Print all profiled statistics to console
     */
    static report() {
        if (Game.cpu.bucket < 9000) return;
        if (!global.ProfilerStats) return;

        console.log('--- Profiler Report ---');
        let sorted = Array.from(global.ProfilerStats.entries())
            .sort((a, b) => b[1].avg - a[1].avg);

        for (const [name, stats] of sorted) {
            console.log(`[${name}] Avg: ${stats.avg.toFixed(4)} CPU | Ticks: ${stats.ticks} | Calls: ${stats.calls}`);
        }
        console.log('-----------------------');
    }
}

module.exports = Profiler;
