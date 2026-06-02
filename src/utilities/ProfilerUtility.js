const Logger = require('./Logger');

const ProfilerUtility = {
    enabled: false,
    metrics: {},

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

            if (!profiler.metrics[name]) {
                profiler.metrics[name] = { calls: 0, totalCpu: 0 };
            }

            profiler.metrics[name].calls++;
            profiler.metrics[name].totalCpu += used;

            return result;
        };
    },

    /**
     * Reports the aggregated metrics for the current tick and resets them.
     */
    report: function() {
        if (!this.enabled || Object.keys(this.metrics).length === 0) {
            return;
        }

        Logger.info('--- Profiler Report ---');
        for (const name in this.metrics) {
            const data = this.metrics[name];
            const avg = data.totalCpu / data.calls;
            Logger.info(`${name}: ${data.calls} calls, ${data.totalCpu.toFixed(3)} CPU total, ${avg.toFixed(3)} CPU avg`);
        }
        Logger.info('-----------------------');

        // Reset for the next tick
        this.metrics = {};
    }
};

module.exports = ProfilerUtility;
