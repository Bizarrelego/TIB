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
 * @returns {Object}
 */
function initializeRoomMemory(roomName) {
    ensureBaseMemory();
    if (!Memory.rooms.has(roomName)) {
        Memory.rooms.set(roomName, {});
    }
    return Memory.rooms.get(roomName);
}

/**
 * Initializes and returns memory for a specific creep.
 * @param {string} creepName
 * @returns {Object}
 */
function initializeCreepMemory(creepName) {
    ensureBaseMemory();
    if (!Memory.creeps.has(creepName)) {
        Memory.creeps.set(creepName, {});
    }
    return Memory.creeps.get(creepName);
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
