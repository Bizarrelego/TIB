/**
 * @file ManagerExecutionWrapper.js
 * @description Provides a standardized utility to wrap manager execution loops with global error boundaries
 * and CPU profiling, ensuring failures do not halt the tick and performance is tracked.
 */

const { wrapManager } = require('./ManagerErrorBoundary');
const SystemScheduler = require('../os/SystemScheduler');
const Profiler = require('./profiler');

/**
 * Wraps a manager's execution function with an error boundary and CPU profiler.
 *
 * @param {string} managerName - The name of the manager, used for logging and profiling metrics.
 * @param {Function} managerFunction - The execution loop function to wrap.
 * @param {Function} [errorCallback] - Optional callback to handle errors.
 * @returns {Function} The wrapped function.
 */
function wrap(managerName, managerFunction, errorCallback) {
    // Apply error boundary
    const errorWrappedFunction = wrapManager(managerFunction, managerName, errorCallback);

    return function (...args) {
        const profilerEnabled = global.PROFILER_ENABLED || (typeof Memory !== 'undefined' && Memory.PROFILER_ENABLED);

        const cpuAvailable = typeof Game !== 'undefined' && Game.cpu && typeof Game.cpu.getUsed === 'function';
        const start = (profilerEnabled && cpuAvailable) ? Game.cpu.getUsed() : (profilerEnabled ? Date.now() : 0);

        const result = errorWrappedFunction.apply(this, args);

        if (profilerEnabled) {
            const end = cpuAvailable ? Game.cpu.getUsed() : Date.now();
            Profiler.record(managerName, end - start);
        }

        return result;
    };
}

/**
 * Registers a manager with the SystemScheduler, applying error boundaries and profiling.
 *
 * @param {Object} config - The configuration for the manager registration.
 * @param {string} config.name - The name of the manager.
 * @param {Function} config.run - The main execution function of the manager.
 * @param {number} config.interval - The tick interval at which to run the manager.
 * @param {number} [config.cpuBudget=Infinity] - The CPU budget for the manager.
 * @param {Function} [config.errorCallback] - Optional error callback.
 */
function registerManager(config) {
    const { name, run, interval, cpuBudget = Infinity, errorCallback } = config;
    const wrappedRun = wrap(name, run, errorCallback);
    SystemScheduler.register(name, interval, wrappedRun, cpuBudget);
}

module.exports = { wrap, registerManager };
