/**
 * @file ManagerErrorBoundary.js
 * @description Provides a wrapper to apply global error boundaries to manager execution loops.
 */

const errorHandler = require('./errorHandler');

/**
 * Wraps a manager's execution function to ensure failures do not halt the entire tick.
 * @param {Function} managerFunction - The main execution function of the manager.
 * @param {string} managerName - The name of the manager for logging purposes.
 * @param {Function} [errorCallback] - Optional callback to handle errors.
 * @returns {Function} A wrapped function with an error boundary.
 */
function wrapManager(managerFunction, managerName, errorCallback) {
    return function (...args) {
        try {
            return managerFunction(...args);
        } catch (e) {
            if (errorCallback && typeof errorCallback === 'function') {
                errorCallback(e, managerName);
            } else {
                errorHandler.logError(e, managerName);
            }
            return undefined;
        }
    };
}

module.exports = { wrapManager };
