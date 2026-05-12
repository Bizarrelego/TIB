/* global FIND_RUINS */

/**
 * Initializes and populates global.State for owned rooms.
 */
module.exports = function discoveryManager() {
    if (!global.State) {
        global.State = {
            structuresByRoom: new Map(),
            creepsByRoom: new Map(),
            hostilesByRoom: new Map(),
            logisticsByRoom: new Map(),
            creepLookup: new Map(),
            scannedRooms: new Set(),
            eventCache: new Map(),
            structureCache: new Map(),
            sourcesByRoom: new Map(),
            spawnsByRoom: new Map(),
            controllersByRoom: new Map(),
            sitesByRoom: new Map(),
            mineralsByRoom: new Map(),
            droppedByRoom: new Map(),
            tombstonesByRoom: new Map(),
            ruinsByRoom: new Map(),
            roomTerrain: new Map()
        };
    }

    const state = global.State;
    state.eventCache.clear();

    // Populate global.State.scannedRooms for owned rooms
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room.controller && room.controller.my === true) {
            state.scannedRooms.add(roomName);
        }
    }

    // Initial Room Scan for Owned Rooms
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];

        if (state.scannedRooms.has(roomName)) {
            // Only run the heavy native polling if the room isn't already initialized in State
            if (!state.structuresByRoom.has(roomName)) {
                // Cache event log to establish baseline during init. Should not be polled here after init.
                state.eventCache.set(roomName, room.getEventLog());

                // Populate structuresByRoom and structureCache
                const roomStructures = new Map();
                const structures = room.find(FIND_STRUCTURES);
                for (const struct of structures) {
                    if (!roomStructures.has(struct.structureType)) {
                        roomStructures.set(struct.structureType, []);
                    }
                    roomStructures.get(struct.structureType).push(struct);
                    state.structureCache.set(struct.id, struct);
                }
                state.structuresByRoom.set(roomName, roomStructures);

                // Populate other per-room data
                state.sourcesByRoom.set(roomName, room.find(FIND_SOURCES));
                state.spawnsByRoom.set(roomName, room.find(FIND_MY_SPAWNS));
                state.controllersByRoom.set(roomName, room.controller);
                state.sitesByRoom.set(roomName, room.find(FIND_MY_CONSTRUCTION_SITES));
                state.mineralsByRoom.set(roomName, room.find(FIND_MINERALS));
                state.droppedByRoom.set(roomName, room.find(FIND_DROPPED_RESOURCES));
                state.tombstonesByRoom.set(roomName, room.find(FIND_TOMBSTONES));
                state.ruinsByRoom.set(roomName, room.find(FIND_RUINS));
                state.roomTerrain.set(roomName, new Room.Terrain(roomName));
                state.hostilesByRoom.set(roomName, room.find(FIND_HOSTILE_CREEPS));
            }

            if (!state.logisticsByRoom.has(roomName)) {
                state.logisticsByRoom.set(roomName, new Map());
            }
        }
    }

    // Clear all per-room creep maps to prevent cross-room ghosting
    for (const roomCreeps of state.creepsByRoom.values()) {
        roomCreeps.clear();
    }

    // Only refresh live creep mappings from the existing global.State.creepLookup
    for (const creepName of state.creepLookup.keys()) {
        const liveCreep = Game.creeps[creepName];
        if (!liveCreep) {
            state.creepLookup.delete(creepName);
            continue;
        }

        state.creepLookup.set(creepName, liveCreep);

        const roomName = liveCreep.pos.roomName;
        let roomCreeps = state.creepsByRoom.get(roomName);
        if (!roomCreeps) {
            roomCreeps = new Map();
            state.creepsByRoom.set(roomName, roomCreeps);
        }
        roomCreeps.set(liveCreep.id, liveCreep);
    }
};
