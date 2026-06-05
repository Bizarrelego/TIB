class RoomMemoryUtility {
    /**
     * Retrieves the memory for a given room.
     * @param {string} roomName The name of the room.
     * @returns {Object} The room's memory object.
     */
    static getRoomMemory(roomName) {
        if (!Memory.rooms || typeof Memory.rooms !== 'object' || Array.isArray(Memory.rooms)) {
            Memory.rooms = {};
        }

        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {};
        }

        return Memory.rooms[roomName];
    }

    /**
     * Sets the memory for a given room.
     * @param {string} roomName The name of the room.
     * @param {Object} data The data to store in the room's memory.
     */
    static setRoomMemory(roomName, data) {
        if (!Memory.rooms || typeof Memory.rooms !== 'object' || Array.isArray(Memory.rooms)) {
            Memory.rooms = {};
        }

        Memory.rooms[roomName] = data;
    }
}

module.exports = RoomMemoryUtility;
