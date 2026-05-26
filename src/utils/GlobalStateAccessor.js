/**
 * @file GlobalStateAccessor.js
 * @description Provides audited, O(1) access to game objects. This utility ensures that managers and roles
 * do not directly use native Screeps polling functions (e.g., room.find(), room.lookAt(), or room.lookForAt())
 * in tick loops, adhering to the 'Zero Native Polling' principle.
 */

class GlobalStateAccessor {
    /**
     * Checks if global.State is available. Logs a warning if not.
     * @private
     * @returns {boolean} True if global.State exists, false otherwise.
     */
    static _checkState() {
        if (!global.State) {
            console.warn('[GlobalStateAccessor] global.State is undefined. Ensure it is initialized before access.');
            return false;
        }
        return true;
    }

    /**
     * Retrieves a creep by its name exclusively from global.State.
     * @param {string} name - The name of the creep.
     * @returns {Creep|undefined} The creep object, or undefined if not found or state is missing.
     */
    static getCreepByName(name) {
        if (!this._checkState() || !global.State.creeps) return undefined;
        return global.State.creeps.get(name);
    }

    /**
     * Retrieves a creep by its ID exclusively from global.State.
     * @param {string} id - The ID of the creep.
     * @returns {Creep|undefined} The creep object, or undefined if not found or state is missing.
     */
    static getCreepById(id) {
        if (!this._checkState() || !global.State.creepsById) return undefined;
        return global.State.creepsById.get(id);
    }

    /**
     * Retrieves a structure by its ID exclusively from global.State.
     * @param {string} id - The ID of the structure.
     * @returns {Structure|undefined} The structure object, or undefined if not found or state is missing.
     */
    static getStructureById(id) {
        if (!this._checkState() || !global.State.structures) return undefined;
        return global.State.structures.get(id);
    }

    /**
     * Retrieves a construction site by its ID exclusively from global.State.
     * @param {string} id - The ID of the construction site.
     * @returns {ConstructionSite|undefined} The construction site object, or undefined if not found or state is missing.
     */
    static getConstructionSiteById(id) {
        if (!this._checkState() || !global.State.constructionSites) return undefined;
        return global.State.constructionSites.get(id);
    }

    /**
     * Retrieves objects of a specific type in a given room exclusively from global.State.
     * Supported types: 'creeps', 'structures', 'spawns', 'sites', 'flags', 'sources'.
     *
     * @param {string} roomName - The name of the room.
     * @param {string} type - The type of objects to retrieve.
     * @returns {Map<string, any>|undefined} A Map of the objects, or undefined if not found.
     */
    static getRoomObjects(roomName, type) {
        if (!this._checkState()) return undefined;

        switch (type) {
            case 'creeps':
                return global.State.creepsByRoom ? global.State.creepsByRoom.get(roomName) : undefined;
            case 'structures':
                return global.State.structuresByRoom ? global.State.structuresByRoom.get(roomName) : undefined;
            case 'spawns':
                return global.State.spawnsByRoom ? global.State.spawnsByRoom.get(roomName) : undefined;
            case 'sites':
                return global.State.sitesByRoom ? global.State.sitesByRoom.get(roomName) : undefined;
            case 'flags':
                return global.State.flagsByRoom ? global.State.flagsByRoom.get(roomName) : undefined;
            case 'sources':
                return global.State.sourcesByRoom ? global.State.sourcesByRoom.get(roomName) : undefined;
            default:
                console.warn(`[GlobalStateAccessor] Invalid room object type requested: ${type}`);
                return undefined;
        }
    }
}

module.exports = GlobalStateAccessor;
