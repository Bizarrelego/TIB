/**
 * @file ManagerExecutionWrapper.js
 * @description Provides a standardized utility to wrap manager execution loops with global error boundaries
 * and CPU profiling, ensuring failures do not halt the tick and performance is tracked.
 */

const errorHandler = require('./errorHandler');
const Profiler = require('./profiler');

/**
 * Wraps a manager's execution function with an error boundary and CPU profiler.
 *
 * @param {string} managerName - The name of the manager, used for logging and profiling metrics.
 * @param {Function} managerFunction - The execution loop function to wrap.
 * @returns {Function} The wrapped function.
 */
function wrap(managerName, managerFunction) {
    return function (...args) {
        Profiler.beginActiveTracking(managerName);

        const profilerEnabled = global.PROFILER_ENABLED || (typeof Memory !== 'undefined' && Memory.PROFILER_ENABLED);

        const cpuAvailable = typeof Game !== 'undefined' && Game.cpu && typeof Game.cpu.getUsed === 'function';
        const start = (profilerEnabled && cpuAvailable) ? Game.cpu.getUsed() : (profilerEnabled ? Date.now() : 0);

        let result;
        try {
            result = managerFunction.apply(this, args);
        } catch (e) {
            errorHandler.logError(e, managerName);
            result = undefined;
        } finally {
            if (profilerEnabled) {
                const end = cpuAvailable ? Game.cpu.getUsed() : Date.now();
                Profiler.record(managerName, end - start);
            }

            Profiler.endActiveTracking(managerName);
        }

        return result;
    };
}

module.exports = { wrap };
