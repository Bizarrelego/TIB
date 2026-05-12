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

    for (const roomName in Game.rooms) {
        if (!state.scannedRooms.has(roomName)) {
            // Architecture requires using pre-calculated DistanceTransforms
            // or RawMemory segments for room layout, not room.find()
            continue;
        }
        const room = Game.rooms[roomName];
        state.eventCache.set(roomName, room.getEventLog());
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
