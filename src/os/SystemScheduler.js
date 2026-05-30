/**
 * Module responsible for managing the execution frequency of non-critical managers and systems.
 * It allows managers to register themselves with a desired execution interval, ensuring they
 * are only called when their scheduled tick arrives. This handles aggressive tick slicing.
 * @module os/SystemScheduler
 */

/**
 * @typedef {Object} ScheduledTask
 * @property {number} interval - The tick interval at which the callback should run.
 * @property {function(): void} callback - The function to execute.
 */

/**
 * @type {Map<string, ScheduledTask>}
 */
const tasks = new Map();

const SystemConfig = require('../constants/SystemConfig');

/**
 * Registers a manager or system to be executed at a specific interval.
 * @param {string} managerId - The unique identifier for the manager/system.
 * @param {number|function(): void} interval - The tick interval at which the callback should run, or the callback function if interval is omitted.
 * @param {function(): void} [callback] - The callback function to execute. Optional if passed as the second argument.
 * @returns {void}
 */
function register(managerId, interval, callback) {
    let actualInterval;
    let actualCallback;

    if (typeof interval === 'function') {
        actualCallback = interval;
        actualInterval = SystemConfig.has(managerId) ? SystemConfig.get(managerId).defaultFrequency : 1;
    } else {
        actualCallback = callback;
        actualInterval = interval;
    }

    if (!actualCallback) {
        throw new Error(`[SystemScheduler] Cannot register ${managerId} without a callback.`);
    }

    tasks.set(managerId, { interval: actualInterval, callback: actualCallback });
}

const cpuThrottler = require('./cpuThrottler');
const AusterityManager = require('./AusterityManager');

/**
 * Runs the scheduled tasks if their interval matches the current game time.
 * Iterates through registered managers and executes their callbacks only if Game.time % interval === 0.
 * @returns {void}
 */
function run() {
    const throttlerFlags = cpuThrottler.throttle();
    if (throttlerFlags && throttlerFlags.skipManagers) return;

    for (const task of tasks.values()) {
        let activeInterval = task.interval;
        if (AusterityManager.isActive()) {
            activeInterval *= 2; // Double the interval to save CPU during austerity
        }

        if (Game.time % activeInterval === 0) {
            task.callback();
        }
    }
}

/**
 * Top-level managers must explicitly export specific lifecycle methods as properties of module.exports.
 */
module.exports = {
    register,
    run,
    throttle: () => cpuThrottler.throttle(),
    // Expose tasks for testing purposes
    tasks
};
