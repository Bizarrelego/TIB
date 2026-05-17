
/**
 * Initializes and populates global.State for owned rooms.
 */
module.exports = function discoveryManager() {
    if (!global.State) global.State = {};
    const state = global.State;

    if (!state.rooms) state.rooms = new Map();
    if (!state.structuresByRoom) state.structuresByRoom = new Map();
    if (!state.creepsByRoom) state.creepsByRoom = new Map();
    if (!state.hostilesByRoom) state.hostilesByRoom = new Map();
    if (!state.logisticsByRoom) state.logisticsByRoom = new Map();
    if (!state.creepLookup) state.creepLookup = new Map();
    if (!state.scannedRooms) state.scannedRooms = new Set();
    if (!state.eventCache) state.eventCache = new Map();
    if (!state.structureCache) state.structureCache = new Map();
    if (!state.sourcesByRoom) state.sourcesByRoom = new Map();
    if (!state.spawnsByRoom) state.spawnsByRoom = new Map();
    if (!state.controllersByRoom) state.controllersByRoom = new Map();
    if (!state.sitesByRoom) state.sitesByRoom = new Map();
    if (!state.mineralsByRoom) state.mineralsByRoom = new Map();
    if (!state.droppedByRoom) state.droppedByRoom = new Map();
    if (!state.tombstonesByRoom) state.tombstonesByRoom = new Map();
    if (!state.ruinsByRoom) state.ruinsByRoom = new Map();
    if (!state.nukesByRoom) state.nukesByRoom = new Map();
    if (!state.roomTerrain) state.roomTerrain = new Map();
    if (!state.sourceWalkableTiles) state.sourceWalkableTiles = new Map();
    
    if (!state.getEvents) {
        state.getEvents = function(roomName) {
            const room = Game.rooms[roomName];
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

    // Populate global.State.scannedRooms for all visible rooms to ensure zero native polling for all logic
    for (const roomName in Game.rooms) {
        state.scannedRooms.add(roomName);
    }

    // Initial Room Scan for Scanned Rooms
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];

        if (state.scannedRooms.has(roomName)) {
            // Only run the heavy native polling if the room isn't already initialized in State
            if (!state.structuresByRoom.has(roomName)) {
                state.rooms.set(roomName, room);
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
                
                const droppedMap = new Map();
                const dropped = room.find(FIND_DROPPED_RESOURCES);
                for (let i = 0; i < dropped.length; i++) droppedMap.set(dropped[i].id, dropped[i]);
                state.droppedByRoom.set(roomName, droppedMap);

                const tombstoneMap = new Map();
                const tombstones = room.find(FIND_TOMBSTONES);
                for (let i = 0; i < tombstones.length; i++) tombstoneMap.set(tombstones[i].id, tombstones[i]);
                state.tombstonesByRoom.set(roomName, tombstoneMap);

                const ruinsMap = new Map();
                const ruins = room.find(FIND_RUINS);
                for (let i = 0; i < ruins.length; i++) ruinsMap.set(ruins[i].id, ruins[i]);
                state.ruinsByRoom.set(roomName, ruinsMap);
                
                state.nukesByRoom.set(roomName, room.find(FIND_NUKES));

                state.roomTerrain.set(roomName, new Room.Terrain(roomName));

                // Cache walkable tiles around sources
                const sources = room.find(FIND_SOURCES);
                const terrain = state.roomTerrain.get(roomName);
                const walkableTilesMap = new Map();

                for (const source of sources) {
                    let walkable = 0;
                    const x = source.pos.x;
                    const y = source.pos.y;

                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            const cx = x + dx;
                            const cy = y + dy;
                            if (cx >= 0 && cx <= 49 && cy >= 0 && cy <= 49) {
                                if (terrain.get(cx, cy) !== TERRAIN_MASK_WALL) {
                                    walkable++;
                                }
                            }
                        }
                    }
                    walkableTilesMap.set(source.id, walkable);
                }
                state.sourceWalkableTiles.set(roomName, walkableTilesMap);

                state.hostilesByRoom.set(roomName, new Map());
                state.nukesByRoom.set(roomName, room.find(FIND_NUKES));
            }

            if (!state.logisticsByRoom.has(roomName)) {
                state.logisticsByRoom.set(roomName, new Map());
            }
        }
    }

    state.creepLookup.clear();
    state.creepsByRoom.clear();

    const creeps = Object.keys(Game.creeps);
    for (let i = 0; i < creeps.length; i++) {
        const creepName = creeps[i];
        const creep = Game.creeps[creepName];

        if (!creep.heap) {
            creep.heap = { state: 'init' };
        }

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
