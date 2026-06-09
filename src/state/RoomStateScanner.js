const RepairTargetUtility = require('../utilities/RepairTargetUtility');
const EnergySourceUtility = require('../utilities/EnergySourceUtility');
const DroppedResourceUtility = require('../utilities/DroppedResourceUtility');
/* global STRUCTURE_INVADER_CORE */
const GameObjectUtility = require('../utilities/GameObjectUtility');

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
    harvesters: [],
    upgraders: [],
    spawnCount: 0,
    extensionCount: 0,
    towerCount: 0,
    linkCount: 0,
    labCount: 0,
    containerCount: 0,
    sourceContainerCount: 0,
    controllerContainerCount: 0,
    droppedEnergyCount: 0,
    ruinCount: 0,
    tombstoneCount: 0,
    constructionSiteCount: 0,
    validDroppedEnergyCount: 0,
    availableDroppedEnergyCount: 0,
    energyInRuinsAndTombstonesCount: 0,
    harvestableSourceCount: 0,
    hostileCount: 0,
    invaderCoreCount: 0,
    structureIdCount: 0,
    repairTargetCount: 0,
    creepCounts: {
        harvester: 0,
        hauler: 0,
        upgrader: 0,
        builder: 0,
        repairer: 0,
        defender: 0,
        miner: 0,
        scout: 0
    },
    cache: {
        scannedAt: 0,
        mineralId: null,
        sourceIds: [],
        structureIds: [],
        lastConstructionSiteCount: 0
    }
});

class RoomStateScanner {
    static run(room) {
        if (!global.State) global.State = { rooms: new Map() };

        const roomName = room.name;

        // V8 GC Optimization: Reuse state objects to avoid thrashing
        let state = global.State.rooms.get(roomName);
        if (!state) {
            state = createRoomStateTemplate();
            global.State.rooms.set(roomName, state);
        }

        // Zero-allocation array resets
        state.structureIdCount = 0;
        state.repairTargetCount = 0;
        state.spawnCount = 0;
        state.extensionCount = 0;
        state.invaderCoreCount = 0;
        state.towerCount = 0;
        state.linkCount = 0;
        state.labCount = 0;
        state.containerCount = 0;
        state.sourceContainerCount = 0;
        state.controllerContainerCount = 0;
        state.droppedEnergyCount = 0;
        state.ruinCount = 0;
        state.tombstoneCount = 0;
        state.validDroppedEnergyCount = 0;
        state.availableDroppedEnergyCount = 0;
        state.energyInRuinsAndTombstonesCount = 0;
        state.harvestableSourceCount = 0;
        state.storage = null;
        state.terminal = null;
        state.factory = null;
        state.extractor = null;

        state.controller = room.controller;

            // Cache static objects like sources and minerals to avoid engine polling overhead
            if (state.cache.sourceIds.length === 0) {
                state.cache.sourceIds = room['find'](FIND_SOURCES).map(s => s.id);
                const mineral = room['find'](FIND_MINERALS)[0];
                state.cache.mineralId = mineral ? mineral.id : null;
            }
            state.sources = state.cache.sourceIds.map(id => GameObjectUtility.getById(id)).filter(Boolean);
            state.mineral = state.cache.mineralId ? GameObjectUtility.getById(state.cache.mineralId) : null;

            state.constructionSites = room['find'](FIND_MY_CONSTRUCTION_SITES);
            state.constructionSiteCount = state.constructionSites.length;

            // Cache structures periodically or if a construction site finishes
            if (!state.cache.scannedAt || Game.time - state.cache.scannedAt > 13 || state.constructionSiteCount !== state.cache.lastConstructionSiteCount) {
                state.cache.structureIds = room['find'](FIND_STRUCTURES).map(s => s.id);
                state.cache.scannedAt = Game.time;
                state.cache.lastConstructionSiteCount = state.constructionSiteCount;
            }

            const structures = state.cache.structureIds.map(id => GameObjectUtility.getById(id)).filter(Boolean);

            for (let i = 0; i < structures.length; i++) {
                const s = structures[i];
                state.structureIds[state.structureIdCount++] = s.id;
                switch (s.structureType) {
                    case STRUCTURE_SPAWN: state.spawns[state.spawnCount++] = s; break;
                    case STRUCTURE_EXTENSION: state.extensions[state.extensionCount++] = s; break;
                    case STRUCTURE_TOWER: state.towers[state.towerCount++] = s; break;
                    case STRUCTURE_CONTAINER: state.containers[state.containerCount++] = s; break;
                    case STRUCTURE_LINK: state.links[state.linkCount++] = s; break;
                    case STRUCTURE_LAB: state.labs[state.labCount++] = s; break;
                    case STRUCTURE_STORAGE: state.storage = s; break;
                    case STRUCTURE_TERMINAL: state.terminal = s; break;
                    case STRUCTURE_FACTORY: state.factory = s; break;
                    case STRUCTURE_EXTRACTOR: state.extractor = s; break;
                    case STRUCTURE_INVADER_CORE: state.invaderCores[state.invaderCoreCount++] = s; break;
                }
            }

            // Centralize container categorization to prevent TaskAssignmentManager from using room.find()
            for (let i = 0; i < state.containerCount; i++) {
                const c = state.containers[i];
                if (state.controller && c.pos.inRangeTo(state.controller, 3)) {
                    state.controllerContainers[state.controllerContainerCount++] = c;
                } else if (state.sources.some(s => s.pos.inRangeTo(c, 2))) {
                    state.sourceContainers[state.sourceContainerCount++] = c;
                }
            }

            const drops = room['find'](FIND_DROPPED_RESOURCES);
            for (let i = 0; i < drops.length; i++) {
                if (drops[i].resourceType === RESOURCE_ENERGY) {
                    state.droppedEnergy[state.droppedEnergyCount++] = drops[i];
                }
            }

            const ruins = room['find'](FIND_RUINS);
            for (let i = 0; i < ruins.length; i++) {
                if (ruins[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    state.ruins[state.ruinCount++] = ruins[i];
                }
            }

            const tombstones = room['find'](FIND_TOMBSTONES);
            for (let i = 0; i < tombstones.length; i++) {
                if (tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    state.tombstones[state.tombstoneCount++] = tombstones[i];
                }
            }

            // Must run after structures are scanned and added to state.structureIds
            const rt = RepairTargetUtility.getRepairTargets(roomName, 0.8);
            for (let i = 0; i < rt.length; i++) {
                state.repairTargets[state.repairTargetCount++] = rt[i];
            }

            // Cache utility outputs for O(1) access by managers later in the tick
            const vd = DroppedResourceUtility.getDroppedEnergy(roomName);
            state.validDroppedEnergyCount = vd.length;
            for(let i=0; i<vd.length; i++) state.validDroppedEnergy[i] = vd[i];

            const ad = EnergySourceUtility.findAvailableDroppedEnergy(roomName);
            state.availableDroppedEnergyCount = ad.length;
            for(let i=0; i<ad.length; i++) state.availableDroppedEnergy[i] = ad[i];

            const ert = EnergySourceUtility.findEnergyInRuinsAndTombstones(roomName);
            state.energyInRuinsAndTombstonesCount = ert.length;
            for(let i=0; i<ert.length; i++) state.energyInRuinsAndTombstones[i] = ert[i];

            const hs = EnergySourceUtility.findHarvestableSources(roomName);
            state.harvestableSourceCount = hs.length;
            for(let i=0; i<hs.length; i++) state.harvestableSources[i] = hs[i];
    }
}

RoomStateScanner.createRoomStateTemplate = createRoomStateTemplate;
module.exports = RoomStateScanner;