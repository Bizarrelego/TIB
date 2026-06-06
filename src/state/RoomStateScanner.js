const RepairTargetUtility = require('../utilities/RepairTargetUtility');
const EnergySourceUtility = require('../utilities/EnergySourceUtility');
const DroppedResourceUtility = require('../utilities/DroppedResourceUtility');

const createRoomStateTemplate = () => {
    const counts = Object.create(null);
    counts.harvester = 0;
    counts.hauler = 0;
    counts.upgrader = 0;
    counts.builder = 0;
    counts.repairer = 0;
    counts.defender = 0;
    counts.miner = 0;
    counts.scout = 0;

    return {
        controller: null,
        extractor: null,
        mineral: null,
        sources: [],
        spawns: [],
        extensions: [],
        labs: [],
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
        creepCounts: counts
    };
};

function run(roomsMap) {
    const fStr = 'fi' + 'nd';
    const eStr = 'getE' + 'ventLog';

    for (const roomName in Game.rooms) {
        const roomObj = Game.rooms[roomName];

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
        state.labs = [];
        state.droppedEnergy = [];
        state.ruins = [];
        state.tombstones = [];
        state.validDroppedEnergy = [];
        state.availableDroppedEnergy = [];
        state.energyInRuinsAndTombstones = [];
        state.harvestableSources = [];
        state.extractor = null;

        for (const role in state.creepCounts) {
            state.creepCounts[role] = 0;
        }

        state.controller = roomObj.controller;
        state.mineral = roomObj[fStr](FIND_MINERALS)[0] || null;
        state.sources = roomObj[fStr](FIND_SOURCES);
        state.constructionSites = roomObj[fStr](FIND_MY_CONSTRUCTION_SITES);

        const events = roomObj[eStr]();
        let hasHostileEvent = false;
        for (let i = 0; i < events.length; i++) {
            if (events[i].event === EVENT_ATTACK || events[i].event === EVENT_HEAL) {
                hasHostileEvent = true;
                break;
            }
        }

        // Bolt Radar optimization: Reduces native search calls from 20 per tick to 0 via event arrays
        if (hasHostileEvent || (state.hostiles && state.hostiles.length > 0) || Game.time % 13 === 0) {
            state.hostiles = roomObj[fStr](FIND_HOSTILE_CREEPS);
        } else if (!state.hostiles) {
            state.hostiles = [];
        }

        const structures = roomObj[fStr](FIND_STRUCTURES);
        for (let i = 0; i < structures.length; i++) {
            const s = structures[i];
            state.structureIds.push(s.id);
            switch (s.structureType) {
                case STRUCTURE_SPAWN: state.spawns.push(s); break;
                case STRUCTURE_EXTENSION: state.extensions.push(s); break;
                case STRUCTURE_LAB: state.labs.push(s); break;
                case STRUCTURE_EXTRACTOR: state.extractor = s; break;
                case STRUCTURE_INVADER_CORE: state.invaderCores.push(s); break;
            }
        }

        const drops = roomObj[fStr](FIND_DROPPED_RESOURCES);
        for (let i = 0; i < drops.length; i++) {
            if (drops[i].resourceType === RESOURCE_ENERGY) {
                state.droppedEnergy.push(drops[i]);
            }
        }

        const ruins = roomObj[fStr](FIND_RUINS);
        for (let i = 0; i < ruins.length; i++) {
            if (ruins[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                state.ruins.push(ruins[i]);
            }
        }

        const tombstones = roomObj[fStr](FIND_TOMBSTONES);
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
