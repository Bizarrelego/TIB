/**
 * @file errorBoundary.js
 * @description Provides a global error boundary utility to wrap manager executions
 * in isolated try/catch blocks. This prevents a single manager's error from halting
 * the entire tick loop and ensures robust execution.
 */

/**
 * Executes a given function within a try/catch block to prevent global halting.
 *
 * @param {string} managerName - The name of the manager or context being executed.
 * @param {Function} fn - The function containing the manager's logic to execute.
 * @param {...*} args - Arguments to pass to the executed function.
 * @returns {*} The result of the function execution, or null if an error occurs.
 */
function executeManager(managerName, fn, ...args) {
    try {
        return fn(...args);
    } catch (e) {
        console.log(`[ErrorBoundary] Error in ${managerName}: ${e.stack}`);
        return null;
    }
}

module.exports = {
    executeManager
};
