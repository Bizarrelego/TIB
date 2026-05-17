/**
 * @file moduleWrapper.js
 * @description A generic utility module to wrap all exported functions of a given
 * manager or utility module with an error boundary.
 */

/**
 * Wraps all functions of a given module object in a try/catch block using the
 * provided error handler function. Supports plain objects and class objects with static methods.
 *
 * @param {Object} moduleObject - The module or class to wrap.
 * @param {Function} errorHandlerFunction - The wrapper function, e.g. executeManager.
 * @returns {Object} The wrapped module object.
 */
function wrapModuleFunctions(moduleObject, errorHandlerFunction) {
    if (typeof moduleObject === 'function') {
        // It's a class with static methods
        const props = Object.getOwnPropertyNames(moduleObject);
        for (const prop of props) {
            if (prop !== 'length' && prop !== 'name' && prop !== 'prototype' && typeof moduleObject[prop] === 'function') {
                const originalFunc = moduleObject[prop];
                moduleObject[prop] = function (...args) {
                    return errorHandlerFunction(prop, originalFunc.bind(moduleObject), ...args);
                };
            }
        }
        return moduleObject;
    } else if (typeof moduleObject === 'object' && moduleObject !== null) {
        // It's a plain object
        const props = Object.getOwnPropertyNames(moduleObject);
        for (const prop of props) {
            if (typeof moduleObject[prop] === 'function') {
                const originalFunc = moduleObject[prop];
                moduleObject[prop] = function (...args) {
                    return errorHandlerFunction(prop, originalFunc.bind(moduleObject), ...args);
                };
            }
        }
        return moduleObject;
    }

    return moduleObject;
}

module.exports = { wrapModuleFunctions };
