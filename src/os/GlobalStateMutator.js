/**
 * @file GlobalStateMutator.js
 * @description Provides safely validated mutation methods for global.State, ensuring adherence to GlobalStateSchema.
 */

const GlobalStateSchema = require('../state/GlobalStateSchema');
const GlobalStateSchemaValidator = require('../state/GlobalStateSchemaValidator');
const Logger = require('../utils/logger');

class GlobalStateMutator {
    /**
     * Helper method to delete a property based on a path.
     * @param {Object} state - The global state object.
     * @param {string|Array<string>} path - The path to the property.
     * @returns {boolean} True if successfully deleted, false otherwise.
     * @private
     */
    static _deleteStateProperty(state, path) {
        if (!state || !path) return false;
        const keys = Array.isArray(path) ? path : path.split('.');
        if (keys.length === 0) return false;

        let current = state;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current instanceof Map) {
                current = current.get(key);
            } else {
                current = current[key];
            }
            if (current === undefined || current === null) return false;
        }

        const lastKey = keys[keys.length - 1];
        if (current instanceof Map) {
            return current.delete(lastKey);
        } else {
            if (lastKey in current) {
                delete current[lastKey];
                return true;
            }
            return false;
        }
    }

    /**
     * Validates state and rolls back if validation fails.
     * @param {string|Array<string>} path - The path being modified.
     * @param {*} originalValue - The value to revert to if validation fails.
     * @param {boolean} wasDeleted - Whether the original operation was a deletion.
     * @param {boolean} wasOriginallyUndefined - Whether the original value was absent before setting.
     * @returns {boolean} True if state is valid, false if invalid and rolled back.
     * @private
     */
    static _validateAndRollback(path, originalValue, wasDeleted, wasOriginallyUndefined) {
        if (!global.State) {
            Logger.error('[GlobalStateMutator] global.State is undefined.');
            return false;
        }

        if (GlobalStateSchemaValidator.validateGlobalState(global.State)) {
            return true;
        }

        Logger.error(`[GlobalStateMutator] State validation failed after modifying path: ${path}. Rolling back.`);

        // Rollback
        if (wasOriginallyUndefined) {
            this._deleteStateProperty(global.State, path);
        } else if (wasDeleted || originalValue !== undefined) {
            GlobalStateSchema.setStateProperty(global.State, path, originalValue);
        } else {
            this._deleteStateProperty(global.State, path);
        }

        return false;
    }

    /**
     * Checks if a property currently exists at the path.
     * @param {Object} state - The global state object.
     * @param {string|Array<string>} path - The path to the property.
     * @returns {boolean} True if it exists.
     * @private
     */
    static _hasStateProperty(state, path) {
        if (!state || !path) return false;
        const keys = Array.isArray(path) ? path : path.split('.');
        if (keys.length === 0) return false;

        let current = state;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (current instanceof Map) {
                current = current.get(key);
            } else {
                current = current[key];
            }
            if (current === undefined || current === null) return false;
        }

        const lastKey = keys[keys.length - 1];
        if (current instanceof Map) {
            return current.has(lastKey);
        } else {
            return lastKey in current;
        }
    }

    /**
     * Safely sets a value in the global state, ensuring schema validity.
     * @param {string|Array<string>} path - The path to the property (e.g., 'aggressionState' or 'creepsByRoom.W1N1').
     * @param {*} value - The value to set.
     * @returns {boolean} True if the modification was successful and valid, false otherwise.
     */
    static setState(path, value) {
        if (!global.State) return false;

        const originalValue = GlobalStateSchema.getStateProperty(global.State, path);
        const wasOriginallyUndefined = !this._hasStateProperty(global.State, path);

        const setSuccess = GlobalStateSchema.setStateProperty(global.State, path, value);
        if (!setSuccess) return false;

        return this._validateAndRollback(path, originalValue, false, wasOriginallyUndefined);
    }

    /**
     * Safely updates a value in the global state using an updater function.
     * @param {string|Array<string>} path - The path to the property.
     * @param {function(*): *} updaterFunction - Function that receives current value and returns new value.
     * @returns {boolean} True if the modification was successful and valid, false otherwise.
     */
    static updateState(path, updaterFunction) {
        if (!global.State) return false;
        if (typeof updaterFunction !== 'function') {
            Logger.error('[GlobalStateMutator] updaterFunction must be a function.');
            return false;
        }

        const originalValue = GlobalStateSchema.getStateProperty(global.State, path);
        const wasOriginallyUndefined = !this._hasStateProperty(global.State, path);

        try {
            const newValue = updaterFunction(originalValue);
            const setSuccess = GlobalStateSchema.setStateProperty(global.State, path, newValue);
            if (!setSuccess) return false;

            return this._validateAndRollback(path, originalValue, false, wasOriginallyUndefined);
        } catch (e) {
            Logger.error(`[GlobalStateMutator] Error in updaterFunction for path ${path}: ${e.message}`);
            return false;
        }
    }

    /**
     * Safely deletes a property from the global state.
     * @param {string|Array<string>} path - The path to the property to delete.
     * @returns {boolean} True if deletion was successful and valid, false otherwise.
     */
    static deleteState(path) {
        if (!global.State) return false;

        if (!this._hasStateProperty(global.State, path)) {
            return true; // Already doesn't exist
        }

        const originalValue = GlobalStateSchema.getStateProperty(global.State, path);

        const deleteSuccess = this._deleteStateProperty(global.State, path);
        if (!deleteSuccess) return false;

        return this._validateAndRollback(path, originalValue, true, false);
    }
}

module.exports = GlobalStateMutator;
