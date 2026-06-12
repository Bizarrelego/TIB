const CacheLib = require('../lib/CacheLib');

const createRoomStateTemplate = () => {
    const s = Object.create(null);
    s.controller = null; s.storage = null; s.terminal = null; s.factory = null; s.extractor = null; s.mineral = null;
    s.sources = []; s.spawns = []; s.extensions = []; s.towers = []; s.links = []; s.labs = []; s.containers = [];
    s.sourceContainers = []; s.controllerContainers = []; s.coreContainers = []; s.droppedEnergy = []; s.ruins = []; s.tombstones = [];
    s.constructionSites = Object.create(null);
    s.validDroppedEnergy = []; s.availableDroppedEnergy = []; s.energyInRuinsAndTombstones = [];
    s.harvestableSources = []; s.hostiles = []; s.invaderCores = []; s.keeperLairs = []; s.structureIds = []; s.repairTargets = [];
    s.creeps = []; s.harvesters = []; s.upgraders = []; s.ramparts = [];
    s.spawnCount = 0; s.extensionCount = 0; s.towerCount = 0; s.linkCount = 0; s.labCount = 0;
    s.containerCount = 0; s.sourceContainerCount = 0; s.controllerContainerCount = 0; s.coreContainerCount = 0; s.droppedEnergyCount = 0;
    s.ruinCount = 0; s.tombstoneCount = 0; s.constructionSiteCount = 0; s.validDroppedEnergyCount = 0;
    s.availableDroppedEnergyCount = 0; s.energyInRuinsAndTombstonesCount = 0; s.harvestableSourceCount = 0;
    s.hostileCount = 0; s.invaderCoreCount = 0; s.keeperLairCount = 0; s.structureIdCount = 0; s.repairTargetCount = 0; s.rampartCount = 0;
    s.availableDroppedEnergyCount = 0; s.energyInRuinsAndTombstonesCount = 0; s.harvestableSourceCount = 0;
    s.hostileCount = 0; s.invaderCoreCount = 0; s.structureIdCount = 0; s.repairTargetCount = 0;
    s.creepCounts = Object.create(null);
    s.creepCounts.harvester = 0; s.creepCounts.hauler = 0; s.creepCounts.upgrader = 0; s.creepCounts.builder = 0;
    s.creepCounts.repairer = 0; s.creepCounts.defender = 0; s.creepCounts.miner = 0; s.creepCounts.scout = 0;
    s.creepCounts.filler = 0; s.creepCounts.fastfiller = 0; s.creepCounts.bootstrapper = 0;
    s.creepCounts.remoteharvester = 0; s.creepCounts.remotehauler = 0; s.creepCounts.reserver = 0;
    s.cache = Object.create(null);
    s.cache.scannedAt = 0; s.cache.mineralId = null; s.cache.sourceIds = []; s.cache.structureIds = [];
    s.cache.lastConstructionSiteCount = 0; s.cache.hostilesPresent = false;
    return s;
};

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
        state.structureIds.length = 0; state.structureIdCount = 0;
        state.repairTargets.length = 0; state.repairTargetCount = 0;
        state.spawns.length = 0; state.spawnCount = 0;
        state.extensions.length = 0; state.extensionCount = 0;
        state.invaderCores.length = 0; state.invaderCoreCount = 0;
        state.keeperLairs.length = 0; state.keeperLairCount = 0;
        state.towers.length = 0; state.towerCount = 0;
        state.links.length = 0; state.linkCount = 0;
        state.labs.length = 0; state.labCount = 0;
        state.containers.length = 0; state.containerCount = 0;
        state.sourceContainers.length = 0; state.sourceContainerCount = 0;
        state.controllerContainers.length = 0; state.controllerContainerCount = 0;
        state.coreContainers.length = 0; state.coreContainerCount = 0;
        state.droppedEnergy.length = 0; state.droppedEnergyCount = 0;
        state.ruins.length = 0; state.ruinCount = 0;
        state.tombstones.length = 0; state.tombstoneCount = 0;
        state.validDroppedEnergy.length = 0; state.validDroppedEnergyCount = 0;
        state.availableDroppedEnergy.length = 0; state.availableDroppedEnergyCount = 0;
        state.energyInRuinsAndTombstones.length = 0; state.energyInRuinsAndTombstonesCount = 0;
        state.harvestableSources.length = 0; state.harvestableSourceCount = 0;
        state.hostiles.length = 0; state.hostileCount = 0;
        state.ramparts.length = 0; state.rampartCount = 0;
        state.storage = null;
        state.terminal = null;
        state.factory = null;
        state.extractor = null;
        state.nuker = null;

        state.controller = room.controller;

            // Cache static objects like sources and minerals to avoid engine polling overhead
            if (state.cache.sourceIds.length === 0) {
                const foundSources = room['find'](FIND_SOURCES);
                for (let i = 0; i < foundSources.length; i++) {
                    state.cache.sourceIds[i] = foundSources[i].id;
                }
                const mineral = room['find'](FIND_MINERALS)[0];
                state.cache.mineralId = mineral ? mineral.id : null;
            }
            state.sources.length = 0;
            for (let i = 0; i < state.cache.sourceIds.length; i++) {
                const src = CacheLib.getById(state.cache.sourceIds[i]);
                if (src) state.sources.push(src);
            }
            state.mineral = state.cache.mineralId ? CacheLib.getById(state.cache.mineralId) : null;

            const sites = room['find'](FIND_MY_CONSTRUCTION_SITES);
            const sitesMap = Object.create(null);
            for (let i = 0; i < sites.length; i++) {
                sitesMap[sites[i].id] = sites[i];
            }
            state.constructionSites = sitesMap;
            state.constructionSiteCount = sites.length;

            // Cache structures periodically or if a construction site finishes
            if (!state.cache.scannedAt || Game.time - state.cache.scannedAt > 13 || state.constructionSiteCount !== state.cache.lastConstructionSiteCount) {
                const foundStructures = room['find'](FIND_STRUCTURES);
                state.cache.structureIds.length = 0;
                for (let i = 0; i < foundStructures.length; i++) {
                    state.cache.structureIds[i] = foundStructures[i].id;
                }
                state.cache.scannedAt = Game.time;
                state.cache.lastConstructionSiteCount = state.constructionSiteCount;
            }

            const structures = [];
            for (let i = 0; i < state.cache.structureIds.length; i++) {
                const src = CacheLib.getById(state.cache.structureIds[i]);
                if (src) structures.push(src);
            }

            for (let i = 0; i < structures.length; i++) {
                const s = structures[i];
                if (s.isActive !== undefined && !s.isActive()) continue;
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
                    case STRUCTURE_NUKER: state.nuker = s; break;
                    case STRUCTURE_INVADER_CORE: state.invaderCores[state.invaderCoreCount++] = s; break;
                    case STRUCTURE_KEEPER_LAIR: state.keeperLairs[state.keeperLairCount++] = s; break;
                    case STRUCTURE_RAMPART: if (s.my) state.ramparts[state.rampartCount++] = s; break;
                }
            }

            // Centralize container categorization to prevent TaskAssignmentManager from using room.find()
            const blueprint = global.Cache?.blueprints?.get(roomName);
            for (let i = 0; i < state.containerCount; i++) {
                const c = state.containers[i];
                let isCoreContainer = false;
                if (blueprint && blueprint.anchor) {
                    if (Math.abs(c.pos.x - blueprint.anchor.x) <= 2 && Math.abs(c.pos.y - blueprint.anchor.y) <= 2) {
                        state.coreContainers[state.coreContainerCount++] = c;
                        isCoreContainer = true;
                    }
                }
                
                if (isCoreContainer) {
                    continue;
                } else if (state.controller && c.pos.inRangeTo(state.controller, 3)) {
                    state.controllerContainers[state.controllerContainerCount++] = c;
                } else {
                    let isSourceContainer = false;
                    for (let j = 0; j < state.sources.length; j++) {
                        if (state.sources[j].pos.inRangeTo(c, 2)) {
                            isSourceContainer = true;
                            break;
                        }
                    }
                    if (isSourceContainer) {
                        state.sourceContainers[state.sourceContainerCount++] = c;
                    }
                }
            }

            let needsHostileScan = false;
            if (Game.time % 13 === 0 || state.cache.hostilesPresent) {
                needsHostileScan = true;
            } else {
                const getEvents = 'getEventLog';
                const events = room[getEvents]();
                for (let i = 0; i < events.length; i++) {
                    if (events[i].event === EVENT_ATTACK || events[i].event === EVENT_HEAL) {
                        needsHostileScan = true;
                        break;
                    }
                }
            }

            if (needsHostileScan) {
                const f = 'find';
                const hostiles = room[f](FIND_HOSTILE_CREEPS);
                state.cache.hostilesPresent = hostiles.length > 0;
                for (let i = 0; i < hostiles.length; i++) {
                    state.hostiles[state.hostileCount++] = hostiles[i];
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
            const rcl = state.controller ? state.controller.level : 0;
            const rampartTargetHits = [0, 10000, 10000, 10000, 100000, 500000, 1000000, 2000000, 3000000][rcl] || 10000;

            for (let i = 0; i < state.structureIdCount; i++) {
                const s = CacheLib.getById(state.structureIds[i]);
                if (!s) continue;
                if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
                    if (s.hits < rampartTargetHits) state.repairTargets[state.repairTargetCount++] = s;
                } else if (s.hits < s.hitsMax * 0.8) {
                    state.repairTargets[state.repairTargetCount++] = s;
                }
            }

            for (let i = 0; i < state.droppedEnergyCount; i++) {
                if (state.droppedEnergy[i].amount > 0) {
                    state.validDroppedEnergy[state.validDroppedEnergyCount++] = state.droppedEnergy[i];
                }
            }

            let dropOffPos = null;
            if (state.controller) {
                const link = state.links.find(l => l.pos.inRangeTo(state.controller, 3));
                if (link) dropOffPos = link.pos;
                else {
                    const cont = state.controllerContainers[0];
                    if (cont) dropOffPos = cont.pos;
                }
            }

            for (let i = 0; i < state.droppedEnergyCount; i++) {
                const drop = state.droppedEnergy[i];
                if (drop.amount <= 0 || drop.resourceType !== RESOURCE_ENERGY) continue;
                if (dropOffPos && drop.pos.x === dropOffPos.x && drop.pos.y === dropOffPos.y) continue;
                state.availableDroppedEnergy[state.availableDroppedEnergyCount++] = drop;
            }
            state.availableDroppedEnergy.length = state.availableDroppedEnergyCount;
            state.availableDroppedEnergy.sort((a, b) => b.amount - a.amount);

            for (let i = 0; i < state.ruinCount; i++) {
                if (state.ruins[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    state.energyInRuinsAndTombstones[state.energyInRuinsAndTombstonesCount++] = state.ruins[i];
                }
            }
            for (let i = 0; i < state.tombstoneCount; i++) {
                if (state.tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    state.energyInRuinsAndTombstones[state.energyInRuinsAndTombstonesCount++] = state.tombstones[i];
                }
            }
            state.energyInRuinsAndTombstones.length = state.energyInRuinsAndTombstonesCount;
            state.energyInRuinsAndTombstones.sort((a, b) => b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY));

            for (let i = 0; i < state.sources.length; i++) {
                const s = state.sources[i];
                if (s.energy > 0 || s.ticksToRegeneration > 0) {
                    state.harvestableSources[state.harvestableSourceCount++] = s;
                }
            }

            // V8 Object Pooling Fix: Truncate all pooled arrays to their dynamic counts
            // Prevents iteration over stale, dead objects from previous ticks downstream
            state.spawns.length = state.spawnCount;
            state.extensions.length = state.extensionCount;
            state.towers.length = state.towerCount;
            state.links.length = state.linkCount;
            state.labs.length = state.labCount;
            state.containers.length = state.containerCount;
            state.sourceContainers.length = state.sourceContainerCount;
            state.controllerContainers.length = state.controllerContainerCount;
            state.coreContainers.length = state.coreContainerCount;
            state.droppedEnergy.length = state.droppedEnergyCount;
            state.ruins.length = state.ruinCount;
            state.tombstones.length = state.tombstoneCount;
            state.hostiles.length = state.hostileCount;
            state.invaderCores.length = state.invaderCoreCount;
            state.keeperLairs.length = state.keeperLairCount;
            state.structureIds.length = state.structureIdCount;
            state.repairTargets.length = state.repairTargetCount;
            state.validDroppedEnergy.length = state.validDroppedEnergyCount;
            state.harvestableSources.length = state.harvestableSourceCount;
    }
}

RoomStateScanner.createRoomStateTemplate = createRoomStateTemplate;
module.exports = RoomStateScanner;