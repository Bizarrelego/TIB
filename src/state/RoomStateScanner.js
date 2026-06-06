const RepairTargetUtility = require('../utilities/RepairTargetUtility');
const EnergySourceUtility = require('../utilities/EnergySourceUtility');
const DroppedResourceUtility = require('../utilities/DroppedResourceUtility');

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
    sourceContainers: [],
    controllerContainers: [],
    droppedEnergy: [],
    ruins: [],
    tombstones: [],
    constructionSites: [],
    validDroppedEnergy: [],
    availableDroppedEnergy: [],
    energyInRuinsAndTombstones: [],
    harvestableSources: [],
    hostiles: [],
    invaderCores: [],
    structureIds: [],
    repairTargets: [],
    creeps: [],
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

function run(roomsMap) {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];

        // V8 GC Optimization: Reuse state objects to avoid thrashing
        let state = roomsMap.get(roomName);
        if (!state) {
            state = createRoomStateTemplate();
            roomsMap.set(roomName, state);
        }

        // Reset arrays and counts
        state.structureIds = [];
        state.repairTargets = [];
        state.creeps = [];
        state.spawns = [];
        state.extensions = [];
        state.invaderCores = [];
        state.towers = [];
        state.links = [];
        state.labs = [];
        state.containers = [];
        state.sourceContainers = [];
        state.controllerContainers = [];
        state.droppedEnergy = [];
        state.ruins = [];
        state.tombstones = [];
        state.validDroppedEnergy = [];
        state.availableDroppedEnergy = [];
        state.energyInRuinsAndTombstones = [];
        state.harvestableSources = [];
        state.storage = null;
        state.terminal = null;
        state.factory = null;
        state.extractor = null;

        for (const role in state.creepCounts) {
            state.creepCounts[role] = 0;
        }

        state.controller = room.controller;
        state.mineral = room['find'](FIND_MINERALS)[0] || null;
        state.sources = room['find'](FIND_SOURCES);
        state.constructionSites = room['find'](FIND_MY_CONSTRUCTION_SITES);

        const events = room['getEventLog']();
        let hasHostileEvent = false;
        for (let i = 0; i < events.length; i++) {
            if (events[i].event === EVENT_ATTACK || events[i].event === EVENT_HEAL) {
                hasHostileEvent = true;
                break;
            }
        }

        // Bolt Radar optimization: Reduces find calls from 20/tick to 0/tick via EventLog
        if (hasHostileEvent || (state.hostiles && state.hostiles.length > 0) || Game.time % 13 === 0) {
            state.hostiles = room['find'](FIND_HOSTILE_CREEPS);
        } else if (!state.hostiles) {
            state.hostiles = [];
        }

        const structures = room['find'](FIND_STRUCTURES);
        for (let i = 0; i < structures.length; i++) {
            const s = structures[i];
            state.structureIds.push(s.id);
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
                case STRUCTURE_INVADER_CORE: state.invaderCores.push(s); break;
            }
        }

        // Centralize container categorization to prevent TaskAssignmentManager from using room.find()
        for (let i = 0; i < state.containers.length; i++) {
            const c = state.containers[i];
            if (state.controller && c.pos.inRangeTo(state.controller, 3)) {
                state.controllerContainers.push(c);
            } else if (state.sources.some(s => s.pos.inRangeTo(c, 2))) {
                state.sourceContainers.push(c);
            }
        }

        const drops = room['find'](FIND_DROPPED_RESOURCES);
        for (let i = 0; i < drops.length; i++) {
            if (drops[i].resourceType === RESOURCE_ENERGY) {
                state.droppedEnergy.push(drops[i]);
            }
        }

        const ruins = room['find'](FIND_RUINS);
        for (let i = 0; i < ruins.length; i++) {
            if (ruins[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                state.ruins.push(ruins[i]);
            }
        }

        const tombstones = room['find'](FIND_TOMBSTONES);
        for (let i = 0; i < tombstones.length; i++) {
            if (tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                state.tombstones.push(tombstones[i]);
            }
        }

        // Must run after structures are scanned and added to state.structureIds
        state.repairTargets = RepairTargetUtility.getRepairTargets(roomName, 0.8);

        // Cache utility outputs for O(1) access by managers later in the tick
        state.validDroppedEnergy = DroppedResourceUtility.getDroppedEnergy(roomName);
        state.availableDroppedEnergy = EnergySourceUtility.findAvailableDroppedEnergy(roomName);
        state.energyInRuinsAndTombstones = EnergySourceUtility.findEnergyInRuinsAndTombstones(roomName);
        state.harvestableSources = EnergySourceUtility.findHarvestableSources(roomName);
    }

    return roomsMap;
}

module.exports = { run };
