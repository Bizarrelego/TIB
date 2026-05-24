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
 * @property {number} cpuBudget - The maximum CPU used before execution is skipped.
 */

/**
 * @type {Map<string, ScheduledTask>}
 */
const tasks = new Map();

/**
 * Registers a manager or system to be executed at a specific interval.
 * @param {string} managerId - The unique identifier for the manager/system.
 * @param {number} interval - The tick interval at which the callback should run.
 * @param {function(): void} callback - The callback function to execute.
 * @param {number} [cpuBudget=Infinity] - The CPU budget for the task.
 * @returns {void}
 */
function register(managerId, interval, callback, cpuBudget = Infinity) {
    tasks.set(managerId, { interval, callback, cpuBudget });
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
            const currentCpu = typeof Game !== 'undefined' && Game.cpu && typeof Game.cpu.getUsed === 'function' ? Game.cpu.getUsed() : 0;
            if (currentCpu <= task.cpuBudget) {
                task.callback();
            }
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
