const Scanner = require('./Scanner');

module.exports = function stateScanner() {
    if (!global.State) {
        global.State = {
            creepsByRoom: new Map(),
            spawnsByRoom: new Map(),
            sourcesByRoom: new Map(),
            structuresByRoom: new Map(),
            sitesByRoom: new Map(),
            hostilesByRoom: new Map(),
            mineralsByRoom: new Map(),
            roomTerrain: new Map(),
            controllersByRoom: new Map(),
            droppedByRoom: new Map()
        };
    } else {
        global.State.creepsByRoom.clear();
        global.State.spawnsByRoom.clear();
        global.State.sourcesByRoom.clear();
        global.State.structuresByRoom.clear();
        global.State.sitesByRoom.clear();
        global.State.hostilesByRoom.clear();
        global.State.mineralsByRoom.clear();
        global.State.controllersByRoom.clear();
        global.State.droppedByRoom.clear();
        // roomTerrain is persistent per global reset, no need to clear it every tick,
        // but since we rebuild it for all visible rooms below anyway, we can clear it,
        // or just rely on global.Cache for actual persistence. Let's put it in global.Cache instead.
    }

    if (!global.Cache.roomTerrain) {
        global.Cache.roomTerrain = new Map();
    }

    // O(1) Source Caching
    if (!global.Cache.rooms) {
        global.Cache.rooms = new Map();
    }
    const rooms = Object.values(Game.rooms);
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];

        if (!global.Cache.roomTerrain.has(room.name)) {
            global.Cache.roomTerrain.set(room.name, Game.map.getRoomTerrain(room.name));
        }
        global.State.roomTerrain.set(room.name, global.Cache.roomTerrain.get(room.name));
        let roomCache = global.Cache.rooms.get(room.name);
        if (!roomCache) {
            roomCache = {};
            global.Cache.rooms.set(room.name, roomCache);
        }

        // O(1) Source and Mineral Caching
        // Removed room.find() logic. Initial discovery must be handled elsewhere or gated if strictly needed.
        // Assuming global.Cache.rooms[room.name] is seeded by intel/events.
        const roomSources = [];
        if (roomCache.sourceIds) {
            for (let j = 0; j < roomCache.sourceIds.length; j++) {
                const source = Game.getObjectById(roomCache.sourceIds[j]);
                if (source) {
                    roomSources.push(source);
                }
            }
        }
        global.State.sourcesByRoom.set(room.name, roomSources);

        const roomMinerals = [];
        if (roomCache.mineralIds) {
            for (let j = 0; j < roomCache.mineralIds.length; j++) {
                const mineral = Game.getObjectById(roomCache.mineralIds[j]);
                if (mineral) {
                    roomMinerals.push(mineral);
                }
            }
        }
        global.State.mineralsByRoom.set(room.name, roomMinerals);

        if (room.controller) {
            global.State.controllersByRoom.set(room.name, room.controller);
        }

        global.State.hostilesByRoom.set(room.name, Scanner.updateHostiles(room));
        global.State.droppedByRoom.set(room.name, Scanner.updateDropped(room));

        // LinkManager caching
        if (!global.State.linksByRoom) {
            global.State.linksByRoom = new Map();
        }
        let roomLinks = global.State.linksByRoom.get(room.name);
        if (!roomLinks) {
            roomLinks = {};
            global.State.linksByRoom.set(room.name, roomLinks);
        }
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

            if (struct.structureType === STRUCTURE_LINK) {
                const roomLinks = global.State.linksByRoom.get(struct.room.name);
                if (roomLinks && struct.room.controller && struct.pos.inRangeTo(struct.room.controller, 3)) {
                    roomLinks.controllerLink = struct;
                }
            }
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
