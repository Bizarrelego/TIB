module.exports = function stateScanner() {
    if (!global.State) {
        global.State = {
            creepsByRoom: new Map(),
            spawnsByRoom: new Map(),
            sourcesByRoom: new Map(),
            structuresByRoom: new Map(),
            sitesByRoom: new Map(),
            hostilesByRoom: new Map()
        };
    } else {
        global.State.creepsByRoom.clear();
        global.State.spawnsByRoom.clear();
        global.State.sourcesByRoom.clear();
        global.State.structuresByRoom.clear();
        global.State.sitesByRoom.clear();
        global.State.hostilesByRoom.clear();
    }

    // O(1) Source Caching
    if (!global.Cache.rooms) {
        global.Cache.rooms = new Map();
    }
    const rooms = Object.values(Game.rooms);
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        let roomCache = global.Cache.rooms.get(room.name);
        if (!roomCache) {
            roomCache = {};
            global.Cache.rooms.set(room.name, roomCache);
        }

        if (!roomCache.sourceIds) {
            const sources = room.find(FIND_SOURCES);
            roomCache.sourceIds = sources.map(s => s.id);
        }

        const roomSources = [];
        for (let j = 0; j < roomCache.sourceIds.length; j++) {
            const source = Game.getObjectById(roomCache.sourceIds[j]);
            if (source) {
                roomSources.push(source);
            }
        }
        global.State.sourcesByRoom.set(room.name, roomSources);

        // O(1) Hostile Caching
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        global.State.hostilesByRoom.set(room.name, hostiles);
    }

    // Reap global.Cache.creeps
    for (const name of global.Cache.creeps.keys()) {
        if (!Game.creeps[name]) {
            global.Cache.creeps.delete(name);
        }
    }

    // Update global.Cache.creeps
    const creepNames = Object.keys(Game.creeps);
    for (let i = 0; i < creepNames.length; i++) {
        const name = creepNames[i];
        const creep = Game.creeps[name];
        let memory = global.Cache.creeps.get(name);
        if (!memory) {
            memory = {};
            global.Cache.creeps.set(name, memory);
        }
        memory._creep = creep;
        creep.heap = memory; // Establish heap proxy

        const roomName = creep.room.name;
        const role = creep.memory.role || 'unassigned';

        let roomCreeps = global.State.creepsByRoom.get(roomName);
        if (!roomCreeps) {
            roomCreeps = new Map();
            global.State.creepsByRoom.set(roomName, roomCreeps);
        }

        let roleCreeps = roomCreeps.get(role);
        if (!roleCreeps) {
            roleCreeps = [];
            roomCreeps.set(role, roleCreeps);
        }
        roleCreeps.push(creep);
    }

    // Update global.State.spawnsByRoom
    const spawnNames = Object.keys(Game.spawns);
    for (let i = 0; i < spawnNames.length; i++) {
        const spawn = Game.spawns[spawnNames[i]];
        const roomName = spawn.room.name;

        let roomSpawns = global.State.spawnsByRoom.get(roomName);
        if (!roomSpawns) {
            roomSpawns = [];
            global.State.spawnsByRoom.set(roomName, roomSpawns);
        }
        roomSpawns.push(spawn);
    }

    // Reap global.Cache.structures
    for (const id of global.Cache.structures.keys()) {
        if (!Game.structures[id]) {
            global.Cache.structures.delete(id);
        }
    }

    // Update global.Cache.structures
    const structureIds = Object.keys(Game.structures);
    for (let i = 0; i < structureIds.length; i++) {
        const id = structureIds[i];
        let memory = global.Cache.structures.get(id);
        if (!memory) {
            memory = {};
            global.Cache.structures.set(id, memory);
        }
        memory._structure = Game.structures[id];

        const struct = Game.structures[id];
        if (struct.room) {
            let roomStructs = global.State.structuresByRoom.get(struct.room.name);
            if (!roomStructs) {
                roomStructs = new Map();
                global.State.structuresByRoom.set(struct.room.name, roomStructs);
            }
            let typeStructs = roomStructs.get(struct.structureType);
            if (!typeStructs) {
                typeStructs = [];
                roomStructs.set(struct.structureType, typeStructs);
            }
            typeStructs.push(struct);
        }
    }

    const sites = Object.values(Game.constructionSites);
    for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        if (site.room) {
            let roomSites = global.State.sitesByRoom.get(site.room.name);
            if (!roomSites) {
                roomSites = [];
                global.State.sitesByRoom.set(site.room.name, roomSites);
            }
            roomSites.push(site);
        }
    }
};
