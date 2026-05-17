/**
 * Utility functions for managing memory and objects safely,
 * focusing on V8 optimizations.
 * @module MemoryUtils
 */

const MemoryUtils = {
    /**
     * Deep clones an object safely, preferring structuredClone when available.
     * @param {*} obj - The object to deep clone.
     * @returns {*} A deep copy of the object.
     */
    deepClone: function(obj) {
        if (obj === undefined) return undefined;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(obj);
            } catch (e) {
                // Fallback if structuredClone fails (e.g. on functions or non-cloneable objects)
                return JSON.parse(JSON.stringify(obj));
            }
        }
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Safely retrieves a value from a nested object using a path.
     * @param {Object} obj - The object to traverse.
     * @param {string|Array<string>} path - The dot-separated path string or array of keys.
     * @param {*} [defaultValue=undefined] - The value to return if the path does not exist.
     * @returns {*} The value at the specified path, or the defaultValue.
     */
    safeGet: function(obj, path, defaultValue = undefined) {
        if (!obj || !path) return defaultValue;

        let keys;
        if (Array.isArray(path)) {
            keys = path;
        } else if (typeof path === 'string') {
            keys = path.split('.');
        } else {
            return defaultValue;
        }

        let current = obj;
        for (let i = 0; i < keys.length; i++) {
            if (current === null || current === undefined) {
                return defaultValue;
            }
            current = current[keys[i]];
        }

        return current === undefined ? defaultValue : current;
    },

    /**
     * Safely deletes a property at a nested path within an object.
     * @param {Object} obj - The object to modify.
     * @param {string|Array<string>} path - The dot-separated path string or array of keys.
     * @returns {boolean} True if the deletion was successful, false otherwise.
     */
    deletePath: function(obj, path) {
        if (!obj || !path) return false;

        let keys;
        if (Array.isArray(path)) {
            keys = path;
        } else if (typeof path === 'string') {
            keys = path.split('.');
        } else {
            return false;
        }

        if (keys.length === 0) return false;

        let current = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (current === null || current === undefined) {
                return false;
            }
            current = current[keys[i]];
        }

        if (current && typeof current === 'object') {
            const finalKey = keys[keys.length - 1];
            if (finalKey in current) {
                delete current[finalKey];
                return true;
            }
        }
        return false;
    }
};

module.exports = MemoryUtils;
