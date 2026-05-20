/**
 * @file ManagerErrorBoundary.js
 * @description Provides a wrapper to apply global error boundaries to manager execution loops.
 */

const errorHandler = require('./errorHandler');

/**
 * Wraps a manager's execution function to ensure failures do not halt the entire tick.
 * @param {Function} managerFunction - The main execution function of the manager.
 * @param {string} managerName - The name of the manager for logging purposes.
 * @returns {Function} A wrapped function with an error boundary.
 */
function wrapManager(managerFunction, managerName) {
    return function (...args) {
        try {
            return managerFunction(...args);
        } catch (e) {
            errorHandler.logError(e, managerName);
            return undefined;
        }
    };
}

module.exports = { wrapManager };
