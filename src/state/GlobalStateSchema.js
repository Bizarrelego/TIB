/**
 * @file GlobalStateSchema.js
 * @description Defines the schema for global.State and provides validation and safe access utilities.
 */

const Logger = require('../utils/logger');

/**
 * @typedef {Object} GlobalStateSchema
 * @property {Map<string, any>} heapCache
 * @property {boolean} isRehydrated
 * @property {Map<string, any>} managers
 * @property {Map<string, Array<Creep>>} creepsByRole
 * @property {Map<string, Map<string, Array<Creep>>>} creepsByRoom
 * @property {Map<string, Map<string, Map<string, Structure>>>} structuresByRoom
 * @property {Map<string, Map<string, Creep>>} hostilesByRoom
 * @property {Map<string, Map<string, any>>} logisticsByRoom
 * @property {Map<string, Creep>} creepLookup
 * @property {Map<string, Map<string, Source>>} sourcesByRoom
 * @property {Map<string, Map<string, StructureSpawn>>} spawnsByRoom
 * @property {Map<string, StructureController>} controllersByRoom
 * @property {Map<string, Map<string, ConstructionSite>>} sitesByRoom
 * @property {Map<string, Map<string, Mineral>>} mineralsByRoom
 * @property {Map<string, Room>} rooms
 * @property {Map<string, Creep>} creeps
 * @property {Map<string, Structure>} structures
 * @property {string} aggressionState
 * @property {Map<string, any>} sourceAssignments
 * @property {Map<string, any>} miningSpotsByRoom
 * @property {Map<string, Creep>} creepsById
 * @property {Map<string, Map<string, Structure>>} structuresByType
 * @property {Map<string, Flag>} flags
 * @property {Map<string, Map<string, Flag>>} flagsByRoom
 * @property {Map<string, Resource>} resources
 * @property {Map<string, ConstructionSite>} constructionSites
 * @property {Map<string, Map<string, ConstructionSite>>} constructionSitesByType
 * @property {Map<string, StructureSpawn>} spawns
 * @property {Map<string, Map<string, RoomPosition>>} stationaryPositions
 * @property {Map<string, number>} roomHashes
 */

class GlobalStateSchemaValidator {
    /**
     * Validates if the given state conforms to the expected global state structure.
     * @param {Object} state - The state object to validate.
     * @returns {boolean} True if valid, false otherwise.
     */
    static validateState(state) {
        if (!state) {
            Logger.error('[GlobalStateSchema] State is null or undefined.');
            return false;
        }

        const requiredMaps = [
            'heapCache', 'managers', 'creepsByRole', 'creepsByRoom',
            'structuresByRoom', 'hostilesByRoom', 'logisticsByRoom',
            'creepLookup', 'sourcesByRoom', 'spawnsByRoom', 'controllersByRoom',
            'sitesByRoom', 'mineralsByRoom', 'rooms', 'creeps', 'structures',
            'sourceAssignments', 'miningSpotsByRoom', 'creepsById', 'structuresByType',
            'flags', 'flagsByRoom', 'resources', 'constructionSites',
            'constructionSitesByType', 'spawns', 'stationaryPositions', 'roomHashes'
        ];

        let isValid = true;

        for (const key of requiredMaps) {
            if (!(state[key] instanceof Map)) {
                Logger.error(`[GlobalStateSchema] Invalid or missing property: ${key}. Expected Map.`);
                isValid = false;
            }
        }

        if (typeof state.isRehydrated !== 'boolean') {
            Logger.error('[GlobalStateSchema] Invalid property: isRehydrated. Expected boolean.');
            isValid = false;
        }

        if (typeof state.aggressionState !== 'string') {
            Logger.error('[GlobalStateSchema] Invalid property: aggressionState. Expected string.');
            isValid = false;
        }

        return isValid;
    }

    /**
     * Safely gets a property from the state based on a path.
     * Supports dot notation and array of keys, navigating through Objects and Maps.
     * @param {Object} state - The global state object.
     * @param {string|Array<string>} path - The path to the property (e.g., 'creepsByRoom.W1N1.harvester').
     * @returns {*} The value at the path, or undefined if not found.
     */
    static getStateProperty(state, path) {
        if (!state || !path) return undefined;
        const keys = Array.isArray(path) ? path : path.split('.');
        let current = state;

        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            if (current instanceof Map) {
                current = current.get(key);
            } else {
                current = current[key];
            }
        }
        return current;
    }

    /**
     * Safely sets a property in the state based on a path.
     * Supports dot notation and array of keys, navigating through Objects and Maps.
     * Creates intermediate Maps if they don't exist.
     * @param {Object} state - The global state object.
     * @param {string|Array<string>} path - The path to the property.
     * @param {*} value - The value to set.
     * @returns {boolean} True if successfully set, false otherwise.
     */
    static setStateProperty(state, path, value) {
        if (!state || !path) return false;
        const keys = Array.isArray(path) ? path : path.split('.');
        if (keys.length === 0) return false;

        let current = state;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            let next;

            if (current instanceof Map) {
                next = current.get(key);
                if (next === undefined || next === null) {
                    next = new Map();
                    current.set(key, next);
                }
            } else {
                next = current[key];
                if (next === undefined || next === null) {
                    next = new Map();
                    current[key] = next;
                }
            }
            current = next;
        }

        const lastKey = keys[keys.length - 1];
        if (current instanceof Map) {
            current.set(lastKey, value);
        } else {
            current[lastKey] = value;
        }

        return true;
    }
}

module.exports = GlobalStateSchemaValidator;
