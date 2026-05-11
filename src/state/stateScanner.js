module.exports = function stateScanner() {
    if (!global.State) {
        global.State = {
            creepsByRoom: new Map(),
            spawnsByRoom: new Map()
        };
    } else {
        global.State.creepsByRoom.clear();
        global.State.spawnsByRoom.clear();
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
    }
};
