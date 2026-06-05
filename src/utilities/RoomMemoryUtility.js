class RoomMemoryUtility {
    /**
     * Retrieves the memory for a given room.
     * @param {string} roomName The name of the room.
     * @returns {Map} The room's memory Map.
     */
    static getRoomMemory(roomName) {
        if (!Memory.rooms || !(Memory.rooms instanceof Map)) {
            Memory.rooms = new Map();
        }

        if (!Memory.rooms.has(roomName)) {
            Memory.rooms.set(roomName, new Map());
        }

        return Memory.rooms.get(roomName);
    }

    /**
     * Sets the memory for a given room.
     * @param {string} roomName The name of the room.
     * @param {Map} data The data to store in the room's memory.
     */
    static setRoomMemory(roomName, data) {
        if (!Memory.rooms || !(Memory.rooms instanceof Map)) {
            Memory.rooms = new Map();
        }

        Memory.rooms.set(roomName, data);
    }
}

module.exports = RoomMemoryUtility;
