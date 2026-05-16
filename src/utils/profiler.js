/**
 * @file profiler.js
 * @description Custom sub-millisecond profiler to track 1000-tick averages for all core managers.
 * Implements logic to track CPU usage per tick, avoiding duplicate ticks and properly handling gaps.
 */

/**
 * @typedef {Object} ProfilerMetrics
 * @property {Float64Array} history - Circular buffer of CPU usage per tick, length 1000.
 * @property {number} lastTick - The last Game.time when this metric was updated.
 * @property {number} currentTickCpu - The CPU usage accumulated in the current tick.
 */

class Profiler {
    /**
     * Global storage for all tracked metrics.
     * @type {Map<string, ProfilerMetrics>}
     */
    static get metrics() { if (!this._metrics) this._metrics = new Map(); return this._metrics; }

    /**
     * Wraps a function or class to measure execution time.
     * If the target is an ES6 class with static methods or an object, it iterates
     * through `Object.getOwnPropertyNames()` to wrap each method individually.
     *
     * @param {string} name - The base name for the metric.
     * @param {Function|Object} target - The function, class, or object to wrap.
     * @returns {Function|Object} The wrapped target, ready for module.exports.
     */
    static wrap(name, target) {
        if (typeof target === 'function') {
            const props = Object.getOwnPropertyNames(target);
            let hasCustomStatic = false;
            for (const prop of props) {
                if (prop !== 'length' && prop !== 'name' && prop !== 'prototype' && typeof target[prop] === 'function') {
                    target[prop] = this._wrapFunction(`${name}.${prop}`, target[prop]);
                    hasCustomStatic = true;
                }
            }
            if (hasCustomStatic) {
                return target;
            }
            return this._wrapFunction(name, target);
        } else if (typeof target === 'object' && target !== null) {
            const props = Object.getOwnPropertyNames(target);
            for (const prop of props) {
                if (typeof target[prop] === 'function') {
                    target[prop] = this._wrapFunction(`${name}.${prop}`, target[prop]);
                }
            }
            return target;
        }
        return target;
    }

    /**
     * Internal function to wrap a single function with CPU measurement.
     *
     * @param {string} name - The specific name of the function metric.
     * @param {Function} func - The function to execute and measure.
     * @returns {Function} The wrapped function.
     */
    static _wrapFunction(name, func) {
        return function (...args) {
            const cpuAvailable = typeof Game !== 'undefined' && Game.cpu && typeof Game.cpu.getUsed === 'function';
            const start = cpuAvailable ? Game.cpu.getUsed() : Date.now();

            const result = func.apply(this, args);

            const end = cpuAvailable ? Game.cpu.getUsed() : Date.now();
            Profiler.record(name, end - start);

            return result;
        };
    }

    /**
     * Synchronizes a metric's history with the current Game.time, effectively
     * rolling the circular buffer and handling skipped ticks.
     *
     * @param {ProfilerMetrics} metric - The metric object to synchronize.
     */
    static _syncMetric(metric) {
        const currentTime = typeof Game !== 'undefined' && Game.time ? Game.time : 0;
        if (metric.lastTick !== currentTime) {
            metric.history[metric.lastTick % 1000] = metric.currentTickCpu;
            const ticksMissed = currentTime - metric.lastTick;
            if (ticksMissed > 0) {
                const clearCount = Math.min(ticksMissed - 1, 1000);
                for (let i = 1; i <= clearCount; i++) {
                    metric.history[(metric.lastTick + i) % 1000] = 0;
                }
            }
            metric.currentTickCpu = 0;
            metric.lastTick = currentTime;
        }
    }

    /**
     * Records CPU usage for a given metric name. Creates the metric if it
     * doesn't exist, and adds to the current tick's accumulated CPU.
     *
     * @param {string} name - Name of the tracked metric.
     * @param {number} cpuUsed - Amount of CPU utilized.
     */
    static record(name, cpuUsed) {
        if (!this.metrics) this.metrics = new Map();
        let metric = this.metrics.get(name);
        if (!metric) {
            metric = {
                history: new Float64Array(1000),
                lastTick: typeof Game !== 'undefined' && Game.time ? Game.time : 0,
                currentTickCpu: 0
            };
            this.metrics.set(name, metric);
        }

        this._syncMetric(metric);
        metric.currentTickCpu += cpuUsed;
    }

    /**
     * Calculates the 1000-tick average CPU usage for a given metric name.
     * Tracks 'ticks' instead of 'calls' to properly dilute metrics across ticks.
     *
     * @param {string} name - The metric name to average.
     * @returns {number} The 1000-tick average CPU usage. Returns 0 if not found.
     */
    static getAverage(name) {
        const metric = this.metrics.get(name);
        if (!metric) return 0;

        this._syncMetric(metric);

        const currentTime = typeof Game !== 'undefined' && Game.time ? Game.time : 0;
        let sum = metric.currentTickCpu;
        const currentIndex = currentTime % 1000;

        for (let i = 0; i < 1000; i++) {
            if (i !== currentIndex) {
                sum += metric.history[i];
            }
        }
        return sum / 1000;
    }

    /**
     * Logs performance bottlenecks if average CPU usage exceeds a certain threshold.
     * Output is gated behind a high CPU bucket condition to prevent lag spikes.
     *
     * @param {number} [threshold=5] - Minimum average CPU required to log the metric.
     */
    static logBottlenecks(threshold = 5) {
        if (typeof Game === 'undefined' || !Game.cpu || Game.cpu.bucket == null) return;
        if (Game.cpu.bucket < 9000) return;

        if (!this.metrics) return;

        const bottlenecks = [];
        for (const name of this.metrics.keys()) {
            const avg = this.getAverage(name);
            if (avg > threshold) {
                bottlenecks.push({ name, avg });
            }
        }

        if (bottlenecks.length > 0) {
            bottlenecks.sort((a, b) => b.avg - a.avg);
            console.log(`[Profiler] Bottlenecks Detected (> ${threshold} avg CPU):`);
            for (const { name, avg } of bottlenecks) {
                console.log(`  - ${name}: ${avg.toFixed(3)} CPU / tick`);
            }
        }
    }

    /**
     * Alias for logBottlenecks to match main.js invocation.
     * Also displays the 1000-tick average CPU usage for all orchestrated managers.
     */
    static report() {
        this.logBottlenecks();

        if (this.metrics) {
            console.log(`[Profiler] 1000-tick Averages:`);
            for (const name of this.metrics.keys()) {
                const avg = this.getAverage(name);
                console.log(`  - ${name}: ${avg.toFixed(3)} CPU / tick`);
            }
        }
    }
}

module.exports = Profiler;
