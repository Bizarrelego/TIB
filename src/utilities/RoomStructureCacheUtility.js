/* global STRUCTURE_INVADER_CORE */
/**
 * Utility for providing O(1) cached access to structures within a room.
 * This relies on the central state populated by GlobalStateScanner.
 * It adheres to the Zero Ghost Features directive and does not use native polling.
 * @module RoomStructureCacheUtility
 */
class RoomStructureCacheUtility {
    /**
     * Gets all structures of a specific type in a room using O(1) lookups from the global state.
     * Maps the structureType dynamically to the corresponding array or property in the state.
     * @param {string} roomName - The name of the room.
     * @param {StructureConstant} structureType - The type of structure to retrieve.
     * @returns {Structure[]} An array of structures matching the type, or an empty array.
     */
    static getStructuresByType(roomName, structureType) {
        if (!global.State || !global.State.rooms || !global.State.rooms.has(roomName)) {
            return [];
        }

        const state = global.State.rooms.get(roomName);

        // Specific singular structures
        if (structureType === STRUCTURE_CONTROLLER) return state.controller ? [state.controller] : [];

        // For array-based structure types, we can use the structureType + 's' naming convention
        // as implemented in GlobalStateScanner.js, e.g. STRUCTURE_SPAWN ('spawn') -> 'spawns'
        const arrayKey = structureType + 's';
        if (state[arrayKey] && Array.isArray(state[arrayKey])) {
            return state[arrayKey];
        }

        // Handle specific edge cases in GlobalStateScanner naming convention
        if (structureType === STRUCTURE_INVADER_CORE) return state.invaderCores || [];

        return [];
    }

    /**
     * Retrieves the controller for the specified room.
     * @param {string} roomName - The name of the room.
     * @returns {StructureController|null} The controller, or null if not found.
     */
    static getController(roomName) {
        if (!global.State || !global.State.rooms || !global.State.rooms.has(roomName)) {
            return null;
        }
        return global.State.rooms.get(roomName).controller || null;
    }

    /**
     * Retrieves all spawns for the specified room.
     * @param {string} roomName - The name of the room.
     * @returns {StructureSpawn[]} An array of spawns.
     */
    static getSpawns(roomName) {
        if (!global.State || !global.State.rooms || !global.State.rooms.has(roomName)) {
            return [];
        }
        return global.State.rooms.get(roomName).spawns || [];
    }

    /**
     * Retrieves all extensions for the specified room.
     * @param {string} roomName - The name of the room.
     * @returns {StructureExtension[]} An array of extensions.
     */
    static getExtensions(roomName) {
        if (!global.State || !global.State.rooms || !global.State.rooms.has(roomName)) {
            return [];
        }
        return global.State.rooms.get(roomName).extensions || [];
    }
}

module.exports = RoomStructureCacheUtility;