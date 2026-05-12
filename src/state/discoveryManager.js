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
            structureCache: new Map()
        };
    }

    const state = global.State;
    state.eventCache.clear();
    state.creepLookup.clear(); // Rebuild creep index each tick for live properties

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];

        // Cache events for stateScanner
        state.eventCache.set(roomName, room.getEventLog());

        // Perform expensive initial scan only once per room
        if (!state.scannedRooms.has(roomName)) {
            const structures = room.find(FIND_STRUCTURES);
            for (const struct of structures) {
                // Populate structureCache directly
                state.structureCache.set(struct.id, struct);

                // Group by room
                let roomStructs = state.structuresByRoom.get(roomName);
                if (!roomStructs) {
                    roomStructs = new Map();
                    state.structuresByRoom.set(roomName, roomStructs);
                }
                roomStructs.set(struct.id, struct);
            }
            state.scannedRooms.add(roomName);
        }
    }

    // Clear all per-room creep maps to prevent cross-room ghosting
    for (const roomCreeps of state.creepsByRoom.values()) {
        roomCreeps.clear();
    }

    // Refresh Creep Lookup with live objects (0-CPU cost via Game.creeps)
    for (const creepName in Game.creeps) {
        const liveCreep = Game.creeps[creepName];
        state.creepLookup.set(creepName, liveCreep);

        // Ensure per-room creep maps are updated
        const roomName = liveCreep.pos.roomName;
        let roomCreeps = state.creepsByRoom.get(roomName);
        if (!roomCreeps) {
            roomCreeps = new Map();
            state.creepsByRoom.set(roomName, roomCreeps);
        }
        roomCreeps.set(liveCreep.id, liveCreep);
    }
};
