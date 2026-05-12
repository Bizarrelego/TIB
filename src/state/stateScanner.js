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
            droppedEnergyByRoom: new Map(),
            tombstonesByRoom: new Map(),
            ruinsByRoom: new Map()
        };
    }

    if (!global.Cache) global.Cache = {};
    if (!global.Cache.roomTerrain) global.Cache.roomTerrain = new Map();
    if (!global.Cache.rooms) global.Cache.rooms = new Map();
    if (!global.Cache.creeps) global.Cache.creeps = new Map();
    if (!global.Cache.structures) global.Cache.structures = new Map();

    const rooms = Object.values(Game.rooms);
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const roomName = room.name;

        if (!global.Cache.roomTerrain.has(roomName)) {
            global.Cache.roomTerrain.set(roomName, Game.map.getRoomTerrain(roomName));
        }
        global.State.roomTerrain.set(roomName, global.Cache.roomTerrain.get(roomName));

        let roomCache = global.Cache.rooms.get(roomName);
        if (!roomCache) {
            roomCache = {
                structureIds: null,
                droppedIds: null,
                tombstoneIds: null,
                ruinIds: null,
                hostileIds: null,
                sourceIds: null,
                mineralIds: null
            };
            global.Cache.rooms.set(roomName, roomCache);
        }

        // 0-CPU Radar: Event-Driven Updates
        const events = room.getEventLog();
        let structuresChanged = !roomCache.structureIds;
        let logisticsChanged = !roomCache.droppedIds || Game.time % 10 === 0;
        let hostilesChanged = !roomCache.hostileIds || Game.time % 3 === 0;

        for (let e = 0; e < events.length; e++) {
            const eventType = events[e].event;
            if (eventType === EVENT_BUILD || eventType === EVENT_OBJECT_DESTROYED) {
                structuresChanged = true;
            } else if (eventType === EVENT_DROP) {
                logisticsChanged = true;
            } else if (eventType === EVENT_ATTACK || eventType === EVENT_HEAL) {
                hostilesChanged = true;
            }
        }

        // O(1) Sources Caching
        if (!roomCache.sourceIds) {
            roomCache.sourceIds = room.find(FIND_SOURCES).map(s => s.id);
        }
        const roomSources = [];
        for (let j = 0; j < roomCache.sourceIds.length; j++) {
            const source = Game.getObjectById(roomCache.sourceIds[j]);
            if (source) roomSources.push(source);
        }
        global.State.sourcesByRoom.set(roomName, roomSources);

        // O(1) Minerals Caching
        if (!roomCache.mineralIds) {
            roomCache.mineralIds = room.find(FIND_MINERALS).map(m => m.id);
        }
        const roomMinerals = [];
        for (let j = 0; j < roomCache.mineralIds.length; j++) {
            const mineral = Game.getObjectById(roomCache.mineralIds[j]);
            if (mineral) roomMinerals.push(mineral);
        }
        global.State.mineralsByRoom.set(roomName, roomMinerals);

        // O(1) Event-Driven Structure Caching
        if (structuresChanged) {
            roomCache.structureIds = room.find(FIND_STRUCTURES).map(s => s.id);
        }
        const roomStructs = new Map();
        for (let j = 0; j < roomCache.structureIds.length; j++) {
            const id = roomCache.structureIds[j];
            const struct = Game.getObjectById(id);
            if (struct) {
                let typeStructs = roomStructs.get(struct.structureType);
                if (!typeStructs) {
                    typeStructs = [];
                    roomStructs.set(struct.structureType, typeStructs);
                }
                typeStructs.push(struct);

                let memory = global.Cache.structures.get(id);
                if (!memory) {
                    memory = {};
                    global.Cache.structures.set(id, memory);
                }
                memory._structure = struct;
            } else {
                global.Cache.structures.delete(id); // Reap natively on decay/destroy
            }
        }
        global.State.structuresByRoom.set(roomName, roomStructs);

        // O(1) Event-Driven Hostile Caching
        if (hostilesChanged) {
            roomCache.hostileIds = room.find(FIND_HOSTILE_CREEPS).map(c => c.id);
        }
        const hostiles = [];
        for (let j = 0; j < roomCache.hostileIds.length; j++) {
            const obj = Game.getObjectById(roomCache.hostileIds[j]);
            if (obj) hostiles.push(obj);
        }
        global.State.hostilesByRoom.set(roomName, hostiles);

        // O(1) Event-Driven Logistics Caching
        if (logisticsChanged) {
            roomCache.droppedIds = room.find(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY }).map(r => r.id);
            roomCache.tombstoneIds = room.find(FIND_TOMBSTONES, { filter: t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0 }).map(t => t.id);
            roomCache.ruinIds = room.find(FIND_RUINS, { filter: r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0 }).map(r => r.id);
        }

        const dropped = [];
        for (let j = 0; j < roomCache.droppedIds.length; j++) {
            const obj = Game.getObjectById(roomCache.droppedIds[j]);
            if (obj && obj.amount > 0) dropped.push(obj);
        }
        global.State.droppedEnergyByRoom.set(roomName, dropped);

        const tombstones = [];
        for (let j = 0; j < roomCache.tombstoneIds.length; j++) {
            const obj = Game.getObjectById(roomCache.tombstoneIds[j]);
            if (obj && obj.store.getUsedCapacity(RESOURCE_ENERGY) > 0) tombstones.push(obj);
        }
        global.State.tombstonesByRoom.set(roomName, tombstones);

        const ruins = [];
        for (let j = 0; j < roomCache.ruinIds.length; j++) {
            const obj = Game.getObjectById(roomCache.ruinIds[j]);
            if (obj && obj.store.getUsedCapacity(RESOURCE_ENERGY) > 0) ruins.push(obj);
        }
        global.State.ruinsByRoom.set(roomName, ruins);
    }

    // Reap dead creeps
    for (const name of global.Cache.creeps.keys()) {
        if (!Game.creeps[name]) {
            global.Cache.creeps.delete(name);
        }
    }

    // Update Creeps
    const creepsByRoom = new Map();
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
        creep.heap = memory;

        const roomName = creep.room.name;
        const role = creep.memory.role || 'unassigned';

        let roomCreeps = creepsByRoom.get(roomName);
        if (!roomCreeps) {
            roomCreeps = new Map();
            creepsByRoom.set(roomName, roomCreeps);
        }

        let roleCreeps = roomCreeps.get(role);
        if (!roleCreeps) {
            roleCreeps = [];
            roomCreeps.set(role, roleCreeps);
        }
        roleCreeps.push(creep);
    }
    global.State.creepsByRoom = creepsByRoom;

    // Update Spawns
    const spawnsByRoom = new Map();
    const spawnNames = Object.keys(Game.spawns);
    for (let i = 0; i < spawnNames.length; i++) {
        const spawn = Game.spawns[spawnNames[i]];
        const roomName = spawn.room.name;

        let roomSpawns = spawnsByRoom.get(roomName);
        if (!roomSpawns) {
            roomSpawns = [];
            spawnsByRoom.set(roomName, roomSpawns);
        }
        roomSpawns.push(spawn);
    }
    global.State.spawnsByRoom = spawnsByRoom;

    // Update Construction Sites
    const sitesByRoom = new Map();
    const sites = Object.values(Game.constructionSites);
    for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        if (site.room) {
            const roomName = site.room.name;
            let roomSites = sitesByRoom.get(roomName);
            if (!roomSites) {
                roomSites = [];
                sitesByRoom.set(roomName, roomSites);
            }
            roomSites.push(site);
        }
    }
    global.State.sitesByRoom = sitesByRoom;
};