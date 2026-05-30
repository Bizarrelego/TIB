/**
 * MemoryAccess.js
 *
 * WARNING: Per Heap Exclusivity constraints, this utility should ONLY be used
 * for initialization, persistence of static strings (e.g., role, colony), or
 * low-frequency state saving.
 * DO NOT use these functions for operational data or high-frequency access
 * inside creep tick loops. Use `creep.heap` or `global.State` instead to prevent
 * CPU overhead from continuous Memory parsing.
 */

/**
 * Ensures the base Memory objects exist.
 */
function ensureBaseMemory() {
    if (!Memory.rooms) {
        Memory.rooms = new Map();
    }
    if (!Memory.creeps) {
        Memory.creeps = new Map();
    }
}

/**
 * Initializes and returns memory for a specific room.
 * @param {string} roomName
 * @returns {Map}
 */
function initializeRoomMemory(roomName) {
    ensureBaseMemory();
    if (!Memory.rooms.has(roomName)) {
        Memory.rooms.set(roomName, new Map());
    }
    return Memory.rooms.get(roomName);
}

/**
 * Initializes and returns memory for a specific creep.
 * @param {string} creepName
 * @returns {Map}
 */
function initializeCreepMemory(creepName) {
    ensureBaseMemory();
    if (!Memory.creeps.has(creepName)) {
        Memory.creeps.set(creepName, new Map());
    }
    return Memory.creeps.get(creepName);
}

/**
 * Gets memory for a specific room, initializing it if necessary.
 * @param {string} roomName
 * @returns {Map}
 */
function getRoomMemory(roomName) {
    return initializeRoomMemory(roomName);
}

/**
 * Gets memory for a specific creep, initializing it if necessary.
 * @param {string} creepName
 * @returns {Map}
 */
function getCreepMemory(creepName) {
    return initializeCreepMemory(creepName);
}

module.exports = {
    initializeRoomMemory,
    initializeCreepMemory,
    getRoomMemory,
    getCreepMemory
};
