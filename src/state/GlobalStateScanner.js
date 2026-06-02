/**
 * Module responsible for building the global state object by scanning rooms.
 * Optimized for RCL 1-8 via Single-Pass Binning and V8 Monomorphism.
 * @module GlobalStateScanner
 */

// V8 Optimization: Statically define the exact shape of a room's state.
const createRoomStateTemplate = () => ({
    controller: null,
    storage: null,
    terminal: null,
    factory: null,
    extractor: null,
    mineral: null,
    sources: [],
    spawns: [],
    extensions: [],
    towers: [],
    links: [],
    labs: [],
    containers: [],
    droppedEnergy: [],
    ruins: [],
    tombstones: [],
    constructionSites: [],
    hostiles: [],
    // CRITICAL FIX: You MUST include all active roles here or the scanner will ignore them,
    // causing SpawnManager to infinitely spawn them.
    creepCounts: {
        harvester: 0,
        hauler: 0,
        upgrader: 0,
        builder: 0,
        repairer: 0,
        defender: 0,
        miner: 0,
        scout: 0
    }
});

function run() {
    if (!global.State) {
        global.State = { rooms: new Map() };
    }

    if (!global.State.rooms || !(global.State.rooms instanceof Map)) {
        global.State.rooms = new Map();
    }

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        const state = createRoomStateTemplate();
        
        state.controller = room.controller;
        state.mineral = room.find(FIND_MINERALS)[0] || null;
        state.sources = room.find(FIND_SOURCES);
        state.constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES);
        state.hostiles = room.find(FIND_HOSTILE_CREEPS);

        const structures = room.find(FIND_STRUCTURES);
        for (let i = 0; i < structures.length; i++) {
            const s = structures[i];
            switch (s.structureType) {
                case STRUCTURE_SPAWN: state.spawns.push(s); break;
                case STRUCTURE_EXTENSION: state.extensions.push(s); break;
                case STRUCTURE_TOWER: state.towers.push(s); break;
                case STRUCTURE_CONTAINER: state.containers.push(s); break;
                case STRUCTURE_LINK: state.links.push(s); break;
                case STRUCTURE_LAB: state.labs.push(s); break;
                case STRUCTURE_STORAGE: state.storage = s; break;
                case STRUCTURE_TERMINAL: state.terminal = s; break;
                case STRUCTURE_FACTORY: state.factory = s; break;
                case STRUCTURE_EXTRACTOR: state.extractor = s; break;
            }
        }

        const drops = room.find(FIND_DROPPED_RESOURCES);
        for (let i = 0; i < drops.length; i++) {
            if (drops[i].resourceType === RESOURCE_ENERGY) {
                state.droppedEnergy.push(drops[i]);
            }
        }

        const ruins = room.find(FIND_RUINS);
        for (let i = 0; i < ruins.length; i++) {
            if (ruins[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                state.ruins.push(ruins[i]);
            }
        }

        const tombstones = room.find(FIND_TOMBSTONES);
        for (let i = 0; i < tombstones.length; i++) {
            if (tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                state.tombstones.push(tombstones[i]);
            }
        }

        global.State.rooms.set(roomName, state);
    }

    const creepNames = Object.keys(Game.creeps);
    for (let i = 0; i < creepNames.length; i++) {
        const creep = Game.creeps[creepNames[i]];
        const roomName = creep.memory.room || creep.room.name;
        const role = creep.memory.role;

        const roomState = global.State.rooms.get(roomName);
        if (roomState && role && roomState.creepCounts[role] !== undefined) {
            roomState.creepCounts[role]++;
        }
    }
}

module.exports = {
    run
};