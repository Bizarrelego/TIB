const Logger = require('./logger');

/**
 * @file errorHandler.js
 * @description Provides a global error boundary wrapper for manager execution.
 * Prevents a single manager's error from halting the entire tick loop,
 * improving overall bot resilience.
 */

/**
 * Wraps the execution of a module's or manager's function in a try/catch block.
 * @param {string} moduleName - The name of the module/manager or function for logging purposes.
 * @param {Function} fn - The function to execute.
 * @param {...any} args - The arguments to pass to the function.
 * @returns {any} The result of the function execution, or undefined if an error occurred.
 */
function logError(e, moduleName) {
    Logger.error(`[Execution Error] ${moduleName}: ${e.stack}`);
}

function executeManager(moduleName, fn, ...args) {
    try {
        return fn(...args);
    } catch (e) {
        logError(e, moduleName);
        return undefined;
    }
}

function wrap(moduleName, fn) {
    return function(...args) {
        return executeManager(moduleName, fn, ...args);
    };
}

module.exports = { executeManager, wrap, logError };
