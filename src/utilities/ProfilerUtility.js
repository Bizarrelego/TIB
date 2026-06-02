const Logger = require('./Logger');

const ProfilerUtility = {
    enabled: false,
    metrics: new Map(),

    /**
     * Enables or disables the profiler.
     * @param {boolean} state
     */
    setEnabled: function(state) {
        this.enabled = state;
    },

    /**
     * Wraps a function to measure its execution time.
     * @param {Function} fn The function to wrap.
     * @param {string} name The name of the function for logging purposes.
     * @returns {Function} The wrapped function.
     */
    wrap: function(fn, name) {
        const profiler = this;
        return function(...args) {
            if (!profiler.enabled) {
                return fn.apply(this, args);
            }

            const start = Game.cpu.getUsed();
            const result = fn.apply(this, args);
            const end = Game.cpu.getUsed();
            const used = end - start;

            if (!profiler.metrics.has(name)) {
                profiler.metrics.set(name, { calls: 0, totalCpu: 0 });
            }

            const data = profiler.metrics.get(name);
            data.calls++;
            data.totalCpu += used;

            return result;
        };
    },

    /**
     * Reports the aggregated metrics for the current tick and resets them.
     */
    report: function() {
        if (!this.enabled || this.metrics.size === 0) {
            return;
        }

        Logger.info('--- Profiler Report ---');
        for (const [name, data] of this.metrics.entries()) {
            const avg = data.totalCpu / data.calls;
            Logger.info(`${name}: ${data.calls} calls, ${data.totalCpu.toFixed(3)} CPU total, ${avg.toFixed(3)} CPU avg`);
        }
        Logger.info('-----------------------');

        // Reset for the next tick
        this.metrics.clear();
    }
};

module.exports = ProfilerUtility;
