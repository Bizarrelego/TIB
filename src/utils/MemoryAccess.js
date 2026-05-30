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
        Memory.rooms = new Object();
    }
    if (!Memory.creeps) {
        Memory.creeps = new Object();
    }
}

/**
 * Initializes and returns memory for a specific room.
 * @param {string} roomName
 * @returns {Object}
 */
function initializeRoomMemory(roomName) {
    ensureBaseMemory();
    if (!Memory.rooms[roomName]) {
        Memory.rooms[roomName] = new Object();
    }
    return Memory.rooms[roomName];
}

/**
 * Initializes and returns memory for a specific creep.
 * @param {string} creepName
 * @returns {Object}
 */
function initializeCreepMemory(creepName) {
    ensureBaseMemory();
    if (!Memory.creeps[creepName]) {
        Memory.creeps[creepName] = new Object();
    }
    return Memory.creeps[creepName];
}

/**
 * Gets memory for a specific room, initializing it if necessary.
 * @param {string} roomName
 * @returns {Object}
 */
function getRoomMemory(roomName) {
    return initializeRoomMemory(roomName);
}

/**
 * Gets memory for a specific creep, initializing it if necessary.
 * @param {string} creepName
 * @returns {Object}
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
