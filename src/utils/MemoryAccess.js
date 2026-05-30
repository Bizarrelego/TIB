/**
 * Ensures the base Memory objects exist.
 */
function ensureBaseMemory() {
    if (!Memory.rooms) {
        Memory.rooms = {};
    }
    if (!Memory.creeps) {
        Memory.creeps = {};
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
        Memory.rooms[roomName] = {};
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
        Memory.creeps[creepName] = {};
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
