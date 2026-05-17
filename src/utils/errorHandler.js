const Logger = require('./logger');

/**
 * @file errorHandler.js
 * @description Provides a global error boundary wrapper for manager execution.
 * Prevents a single manager's error from halting the entire tick loop,
 * improving overall bot resilience.
 */

/**
 * Wraps the execution of a manager's function in a try/catch block.
 * @param {string} managerName - The name of the manager for logging purposes.
 * @param {Function} fn - The function to execute.
 * @param {...any} args - The arguments to pass to the function.
 * @returns {any} The result of the function execution, or undefined if an error occurred.
 */
function executeManager(managerName, fn, ...args) {
    try {
        return fn(...args);
    } catch (e) {
        Logger.error(`[ManagerOrchestrator Error] ${managerName}: ${e.stack}`);
        return undefined;
    }
}

module.exports = { executeManager };
