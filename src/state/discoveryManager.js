/* global FIND_RUINS */

/**
 * Initializes and populates global.State for owned rooms.
 */
module.exports = function discoveryManager() {
    if (!global.State) {
        global.State = {};
    }

    // Assign missing properties
    if (!global.State.structuresByRoom) global.State.structuresByRoom = new Map();
    if (!global.State.creepsByRoom) global.State.creepsByRoom = new Map();
    if (!global.State.hostilesByRoom) global.State.hostilesByRoom = new Map();
    if (!global.State.logisticsByRoom) global.State.logisticsByRoom = new Map();
    if (!global.State.creepLookup) global.State.creepLookup = new Map();
    if (!global.State.scannedRooms) global.State.scannedRooms = new Set();
    if (!global.State.eventCache) global.State.eventCache = new Map();
    if (!global.State.structureCache) global.State.structureCache = new Map();
    if (!global.State.sourcesByRoom) global.State.sourcesByRoom = new Map();
    if (!global.State.spawnsByRoom) global.State.spawnsByRoom = new Map();
    if (!global.State.controllersByRoom) global.State.controllersByRoom = new Map();
    if (!global.State.sitesByRoom) global.State.sitesByRoom = new Map();
    if (!global.State.mineralsByRoom) global.State.mineralsByRoom = new Map();
    if (!global.State.droppedByRoom) global.State.droppedByRoom = new Map();
    if (!global.State.tombstonesByRoom) global.State.tombstonesByRoom = new Map();
    if (!global.State.ruinsByRoom) global.State.ruinsByRoom = new Map();
    if (!global.State.roomTerrain) global.State.roomTerrain = new Map();

    if (!global.State.getEvents) {
        global.State.getEvents = function(roomName) {
            const room = global.State.rooms[roomName];
            if (!room) return [];

            const currentEventLog = room.getEventLog() || [];
            const previousEventLog = global.State.eventCache.get(roomName) || [];

            // Event logs are append-only. New events are at the end.
            const newEvents = currentEventLog.slice(previousEventLog.length);

            // Update cache so the next call diffs against this
            global.State.eventCache.set(roomName, currentEventLog);

            return newEvents;
        };
    }

    const state = global.State;

    // Populate global.State.scannedRooms for all visible rooms to ensure zero native polling for all logic
    for (const roomName in global.State.rooms) {
        state.scannedRooms.add(roomName);
    }

    // Initial Room Scan for Scanned Rooms
    for (const roomName in global.State.rooms) {
        const room = global.State.rooms[roomName];

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
                        roomStructures.set(struct.structureType, new Map());
                    }
                    roomStructures.get(struct.structureType).set(struct.id, struct);
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
                state.hostilesByRoom.set(roomName, new Map());
            }

            if (!state.logisticsByRoom.has(roomName)) {
                state.logisticsByRoom.set(roomName, new Map());
            }
        }
    }

    state.creepLookup.clear();
    state.creepsByRoom.clear();

    const creeps = Object.keys(global.State.creeps);
    for (let i = 0; i < creeps.length; i++) {
        const creepName = creeps[i];
        const creep = global.State.creeps[creepName];
        state.creepLookup.set(creepName, creep);

        const roomName = creep.pos.roomName;
        let roomCreeps = state.creepsByRoom.get(roomName);
        if (!roomCreeps) {
            roomCreeps = new Map();
            state.creepsByRoom.set(roomName, roomCreeps);
        }

        const role = creep.memory.role || 'default';
        let roleCreeps = roomCreeps.get(role);
        if (!roleCreeps) {
            roleCreeps = [];
            roomCreeps.set(role, roleCreeps);
        }
        roleCreeps.push(creep);
    }
};
