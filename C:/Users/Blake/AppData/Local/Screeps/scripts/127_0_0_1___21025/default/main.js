'use strict';

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var main$1 = {};

var ActionConstants_1;
var hasRequiredActionConstants;

function requireActionConstants () {
	if (hasRequiredActionConstants) return ActionConstants_1;
	hasRequiredActionConstants = 1;
	const ActionConstants = {
	    ACTION_IDLE: 'idle',
	    ACTION_HARVEST: 'harvest',
	    ACTION_UPGRADE: 'upgrade',
	    ACTION_TRANSFER: 'transfer',
	    ACTION_PICKUP: 'pickup',
	    ACTION_WITHDRAW: 'withdraw',
	    ACTION_BUILD: 'build',
	    ACTION_REPAIR: 'repair',
	    ACTION_DROP: 'drop',
	    ACTION_SCOUT: 'scout',
	    ACTION_MOVE_ROOM: 'move_room',
	    ACTION_ATTACK: 'attack',
	    ACTION_RANGED_ATTACK: 'rangedAttack',
	    ACTION_HEAL: 'heal',
	    ACTION_FLEE: 'flee',
	    ACTION_PATROL: 'patrol',
	    ACTION_RESERVE: 'reserve',
	    ACTION_CLAIM: 'claim',
	    ACTION_ATTACK_CONTROLLER: 'attackController',
	    ACTION_TRANSFER_ENERGY: 'transferEnergy',
	    ACTION_RUN_REACTION: 'runReaction',
	    ACTION_USE_POWER: 'usePower',
	    ACTION_RENEW: 'renew',
	    ACTION_ENABLE_ROOM: 'enableRoom'
	};

	ActionConstants_1 = ActionConstants;
	return ActionConstants_1;
}

var CacheLib_1;
var hasRequiredCacheLib;

function requireCacheLib () {
	if (hasRequiredCacheLib) return CacheLib_1;
	hasRequiredCacheLib = 1;
	const ActionConstants = requireActionConstants();

	/**
	 * V8 Optimized Monomorphic Creep Heap
	 */
	class CreepHeap {
	    constructor() {
	        this.state = 'idle';
	        this.targetId = null;
	        this.actionIntent = ActionConstants.ACTION_IDLE;
	        this.harvestPosition = null;
	        this.sleepUntil = 0;
	        this.sitTargetId = null;
	        this.secondaryTargetId = null;
	        this.waypointPos = null;
	        this.waypointIndex = 0;
	        this.destination = null;
	        this.fleePos = null;
	        this.tooClose = false;
	        this.targetRoom = null;
	        this.unreachableTargetId = null;
	        this.visitedRooms = [];
	    }
	}

	const objectCache = new Map();
	let cacheTick = 0;

	class CacheLib {
	    static getById(id) {
	        if (!id || typeof id !== 'string') return null;
	        if (Game.time !== cacheTick) {
	            objectCache.clear();
	            cacheTick = Game.time;
	        }
	        if (objectCache.has(id)) return objectCache.get(id);
	        const obj = Game.getObjectById(id);
	        objectCache.set(id, obj);
	        return obj;
	    }

	    static getDefaultHeap() {
	        return new CreepHeap();
	    }
	}

	CacheLib_1 = CacheLib;
	return CacheLib_1;
}

var RoomStateScanner_1;
var hasRequiredRoomStateScanner;

function requireRoomStateScanner () {
	if (hasRequiredRoomStateScanner) return RoomStateScanner_1;
	hasRequiredRoomStateScanner = 1;
	const CacheLib = requireCacheLib();

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
	        if (!commonjsGlobal.State) commonjsGlobal.State = { rooms: new Map() };

	        const roomName = room.name;

	        // V8 GC Optimization: Reuse state objects to avoid thrashing
	        let state = commonjsGlobal.State.rooms.get(roomName);
	        if (!state) {
	            state = createRoomStateTemplate();
	            commonjsGlobal.State.rooms.set(roomName, state);
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

	                // ALWAYS add to structureIds so CostMatrix and Repair tasks see it (even if inactive)
	                state.structureIds[state.structureIdCount++] = s.id;

	                // If it is inactive, do NOT add it to functional arrays (spawns, extensions, etc.)
	                if (s.isActive !== undefined && !s.isActive()) continue;

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
	            const blueprint = commonjsGlobal.Cache?.blueprints?.get(roomName);
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
	RoomStateScanner_1 = RoomStateScanner;
	return RoomStateScanner_1;
}

/**
 * The Colony abstraction aggregates state for an entire territory (a core room + outposts).
 * Improves data locality and architectural hierarchy by grouping core rooms with their dependent outposts.
 */

var Colony_1;
var hasRequiredColony;

function requireColony () {
	if (hasRequiredColony) return Colony_1;
	hasRequiredColony = 1;
	class Colony {
	    constructor(roomName) {
	        this.name = roomName;
	        // The array of outpost room names assigned to this colony
	        this.outposts = Memory.rooms[roomName]?.outposts || [];

	        // V8 Monomorphism: Plain arrays populated exactly once per tick by GlobalStateScanner
	        this.creeps = [];
	        this.creepsByRole = {};
	        this.sources = [];
	        this.constructionSites = [];
	    }

	    get coreRoom() {
	        return Game.rooms[this.name];
	    }
	}

	Colony_1 = Colony;
	return Colony_1;
}

var GlobalStateScanner;
var hasRequiredGlobalStateScanner;

function requireGlobalStateScanner () {
	if (hasRequiredGlobalStateScanner) return GlobalStateScanner;
	hasRequiredGlobalStateScanner = 1;
	const RoomStateScanner = requireRoomStateScanner();
	const Colony = requireColony();

	/**
	 * Module responsible for building the global state object by scanning rooms.
	 * Optimized for RCL 1-8 via Single-Pass Binning, V8 Monomorphism, and Object Reuse.
	 * @module GlobalStateScanner
	 */

	function run() {
	    if (!commonjsGlobal.State) commonjsGlobal.State = { rooms: new Map(), colonies: new Map() };
	    if (!commonjsGlobal.State.colonies) commonjsGlobal.State.colonies = new Map();

	    // Rebuild colonies every tick
	    commonjsGlobal.State.colonies.clear();

	    if (!commonjsGlobal.Cache) commonjsGlobal.Cache = {};
	    if (!commonjsGlobal.Cache.colonyInstances) commonjsGlobal.Cache.colonyInstances = new Map();

	    for (const roomName in Game.rooms) {
	        const room = Game.rooms[roomName];
	        if (room.controller && room.controller.my) {
	            const outposts = Memory.empire?.colonies?.[roomName]?.outposts || [];
	            let colony = commonjsGlobal.Cache.colonyInstances.get(roomName);

	            if (!colony) {
	                colony = new Colony(roomName);
	                commonjsGlobal.Cache.colonyInstances.set(roomName, colony);
	            } else {
	                colony.outposts = outposts;
	                // Clear the dynamic arrays that get repopulated every tick
	                colony.creeps.length = 0;
	                for (let key in colony.creepsByRole) colony.creepsByRole[key].length = 0;
	                colony.sources.length = 0;
	                colony.constructionSites.length = 0;
	            }

	            commonjsGlobal.State.colonies.set(roomName, colony);
	        }
	    }

	    // Clear creeps and creepCounts for all initialized rooms from the previous tick
	    for (const roomState of commonjsGlobal.State.rooms.values()) {
	        roomState.creeps.length = 0;
	        roomState.harvesters.length = 0;
	        roomState.upgraders.length = 0;
	        for (const role in roomState.creepCounts) {
	            roomState.creepCounts[role] = 0;
	        }
	    }

	    for (const creepName in Game.creeps) {
	        const creep = Game.creeps[creepName];
	        const roomName = creep.memory.room || creep.room.name;
	        const role = creep.memory.role;
	        const colonyName = creep.memory.colony || roomName;

	        let roomState = commonjsGlobal.State.rooms.get(roomName);
	        if (!roomState) {
	            roomState = RoomStateScanner.createRoomStateTemplate();
	            commonjsGlobal.State.rooms.set(roomName, roomState);
	        }

	        roomState.creeps.push(creep);
	        if (role === 'harvester') roomState.harvesters.push(creep);
	        if (role === 'upgrader') roomState.upgraders.push(creep);

	        if (role && roomState.creepCounts[role] !== undefined) {
	            // Pre-spawning: ignore creeps that are about to die so they are replaced seamlessly
	            if (creep.ticksToLive === undefined || creep.ticksToLive > 50) {
	                roomState.creepCounts[role]++;
	            }
	        }

	        // Single-Pass Binning for Colonies
	        const colony = commonjsGlobal.State.colonies.get(colonyName);
	        if (colony) {
	            colony.creeps.push(creep);
	            if (!colony.creepsByRole[role]) colony.creepsByRole[role] = [];
	            colony.creepsByRole[role].push(creep);
	        }
	    }

	    // Populate colony sources and construction sites
	    for (const colony of commonjsGlobal.State.colonies.values()) {
	        const coreState = commonjsGlobal.State.rooms.get(colony.name);
	        if (coreState) {
	            if (coreState.sources) colony.sources.push(...coreState.sources);
	            if (coreState.constructionSites) colony.constructionSites.push(...Object.values(coreState.constructionSites));
	        }

	        for (let i = 0; i < colony.outposts.length; i++) {
	            const outpostState = commonjsGlobal.State.rooms.get(colony.outposts[i]);
	            if (outpostState) {
	                if (outpostState.sources) colony.sources.push(...outpostState.sources);
	                if (outpostState.constructionSites) colony.constructionSites.push(...Object.values(outpostState.constructionSites));
	            }
	        }
	    }

	    // Single-pass mineral tracking for Empire economy and expansion
	    commonjsGlobal.State.empireMinerals = [];
	    for (const colony of commonjsGlobal.State.colonies.values()) {
	        const coreState = commonjsGlobal.State.rooms.get(colony.name);
	        if (coreState && coreState.mineral) {
	            const mineralType = coreState.mineral.mineralType;
	            if (!commonjsGlobal.State.empireMinerals.includes(mineralType)) {
	                commonjsGlobal.State.empireMinerals.push(mineralType);
	            }
	        }
	    }
	}

	GlobalStateScanner = {
	    run
	};
	return GlobalStateScanner;
}

var SystemLib;
var hasRequiredSystemLib;

function requireSystemLib () {
	if (hasRequiredSystemLib) return SystemLib;
	hasRequiredSystemLib = 1;
	// src/lib/SystemLib.js

	class Logger {
	    static info(message) { console.log(`[INFO] ${message}`); }
	    static warn(message) { console.log(`[WARN] ${message}`); }
	    static error(message) { console.log(`[ERROR] ${message}`); }
	    static debug(message) { console.log(`[DEBUG] ${message}`); }
	    static run() {}
	}

	class ErrorHandlingUtility {
	    static wrap(fn, context) {
	        return function (...args) {
	            try { return fn.apply(this, args); }
	            catch (error) {
	                const errorMessage = `Error in ${context}: ${error.message}\nStack: ${error.stack}`;
	                Logger.error(errorMessage);
	            }
	        };
	    }
	}

	const ProfilerUtility = {
	    enabled: false,
	    metrics: new Map(),
	    start: function () { if (this.enabled) this.metrics.clear(); },
	    end: function () { if (this.enabled) { Logger.debug(`Total CPU used this tick: ${Game.cpu.getUsed().toFixed(3)}`); } },
	    setEnabled: function (state) { this.enabled = state; },
	    wrap: function (fn, name) {
	        const profiler = this;
	        return function (...args) {
	            if (!profiler.enabled) return fn.apply(this, args);
	            const start = Game.cpu.getUsed();
	            const result = fn.apply(this, args);
	            const used = Game.cpu.getUsed() - start;
	            if (!profiler.metrics.has(name)) profiler.metrics.set(name, { calls: 0, totalCpu: 0 });
	            const data = profiler.metrics.get(name);
	            data.calls++; data.totalCpu += used;
	            return result;
	        };
	    },
	    report: function () {
	        if (!this.enabled || this.metrics.size === 0) return;
	        Logger.info('--- Profiler Report ---');
	        for (const [name, data] of this.metrics.entries()) {
	            Logger.info(`${name}: ${data.calls} calls, ${data.totalCpu.toFixed(3)} CPU total, ${(data.totalCpu / data.calls).toFixed(3)} CPU avg`);
	        }
	        Logger.info('-----------------------');
	        this.metrics.clear();
	    }
	};

	class StressTestUtility {
	    static run() {
	        if (!commonjsGlobal.State || !commonjsGlobal.State.rooms) return;
	        let mainRoom = null;
	        for (const [roomName, roomState] of commonjsGlobal.State.rooms) {
	            if (roomState.spawns && roomState.spawns.length > 0) { mainRoom = roomName; break; }
	        }
	        if (!mainRoom) return;

	        const roomState = commonjsGlobal.State.rooms.get(mainRoom);
	        const spawn = roomState.spawns[0];

	        if (Memory.stressTestCombat) {
	            if (!roomState.hostiles) roomState.hostiles = [];
	            for (let i = 0; i < 3; i++) {
	                roomState.hostiles.push({
	                    id: `mock_hostile_${i}`,
	                    pos: { x: spawn.pos.x + 3 + i, y: spawn.pos.y + 3 + i, roomName: mainRoom, getRangeTo: function (pos) { return Math.max(Math.abs(this.x - pos.x), Math.abs(this.y - pos.y)); } },
	                    body: [{ type: 'attack', hits: 100 }, { type: 'ranged_attack', hits: 100 }],
	                    hits: 1000, hitsMax: 1000, my: false, owner: { username: 'Invader' }
	                });
	            }
	        }

	        if (Memory.stressTestTraffic) {
	            let count = 0;
	            for (const creepName in Game.creeps) {
	                const creep = Game.creeps[creepName];
	                if (creep.room.name !== mainRoom) continue;
	                const role = creep.memory.role || '';
	                if (role === 'meleeCreep' || role === 'rangerCreep' || role === 'medicCreep') continue;
	                if (!creep.heap) continue;

	                creep.heap.targetId = null;
	                creep.heap.actionIntent = 'move';
	                creep.heap.destination = (count % 2 === 0) ? { x: 10, y: 10, roomName: mainRoom, range: 1 } : { x: 40, y: 40, roomName: mainRoom, range: 1 };
	                count++;
	            }
	        }
	    }
	}

	class RouteDistanceCalculator {
	    static getDistance(sourceId, sourcePos, colonyName) {
	        if (!Memory.sources) Memory.sources = {};
	        if (!Memory.sources[sourceId]) Memory.sources[sourceId] = {};

	        if (Memory.sources[sourceId].distance) {
	            return Memory.sources[sourceId].distance;
	        }

	        const roomState = commonjsGlobal.State?.rooms?.get(colonyName);
	        if (!roomState) return 25; // fallback

	        let targetPos = null;
	        if (roomState.storage) targetPos = roomState.storage.pos;
	        else if (roomState.spawns && roomState.spawns.length > 0) targetPos = roomState.spawns[0].pos;

	        if (!targetPos) return 25; // fallback

	        const fromPos = new RoomPosition(sourcePos.x, sourcePos.y, sourcePos.roomName || sourcePos.roomName);

	        const ret = PathFinder.search(fromPos, { pos: targetPos, range: 1 }, {
	            plainCost: 2,
	            swampCost: 10,
	            roomCallback: function(_roomName) {
	                // Return a flat matrix or let pathfinder use default costs
	                return new PathFinder.CostMatrix;
	            }
	        });

	        const distance = ret.path.length;
	        // Add a slight padding to the distance
	        Memory.sources[sourceId].distance = distance > 0 ? distance : 25;
	        return Memory.sources[sourceId].distance;
	    }
	}

	SystemLib = {
	    Logger,
	    ErrorHandlingUtility,
	    ProfilerUtility,
	    StressTestUtility,
	    RouteDistanceCalculator
	};
	return SystemLib;
}

var MathLib_1;
var hasRequiredMathLib;

function requireMathLib () {
	if (hasRequiredMathLib) return MathLib_1;
	hasRequiredMathLib = 1;
	// src/lib/MathLib.js

	class MathLib {
	    /**
	     * Hashes a string to a positive integer using djb2 algorithm.
	     * Optimized to avoid string allocations for V8.
	     */
	    static djb2Hash(str) {
	        if (!str) return 0;
	        const idString = String(str);
	        let hash = 5381;
	        for (let i = 0, len = idString.length; i < len; i++) {
	            hash = (hash * 33) ^ idString.charCodeAt(i);
	        }
	        return hash >>> 0;
	    }

	    /**
	     * Assigns a single target from a list based on a consistent hash of the creep's identifier.
	     */
	    static assignByHash(creepId, targetList) {
	        if (!Array.isArray(targetList) || targetList.length === 0) return null;
	        if (!creepId) return targetList[0];
	        const hash = MathLib.djb2Hash(creepId);
	        const index = hash % targetList.length;
	        return targetList[index];
	    }

	    static getRangeTo(pos1, pos2) {
	        if (!pos1 || !pos2) return Infinity;
	        if (pos1.roomName !== pos2.roomName) return Infinity;
	        return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
	    }

	    static getAdjacentPositions(pos) {
	        if (!pos) return [];
	        const adjacent = [];
	        for (let dx = -1; dx <= 1; dx++) {
	            for (let dy = -1; dy <= 1; dy++) {
	                if (dx === 0 && dy === 0) continue;
	                const x = pos.x + dx;
	                const y = pos.y + dy;
	                if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
	                    adjacent.push(new RoomPosition(x, y, pos.roomName));
	                }
	            }
	        }
	        return adjacent;
	    }

	    static serializePosition(pos) {
	        if (!pos) return null;
	        return `${pos.x}:${pos.y}:${pos.roomName}`;
	    }

	    static deserializePosition(str) {
	        if (!str || typeof str !== 'string') return null;
	        const parts = str.split(':');
	        if (parts.length !== 3) return null;
	        const x = parseInt(parts[0], 10);
	        const y = parseInt(parts[1], 10);
	        const roomName = parts[2];
	        if (isNaN(x) || isNaN(y) || !roomName) return null;
	        return new RoomPosition(x, y, roomName);
	    }
	}

	MathLib_1 = MathLib;
	return MathLib_1;
}

var TaskAssignmentManager_1;
var hasRequiredTaskAssignmentManager;

function requireTaskAssignmentManager () {
	if (hasRequiredTaskAssignmentManager) return TaskAssignmentManager_1;
	hasRequiredTaskAssignmentManager = 1;
	const ActionConstants = requireActionConstants();
	const CacheLib = requireCacheLib();
	const MathLib = requireMathLib();
	// Task assignment modules have been purged and merged natively.



	/**
	 * Top-Down, Heap-Driven Task Assignment Manager
	 * Optimized for strict Drop-Mining, Stationary Upgrading, and Distance-Weighted Hauling.
	 */
	class TaskAssignmentManager {
	    /**
	     * Centralized cross-room routing helper.
	     * Translates strategic targets into local waypoints for the TrafficManager.
	     */
	    static setMoveRoomIntent(creep, targetRoom) {
	        creep.memory.targetRoom = targetRoom;
	        creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;

	        let nextRoom = targetRoom;

	        // 1. Expansion Routing Override
	        if (Memory.empire && Memory.empire.colonizeRoom === targetRoom && Memory.empire.colonizeRoute) {
	            const route = Memory.empire.colonizeRoute;
	            const idx = route.indexOf(creep.room.name);
	            if (idx > -1 && idx < route.length - 1) {
	                nextRoom = route[idx + 1];
	            }
	        }
	        // 2. Universal Multi-Room Routing
	        else {
	            if (!creep.heap.route || creep.heap.routeTarget !== targetRoom) {
	                const route = Game.map.findRoute(creep.room.name, targetRoom, {
	                    routeCallback: (roomName) => {
	                        const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(roomName) : null;
	                        if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) return Infinity;

	                        const intel = Memory.rooms[roomName];
	                        if (intel) {
	                            if (intel.controller && intel.controller.owner && intel.controller.owner !== 'Bizarrelego') return 20;
	                            if (intel.roomType === 'center' || intel.roomType === 'keeper') return 10;
	                        }
	                        return 1;
	                    }
	                });

	                if (route !== ERR_NO_PATH && route.length > 0) {
	                    creep.heap.route = route.map(r => r.room);
	                    creep.heap.routeTarget = targetRoom;
	                } else {
	                    creep.heap.route = [];
	                    creep.heap.routeTarget = targetRoom;
	                }
	            }

	            if (creep.heap.route && creep.heap.route.length > 0) {
	                nextRoom = creep.heap.route[0];
	                // Advance the route when the creep enters the next room
	                if (creep.room.name === nextRoom) {
	                    creep.heap.route.shift();
	                    if (creep.heap.route.length > 0) {
	                        nextRoom = creep.heap.route[0];
	                    } else {
	                        nextRoom = targetRoom;
	                    }
	                }
	            }
	        }

	        // Generate localized destination for the TrafficManager
	        creep.heap.destination = { x: 25, y: 25, roomName: nextRoom, range: 22 };
	    }

	    static run(colony) {
	        if (!commonjsGlobal.creepHeap) commonjsGlobal.creepHeap = new Map();

	        // Ensure tick claims are reset exactly once per tick globally, not per colony
	        if (commonjsGlobal.tickClaimsTime !== Game.time) {
	            commonjsGlobal.tickClaims = new Map();
	            commonjsGlobal.tickClaimsTime = Game.time;
	        }

	        const creeps = colony.creeps;
	        for (let i = 0; i < creeps.length; i++) {
	            const creep = creeps[i];
	            if (creep.spawning) continue;

	            try {
	                // Scouts are managed exclusively by ScoutingManager — skip to prevent heap overwrite
	                const rawRole = creep.memory.role || '';
	                if (rawRole.toLowerCase() === 'scout') continue;

	                // The primary room state context is the room the creep is CURRENTLY in.
	                const roomName = creep.room.name;
	                const roomState = commonjsGlobal.State?.rooms?.get(roomName);
	                if (!roomState) continue;

	                let heap = commonjsGlobal.creepHeap.get(creep.name);
	                if (!heap) {
	                    heap = CacheLib.getDefaultHeap();
	                    commonjsGlobal.creepHeap.set(creep.name, heap);
	                }
	                creep.heap = heap;

	                if (Game.time < creep.heap.sleepUntil) continue;

	                TaskAssignmentManager.updateCreepState(creep);

	                if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE && creep.heap.actionIntent !== null) {
	                    TaskAssignmentManager.validateCurrentTask(creep);

	                    if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE) {
	                        TaskAssignmentManager.reregisterClaim(creep);
	                        continue;
	                    }
	                }

	                if (TaskAssignmentManager.checkCivilianFlee(creep, roomState)) {
	                    continue;
	                }

	                TaskAssignmentManager.assignTask(creep, roomState);
	            } catch (err) {
	                console.log(`[ERROR] TaskAssignmentManager crashed for creep ${creep.name}: ${err.message}\n${err.stack}`);
	            }
	        }
	    }

	    static reregisterClaim(creep) {
	        if (!creep.heap.targetId) return;
	        const target = CacheLib.getById(creep.heap.targetId);
	        if (!target) return;

	        const claimKey = `${creep.heap.targetId}_${creep.heap.state}`;
	        const currentClaim = commonjsGlobal.tickClaims.get(claimKey) || 0;

	        if (creep.heap.state === 'gather') {
	            commonjsGlobal.tickClaims.set(claimKey, currentClaim + creep.store.getFreeCapacity());
	        } else if (creep.heap.state === 'work' && (creep.heap.actionIntent === ActionConstants.ACTION_TRANSFER || creep.heap.actionIntent === ActionConstants.ACTION_BUILD)) {
	            commonjsGlobal.tickClaims.set(claimKey, currentClaim + creep.store.getUsedCapacity(RESOURCE_ENERGY));
	        }
	    }

	    static updateCreepState(creep) {
	        const role = creep.memory.role || '';

	        // Harvesters and Upgraders are stationary roles and do not use gather/work cycles
	        if (role === 'harvester' || role === 'upgrader' || role === 'remoteharvester') return;

	        const totalUsed = creep.store.getUsedCapacity();
	        const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);

	        if (!creep.heap.state || creep.heap.state === 'idle') {
	            // Force all worker creeps to completely empty before gathering again
	            if (totalUsed > 0) {
	                creep.heap.state = 'work';
	            } else {
	                creep.heap.state = 'gather';
	            }
	        }

	        if (creep.heap.state === 'gather' && free === 0) {
	            creep.heap.state = 'work';
	            creep.heap.targetId = null;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.unreachableTargetId = null;
	        } else if (creep.heap.state === 'work' && totalUsed === 0) {
	            creep.heap.state = 'gather';
	            creep.heap.targetId = null;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.unreachableTargetId = null;
	        }
	    }

	    static validateCurrentTask(creep) {
	        if (!creep.heap.targetId) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }
	        const target = CacheLib.getById(creep.heap.targetId);

	        if (!target) {
	            creep.heap.targetId = null;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        if (creep.heap.state === 'gather') {
	            if ((target.amount !== undefined && target.amount < 50) ||
	                (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) < 50) ||
	                (target.energy !== undefined && target.energy === 0)) {
	                creep.heap.targetId = null;
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        } else if (creep.heap.state === 'work') {
	            if (creep.store.getUsedCapacity() === 0 ||
	                (target.store && target.store.getFreeCapacity() === 0) ||
	                (creep.heap.actionIntent === ActionConstants.ACTION_UPGRADE && creep.memory.role !== 'upgrader')) {
	                creep.heap.targetId = null;
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        }
	    }

	    static checkCivilianFlee(creep, roomState) {
	        const role = (creep.memory.role || '').toLowerCase();
	        if (role === 'meleecreep' || role === 'rangercreep' || role === 'mediccreep' || role === 'defender') {
	            return false;
	        }

	        if (creep.room.name !== creep.memory.colony && Memory.rooms[creep.room.name] && Memory.rooms[creep.room.name].undefendable > Game.time) {
	            creep.memory.targetRoom = creep.memory.colony;
	            creep.heap.fleeGoals = null;
	            creep.heap.targetId = null;
	            creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.colony);
	            return true;
	        }

	        const hostiles = roomState.hostiles;
	        if (!hostiles || hostiles.length === 0) {
	            if (creep.heap.fleeGoals) creep.heap.fleeGoals = null;
	            return false;
	        }

	        // Check if the civilian is standing on a rampart. If so, they are safe and do not need to flee.
	        let onRampart = false;
	        if (roomState.ramparts) {
	            for (let i = 0; i < roomState.rampartCount; i++) {
	                const r = roomState.ramparts[i];
	                if (r.pos.x === creep.pos.x && r.pos.y === creep.pos.y) {
	                    onRampart = true;
	                    break;
	                }
	            }
	        }

	        if (onRampart) {
	            if (creep.heap.fleeGoals) creep.heap.fleeGoals = null;
	            return false;
	        }

	        let nearHostile = false;
	        const fleeGoals = [];
	        for (let i = 0; i < hostiles.length; i++) {
	            const h = hostiles[i];
	            if (Math.max(Math.abs(creep.pos.x - h.pos.x), Math.abs(creep.pos.y - h.pos.y)) <= 5) {
	                nearHostile = true;
	            }
	            fleeGoals.push({ pos: h.pos, range: 7 });
	        }

	        if (nearHostile) {
	            creep.heap.fleeGoals = fleeGoals;
	            creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
	            creep.heap.targetId = null;
	            creep.heap.state = 'fleeing';
	            return true;
	        }

	        if (creep.heap.fleeGoals) creep.heap.fleeGoals = null;
	        return false;
	    }

	    static assignTask(creep, roomState) {
	        const role = (creep.memory.role || '').toLowerCase();
	        // Military creeps are managed exclusively by MilitaryManager — skip to prevent heap overwrite
	        if (role === 'meleecreep' || role === 'rangercreep' || role === 'mediccreep') return;

	        // End-of-Life Task Abortion
	        // Prevents dying creeps from accepting new withdraw/harvest tasks, forcing them to dump their inventory into core storage before expiring.
	        if ((role === 'hauler' || role === 'filler' || role === 'upgrader' || role === 'builder') && creep.ticksToLive < 30) {
	            if (creep.store.getUsedCapacity() > 0) {
	                let dumpTarget = null;
	                if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) dumpTarget = roomState.storage;
	                else if (roomState.terminal && roomState.terminal.store.getFreeCapacity() > 0) dumpTarget = roomState.terminal;
	                else if (roomState.spawns && roomState.spawnCount > 0) {
	                    for(let i=0; i<roomState.spawnCount; i++) {
	                        if (roomState.spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) { dumpTarget = roomState.spawns[i]; break; }
	                    }
	                }

	                if (dumpTarget) {
	                    creep.heap.targetId = dumpTarget.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                } else {
	                    creep.heap.actionIntent = ActionConstants.ACTION_SUICIDE;
	                }
	                return;
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_SUICIDE;
	                return;
	            }
	        }
	        if (role === 'harvester') TaskAssignmentManager.assignHarvester(creep, roomState);
	        else if (role === 'hauler') TaskAssignmentManager.assignHauler(creep, roomState);
	        else if (role === 'builder') TaskAssignmentManager.assignBuilder(creep, roomState);
	        else if (role === 'pioneer') TaskAssignmentManager.assignPioneer(creep, roomState);
	        else if (role === 'bootstrapper') TaskAssignmentManager.assignBootstrapper(creep, roomState);
	        else if (role === 'upgrader') TaskAssignmentManager.assignUpgrader(creep, roomState);
	        else if (role === 'filler') TaskAssignmentManager.assignFiller(creep, roomState);
	        else if (role === 'fastfiller') TaskAssignmentManager.assignFastfiller(creep, roomState);
	        else if (role === 'remoteharvester') TaskAssignmentManager.assignRemoteHarvester(creep, roomState);
	        else if (role === 'remotehauler') TaskAssignmentManager.assignRemoteHauler(creep, roomState);
	        else if (role === 'reserver') TaskAssignmentManager.assignReserver(creep, roomState);
	        else if (role === 'defender') TaskAssignmentManager.assignDefender(creep, roomState);
	        else if (role === 'hubmanager') TaskAssignmentManager.assignHubManager(creep, roomState);
	        else if (role === 'mineralminer') TaskAssignmentManager.assignMineralMiner(creep, roomState);
	        else if (role === 'mineralhauler') TaskAssignmentManager.assignMineralHauler(creep, roomState);
	        else if (role === 'claimer') TaskAssignmentManager.assignClaimer(creep, roomState);
	        else if (role === 'scientist') TaskAssignmentManager.assignScientist(creep, roomState);
	        else if (role === 'remotebuilder') TaskAssignmentManager.assignRemoteBuilder(creep, roomState);
	        else if (role === 'skguard') TaskAssignmentManager.assignSKGuard(creep, roomState);
	        else if (role === 'skminer') TaskAssignmentManager.assignSKMiner(creep, roomState);
	        else if (role === 'skhauler') TaskAssignmentManager.assignSKHauler(creep, roomState);
	    }

	    static assignPioneer(creep, roomState) {
	        const targetRoom = Memory.empire?.colonizeRoom;
	        if (!targetRoom) {
	            // Expansion finished or aborted, act as builder
	            TaskAssignmentManager.assignBuilder(creep, roomState);
	            return;
	        }

	        if (creep.room.name !== targetRoom) {
	            creep.memory.targetRoom = targetRoom;
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            creep.heap.state = 'moving';
	            return;
	        }

	        // We are in the target room. Act as a bootstrapper.
	        TaskAssignmentManager.assignBootstrapper(creep, roomState);
	    }

	    static assignMineralMiner(creep, roomState) {
	        if (!roomState.mineral || roomState.mineral.mineralAmount === 0) {
	            if (creep.store.getUsedCapacity() > 0) {
	                creep.heap.state = 'work';
	                TaskAssignmentManager.assignHaulerWork(creep, roomState);
	                return;
	            }
	            if (roomState.mineral && roomState.mineral.ticksToRegeneration) {
	                creep.heap.sleepUntil = Game.time + roomState.mineral.ticksToRegeneration;
	            }
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        let minerContainer = null;
	        if (roomState.containers) {
	            for (let i = 0; i < roomState.containers.length; i++) {
	                const c = roomState.containers[i];
	                if (Math.max(Math.abs(c.pos.x - roomState.mineral.pos.x), Math.abs(c.pos.y - roomState.mineral.pos.y)) <= 1) {
	                    minerContainer = c;
	                    break;
	                }
	            }
	        }

	        if (minerContainer) {
	            if (creep.pos.x !== minerContainer.pos.x || creep.pos.y !== minerContainer.pos.y) {
	                creep.heap.destination = { x: minerContainer.pos.x, y: minerContainer.pos.y, roomName: creep.room.name, range: 0 };
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            } else {
	                creep.heap.targetId = roomState.mineral.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
	            }
	        } else {
	            if (Math.max(Math.abs(creep.pos.x - roomState.mineral.pos.x), Math.abs(creep.pos.y - roomState.mineral.pos.y)) > 1) {
	                creep.heap.destination = { x: roomState.mineral.pos.x, y: roomState.mineral.pos.y, roomName: creep.room.name, range: 1 };
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            } else {
	                creep.heap.targetId = roomState.mineral.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
	            }
	        }
	    }

	    static assignHubManager(creep, roomState) {
	        const terminal = roomState.terminal;
	        const storage = roomState.storage;

	        let hubLink = null;
	        if (roomState.links && storage) {
	            for (let i = 0; i < roomState.links.length; i++) {
	                if (roomState.links[i].pos.inRangeTo(storage, 2)) {
	                    hubLink = roomState.links[i];
	                    break;
	                }
	            }
	        }

	        if (!storage || !terminal || !hubLink) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        // Permanent sit target: Find a tile that is range 1 to storage, terminal, and hubLink
	        if (!creep.heap.sitPos) {
	            for (let dx = -1; dx <= 1; dx++) {
	                let found = false;
	                for (let dy = -1; dy <= 1; dy++) {
	                    const x = storage.pos.x + dx;
	                    const y = storage.pos.y + dy;
	                    if (Math.max(Math.abs(x - terminal.pos.x), Math.abs(y - terminal.pos.y)) <= 1 &&
	                        Math.max(Math.abs(x - hubLink.pos.x), Math.abs(y - hubLink.pos.y)) <= 1) {
	                        creep.heap.sitPos = { x, y, roomName: roomState.name || creep.room.name };
	                        found = true;
	                        break;
	                    }
	                }
	                if (found) break;
	            }
	        }

	        if (creep.heap.sitPos && (creep.pos.x !== creep.heap.sitPos.x || creep.pos.y !== creep.heap.sitPos.y)) {
	            creep.heap.destination = { x: creep.heap.sitPos.x, y: creep.heap.sitPos.y, roomName: creep.heap.sitPos.roomName, range: 0 };
	            creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
	            return;
	        }

	        // Science Logistics Variables
	        const scienceTarget = Memory.rooms[creep.memory.colony]?.scienceTarget;
	        let supplierLabs = [];
	        let reactorLabs = [];
	        if (scienceTarget && roomState.labs && roomState.labs.length >= 3) {
	            const blueprint = commonjsGlobal.Cache.blueprints?.get(creep.room.name);
	            if (blueprint && blueprint.supplierLabs) {
	                for (let i = 0; i < roomState.labs.length; i++) {
	                    const lab = roomState.labs[i];
	                    let isSupplier = false;
	                    for (let j = 0; j < blueprint.supplierLabs.length; j++) {
	                        const sup = blueprint.supplierLabs[j];
	                        if (lab.pos.x === sup.x && lab.pos.y === sup.y) {
	                            supplierLabs.push(lab);
	                            isSupplier = true;
	                            break;
	                        }
	                    }
	                    if (!isSupplier) reactorLabs.push(lab);
	                }
	            }
	        }

	        if (creep.heap.state === 'gather') {
	            // Priority 1: Extract synthesized compounds from Reactor Labs
	            if (scienceTarget && reactorLabs.length > 0) {
	                for (let i = 0; i < reactorLabs.length; i++) {
	                    const reactor = reactorLabs[i];
	                    if (reactor.store.getUsedCapacity(scienceTarget.target) >= 100) {
	                        creep.heap.targetId = reactor.id;
	                        creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                        // HACK: Store what we are grabbing so ActionExecutor pulls the right mineral
	                        creep.memory.withdrawResource = scienceTarget.target;
	                        return;
	                    }
	                }
	            }

	            // Priority 2: Load Supplier Labs with raw reactant minerals
	            if (scienceTarget && supplierLabs.length === 2) {
	                const sup1 = supplierLabs[0];
	                const sup2 = supplierLabs[1];

	                if (sup1.store.getUsedCapacity(scienceTarget.r1) < 1000 && terminal.store.getUsedCapacity(scienceTarget.r1) > 0) {
	                    creep.heap.targetId = terminal.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                    creep.memory.withdrawResource = scienceTarget.r1;
	                    return;
	                }
	                if (sup2.store.getUsedCapacity(scienceTarget.r2) < 1000 && terminal.store.getUsedCapacity(scienceTarget.r2) > 0) {
	                    creep.heap.targetId = terminal.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                    creep.memory.withdrawResource = scienceTarget.r2;
	                    return;
	                }
	            }

	            // Reset HACK if doing normal operations
	            creep.memory.withdrawResource = null;

	            // Priority 3: Empty Hub Link
	            if (hubLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.targetId = hubLink.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            // Priority 2: Storage -> Terminal if storage is overflowing (> 500k)
	            if (storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000 && terminal.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            // Priority 3: Terminal overflow -> Storage
	            if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 100000 && storage.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = terminal.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        } else {
	            // Work phase (we are holding energy or minerals)
	            const carriedTypes = Object.keys(creep.store).filter(r => creep.store[r] > 0);
	            const carriedType = carriedTypes.length > 0 ? carriedTypes[0] : RESOURCE_ENERGY;

	            // Priority 1: Lab Logistics (Transferring minerals)
	            if (scienceTarget && carriedType !== RESOURCE_ENERGY) {
	                if (carriedType === scienceTarget.target) {
	                    // Dump product into terminal
	                    creep.heap.targetId = terminal.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                    return;
	                } else if (carriedType === scienceTarget.r1 && supplierLabs.length === 2) {
	                    creep.heap.targetId = supplierLabs[0].id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                    return;
	                } else if (carriedType === scienceTarget.r2 && supplierLabs.length === 2) {
	                    creep.heap.targetId = supplierLabs[1].id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                    return;
	                }

	                // If we are holding random garbage minerals, dump to terminal
	                creep.heap.targetId = terminal.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return;
	            }

	            // Priority 2: Fill Terminal if we withdrew from Storage due to overflow
	            if (carriedType === RESOURCE_ENERGY && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000 && terminal.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = terminal.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return;
	            }

	            // Priority 3: Dump everything else into Storage
	            if (storage.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return;
	            }

	            // Fallback
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }
	    }

	    static assignMineralHauler(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            if (!roomState.mineral) {
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                return;
	            }

	            let targetContainer = null;
	            if (roomState.containers) {
	                for (let i = 0; i < roomState.containers.length; i++) {
	                    const c = roomState.containers[i];
	                    if (Math.max(Math.abs(c.pos.x - roomState.mineral.pos.x), Math.abs(c.pos.y - roomState.mineral.pos.y)) <= 1) {
	                        if (c.store.getUsedCapacity() - c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                            targetContainer = c;
	                            break;
	                        }
	                    }
	                }
	            }

	            if (targetContainer) {
	                creep.heap.targetId = targetContainer.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                // Since this is a generic withdraw, ActionExecutor will need to pull all non-energy resources.
	                // It will be handled automatically if ActionExecutor pulls the highest amount resource.
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        } else {
	            // Drop off in Terminal, fallback to Storage
	            const target = roomState.terminal || roomState.storage;
	            if (target && target.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = target.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        }
	    }

	    static assignClaimer(creep, _roomState) {
	        const targetRoom = Memory.empire?.colonizeRoom;
	        if (!targetRoom) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        if (creep.room.name !== targetRoom) {
	            creep.memory.targetRoom = targetRoom;
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            return;
	        }

	        const targetRoomState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	        if (targetRoomState && targetRoomState.controller) {
	            creep.heap.targetId = targetRoomState.controller.id;

	            const myUsername = Memory.empire ? Memory.empire.username : 'Bizarrelego';
	            const reservation = targetRoomState.controller.reservation;

	            if (reservation && reservation.username !== myUsername) {
	                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK_CONTROLLER;
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_CLAIM;
	            }
	        } else {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }
	    }

	    static assignScientist(creep, _roomState) {
	        // Skeleton logic for Scientist
	        if (creep.heap.state === 'gather') {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        } else {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }
	    }

	    static assignDefender(creep, homeState) {
	        // Priority 1: Defend home room
	        if (homeState.hostiles && homeState.hostiles.length > 0) {
	            if (creep.room.name !== creep.memory.colony) {
	                creep.memory.targetRoom = creep.memory.colony;
	                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	                return;
	            }
	            creep.heap.targetId = homeState.hostiles[0].id;
	            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	            return;
	        }

	        // Priority 2: Defend expansion room
	        if (Memory.empire && Memory.empire.colonizeRoom && Memory.empire.colonizeSourceColony === creep.memory.colony) {
	            const expState = commonjsGlobal.State.rooms.get(Memory.empire.colonizeRoom);
	            if (expState && expState.hostiles && expState.hostileCount > 0) {
	                if (creep.room.name !== Memory.empire.colonizeRoom) {
	                    creep.memory.targetRoom = Memory.empire.colonizeRoom;
	                    TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	                    return;
	                }
	                creep.heap.targetId = expState.hostiles[0].id;
	                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	                return;
	            }
	        }

	        // Priority 3: Defend outposts
	        const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	        for (let i = 0; i < outposts.length; i++) {
	            const outpostState = commonjsGlobal.State.rooms.get(outposts[i]);
	            if (outpostState && outpostState.hostiles && outpostState.hostileCount > 0) {
	                if (creep.room.name !== outposts[i]) {
	                    creep.memory.targetRoom = outposts[i];
	                    TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	                    return;
	                }
	                creep.heap.targetId = outpostState.hostiles[0].id;
	                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	                return;
	            }
	        }

	        // Priority 3: Park near spawn when idle
	        if (homeState.spawns && homeState.spawns.length > 0) {
	            const spawn = homeState.spawns[0];
	            creep.heap.waypointPos = { x: spawn.pos.x + 4, y: spawn.pos.y, roomName: creep.memory.colony };
	        }
	        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	    }

	    static getRemoteCensus() {
	        if (commonjsGlobal.remoteCensusTick !== Game.time) {
	            commonjsGlobal.remoteCensus = new Map();
	            commonjsGlobal.remoteCensusTick = Game.time;
	            for (const name in Game.creeps) {
	                const c = Game.creeps[name];
	                if (c.memory.targetRoom) {
	                    const key = `${c.memory.role}_${c.memory.colony}_${c.memory.targetRoom}`;
	                    commonjsGlobal.remoteCensus.set(key, (commonjsGlobal.remoteCensus.get(key) || 0) + 1);
	                }
	            }
	        }
	        return commonjsGlobal.remoteCensus;
	    }

	    static assignRemoteHarvester(creep, _homeState) {
	        if (!creep.memory.targetRoom || !creep.memory.targetSource) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        if (!creep.memory.targetId) {
	            creep.memory.targetId = creep.memory.targetSource;
	        }

	        if (creep.room.name !== creep.memory.targetRoom) {
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            return;
	        }

	        const roomState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	        if (!roomState) return;

	        TaskAssignmentManager.assignHarvester(creep, roomState);
	    }

	    static assignReserver(creep, _roomState) {
	        if (!creep.memory.targetRoom) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        if (creep.room.name !== creep.memory.targetRoom) {
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            return;
	        }

	        const targetRoomState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	        if (targetRoomState && targetRoomState.controller) {
	            creep.heap.targetId = targetRoomState.controller.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_RESERVE;
	        } else {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }
	    }

	    static assignRemoteBuilder(creep, homeState) {
	        if (!creep.memory.targetRoom) {
	            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	            if (outposts.length > 0) {
	                const census = TaskAssignmentManager.getRemoteCensus();
	                let bestRoom = outposts[0];
	                let minCount = Infinity;
	                for (let i = 0; i < outposts.length; i++) {
	                    const key = `remotebuilder_${creep.memory.colony}_${outposts[i]}`;
	                    const count = census.get(key) || 0;
	                    if (count < minCount) {
	                        minCount = count;
	                        bestRoom = outposts[i];
	                    }
	                }
	                creep.memory.targetRoom = bestRoom;
	            } else {
	                return;
	            }
	        }

	        if (creep.heap.state === 'gather') {
	            if (creep.room.name !== creep.memory.colony) {
	                creep.memory.targetRoom = creep.memory.colony; // Temporary override for gather
	                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	                return;
	            }
	            if (TaskAssignmentManager.getEnergy(creep, homeState, false)) return;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        // State: work
	        if (creep.room.name !== creep.memory.targetRoom) {
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            return;
	        }

	        const roomState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	        if (!roomState) return;

	        // Repair containers and roads
	        if (roomState.repairTargets?.length > 0) {
	            for (let i = 0; i < roomState.repairTargetCount; i++) {
	                const target = roomState.repairTargets[i];
	                if (target.hits < target.hitsMax * 0.5) {
	                    creep.heap.targetId = target.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
	                    return;
	                }
	            }
	        }

	        // Build sites
	        if (roomState.constructionSites && roomState.constructionSiteCount > 0) {
	            creep.heap.targetId = roomState.constructionSites[0].id;
	            creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
	            return;
	        }

	        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	    }

	    static assignRemoteHauler(creep, homeState) {
	        if (creep.heap.state === 'gather') {
	            if (!creep.memory.targetRoom) {
	                const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	                if (outposts.length > 0) {
	                    const census = TaskAssignmentManager.getRemoteCensus();
	                    let bestRoom = outposts[0];
	                    let minCount = Infinity;
	                    for (let i = 0; i < outposts.length; i++) {
	                        const key = `remoteHauler_${creep.memory.colony}_${outposts[i]}`;
	                        const count = census.get(key) || 0;
	                        if (count < minCount) {
	                            minCount = count;
	                            bestRoom = outposts[i];
	                        }
	                    }
	                    creep.memory.targetRoom = bestRoom;
	                } else {
	                    return;
	                }
	            }

	            // --- Tigga-Style Infrastructure Maintenance ---
	            creep.heap.opportunisticTarget = null;
	            if (creep.getActiveBodyparts(WORK) > 0 && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                const structures = creep.pos.lookFor(LOOK_STRUCTURES);
	                for (let i = 0; i < structures.length; i++) {
	                    const s = structures[i];
	                    if (s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax - 1000) {
	                        creep.heap.opportunisticTarget = s.id;
	                        break;
	                    }
	                }
	            }

	            if (creep.room.name !== creep.memory.targetRoom) {
	                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	                return;
	            }
	            const roomState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	            if (!roomState) return;

	            // Priority: Assigned Target Source
	            if (creep.memory.targetSource) {
	                const result = TaskAssignmentManager.getEnergyNearSource(creep, creep.memory.targetSource, roomState);
	                if (result) {
	                    creep.heap.targetId = result.target.id;
	                    creep.heap.actionIntent = result.intent;
	                    return;
	                }
	            }

	            let bestTarget = null;
	            let bestAmount = 0;
	            const drops = roomState.droppedEnergy || [];
	            for (let i = 0; i < drops.length; i++) {
	                const d = drops[i];
	                const claimKey = `${d.id}_gather`;
	                const claimed = commonjsGlobal.tickClaims.get(claimKey) || 0;
	                const available = d.amount - claimed;
	                if (available > bestAmount) {
	                    bestAmount = available;
	                    bestTarget = d;
	                }
	            }

	            if (bestTarget && bestAmount >= 25) {
	                const claimKey = `${bestTarget.id}_gather`;
	                commonjsGlobal.tickClaims.set(claimKey, (commonjsGlobal.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY));
	                creep.heap.targetId = bestTarget.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }

	            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && !bestTarget) {
	                creep.heap.state = 'work';
	                creep.heap.targetId = null;
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }

	        } else {
	            if (creep.room.name !== creep.memory.colony) {
	                // --- Tigga-Style Infrastructure Maintenance ---
	                creep.heap.opportunisticTarget = null;
	                if (creep.getActiveBodyparts(WORK) > 0 && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                    const structures = creep.pos.lookFor(LOOK_STRUCTURES);
	                    for (let i = 0; i < structures.length; i++) {
	                        const s = structures[i];
	                        if (s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax - 1000) {
	                            creep.heap.opportunisticTarget = s.id;
	                            break;
	                        }
	                    }
	                }

	                creep.memory.targetRoom = creep.memory.colony;
	                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	                return;
	            }
	            TaskAssignmentManager.assignHaulerWork(creep, homeState);
	        }
	    }

	    static assignSKHauler(creep, _roomState) {
	        // Functions identically to remote hauler, but targets SK rooms explicitly.
	        const homeState = commonjsGlobal.State?.rooms?.get(creep.memory.colony);
	        if (!homeState) return;

	        if (creep.heap.state === 'gather') {
	            if (!creep.memory.targetRoom) {
	                const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	                if (outposts.length > 0) {
	                    const census = TaskAssignmentManager.getRemoteCensus();
	                    let bestRoom = outposts[0];
	                    let minCount = Infinity;
	                    for (let i = 0; i < outposts.length; i++) {
	                        // Only target SK outposts
	                        if (Memory.rooms[outposts[i]]?.roomType !== 'sk') continue;

	                        const key = `skhauler_${creep.memory.colony}_${outposts[i]}`;
	                        const count = census.get(key) || 0;
	                        if (count < minCount) {
	                            minCount = count;
	                            bestRoom = outposts[i];
	                        }
	                    }
	                    if (minCount !== Infinity) {
	                        creep.memory.targetRoom = bestRoom;
	                    } else {
	                        return; // No SK outposts
	                    }
	                } else {
	                    return;
	                }
	            }
	            if (creep.room.name !== creep.memory.targetRoom) {
	                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	                return;
	            }
	            const localState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	            if (!localState) return;

	            // Priority: Assigned Target Source
	            if (creep.memory.targetSource) {
	                const result = TaskAssignmentManager.getEnergyNearSource(creep, creep.memory.targetSource, localState);
	                if (result) {
	                    creep.heap.targetId = result.target.id;
	                    creep.heap.actionIntent = result.intent;
	                    return;
	                }
	            }

	            let bestTarget = null;
	            let bestAmount = 0;
	            const drops = localState.droppedEnergy || [];
	            for (let i = 0; i < drops.length; i++) {
	                const d = drops[i];
	                const claimKey = `${d.id}_gather`;
	                const claimed = commonjsGlobal.tickClaims.get(claimKey) || 0;
	                const available = d.amount - claimed;
	                if (available > bestAmount) {
	                    bestAmount = available;
	                    bestTarget = d;
	                }
	            }

	            if (bestTarget && bestAmount >= 25) {
	                const claimKey = `${bestTarget.id}_gather`;
	                commonjsGlobal.tickClaims.set(claimKey, (commonjsGlobal.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY));
	                creep.heap.targetId = bestTarget.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }

	            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && !bestTarget) {
	                creep.heap.state = 'work';
	                creep.heap.targetId = null;
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        } else {
	            if (creep.room.name !== creep.memory.colony) {
	                creep.memory.targetRoom = creep.memory.colony;
	                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	                return;
	            }
	            TaskAssignmentManager.assignHaulerWork(creep, homeState);
	        }
	    }

	    static assignFastfiller(creep, roomState) {
	        const blueprint = commonjsGlobal.Cache?.blueprints?.get(creep.room.name);
	        if (!blueprint || !blueprint.anchor) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }
	        const ax = blueprint.anchor.x;
	        const ay = blueprint.anchor.y;

	        // 1. Calculate designated parking spot
	        if (!creep.memory.spotX) {
	            const spots = [
	                {x: ax - 1, y: ay - 1},
	                {x: ax + 1, y: ay - 1},
	                {x: ax - 1, y: ay + 1},
	                {x: ax + 1, y: ay + 1}
	            ];
	            for (let i = 0; i < spots.length; i++) {
	                const s = spots[i];
	                let occupied = false;
	                for (const name in Game.creeps) {
	                    const c = Game.creeps[name];
	                    if (c.memory.role === 'fastfiller' && c.name !== creep.name) {
	                        if (c.memory.spotX === s.x && c.memory.spotY === s.y) occupied = true;
	                    }
	                }
	                if (!occupied) {
	                    creep.memory.spotX = s.x;
	                    creep.memory.spotY = s.y;
	                    break;
	                }
	            }
	        }

	        const spotX = creep.memory.spotX;
	        const spotY = creep.memory.spotY;
	        if (!spotX) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        // 2. Navigate to parking spot exactly once
	        if (creep.pos.x !== spotX || creep.pos.y !== spotY) {
	            creep.heap.destination = { x: spotX, y: spotY, roomName: creep.room.name, range: 0 };
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        // 3. Static Execution Loop
	        let targetNeedsEnergy = null;

	        const checkStructure = (s) => {
	            if (s && Math.max(Math.abs(s.pos.x - spotX), Math.abs(s.pos.y - spotY)) <= 1) {
	                if (s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
	                    targetNeedsEnergy = s;
	                    return true;
	                }
	            }
	            return false;
	        };

	        for (let i = 0; i < roomState.spawnCount; i++) if (checkStructure(roomState.spawns[i])) break;
	        if (!targetNeedsEnergy) {
	            for (let i = 0; i < roomState.extensionCount; i++) if (checkStructure(roomState.extensions[i])) break;
	        }

	        if (targetNeedsEnergy) {
	            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.targetId = targetNeedsEnergy.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	            } else {
	                let source = null;
	                // Withdraw from adjacent Link, Storage, or Core Containers
	                if (roomState.links) {
	                    for (let i = 0; i < roomState.linkCount; i++) {
	                        const l = roomState.links[i];
	                        if (Math.max(Math.abs(l.pos.x - spotX), Math.abs(l.pos.y - spotY)) <= 1 && l.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                            source = l; break;
	                        }
	                    }
	                }
	                if (!source && roomState.storage && Math.max(Math.abs(roomState.storage.pos.x - spotX), Math.abs(roomState.storage.pos.y - spotY)) <= 1) {
	                    if (roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) source = roomState.storage;
	                }
	                if (!source && roomState.coreContainers) {
	                    for (let i = 0; i < roomState.coreContainerCount; i++) {
	                        const c = roomState.coreContainers[i];
	                        if (c && Math.max(Math.abs(c.pos.x - spotX), Math.abs(c.pos.y - spotY)) <= 1 && c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                            source = c; break;
	                        }
	                    }
	                }

	                if (source) {
	                    creep.heap.targetId = source.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                } else {
	                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                }
	            }
	        } else {
	            // Buffer empty capacity if there's nothing to fill
	            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
	                 let source = null;
	                 if (roomState.coreContainers) {
	                     for (let i = 0; i < roomState.coreContainerCount; i++) {
	                         const c = roomState.coreContainers[i];
	                         if (c && Math.max(Math.abs(c.pos.x - spotX), Math.abs(c.pos.y - spotY)) <= 1 && c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                             source = c; break;
	                         }
	                     }
	                 }
	                 if (source) {
	                     creep.heap.targetId = source.id;
	                     creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                     return;
	                 }
	            }
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }
	    }

	    static assignFiller(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            // Priority 0: Handle non-energy cargo first
	            if (creep.store.getUsedCapacity() > creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
	                if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) {
	                    creep.heap.targetId = roomState.storage.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                    return;
	                }
	                if (roomState.terminal && roomState.terminal.store.getFreeCapacity() > 0) {
	                    creep.heap.targetId = roomState.terminal.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                    return;
	                }
	            }

	            // Priority 0.5: Dropped energy (>50), Tombstones, Ruins
	            const scavenge = TaskAssignmentManager.findClosestEnergy(creep, roomState);
	            if (scavenge) {
	                creep.heap.targetId = scavenge.id;
	                creep.heap.actionIntent = scavenge.actionIntent;
	                return;
	            }

	            // Priority 1: Terminal excess (>60,000)
	            if (roomState.terminal && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 60000) {
	                creep.heap.targetId = roomState.terminal.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            // Priority 2: Containers
	            if (roomState.controllerContainers && roomState.controllerContainers.length > 0) {
	                for (let i = 0; i < roomState.controllerContainers.length; i++) {
	                    const c = roomState.controllerContainers[i];
	                    if (c.store.getUsedCapacity(RESOURCE_ENERGY) > 500) {
	                        creep.heap.targetId = c.id;
	                        creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                        return;
	                    }
	                }
	            }

	            // Priority 3: Storage
	            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.targetId = roomState.storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            // Priority 4: Terminal Fallback
	            if (roomState.terminal && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.targetId = roomState.terminal.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        } else {
	            // Priority 0: Critical Towers (< 600 energy)
	            if (roomState.towers) {
	                let criticalTower = null;
	                for (let i = 0; i < roomState.towerCount; i++) {
	                    const t = roomState.towers[i];
	                    if (t.store.getUsedCapacity(RESOURCE_ENERGY) < 600) {
	                        criticalTower = t;
	                        break;
	                    }
	                }
	                if (criticalTower) {
	                    creep.heap.targetId = criticalTower.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                    return;
	                }
	            }

	            // Priority 1 & 2: Spawns/Extensions, followed by Towers (>200 missing)
	            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState, true)) return;

	            // Priority 3: Labs
	            if (roomState.labs && roomState.labCount > 0) {
	                for (let i = 0; i < roomState.labCount; i++) {
	                    const l = roomState.labs[i];
	                    if (l.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
	                        creep.heap.targetId = l.id;
	                        creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                        return;
	                    }
	                }
	            }

	            // Priority 4: Nuker
	            if (roomState.nuker && roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 150000) {
	                if (roomState.nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
	                    creep.heap.targetId = roomState.nuker.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                    return;
	                }
	            }

	            // Priority 5: Balancing Terminal/Storage
	            if (roomState.terminal && roomState.terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 50000) {
	                if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
	                    creep.heap.targetId = roomState.terminal.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                    return;
	                }
	            }

	            // Priority 6: Storage Dump
	            if (roomState.storage && roomState.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.targetId = roomState.storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return;
	            }

	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }
	    }

	    // ─────────────────────────────────────────────────────────────────────────────
	    // NATIVE TASK MODULES
	    // ─────────────────────────────────────────────────────────────────────────────

	    static assignHarvester(creep, roomState) {
	        const sources = roomState.sources;
	        if (!sources || sources.length === 0) return;

	        // Lock source permanently to prevent target thrashing
	        if (!creep.memory.targetId) {
	            const counts = new Map();
	            for (const name in Game.creeps) {
	                const c = Game.creeps[name];
	                if (c.memory.role === 'harvester' && c.memory.colony === creep.memory.colony && c.memory.targetId) {
	                    counts.set(c.memory.targetId, (counts.get(c.memory.targetId) || 0) + 1);
	                }
	            }

	            let bestSource = sources[0];
	            let minCount = Infinity;
	            for (let i = 0; i < sources.length; i++) {
	                const count = counts.get(sources[i].id) || 0;
	                if (count < minCount) {
	                    minCount = count;
	                    bestSource = sources[i];
	                }
	            }
	            creep.memory.targetId = bestSource.id;
	        }

	        creep.heap.targetId = creep.memory.targetId;
	        creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;

	        const source = CacheLib.getById(creep.memory.targetId);
	        if (!source) return;

	        // Reduces CPU by deferring source evaluation for N ticks (O(1) savings per harvester)
	        if (source.energy === 0 && source.ticksToRegeneration) {
	            creep.heap.sleepUntil = Game.time + source.ticksToRegeneration;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        if (roomState.sourceContainers) {
	            for (let i = 0; i < roomState.sourceContainers.length; i++) {
	                const c = roomState.sourceContainers[i];
	                if (Math.max(Math.abs(c.pos.x - source.pos.x), Math.abs(c.pos.y - source.pos.y)) <= 2) {
	                    creep.heap.sitTargetId = c.id;
	                    break;
	                }
	            }
	        }

	        if (creep.heap.sitTargetId) {
	            const container = CacheLib.getById(creep.heap.sitTargetId);
	            if (container && (creep.pos.x !== container.pos.x || creep.pos.y !== container.pos.y || creep.pos.roomName !== container.pos.roomName)) {
	                creep.heap.destination = { x: container.pos.x, y: container.pos.y, roomName: container.pos.roomName, range: 0 };
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        }
	    }

	    static routeToCoreStructures(creep, roomState, includeTowers = true) {
	        let bestTarget = null;
	        let bestScore = -1;

	        const evaluateTarget = (target) => {
	            if (!target || !target.store) return;
	            if (target.isActive !== undefined && !target.isActive()) return;

	            const freeCapacity = target.store.getFreeCapacity(RESOURCE_ENERGY);
	            if (freeCapacity === 0) return;

	            const claimed = target.__deliveryClaimed || 0;
	            const remainingSpace = freeCapacity - claimed;
	            if (remainingSpace <= 0) return;

	            const dx = creep.pos.x - target.pos.x;
	            const dy = creep.pos.y - target.pos.y;
	            const distance = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
	            // Weight by remaining space so haulers prefer emptier targets
	            const score = remainingSpace * 100 / distance;

	            if (score > bestScore) {
	                bestScore = score;
	                bestTarget = target;
	            }
	        };

	        // Pass 1: Spawns and Extensions (Absolute Core Priority)
	        roomState.spawns?.forEach(evaluateTarget);
	        roomState.extensions?.forEach(evaluateTarget);

	        if (bestTarget) {
	            bestTarget.__deliveryClaimed = (bestTarget.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
	            creep.heap.targetId = bestTarget.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	            return true;
	        }

	        // Pass 2: Towers (Secondary Core Priority)
	        if (includeTowers) {
	            roomState.towers?.forEach(t => {
	                // Only fill towers if they are missing > 200 energy
	                if (t.store.getFreeCapacity(RESOURCE_ENERGY) >= 200) evaluateTarget(t);
	            });

	            if (bestTarget) {
	                bestTarget.__deliveryClaimed = (bestTarget.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
	                creep.heap.targetId = bestTarget.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return true;
	            }
	        }

	        return false;
	    }

	    static assignUpgrader(creep, roomState) {
	        if (!roomState.controller) return;

	        // Find the planned container tile
	        const blueprint = commonjsGlobal.Cache?.blueprints?.get(creep.room.name);
	        let containerTile = null;
	        if (blueprint && blueprint.containers) {
	            for (let i = 0; i < blueprint.containers.length; i++) {
	                const tile = blueprint.containers[i];
	                if (Math.abs(tile.x - roomState.controller.pos.x) <= 3 && Math.abs(tile.y - roomState.controller.pos.y) <= 3) {
	                    containerTile = tile;
	                    break;
	                }
	            }
	        }

	        const focusPos = containerTile ? { x: containerTile.x, y: containerTile.y, roomName: creep.room.name } : roomState.controller.pos;
	        const focusRange = containerTile ? 1 : 3;

	        // Emergency Downgrade Protocol: If starving and about to downgrade, allow the upgrader to scavenge globally instead of waiting at the hub
	        const isEmergency = roomState.controller.ticksToDowngrade < 20000;
	        const needsEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0;

	        if (isEmergency && needsEnergy) {
	            const scavenge = TaskAssignmentManager.findClosestEnergy(creep, roomState);
	            if (scavenge) {
	                creep.heap.targetId = scavenge.id;
	                creep.heap.actionIntent = scavenge.actionIntent;
	                creep.heap.destination = null; // Free it from focusPos restriction
	                return;
	            }
	        }

	        // Fixes upgrader spawn paralysis by enforcing strict physical routing to the controller hub before attempting to execute work intents.
	        if (Math.max(Math.abs(creep.pos.x - focusPos.x), Math.abs(creep.pos.y - focusPos.y)) > focusRange) {
	            creep.heap.destination = { x: focusPos.x, y: focusPos.y, roomName: focusPos.roomName, range: focusRange };
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        // Opportunistic Pickup: If energy is dropped perfectly adjacent, snatch it while upgrading!
	        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
	            let found = false;
	            for (let i = 0; i < roomState.droppedEnergy.length; i++) {
	                const d = roomState.droppedEnergy[i];
	                if (Math.max(Math.abs(creep.pos.x - d.pos.x), Math.abs(creep.pos.y - d.pos.y)) <= 1) {
	                    creep.heap.secondaryTargetId = d.id;
	                    creep.heap.secondaryIntent = ActionConstants.ACTION_PICKUP;
	                    found = true;
	                    break;
	                }
	            }
	            if (!found) {
	                creep.heap.secondaryTargetId = null;
	                creep.heap.secondaryIntent = null;
	            }
	        } else {
	            creep.heap.secondaryTargetId = null;
	            creep.heap.secondaryIntent = null;
	        }

	        // If the upgrader needs energy, issue a gather intent first
	        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
	            // Priority 0: Withdraw from adjacent link
	            if (roomState.links) {
	                for (let i = 0; i < roomState.links.length; i++) {
	                    const link = roomState.links[i];
	                    if (Math.max(Math.abs(link.pos.x - creep.pos.x), Math.abs(link.pos.y - creep.pos.y)) <= 1 && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                        creep.heap.targetId = link.id;
	                        creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                        return;
	                    }
	                }
	            }

	            // Priority 1: Withdraw from controller container
	            if (roomState.controllerContainers && roomState.controllerContainers.length > 0) {
	                const c = roomState.controllerContainers[0];
	                if (c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                    creep.heap.targetId = c.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                    return;
	                }
	            }
	            // Priority 2: Pickup adjacent dropped energy
	            if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
	                for (let i = 0; i < roomState.droppedEnergy.length; i++) {
	                    const d = roomState.droppedEnergy[i];
	                    if (Math.max(Math.abs(creep.pos.x - d.pos.x), Math.abs(creep.pos.y - d.pos.y)) <= 3) {
	                        creep.heap.targetId = d.id;
	                        creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
	                        return;
	                    }
	                }
	            }
	        }

	        // Emergency Base Relocation Protocol: If there are no spawns, but a spawn construction site exists, Upgraders become Builders
	        if ((!roomState.spawns || roomState.spawns.length === 0) && roomState.constructionSites) {
	            const sites = Object.values(roomState.constructionSites);
	            for (let i = 0; i < sites.length; i++) {
	                if (sites[i].structureType === STRUCTURE_SPAWN) {
	                    creep.heap.targetId = sites[i].id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
	                    return;
	                }
	            }
	        }

	        // Issue upgrade intent
	        creep.heap.targetId = roomState.controller.id;
	        creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
	    }

	    static findClosestEnergy(creep, roomState) {
	        let bestTarget = null;
	        let bestDist = Infinity;
	        let bestIntent = null;

	        // Check dropped energy
	        if (roomState.droppedEnergy) {
	            for (let i = 0; i < roomState.droppedEnergy.length; i++) {
	                const drop = roomState.droppedEnergy[i];
	                if (drop.amount < 30) continue;
	                const claimed = drop.__gatherClaimed || 0;
	                if (drop.amount - claimed < 30) continue;
	                const dx = Math.abs(creep.pos.x - drop.pos.x);
	                const dy = Math.abs(creep.pos.y - drop.pos.y);
	                const dist = Math.max(dx, dy);
	                if (dist < bestDist) {
	                    bestDist = dist;
	                    bestTarget = drop;
	                    bestIntent = ActionConstants.ACTION_PICKUP;
	                }
	            }
	        }

	        // (Spawn withdrawal block removed to prevent infinite filler loops and protect core spawning infrastructure)

	        // Check Storage
	        if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	            const dx = Math.abs(creep.pos.x - roomState.storage.pos.x);
	            const dy = Math.abs(creep.pos.y - roomState.storage.pos.y);
	            const dist = Math.max(dx, dy);
	            if (dist < bestDist) {
	                bestDist = dist;
	                bestTarget = roomState.storage;
	                bestIntent = ActionConstants.ACTION_WITHDRAW;
	            }
	        }

	        // Check Terminal
	        if (roomState.terminal && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	            const dx = Math.abs(creep.pos.x - roomState.terminal.pos.x);
	            const dy = Math.abs(creep.pos.y - roomState.terminal.pos.y);
	            const dist = Math.max(dx, dy);
	            if (dist < bestDist) {
	                bestDist = dist;
	                bestTarget = roomState.terminal;
	                bestIntent = ActionConstants.ACTION_WITHDRAW;
	            }
	        }

	        if (bestTarget) {
	            bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
	            return { id: bestTarget.id, actionIntent: bestIntent };
	        }
	        return null;
	    }

	    static getEnergyNearSource(creep, targetSourceId, roomState) {
	        let bestTarget = null;
	        let bestAmount = 0;
	        let intent = '';

	        const sourceObj = CacheLib.getById(targetSourceId);
	        if (!sourceObj) return null;

	        if (roomState.containers) {
	            for (let i = 0; i < roomState.containers.length; i++) {
	                const c = roomState.containers[i];
	                if (Math.max(Math.abs(c.pos.x - sourceObj.pos.x), Math.abs(c.pos.y - sourceObj.pos.y)) <= 2) {
	                    const amount = c.store.getUsedCapacity(RESOURCE_ENERGY);
	                    const claimKey = `${c.id}_gather`;
	                    const claimed = commonjsGlobal.tickClaims.get(claimKey) || 0;
	                    const available = amount - claimed;
	                    if (available > bestAmount && available >= Math.min(25, creep.store.getFreeCapacity())) {
	                        bestAmount = available;
	                        bestTarget = c;
	                        intent = ActionConstants.ACTION_WITHDRAW;
	                    }
	                }
	            }
	        }

	        if (roomState.droppedEnergy) {
	            for (let i = 0; i < roomState.droppedEnergy.length; i++) {
	                const d = roomState.droppedEnergy[i];
	                if (Math.max(Math.abs(d.pos.x - sourceObj.pos.x), Math.abs(d.pos.y - sourceObj.pos.y)) <= 2) {
	                    const claimKey = `${d.id}_gather`;
	                    const claimed = commonjsGlobal.tickClaims.get(claimKey) || 0;
	                    const available = d.amount - claimed;
	                    if (available > bestAmount && available >= 25) {
	                        bestAmount = available;
	                        bestTarget = d;
	                        intent = ActionConstants.ACTION_PICKUP;
	                    }
	                }
	            }
	        }

	        if (bestTarget) {
	            const claimKey = `${bestTarget.id}_gather`;
	            commonjsGlobal.tickClaims.set(claimKey, (commonjsGlobal.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity());
	            return { target: bestTarget, intent: intent };
	        }
	        return null;
	    }

	    static assignHauler(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            // Priority 0: Assigned Target Source
	            if (creep.memory.targetSource) {
	                const result = TaskAssignmentManager.getEnergyNearSource(creep, creep.memory.targetSource, roomState);
	                if (result) {
	                    creep.heap.targetId = result.target.id;
	                    creep.heap.actionIntent = result.intent;
	                    return;
	                }
	            }

	            // Priority 1: Scavenge from Ruins and Tombstones
	            let bestScavenge = null;
	            let bestScavengeScore = -1;

	            const evaluateScavenge = (target) => {
	                if (!target || !target.store || target.store.getUsedCapacity() === 0) return;
	                const amount = target.store.getUsedCapacity();
	                const claimKey = `${target.id}_gather`;
	                const claimed = commonjsGlobal.tickClaims.get(claimKey) || 0;
	                const remaining = amount - claimed;

	                if (remaining >= Math.min(25, creep.store.getFreeCapacity())) {
	                    const dist = Math.max(Math.abs(creep.pos.x - target.pos.x), Math.abs(creep.pos.y - target.pos.y)) || 1;
	                    const score = remaining / dist;
	                    if (score > bestScavengeScore) {
	                        bestScavengeScore = score;
	                        bestScavenge = target;
	                    }
	                }
	            };

	            if (roomState.ruins) {
	                for (let i = 0; i < roomState.ruins.length; i++) evaluateScavenge(roomState.ruins[i]);
	            }
	            if (roomState.tombstones) {
	                for (let i = 0; i < roomState.tombstones.length; i++) evaluateScavenge(roomState.tombstones[i]);
	            }

	            if (bestScavenge) {
	                const claimKey = `${bestScavenge.id}_gather`;
	                commonjsGlobal.tickClaims.set(claimKey, (commonjsGlobal.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity());
	                creep.heap.targetId = bestScavenge.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            // Priority 1.5: Withdraw from Containers (if they exist and have energy)
	            if (roomState.containers) {
	                let bestContainer = null;
	                let bestContainerScore = -1;
	                for (let i = 0; i < roomState.containers.length; i++) {
	                    const c = roomState.containers[i];
	                    // Skip if this is the controller's container (we only pull from source containers)
	                    if (roomState.controller && Math.max(Math.abs(c.pos.x - roomState.controller.pos.x), Math.abs(c.pos.y - roomState.controller.pos.y)) <= 3) continue;

	                    const amount = c.store.getUsedCapacity();
	                    const claimKey = `${c.id}_gather`;
	                    const claimed = commonjsGlobal.tickClaims.get(claimKey) || 0;
	                    const remaining = amount - claimed;

	                    if (remaining >= Math.min(25, creep.store.getFreeCapacity())) {
	                        const dist = Math.max(Math.abs(creep.pos.x - c.pos.x), Math.abs(creep.pos.y - c.pos.y)) || 1;
	                        const score = remaining / dist;
	                        if (score > bestContainerScore) {
	                            bestContainerScore = score;
	                            bestContainer = c;
	                        }
	                    }
	                }
	                if (bestContainer) {
	                    const claimKey = `${bestContainer.id}_gather`;
	                    commonjsGlobal.tickClaims.set(claimKey, (commonjsGlobal.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity());
	                    creep.heap.targetId = bestContainer.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                    return;
	                }
	            }

	            // Priority 2: Hashed assignment to specific harvester's drop zone
	            const harvesters = roomState.harvesters || [];
	            if (harvesters.length > 0) {
	                // djb2 hash for even distribution across harvesters
	                const targetHarvester = harvesters[MathLib.djb2Hash(creep.name) % harvesters.length];

	                // Find dropped energy near this specific harvester using fast Chebyshev distance
	                // Pick highest-amount drop for efficiency
	                let bestTarget = null;
	                let bestAmount = 0;
	                let intent = '';
	                const drops = roomState.droppedEnergy || [];

	                for (let i = 0; i < drops.length; i++) {
	                    const d = drops[i];
	                    // Skip drops near the controller (these are for upgraders/bootstrappers!)
	                    if (roomState.controller && Math.max(Math.abs(d.pos.x - roomState.controller.pos.x), Math.abs(d.pos.y - roomState.controller.pos.y)) <= 3) continue;

	                    if (Math.max(Math.abs(d.pos.x - targetHarvester.pos.x), Math.abs(d.pos.y - targetHarvester.pos.y)) <= 2) {
	                        const claimKey = `${d.id}_gather`;
	                        const claimed = commonjsGlobal.tickClaims.get(claimKey) || 0;
	                        const available = d.amount - claimed;
	                        if (available > bestAmount) {
	                            bestAmount = available;
	                            bestTarget = d;
	                            intent = ActionConstants.ACTION_PICKUP;
	                        }
	                    }
	                }

	                if (bestTarget && bestAmount >= 25) {
	                    const claimKey = `${bestTarget.id}_gather`;
	                    commonjsGlobal.tickClaims.set(claimKey, (commonjsGlobal.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity());
	                    creep.heap.targetId = bestTarget.id;
	                    creep.heap.actionIntent = intent;
	                    return;
	                }
	            }

	            // Priority 3: If hauler has partial energy, go deliver it instead of waiting
	            if (creep.store.getUsedCapacity() > 0) {
	                creep.heap.state = 'work';
	                TaskAssignmentManager.assignHaulerWork(creep, roomState);
	            }
	            // If truly empty and no targets: do nothing this tick, will retry next tick
	        } else {
	            TaskAssignmentManager.assignHaulerWork(creep, roomState);
	        }
	    }

	    static assignHaulerWork(creep, roomState) {
	        const totalUsed = creep.store.getUsedCapacity();
	        const energyUsed = creep.store.getUsedCapacity(RESOURCE_ENERGY);
	        const hasMinerals = totalUsed > energyUsed;

	        // Mineral Override: If carrying non-energy, bypass core structures and strictly dump into Storage/Terminal
	        if (hasMinerals) {
	            if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = roomState.storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return;
	            }
	            if (roomState.terminal && roomState.terminal.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = roomState.terminal.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return;
	            }
	            // Drop it near the controller if we have nowhere to put it
	            if (roomState.controller) {
	                creep.heap.targetId = roomState.controller.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_DROP;
	                return;
	            }
	        }

	        const fastfillerCount = (roomState.creepCounts && roomState.creepCounts['fastfiller']) ? roomState.creepCounts['fastfiller'] : 0;
	        const fillerCount = (roomState.creepCounts && roomState.creepCounts['filler']) ? roomState.creepCounts['filler'] : 0;
	        const hasActiveFiller = fastfillerCount > 0 || fillerCount > 0;

	        const hasCoreContainer = roomState.coreContainers && roomState.coreContainerCount > 0;
	        const hasStorage = roomState.storage && roomState.storage.store.getFreeCapacity() > 0;
	        const hasCentralDropoff = hasCoreContainer || hasStorage;

	        // Dynamic Logistics Fallback
	        if (!hasActiveFiller || !hasCentralDropoff) {
	            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState)) return;
	        }

	        // Pre-Storage Controller Delivery (RCL < 6 or no link)
	        if (roomState.controller) {
	            let controllerLink = null;
	            if (roomState.links) {
	                for (let i = 0; i < roomState.links.length; i++) {
	                    if (Math.max(Math.abs(roomState.links[i].pos.x - roomState.controller.pos.x), Math.abs(roomState.links[i].pos.y - roomState.controller.pos.y)) <= 3) {
	                        controllerLink = roomState.links[i];
	                        break;
	                    }
	                }
	            }

	            if (!controllerLink) {
	                let controllerContainer = null;
	                if (roomState.containers) {
	                    for (let i = 0; i < roomState.containers.length; i++) {
	                        const c = roomState.containers[i];
	                        if (Math.max(Math.abs(c.pos.x - roomState.controller.pos.x), Math.abs(c.pos.y - roomState.controller.pos.y)) <= 3) {
	                            controllerContainer = c;
	                            break;
	                        }
	                    }
	                }

	                if (controllerContainer) {
	                    if (controllerContainer.store.getUsedCapacity(RESOURCE_ENERGY) < 1500) {
	                        creep.heap.targetId = controllerContainer.id;
	                        creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                        return;
	                    }
	                } else {
	                    let droppedEnergyAmount = 0;
	                    if (roomState.droppedEnergy) {
	                        for (let i = 0; i < roomState.droppedEnergy.length; i++) {
	                            const d = roomState.droppedEnergy[i];
	                            if (Math.max(Math.abs(d.pos.x - roomState.controller.pos.x), Math.abs(d.pos.y - roomState.controller.pos.y)) <= 3) {
	                                droppedEnergyAmount += d.amount;
	                            }
	                        }
	                    }
	                    if (droppedEnergyAmount < 1000) {
	                        const blueprint = commonjsGlobal.Cache?.blueprints?.get(creep.room.name);
	                        let plannedContainerTile = null;
	                        if (blueprint && blueprint.containers) {
	                            for (let i = 0; i < blueprint.containers.length; i++) {
	                                const tile = blueprint.containers[i];
	                                if (Math.abs(tile.x - roomState.controller.pos.x) <= 3 && Math.abs(tile.y - roomState.controller.pos.y) <= 3) {
	                                    plannedContainerTile = tile;
	                                    break;
	                                }
	                            }
	                        }

	                        if (plannedContainerTile) {
	                            const distToTile = Math.max(Math.abs(creep.pos.x - plannedContainerTile.x), Math.abs(creep.pos.y - plannedContainerTile.y));
	                            if (distToTile > 1) {
	                                creep.heap.destination = { x: plannedContainerTile.x, y: plannedContainerTile.y, roomName: creep.room.name, range: 1 };
	                                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                                return;
	                            } else {
	                                creep.heap.targetId = roomState.controller.id;
	                                creep.heap.actionIntent = ActionConstants.ACTION_DROP;
	                                return;
	                            }
	                        } else {
	                            if (Math.max(Math.abs(creep.pos.x - roomState.controller.pos.x), Math.abs(creep.pos.y - roomState.controller.pos.y)) > 3) {
	                                creep.heap.destination = { x: roomState.controller.pos.x, y: roomState.controller.pos.y, roomName: creep.room.name, range: 3 };
	                                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                                return;
	                            } else {
	                                creep.heap.targetId = roomState.controller.id;
	                                creep.heap.actionIntent = ActionConstants.ACTION_DROP;
	                                return;
	                            }
	                        }
	                    }
	                }
	            }
	        }

	        // Priority 1: Dump in Storage if it exists
	        if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) {
	            creep.heap.targetId = roomState.storage.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	            return;
	        }

	        // Priority 1b: Dump in Core Containers if fastfillers are active
	        if (roomState.coreContainers && roomState.coreContainerCount > 0) {
	            let bestCore = null;
	            let bestFree = 0;
	            for (let i = 0; i < roomState.coreContainerCount; i++) {
	                const c = roomState.coreContainers[i];
	                if (c && c.store.getFreeCapacity() > bestFree) {
	                    bestFree = c.store.getFreeCapacity();
	                    bestCore = c;
	                }
	            }
	            if (bestCore) {
	                creep.heap.targetId = bestCore.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return;
	            }
	        }

	        // (Removed duplicate routeToCoreStructures check since it's handled by the Dynamic Logistics Fallback at Priority 1)

	        // If Storage is full, we should still drop at controller if needed as a last resort.
	        if (roomState.controller && roomState.storage && roomState.storage.store.getFreeCapacity() === 0) {
	            creep.heap.targetId = roomState.controller.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_DROP;
	        }
	    }

	    static assignBuilder(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            // Distance-aware energy source selection
	            const bestSource = TaskAssignmentManager.findClosestEnergy(creep, roomState);
	            if (bestSource) {
	                creep.heap.targetId = bestSource.id;
	                creep.heap.actionIntent = bestSource.actionIntent;
	                return;
	            }

	            // Nothing to gather but have some energy — go work
	            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.state = 'work';
	                TaskAssignmentManager.assignBuilderWork(creep, roomState);
	            }
	        } else {
	            TaskAssignmentManager.assignBuilderWork(creep, roomState);
	        }
	    }

	    static assignSKGuard(creep, roomState) {
	        if (!creep.memory.targetRoom) {
	            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	            if (outposts.length > 0) {
	                const census = TaskAssignmentManager.getRemoteCensus();
	                let bestRoom = outposts[0];
	                let minCount = Infinity;
	                for (let i = 0; i < outposts.length; i++) {
	                    if (Memory.rooms[outposts[i]]?.roomType !== 'sk') continue;
	                    const key = `skguard_${creep.memory.colony}_${outposts[i]}`;
	                    const count = census.get(key) || 0;
	                    if (count < minCount) {
	                        minCount = count;
	                        bestRoom = outposts[i];
	                    }
	                }
	                if (minCount !== Infinity) creep.memory.targetRoom = bestRoom;
	                else return;
	            } else return;
	        }

	        if (creep.room.name !== creep.memory.targetRoom) {
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            // Pre-heal while moving if damaged
	            if (creep.hits < creep.hitsMax) creep.heap.secondaryIntent = ActionConstants.ACTION_HEAL;
	            return;
	        }

	        // Inside the SK room
	        if (creep.hits < creep.hitsMax) {
	            creep.heap.secondaryIntent = ActionConstants.ACTION_HEAL; // self heal
	        }

	        // Priority 1: Hostiles (Invaders or actual players)
	        if (roomState.hostiles && roomState.hostiles.length > 0) {
	            let bestHostile = null;
	            let bestDist = Infinity;
	            for (let i = 0; i < roomState.hostiles.length; i++) {
	                const h = roomState.hostiles[i];
	                if (h.owner.username === 'Source Keeper') continue; // Prioritize real hostiles
	                const dist = Math.max(Math.abs(creep.pos.x - h.pos.x), Math.abs(creep.pos.y - h.pos.y));
	                if (dist < bestDist) {
	                    bestDist = dist;
	                    bestHostile = h;
	                }
	            }
	            if (bestHostile) {
	                creep.heap.targetId = bestHostile.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	                return;
	            }
	        }

	        // Priority 2: Source Keepers
	        if (roomState.hostiles && roomState.hostiles.length > 0) {
	            let bestKeeper = null;
	            let bestDist = Infinity;
	            for (let i = 0; i < roomState.hostiles.length; i++) {
	                const h = roomState.hostiles[i];
	                if (h.owner.username !== 'Source Keeper') continue;
	                const dist = Math.max(Math.abs(creep.pos.x - h.pos.x), Math.abs(creep.pos.y - h.pos.y));
	                if (dist < bestDist) {
	                    bestDist = dist;
	                    bestKeeper = h;
	                }
	            }
	            if (bestKeeper) {
	                creep.heap.targetId = bestKeeper.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	                return;
	            }
	        }

	        // Priority 3: Wait near the soonest-to-spawn Lair
	        const lairs = roomState.keeperLairs || [];
	        if (lairs.length > 0) {
	            let soonestLair = lairs[0];
	            for (let i = 1; i < lairs.length; i++) {
	                if (lairs[i].ticksToSpawn < soonestLair.ticksToSpawn) {
	                    soonestLair = lairs[i];
	                }
	            }
	            creep.heap.destination = { x: soonestLair.pos.x, y: soonestLair.pos.y, roomName: creep.room.name, range: 1 };
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        } else {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }
	    }

	    static assignSKMiner(creep, roomState) {
	        if (!creep.memory.targetRoom) {
	            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	            if (outposts.length > 0) {
	                const census = TaskAssignmentManager.getRemoteCensus();
	                let bestRoom = outposts[0];
	                let minCount = Infinity;
	                for (let i = 0; i < outposts.length; i++) {
	                    if (Memory.rooms[outposts[i]]?.roomType !== 'sk') continue;
	                    const key = `skminer_${creep.memory.colony}_${outposts[i]}`;
	                    const count = census.get(key) || 0;
	                    if (count < minCount) {
	                        minCount = count;
	                        bestRoom = outposts[i];
	                    }
	                }
	                if (minCount !== Infinity) creep.memory.targetRoom = bestRoom;
	                else return;
	            } else return;
	        }

	        if (creep.room.name !== creep.memory.targetRoom) {
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            return;
	        }

	        if (!creep.memory.targetSource) {
	            const sources = roomState.sources;
	            if (sources && sources.length > 0) {
	                const sourceIds = sources.map(s => s.id);
	                const assigned = TaskAssignmentManager.getAssignedSources('skminer', creep.room.name);
	                let bestSource = sourceIds[0];
	                let minAssigned = Infinity;

	                for (let i = 0; i < sourceIds.length; i++) {
	                    const count = assigned.get(sourceIds[i]) || 0;
	                    if (count < minAssigned) {
	                        minAssigned = count;
	                        bestSource = sourceIds[i];
	                    }
	                }
	                creep.memory.targetSource = bestSource;
	            }
	        }

	        if (creep.memory.targetSource) {
	            creep.heap.targetId = creep.memory.targetSource;
	            creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;

	            const source = CacheLib.getById(creep.memory.targetSource);
	            // Reduces CPU by deferring source evaluation for N ticks (O(1) savings per SKMiner)
	            if (source && source.energy === 0 && source.ticksToRegeneration) {
	                creep.heap.sleepUntil = Game.time + source.ticksToRegeneration;
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        }
	    }

	    static assignBuilderWork(creep, roomState) {
	        // Priority 0: Critical Decay Repair (Ramparts/Walls < 100,000 HP)
	        if (roomState.repairTargets?.length > 0) {
	            let emergencyTarget = null;
	            let emergencyDist = Infinity;
	            for (let i = 0; i < roomState.repairTargets.length; i++) {
	                const t = roomState.repairTargets[i];
	                if ((t.structureType === STRUCTURE_RAMPART || t.structureType === STRUCTURE_WALL) && t.hits < 100000) {
	                    const dx = Math.abs(creep.pos.x - t.pos.x);
	                    const dy = Math.abs(creep.pos.y - t.pos.y);
	                    const dist = Math.max(dx, dy);
	                    if (dist < emergencyDist) {
	                        emergencyDist = dist;
	                        emergencyTarget = t;
	                    }
	                }
	            }
	            if (emergencyTarget) {
	                creep.heap.targetId = emergencyTarget.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
	                return;
	            }
	        }

	        // Priority 1: Build construction sites — prefer nearly-complete ones
	        if (roomState.constructionSites) {
	            let bestSite = null;
	            let bestScore = -1;
	            for (const siteId in roomState.constructionSites) {
	                const s = CacheLib.getById(siteId) || roomState.constructionSites[siteId];
	                if (!s) continue;
	                const dx = Math.abs(creep.pos.x - s.pos.x);
	                const dy = Math.abs(creep.pos.y - s.pos.y);
	                const dist = Math.max(dx, dy) || 1;
	                // Progress ratio: higher = closer to completion
	                const progress = s.progressTotal > 0 ? s.progress / s.progressTotal : 0;
	                // Score: prefer nearby + nearly-complete sites
	                let score = (1 + progress * 3) * 100 / dist;

	                // Emergency override: Storage is absolute top priority
	                if (s.structureType === STRUCTURE_STORAGE) {
	                    score += 10000;
	                }
	                if (score > bestScore) {
	                    bestScore = score;
	                    bestSite = s;
	                }
	            }
	            if (bestSite) {
	                creep.heap.targetId = bestSite.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
	                return;
	            }
	        }

	        // Priority 2: Generic Repair (Decay maintenance)
	        if (roomState.repairTargets?.length > 0) {
	            let bestTarget = null;
	            let bestDist = Infinity;
	            for (let i = 0; i < roomState.repairTargets.length; i++) {
	                const t = roomState.repairTargets[i];
	                // Cap general repairs for walls/ramparts so builders don't get stuck forever
	                if ((t.structureType === STRUCTURE_WALL || t.structureType === STRUCTURE_RAMPART) && t.hits > 500000) continue;
	                if (t.hits >= t.hitsMax * 0.8) continue;

	                const dx = Math.abs(creep.pos.x - t.pos.x);
	                const dy = Math.abs(creep.pos.y - t.pos.y);
	                const dist = Math.max(dx, dy);
	                if (dist < bestDist) {
	                    bestDist = dist;
	                    bestTarget = t;
	                }
	            }
	            if (bestTarget) {
	                creep.heap.targetId = bestTarget.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
	                return;
	            }
	        }

	        // Fallback: Upgrade controller
	        if (roomState.controller) {
	            creep.heap.targetId = roomState.controller.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
	        }
	    }


	    /**
	     * Prevents economic cannibalism by forbidding workers from draining core spawning infrastructure.
	     * Hardened against drop-mining by forcing a strict state machine transition.
	     */
	    static assignBootstrapper(creep, roomState) {
	        // Anti-Drop-Mining Lock: Force transition the exact tick capacity is reached
	        if (creep.heap.state === 'gather' && creep.store.getFreeCapacity() === 0) {
	            creep.heap.state = 'work';
	            creep.heap.targetId = null;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }

	        if (creep.heap.state === 'gather') {
	            // Priority 1: Pull from Storage if available (fastest recovery)
	            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.targetId = roomState.storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            // Priority 2: Scavenge dropped energy/ruins (faster than mining)
	            const bestSource = TaskAssignmentManager.findClosestEnergy(creep, roomState);
	            if (bestSource) {
	                creep.heap.targetId = bestSource.id;
	                creep.heap.actionIntent = bestSource.actionIntent;
	                return;
	            }

	            // Fallback: Harvest directly from assigned source
	            if (roomState.sources && roomState.sources.length > 0) {
	                const targetSource = roomState.sources[MathLib.djb2Hash(creep.name) % roomState.sources.length];
	                creep.heap.targetId = targetSource.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
	                return;
	            }
	        } else {
	            // Priority 1: Controller Emergency
	            if (roomState.controller && roomState.controller.my && roomState.controller.ticksToDowngrade < 2000) {
	                creep.heap.targetId = roomState.controller.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
	                return;
	            }

	            // Priority 2: Fill Spawns/Extensions first to get real creeps spawning (ignore towers)
	            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState, false)) return;

	            // Priority 3: Critical Repairs (Structures < 50% or Walls/Ramparts < 5000)
	            if (roomState.repairTargets && roomState.repairTargets.length > 0) {
	                let bestRepair = null;
	                let bestRepairDist = Infinity;
	                for (let i = 0; i < roomState.repairTargets.length; i++) {
	                    const t = roomState.repairTargets[i];
	                    let isCritical = false;
	                    if (t.structureType === STRUCTURE_WALL || t.structureType === STRUCTURE_RAMPART) {
	                        if (t.hits < 5000) isCritical = true;
	                    } else if (t.hits < t.hitsMax * 0.5) {
	                        if (t.structureType === STRUCTURE_SPAWN || t.structureType === STRUCTURE_TOWER || t.structureType === STRUCTURE_EXTENSION) {
	                            isCritical = true;
	                        }
	                    }
	                    if (isCritical) {
	                        const dist = Math.max(Math.abs(creep.pos.x - t.pos.x), Math.abs(creep.pos.y - t.pos.y));
	                        if (dist < bestRepairDist) {
	                            bestRepairDist = dist;
	                            bestRepair = t;
	                        }
	                    }
	                }
	                if (bestRepair) {
	                    creep.heap.targetId = bestRepair.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
	                    return;
	                }
	            }

	            // Priority 4: Build critical structures (Spawns/Towers heavily prioritized)
	            if (roomState.constructionSites) {
	                let bestSite = null;
	                let bestScore = -1;
	                for (const siteId in roomState.constructionSites) {
	                    const s = CacheLib.getById(siteId) || roomState.constructionSites[siteId];
	                    if (!s) continue;
	                    let dist = Math.max(Math.abs(creep.pos.x - s.pos.x), Math.abs(creep.pos.y - s.pos.y)) || 1;

	                    // Massive artificial distance reduction for critical sites
	                    if (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_TOWER) {
	                        dist = dist * 0.1;
	                    }

	                    const score = 100 / dist;
	                    if (score > bestScore) {
	                        bestScore = score;
	                        bestSite = s;
	                    }
	                }
	                if (bestSite) {
	                    creep.heap.targetId = bestSite.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
	                    return;
	                }
	            }

	            // Fallback: Upgrade controller
	            if (roomState.controller) {
	                creep.heap.targetId = roomState.controller.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
	            }
	        }
	    }
	}

	TaskAssignmentManager_1 = TaskAssignmentManager;
	return TaskAssignmentManager_1;
}

var MilitaryManager_1;
var hasRequiredMilitaryManager;

function requireMilitaryManager () {
	if (hasRequiredMilitaryManager) return MilitaryManager_1;
	hasRequiredMilitaryManager = 1;
	const TaskAssignmentManager = requireTaskAssignmentManager();

	const ActionConstants = requireActionConstants();

	/**
	 * Military Brain — commands all combat creeps.
	 * Handles defensive squads, offensive squads, patrol duty, and aggressive zone targeting.
	 * Strictly reads from global.State. Writes ONLY to creep.heap and creep.memory.
	 */
	class MilitaryManager {
	    static run() {
	        if (!commonjsGlobal.State) return;

	        // Build/refresh aggressive zone target queue every 50 ticks
	        if (Game.time % 50 === 0) {
	            MilitaryManager.buildAggressiveZoneQueue();
	        }

	        for (const roomName in Game.rooms) {
	            const room = Game.rooms[roomName];
	            if (!room.controller || !room.controller.my) continue;
	            MilitaryManager.commandColony(room.name);
	        }
	    }

	    // ─────────────────────────────────────────────────────────────────────────────
	    // COLONY COMMAND LOOP
	    // ─────────────────────────────────────────────────────────────────────────────

	    static commandColony(colony) {
	        const homeState = commonjsGlobal.State.rooms.get(colony);
	        if (!homeState) return;

	        const homeHasHostiles = homeState.hostiles && homeState.hostiles.length > 0;

	        // Check outpost threats
	        let outpostThreatRoom = null;
	        const outposts = Memory.rooms[colony]?.outposts || [];
	        for (let i = 0; i < outposts.length; i++) {
	            MilitaryManager.assessOutpostViability(outposts[i]);
	            if (!homeHasHostiles) {
	                const oState = commonjsGlobal.State.rooms.get(outposts[i]);
	                if (oState && oState.hostiles && oState.hostiles.length > 0) {
	                    if (!outpostThreatRoom) outpostThreatRoom = outposts[i];
	                }
	            }
	        }

	        const hasThreat = homeHasHostiles || outpostThreatRoom !== null;

	        // Run once per room logic
	        let weAreStronger = true;
	        let primaryTarget = null;
	        if (homeHasHostiles) {
	            weAreStronger = MilitaryManager.evaluateStrength(homeState, colony);
	            primaryTarget = MilitaryManager.findPrimaryTarget(homeState);
	        } else if (outpostThreatRoom) {
	            const oState = commonjsGlobal.State.rooms.get(outpostThreatRoom);
	            weAreStronger = MilitaryManager.evaluateStrength(oState, colony);
	        }

	        // Global Defense Routing (Reinforcement Request)
	        if (hasThreat && !weAreStronger) {
	            const besiegedRoom = homeHasHostiles ? colony : outpostThreatRoom;
	            MilitaryManager.requestGlobalReinforcements(besiegedRoom, colony);
	        }

	        // --- Tigga-Style Quad Squad Formation ---
	        const medics = [];
	        const leaders = [];
	        for (const creepName in Game.creeps) {
	            const creep = Game.creeps[creepName];
	            if (creep.memory.colony !== colony || creep.spawning) continue;
	            if (creep.memory.role === 'medicCreep') medics.push(creep);
	            else if (creep.memory.role === 'meleeCreep' || creep.memory.role === 'rangerCreep') leaders.push(creep);
	        }

	        // Dynamically bind Medics to Leaders to form synchronized Squads
	        for (let i = 0; i < medics.length; i++) {
	            const medic = medics[i];
	            const leader = leaders[i % leaders.length];
	            if (leader) {
	                medic.heap.squadLeader = leader.name;
	            } else {
	                medic.heap.squadLeader = null;
	            }
	        }

	        // Command each military creep
	        for (const creepName in Game.creeps) {
	            const creep = Game.creeps[creepName];
	            if (creep.memory.colony !== colony) continue;

	            const role = creep.memory.role;
	            if (role !== 'meleeCreep' && role !== 'rangerCreep' && role !== 'medicCreep') continue;
	            if (creep.spawning) continue;

	            // Medics bound to a squad leader execute synchronized Snake logic
	            if (role === 'medicCreep' && creep.heap.squadLeader) {
	                const leader = Game.creeps[creep.heap.squadLeader];
	                MilitaryManager.assignQuadSnakeFollower(creep, leader);
	                continue;
	            }

	            if (hasThreat) {
	                // Defensive priority: home threats first, then outpost threats
	                if (homeHasHostiles) {
	                    MilitaryManager.assignDefensive(creep, homeState, colony, weAreStronger, primaryTarget);
	                } else {
	                    MilitaryManager.assignOutpostDefense(creep, outpostThreatRoom);
	                }
	            } else {
	                // Check if there are offensive targets queued
	                const queue = commonjsGlobal.State.militaryQueue;
	                if (queue && queue.length > 0) {
	                    MilitaryManager.assignOffensive(creep, queue[0].roomName, colony);
	                } else {
	                    MilitaryManager.assignPatrol(creep, homeState, colony);
	                }
	            }
	        }
	    }

	    // ─────────────────────────────────────────────────────────────────────────────
	    // DEFENSIVE ASSIGNMENT
	    // ─────────────────────────────────────────────────────────────────────────────

	    static assignDefensive(creep, homeState, colony, weAreStronger, primaryTarget) {
	        if (!primaryTarget) return;

	        let closestDist = Math.max(Math.abs(creep.pos.x - primaryTarget.pos.x), Math.abs(creep.pos.y - primaryTarget.pos.y));

	        const bestRampart = MilitaryManager.findBestRampart(creep, primaryTarget, homeState, weAreStronger);

	        const role = creep.memory.role;

	        if (role === 'meleeCreep') {
	            if (bestRampart) {
	                creep.heap.destination = { x: bestRampart.pos.x, y: bestRampart.pos.y, roomName: bestRampart.pos.roomName, range: 0 };
	            } else {
	                creep.heap.destination = { x: primaryTarget.pos.x, y: primaryTarget.pos.y, roomName: primaryTarget.pos.roomName, range: 1 };
	            }
	            creep.heap.targetId = primaryTarget.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	            creep.heap.state = 'combat';

	        } else if (role === 'rangerCreep') {
	            if (bestRampart) {
	                creep.heap.destination = { x: bestRampart.pos.x, y: bestRampart.pos.y, roomName: bestRampart.pos.roomName, range: 0 };
	                creep.heap.fleeGoals = null; // Do not kite if we are holding a bunker rampart
	            } else {
	                // Replaces naive 1-tile math with native TrafficManager flee pathfinding, allowing rangers to kite flawlessly around terrain.
	                if (closestDist <= 2) {
	                    creep.heap.fleeGoals = [{ pos: primaryTarget.pos, range: 3 }];
	                } else {
	                    creep.heap.fleeGoals = null;
	                    creep.heap.destination = { x: primaryTarget.pos.x, y: primaryTarget.pos.y, roomName: primaryTarget.pos.roomName, range: 3 };
	                }
	            }
	            creep.heap.targetId = primaryTarget.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
	            creep.heap.state = 'combat';

	        } else if (role === 'medicCreep') {
	            // Medics also seek a rampart if we are weaker, otherwise they just kite and follow.
	            let medicRampart = null;
	            if (!weAreStronger) {
	                medicRampart = MilitaryManager.findBestRampart(creep, primaryTarget, homeState, weAreStronger);
	            }

	            if (medicRampart) {
	                creep.heap.destination = { x: medicRampart.pos.x, y: medicRampart.pos.y, roomName: medicRampart.pos.roomName, range: 0 };
	                creep.heap.fleeGoals = null;
	            } else {
	                if (closestDist <= 2) {
	                    creep.heap.fleeGoals = [{ pos: primaryTarget.pos, range: 3 }];
	                } else {
	                    creep.heap.fleeGoals = null;
	                }
	            }

	            const healTarget = MilitaryManager.findMostDamagedAlly(colony, creep.room.name);
	            if (healTarget) {
	                creep.heap.targetId = healTarget.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
	                creep.heap.state = 'combat';
	            } else {
	                const melee = MilitaryManager.findAllyByRole(colony, 'meleeCreep', creep.room.name);
	                if (melee) {
	                    creep.heap.targetId = melee.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
	                    creep.heap.state = 'combat';
	                }
	            }
	        }
	    }

	    static requestGlobalReinforcements(besiegedRoom, requestingColony) {
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        let bestColony = null;
	        let bestDist = Infinity;

	        // Find closest RCL 7+ colony
	        for (const c of commonjsGlobal.State.colonies.values()) {
	            if (c.name === requestingColony) continue;

	            const cState = commonjsGlobal.State.rooms.get(c.name);
	            if (cState && cState.controller && cState.controller.level >= 7) {
	                const dist = Game.map.getRoomLinearDistance(c.name, besiegedRoom);
	                if (dist < bestDist) {
	                    bestDist = dist;
	                    bestColony = c;
	                }
	            }
	        }

	        if (bestColony) {
	            // Re-route idle defenders from the high-RCL colony
	            const creeps = bestColony.creeps;
	            for (let i = 0; i < creeps.length; i++) {
	                const c = creeps[i];
	                const role = c.memory.role;
	                if (role === 'meleeCreep' || role === 'rangerCreep' || role === 'medicCreep' || role === 'defender') {
	                    if (!c.spawning && c.heap && (!c.heap.state || c.heap.state === 'idle' || c.heap.state === 'patrol')) {
	                        // Reroute them globally
	                        c.memory.targetRoom = besiegedRoom;
	                        c.heap.state = 'moving';
	                        TaskAssignmentManager.setMoveRoomIntent(c, c.memory.targetRoom);
	                    }
	                }
	            }
	        }
	    }

	    static assignOutpostDefense(creep, targetRoom) {
	        if (creep.room.name !== targetRoom) {
	            creep.memory.targetRoom = targetRoom;
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            creep.heap.state = 'moving';
	            return;
	        }

	        const oState = commonjsGlobal.State.rooms.get(targetRoom);
	        if (!oState || !oState.hostiles || oState.hostiles.length === 0) {
	            creep.heap.state = 'idle';
	            return;
	        }

	        const hostiles = oState.hostiles;
	        let closestHostile = null;
	        let closestDist = Infinity;
	        for (let i = 0; i < hostiles.length; i++) {
	            const h = hostiles[i];
	            const d = Math.max(Math.abs(creep.pos.x - h.pos.x), Math.abs(creep.pos.y - h.pos.y));
	            if (d < closestDist) {
	                closestDist = d;
	                closestHostile = h;
	            }
	        }
	        if (!closestHostile) return;

	        if (creep.memory.role === 'meleeCreep') {
	            creep.heap.targetId = closestHostile.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	            creep.heap.state = 'combat';
	        } else if (creep.memory.role === 'rangerCreep') {
	            // Replaces naive 1-tile math with native TrafficManager flee pathfinding, allowing rangers to kite flawlessly around terrain.
	            if (closestDist <= 2) {
	                creep.heap.fleeGoals = [{ pos: closestHostile.pos, range: 3 }];
	            } else {
	                creep.heap.fleeGoals = null;
	                creep.heap.destination = { x: closestHostile.pos.x, y: closestHostile.pos.y, roomName: closestHostile.pos.roomName, range: 3 };
	            }
	            creep.heap.targetId = closestHostile.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
	            creep.heap.state = 'combat';
	        } else if (creep.memory.role === 'medicCreep') {
	            // Adds survival instincts to medics via fleeGoals, preventing them from blindly following melee creeps into danger.
	            if (closestDist <= 2) {
	                creep.heap.fleeGoals = [{ pos: closestHostile.pos, range: 3 }];
	            } else {
	                creep.heap.fleeGoals = null;
	            }

	            const healTarget = MilitaryManager.findMostDamagedAlly(creep.memory.colony, targetRoom);
	            if (healTarget) {
	                creep.heap.targetId = healTarget.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
	                creep.heap.state = 'combat';
	            } else {
	                const melee = MilitaryManager.findAllyByRole(creep.memory.colony, 'meleeCreep', targetRoom);
	                if (melee) {
	                    creep.heap.targetId = melee.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
	                    creep.heap.state = 'combat';
	                }
	            }
	        }
	    }

	    // ─────────────────────────────────────────────────────────────────────────────
	    // QUAD SQUAD SNAKE LOGIC
	    // ─────────────────────────────────────────────────────────────────────────────

	    static assignQuadSnakeFollower(creep, leader) {
	        if (!leader) {
	            creep.heap.squadLeader = null;
	            creep.heap.state = 'idle';
	            return;
	        }

	        let isMoving = false;
	        // Follow the leader
	        if (!creep.pos.isNearTo(leader.pos)) {
	            creep.heap.destination = { x: leader.pos.x, y: leader.pos.y, roomName: leader.pos.roomName, range: 1 };
	            creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
	            creep.heap.state = 'moving';
	            isMoving = true;
	        } else if (leader.room.name !== creep.room.name) {
	            creep.memory.targetRoom = leader.room.name;
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            creep.heap.state = 'moving';
	            isMoving = true;
	        }

	        // Cross-heal logic: heal the most damaged creep in the squad (leader or any follower)
	        const squad = [leader];
	        for (const name in Game.creeps) {
	            const c = Game.creeps[name];
	            if (c.memory.colony === creep.memory.colony && (c.name === creep.name || (c.heap && c.heap.squadLeader === leader.name))) {
	                squad.push(c);
	            }
	        }

	        let lowestHits = Infinity;
	        let healTarget = null;
	        for (let i = 0; i < squad.length; i++) {
	            const member = squad[i];
	            if (member.hits < member.hitsMax && member.hits < lowestHits) {
	                lowestHits = member.hits;
	                healTarget = member;
	            }
	        }

	        if (healTarget && creep.pos.isNearTo(healTarget.pos)) {
	            creep.heap.targetId = healTarget.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
	            creep.heap.state = 'combat';
	        } else if (healTarget && creep.pos.inRangeTo(healTarget.pos, 3)) {
	            creep.heap.targetId = healTarget.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_RANGED_HEAL;
	            creep.heap.state = 'combat';
	        } else if (!isMoving) {
	            creep.heap.state = 'idle';
	        }
	    }

	    // ─────────────────────────────────────────────────────────────────────────────
	    // OFFENSIVE ASSIGNMENT
	    // ─────────────────────────────────────────────────────────────────────────────

	    static assignOffensive(creep, targetRoom, colony) {
	        if (creep.room.name !== targetRoom) {
	            creep.memory.targetRoom = targetRoom;
	            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
	            creep.heap.state = 'moving';
	            return;
	        }

	        const roomState = commonjsGlobal.State.rooms.get(targetRoom);
	        if (!roomState) return;

	        const hostiles = roomState.hostiles || [];
	        let closestHostile = null;
	        let closestDist = Infinity;
	        for (let i = 0; i < hostiles.length; i++) {
	            const h = hostiles[i];
	            const d = Math.max(Math.abs(creep.pos.x - h.pos.x), Math.abs(creep.pos.y - h.pos.y));
	            if (d < closestDist) {
	                closestDist = d;
	                closestHostile = h;
	            }
	        }

	        if (creep.memory.role === 'meleeCreep') {
	            if (closestHostile) {
	                creep.heap.targetId = closestHostile.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	                creep.heap.state = 'combat';
	            } else {
	                const structTarget = MilitaryManager.pickOffensiveStructure(roomState);
	                if (structTarget) {
	                    creep.heap.targetId = structTarget.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	                    creep.heap.state = 'combat';
	                }
	            }

	        } else if (creep.memory.role === 'rangerCreep') {
	            if (closestHostile) {
	                // Replaces naive 1-tile math with native TrafficManager flee pathfinding, allowing rangers to kite flawlessly around terrain.
	                if (closestDist <= 2) {
	                    creep.heap.fleeGoals = [{ pos: closestHostile.pos, range: 3 }];
	                } else {
	                    creep.heap.fleeGoals = null;
	                    creep.heap.destination = { x: closestHostile.pos.x, y: closestHostile.pos.y, roomName: closestHostile.pos.roomName, range: 3 };
	                }
	                creep.heap.targetId = closestHostile.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
	                creep.heap.state = 'combat';
	            } else {
	                const structTarget = MilitaryManager.pickOffensiveStructure(roomState);
	                if (structTarget) {
	                    creep.heap.targetId = structTarget.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
	                    creep.heap.state = 'combat';
	                }
	            }

	        } else if (creep.memory.role === 'medicCreep') {
	            // Adds survival instincts to medics via fleeGoals, preventing them from blindly following melee creeps into danger.
	            if (closestHostile && closestDist <= 2) {
	                creep.heap.fleeGoals = [{ pos: closestHostile.pos, range: 3 }];
	            } else {
	                creep.heap.fleeGoals = null;
	            }

	            const healTarget = MilitaryManager.findMostDamagedAlly(colony, targetRoom);
	            if (healTarget) {
	                creep.heap.targetId = healTarget.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
	                creep.heap.state = 'combat';
	            } else {
	                const melee = MilitaryManager.findAllyByRole(colony, 'meleeCreep', targetRoom);
	                if (melee) {
	                    creep.heap.targetId = melee.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
	                    creep.heap.state = 'combat';
	                }
	            }
	        }
	    }

	    // ─────────────────────────────────────────────────────────────────────────────
	    // PATROL ASSIGNMENT
	    // ─────────────────────────────────────────────────────────────────────────────

	    static assignPatrol(creep, homeState, colony) {
	        if (!commonjsGlobal.State.patrolWaypoints) commonjsGlobal.State.patrolWaypoints = {};

	        if (!commonjsGlobal.State.patrolWaypoints[colony]) {
	            const mem = Memory.rooms[colony];
	            if (mem && mem.patrolWaypoints && mem.patrolWaypoints.length > 0) {
	                commonjsGlobal.State.patrolWaypoints[colony] = mem.patrolWaypoints;
	            } else {
	                const spawn = homeState.spawns && homeState.spawns[0];
	                const controller = homeState.controller;
	                if (!spawn || !controller) {
	                    creep.heap.state = 'idle';
	                    return;
	                }
	                commonjsGlobal.State.patrolWaypoints[colony] = [
	                    { x: spawn.pos.x, y: spawn.pos.y, roomName: colony },
	                    { x: controller.pos.x, y: controller.pos.y, roomName: colony }
	                ];
	            }
	        }

	        const waypoints = commonjsGlobal.State.patrolWaypoints[colony];
	        if (!creep.heap.waypointIndex) creep.heap.waypointIndex = 0;

	        let wp = waypoints[creep.heap.waypointIndex % waypoints.length];

	        // Advance waypoint if arrived
	        if (creep.room.name === wp.roomName && Math.max(Math.abs(creep.pos.x - wp.x), Math.abs(creep.pos.y - wp.y)) <= 1) {
	            creep.heap.waypointIndex++;
	            wp = waypoints[creep.heap.waypointIndex % waypoints.length];
	        }

	        creep.heap.waypointPos = wp;
	        creep.heap.destination = { x: wp.x, y: wp.y, roomName: wp.roomName, range: 1 };
	        creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
	        creep.heap.state = 'moving';
	    }

	    // ─────────────────────────────────────────────────────────────────────────────
	    // AGGRESSIVE ZONE TARGETING
	    // ─────────────────────────────────────────────────────────────────────────────

	    static buildAggressiveZoneQueue() {
	        if (!commonjsGlobal.State) return;
	        if (!Memory.rooms) return;

	        const visited = new Set();
	        const scores = [];

	        const frontier = [];
	        for (const roomName in Game.rooms) {
	            const room = Game.rooms[roomName];
	            if (room.controller && room.controller.my) {
	                frontier.push({ roomName, hop: 0 });
	                visited.add(roomName);
	            }
	        }

	        for (let fi = 0; fi < frontier.length; fi++) {
	            const { roomName, hop } = frontier[fi];
	            if (hop >= 3) continue;

	            const exits = Game.map.describeExits(roomName);
	            if (!exits) continue;

	            for (const dir in exits) {
	                const neighbor = exits[dir];
	                if (visited.has(neighbor)) continue;
	                visited.add(neighbor);
	                frontier.push({ roomName: neighbor, hop: hop + 1 });

	                const intel = Memory.rooms[neighbor];
	                let score = 0;

	                // Tigga-Style Remote Denial: Prioritize neighbors pushing into our remote radius
	                let isAdjacentToOutpost = false;
	                for (const colonyName in Game.rooms) {
	                    const room = Game.rooms[colonyName];
	                    if (room.controller && room.controller.my && Memory.rooms[colonyName]?.outposts) {
	                        const outposts = Memory.rooms[colonyName].outposts;
	                        if (outposts.includes(neighbor)) {
	                            isAdjacentToOutpost = true;
	                            score += 50; // Threat directly in our outpost
	                            break;
	                        }
	                        for (let i = 0; i < outposts.length; i++) {
	                            const outpostExits = Game.map.describeExits(outposts[i]);
	                            if (outpostExits) {
	                                for (const d in outpostExits) {
	                                    if (outpostExits[d] === neighbor) {
	                                        isAdjacentToOutpost = true;
	                                        break;
	                                    }
	                                }
	                            }
	                            if (isAdjacentToOutpost) break;
	                        }
	                    }
	                    if (isAdjacentToOutpost) break;
	                }

	                if (isAdjacentToOutpost) {
	                    score += 150; // High priority to choke adjacent competitors
	                }

	                if (intel) {
	                    // Check if there are hostile structures or creeps to slaughter
	                    let hasTargets = false;
	                    if (intel.controller && intel.controller.owner && intel.controller.owner !== 'Blake') {
	                        score += 300;
	                        hasTargets = true;
	                    }
	                    if (intel.hostiles && intel.hostiles.creeps > 0) {
	                        score += 200;
	                        hasTargets = true;
	                    }

	                    if (hasTargets) {
	                        if (intel.sources && intel.sources.length > 0) score += 50 * intel.sources.length;
	                    } else {
	                        score = 0; // Don't raid if there's nothing to kill
	                    }
	                } else {
	                    score = 0; // Don't blindly raid unscouted rooms
	                }

	                if (score > 0) {
	                    let threatIndex = 0;
	                    if (intel && intel.hostiles) {
	                        threatIndex = (intel.hostiles.dps || 0) + (intel.hostiles.hps || 0);
	                    }
	                    scores.push({ roomName: neighbor, score, threatIndex });
	                }
	            }
	        }

	        scores.sort((a, b) => b.score - a.score);
	        commonjsGlobal.State.militaryQueue = scores.slice(0, 3).map(s => ({ roomName: s.roomName, threatIndex: s.threatIndex }));
	    }

	    // ─────────────────────────────────────────────────────────────────────────────
	    // UTILITY HELPERS
	    // ─────────────────────────────────────────────────────────────────────────────

	    static findMostDamagedAlly(colony, roomName) {
	        let worstCreep = null;
	        let worstRatio = 1.0;

	        for (const name in Game.creeps) {
	            const c = Game.creeps[name];
	            if (c.memory.colony !== colony) continue;
	            if (c.room.name !== roomName) continue;
	            const ratio = c.hits / c.hitsMax;
	            if (ratio < worstRatio) {
	                worstRatio = ratio;
	                worstCreep = c;
	            }
	        }
	        return worstCreep;
	    }

	    static findAllyByRole(colony, role, roomName) {
	        for (const name in Game.creeps) {
	            const c = Game.creeps[name];
	            if (c.memory.colony === colony && c.memory.role === role && c.room.name === roomName) {
	                return c;
	            }
	        }
	        return null;
	    }

	    static pickOffensiveStructure(roomState) {
	        if (roomState.invaderCores && roomState.invaderCores.length > 0) return roomState.invaderCores[0];
	        if (roomState.towers && roomState.towers.length > 0) {
	            for (let i = 0; i < roomState.towers.length; i++) {
	                if (!roomState.towers[i].my) return roomState.towers[i];
	            }
	        }
	        if (roomState.spawns && roomState.spawns.length > 0) {
	            for (let i = 0; i < roomState.spawns.length; i++) {
	                if (!roomState.spawns[i].my) return roomState.spawns[i];
	            }
	        }
	        return null;
	    }
	    static getThreatIndex(hostiles) {
	        if (!hostiles || hostiles.length === 0) return 0;
	        let threat = 0;
	        for (let i = 0; i < hostiles.length; i++) {
	            const body = hostiles[i].body;
	            if (!body) continue;
	            for (let j = 0; j < body.length; j++) {
	                const type = body[j].type;
	                if (type === ATTACK) threat += 30;
	                else if (type === RANGED_ATTACK) threat += 10;
	                else if (type === HEAL) threat += 12;
	            }
	        }
	        return threat;
	    }

	    static getAllyThreatIndex(creeps, colony) {
	        if (!creeps || creeps.length === 0) return 0;
	        let threat = 0;
	        for (let i = 0; i < creeps.length; i++) {
	            const c = creeps[i];
	            if (colony && c.memory.colony !== colony) continue;
	            const role = (c.memory.role || '').toLowerCase();
	            if (role === 'meleecreep' || role === 'rangercreep' || role === 'mediccreep' || role === 'defender') {
	                for (let j = 0; j < c.body.length; j++) {
	                    const type = c.body[j].type;
	                    if (type === ATTACK) threat += 30;
	                    else if (type === RANGED_ATTACK) threat += 10;
	                    else if (type === HEAL) threat += 12;
	                }
	            }
	        }
	        return threat;
	    }

	    static evaluateStrength(roomState, colony) {
	        let enemyScore = MilitaryManager.getThreatIndex(roomState.hostiles);
	        let allyScore = MilitaryManager.getAllyThreatIndex(roomState.creeps, colony);

	        const towers = roomState.towers || [];
	        allyScore += towers.length * 150; // A tower is significantly stronger than 5 parts, adjusting to align with the *30 threat index

	        return allyScore >= enemyScore;
	    }

	    static assessOutpostViability(outpostName) {
	        if (!Memory.rooms[outpostName]) return;
	        const oState = commonjsGlobal.State.rooms.get(outpostName);
	        if (!oState || !oState.hostiles || oState.hostiles.length === 0) {
	            Memory.rooms[outpostName].hostileDominanceTicks = 0;
	            return;
	        }

	        let hostileThreat = MilitaryManager.getThreatIndex(oState.hostiles);
	        let allyThreat = MilitaryManager.getAllyThreatIndex(oState.creeps, null);

	        if (hostileThreat > allyThreat) {
	            Memory.rooms[outpostName].hostileDominanceTicks = (Memory.rooms[outpostName].hostileDominanceTicks || 0) + 1;
	            if (Memory.rooms[outpostName].hostileDominanceTicks > 50) {
	                Memory.rooms[outpostName].undefendable = Game.time + 1500;
	                Memory.rooms[outpostName].hostileDominanceTicks = 0;
	            }
	        } else {
	            Memory.rooms[outpostName].hostileDominanceTicks = 0;
	        }
	    }

	    static findPrimaryTarget(roomState) {
	        const hostiles = roomState.hostiles;
	        if (!hostiles || hostiles.length === 0) return null;

	        let bestTarget = null;
	        let highestScore = -Infinity;

	        for (let i = 0; i < hostiles.length; i++) {
	            const h = hostiles[i];
	            let score = 0;

	            let hasHeal = false;
	            let hasAttack = false;

	            for (let j = 0; j < h.body.length; j++) {
	                const type = h.body[j].type;
	                if (type === HEAL) hasHeal = true;
	                if (type === ATTACK || type === RANGED_ATTACK) hasAttack = true;
	            }

	            // Target Priority System
	            if (hasHeal) score += 1000;
	            else if (hasAttack) score += 500;

	            // Tie breaker: Weakest targets get prioritized (to burst them down)
	            const healthRatio = h.hits / h.hitsMax;
	            score -= healthRatio * 100;

	            if (score > highestScore) {
	                highestScore = score;
	                bestTarget = h;
	            }
	        }

	        return bestTarget;
	    }

	    static findBestRampart(creep, hostile, roomState, weAreStronger) {
	        if (!roomState.ramparts || roomState.rampartCount === 0) return null;

	        let bestRampart = null;
	        let bestScore = -Infinity;

	        const attackRange = (creep.memory.role === 'rangerCreep') ? 3 : 1;

	        for (let i = 0; i < roomState.rampartCount; i++) {
	            const s = roomState.ramparts[i];
	            const distToHostile = Math.max(Math.abs(s.pos.x - hostile.pos.x), Math.abs(s.pos.y - hostile.pos.y));

	            if (distToHostile <= attackRange) {
	                const distToCreep = Math.max(Math.abs(creep.pos.x - s.pos.x), Math.abs(creep.pos.y - s.pos.y));
	                const score = -distToCreep;
	                if (score > bestScore) {
	                    bestScore = score;
	                    bestRampart = s;
	                }
	            }
	        }

	        if (!bestRampart && !weAreStronger) {
	            let closestRampartToHostile = null;
	            let minRampartDist = Infinity;
	            for (let i = 0; i < roomState.rampartCount; i++) {
	                const s = roomState.ramparts[i];
	                const dist = Math.max(Math.abs(s.pos.x - hostile.pos.x), Math.abs(s.pos.y - hostile.pos.y));
	                if (dist < minRampartDist) {
	                    minRampartDist = dist;
	                    closestRampartToHostile = s;
	                }
	            }
	            if (closestRampartToHostile) bestRampart = closestRampartToHostile;
	        }

	        return bestRampart;
	    }
	}

	MilitaryManager_1 = MilitaryManager;
	return MilitaryManager_1;
}

var SpawnManager_1;
var hasRequiredSpawnManager;

function requireSpawnManager () {
	if (hasRequiredSpawnManager) return SpawnManager_1;
	hasRequiredSpawnManager = 1;
	// src/colonies/SpawnManager.js
	const { RouteDistanceCalculator } = requireSystemLib();
	const MilitaryManager = requireMilitaryManager();
	const EMERGENCY_BODY = [WORK, CARRY, MOVE];

	class CreepBodyBuilder {
	    static getBody(role, energyCapacity, extraArgs = {}) {
	        energyCapacity = energyCapacity || 300;

	        switch (role) {
	            case 'filler': return this.generateFiller(energyCapacity);
	            case 'fastfiller': return this.generateFastfiller(energyCapacity);
	            case 'hauler': return this.generateHauler(energyCapacity);
	            case 'upgrader': return this.generateUpgrader(energyCapacity);
	            case 'builder': return this.generateBuilder(energyCapacity);
	            case 'pioneer': return this.generatePioneer(energyCapacity);
	            case 'bootstrapper': return [WORK, CARRY, MOVE];
	            case 'harvester': return this.generateHarvester(energyCapacity);
	            case 'remoteharvester': return this.generateRemoteHarvester(energyCapacity, extraArgs.isReserved);
	            case 'remotehauler': return this.generateRemoteHauler(energyCapacity);
	            case 'reserver': return this.generateReserver(energyCapacity);
	            // Optimizes spawn cost by locking scouts to a single MOVE part, ensuring negligible impact on the RCL 2 energy budget.
	            case 'scout': return [MOVE];
	            case 'mineralminer': return this.generateMiner(energyCapacity);
	            case 'hubmanager': return this.generateHubManager(energyCapacity);
	            case 'mineralhauler': return this.generateHauler(energyCapacity);
	            case 'claimer': return this.generateClaimer(energyCapacity);
	            case 'scientist': return this.generateScientist(energyCapacity);
	            case 'defender': return [TOUGH, MOVE, ATTACK, MOVE];
	            case 'meleeCreep': return this.generateMelee(energyCapacity);
	            case 'rangerCreep': return this.generateRanger(energyCapacity);
	            case 'medicCreep': return this.generateMedic(energyCapacity);
	            case 'skguard': return this.generateSKGuard(energyCapacity);
	            case 'skminer': return this.generateSKMiner(energyCapacity);
	            case 'skhauler': return this.generateSKHauler(energyCapacity);
	            default: return [WORK, CARRY, MOVE];
	        }
	    }

	    static generateSKGuard(energy) {
	        // Paladin Body: [TOUGH, ATTACK, MOVE, HEAL]
	        // Base cost: 10 + 80 + 50 + 250 = 390
	        // Need high move ratio. Max cost for 50 parts is around 5000.
	        // We'll aim for a balanced block of: 1 TOUGH, 4 ATTACK, 6 MOVE, 1 HEAL = 10 + 320 + 300 + 250 = 880.
	        const blockCost = 880;
	        let blocks = Math.floor(energy / blockCost);
	        if (blocks > 4) blocks = 4; // 4 blocks = 48 parts
	        if (blocks < 1) return [MOVE, ATTACK, HEAL, MOVE]; // Emergency

	        const body = new Array(blocks * 12);
	        let idx = 0;
	        for (let i = 0; i < blocks; i++) body[idx++] = TOUGH;
	        for (let i = 0; i < blocks * 4; i++) body[idx++] = ATTACK;
	        for (let i = 0; i < blocks * 6; i++) body[idx++] = MOVE;
	        for (let i = 0; i < blocks; i++) body[idx++] = HEAL;
	        return body;
	    }

	    static generateSKMiner(energy) {
	        // SK sources have 4000 capacity per 300 ticks (~13.33/tick)
	        // Requires 7 WORK parts to fully drain in time.
	        // Body: 7 WORK, 1 CARRY, 4 MOVE = 700 + 50 + 200 = 950 energy.
	        if (energy >= 950) {
	            return this.buildArray(7, 1, 4);
	        }
	        return this.generateMiner(energy); // fallback
	    }

	    static generateSKHauler(energy) {
	        // Massive hauler, 2 CARRY : 1 MOVE.
	        let carry = 1, move = 1;
	        let cost = 100;
	        while (cost + 150 <= energy && (carry + move + 3) <= 50) {
	            carry += 2;
	            move += 1;
	            cost += 150;
	        }
	        return this.buildArray(0, carry, move);
	    }

	    static generateHarvester(energy) {
	        let work = 1, carry = 1, move = 1;
	        let cost = 200;
	        // Cap at 6 WORK, 1 CARRY, 3 MOVE
	        while (cost + 100 <= energy && work < 6) { work++; cost += 100; }
	        while (cost + 50 <= energy && move < 3) { move++; cost += 50; }
	        return this.buildArray(work, carry, move);
	    }

	    static generateRemoteHarvester(energy, isReserved) {
	        const workNeeded = isReserved ? 5 : 3;

	        let work = workNeeded;
	        let carry = 1;
	        let move = Math.ceil(workNeeded / 2); // 1 MOVE per 2 WORK to maintain 1 tile/tick on roads

	        let cost = (work * 100) + (carry * 50) + (move * 50);

	        // Fallback for extreme low energy
	        if (energy < cost) {
	             work = Math.floor((energy - 100) / 100);
	             if (work < 1) work = 1;
	             move = Math.ceil(work / 2);
	        }

	        return this.buildArray(work, carry, move);
	    }

	    static generateHauler(energy) {
	        // Core haulers follow the same math: 2 CARRY, 1 MOVE
	        let carry = 0, move = 0;
	        let cost = 0;

	        if (energy < 150) {
	            return this.buildArray(0, 1, 1);
	        }

	        while (cost + 150 <= energy && (carry + move + 3) <= 50) {
	            carry += 2;
	            move += 1;
	            cost += 150;
	        }
	        return this.buildArray(0, carry, move);
	    }

	    static generateRemoteHauler(energy) {
	        // Tigga Mathematical Hauler Builder: 2 CARRY, 1 MOVE blocks
	        // Base cost per block: 150 energy. 1 WORK part strictly omitted to follow pure mathematical logic.
	        let carry = 0, move = 0;
	        let cost = 0;

	        if (energy < 150) {
	            return this.buildArray(0, 1, 1);
	        }

	        while (cost + 150 <= energy && (carry + move + 3) <= 50) {
	            carry += 2;
	            move += 1;
	            cost += 150;
	        }
	        return this.buildArray(0, carry, move);
	    }

	    static generateFastfiller(energy) {
	        // Fastfillers are static. Max CARRY, exactly 1 MOVE.
	        // Needs to hold as much as possible to buffer transfers.
	        let carry = Math.floor((energy - 50) / 50);
	        if (carry > 30) carry = 30; // Max 1500 capacity is plenty
	        if (carry < 1) carry = 1;
	        return this.buildArray(0, carry, 1);
	    }

	    static generateFiller(energy) {
	        let carry = Math.floor(energy / 100);
	        if (carry > 25) carry = 25;
	        if (carry < 1) carry = 1;
	        return this.buildArray(0, carry, carry);
	    }

	    static generateUpgrader(energy) {
	        let work = 1, carry = 1, move = 1;
	        let cost = 200;
	        // Cap at 15 WORK, 1 CARRY, 3 MOVE
	        while (cost + 100 <= energy && work < 15) { work++; cost += 100; }
	        while (cost + 50 <= energy && move < 3) { move++; cost += 50; }
	        return this.buildArray(work, carry, move);
	    }

	    static generateBuilder(energy) {
	        let work = 1, carry = 1, move = 1;
	        let cost = 200;
	        while (cost + 200 <= energy && (work + carry + move + 3) <= 50) { work++; carry++; move++; cost += 200; }
	        while (cost + 50 <= energy && (work + carry + move + 1) <= 50) { carry++; cost += 50; }
	        return this.buildArray(work, carry, move);
	    }

	    static generatePioneer(energy) {
	        let work = 1, carry = 1, move = 1;
	        let cost = 200;
	        // Basically a builder/bootstrapper that can walk far
	        while (cost + 200 <= energy && (work + carry + move + 3) <= 50) { work++; carry++; move++; cost += 200; }
	        return this.buildArray(work, carry, move);
	    }

	    static generateMiner(energy) {
	        let work = 1, move = 1;
	        let cost = 150;
	        while (cost + 100 <= energy && work < 5) { work++; cost += 100; }
	        return this.buildArray(work, 0, move);
	    }

	    static generateReserver(energy) {
	        let claims = 1;
	        let moves = 1;
	        if (energy >= 1300) { claims = 2; moves = 2; }
	        const body = new Array(claims + moves);
	        let idx = 0;
	        for (let i = 0; i < claims; i++) body[idx++] = CLAIM;
	        for (let i = 0; i < moves; i++) body[idx++] = MOVE;
	        return body;
	    }

	    static generateHubManager(energy) {
	        // HubManager is stationary. It needs 1 MOVE and max CARRY.
	        let carry = 1;
	        let move = 1;
	        let cost = 100;
	        // Cap at 16 CARRY parts (800 capacity) to cover the 800 link transfer size.
	        while (cost + 50 <= energy && carry < 16 && (carry + move + 1) <= 50) { carry++; cost += 50; }
	        return this.buildArray(0, carry, move);
	    }

	    static generateClaimer(_energy) {
	        // Claimer just needs to claim the room.
	        return [CLAIM, MOVE];
	    }

	    static generateScientist(energy) {
	        // Scientist needs to carry compounds. 1 MOVE, some CARRY.
	        let carry = 1, move = 1;
	        let cost = 100;
	        while (cost + 100 <= energy && carry < 10 && (carry + move + 2) <= 50) { carry++; move++; cost += 100; }
	        return this.buildArray(0, carry, move);
	    }

	    static generateMelee(energy) {
	        const blockCost = BODYPART_COST[TOUGH] * 2 + BODYPART_COST[ATTACK] * 2 + BODYPART_COST[MOVE] * 2;
	        let blocks = Math.floor(energy / blockCost);
	        if (blocks > Math.floor(50 / 6)) blocks = Math.floor(50 / 6);
	        if (blocks < 1) blocks = 1;

	        const body = new Array(blocks * 6);
	        let idx = 0;
	        for (let i = 0; i < blocks; i++) {
	            body[idx++] = TOUGH; body[idx++] = TOUGH;
	            body[idx++] = ATTACK; body[idx++] = ATTACK;
	            body[idx++] = MOVE; body[idx++] = MOVE;
	        }
	        return body;
	    }

	    static generateRanger(energy) {
	        const blockCost = BODYPART_COST[TOUGH] + BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
	        let blocks = Math.floor(energy / blockCost);
	        if (blocks > Math.floor(50 / 3)) blocks = Math.floor(50 / 3);
	        if (blocks < 1) blocks = 1;

	        const body = new Array(blocks * 3);
	        let idx = 0;
	        for (let i = 0; i < blocks; i++) {
	            body[idx++] = TOUGH;
	            body[idx++] = RANGED_ATTACK;
	            body[idx++] = MOVE;
	        }
	        return body;
	    }

	    static generateMedic(energy) {
	        const blockCost = BODYPART_COST[MOVE] + BODYPART_COST[HEAL];
	        let blocks = Math.floor(energy / blockCost);
	        if (blocks > 25) blocks = 25;
	        if (blocks < 1) blocks = 1;

	        const body = new Array(blocks * 2);
	        let idx = 0;
	        for (let i = 0; i < blocks; i++) {
	            body[idx++] = MOVE;
	            body[idx++] = HEAL;
	        }
	        return body;
	    }

	    static buildArray(work, carry, move) {
	        const len = work + carry + move;
	        const body = new Array(len);
	        let idx = 0;
	        for (let i = 0; i < work; i++) body[idx++] = WORK;
	        for (let i = 0; i < carry; i++) body[idx++] = CARRY;
	        for (let i = 0; i < move; i++) body[idx++] = MOVE;
	        return body;
	    }
	}

	class CensusCalculator {
	    static getAllLimits(rcl, roomState, roomName, energyCapacity) {
	        // Base limits with 0 default, completely dynamically generated
	        const limits = {
	            harvester: 0,
	            hauler: 0,
	            upgrader: 0,
	            builder: 0,
	            filler: 0,
	            fastfiller: 0,
	            mineralminer: 0,
	            mineralhauler: 0,
	            hubmanager: 0,
	            scientist: 0,
	            pioneer: 0,
	            claimer: 0
	        };

	        if (roomState) {
	            // 1. Dynamic Harvesters
	            if (roomState.sources) {
	                limits.harvester = roomState.sources.length;
	            }

	            // 2. Dynamic Haulers
	            let looseEnergy = 0;
	            if (roomState.droppedEnergy) {
	                for (let i = 0; i < roomState.droppedEnergyCount; i++) {
	                    const drop = roomState.droppedEnergy[i];
	                    if (drop && drop.amount) looseEnergy += drop.amount;
	                }
	            }

	            let haulerBase = 1;
	            if (roomState.coreContainers && roomState.coreContainerCount > 0) {
	                for (let i = 0; i < roomState.coreContainerCount; i++) {
	                    const c = roomState.coreContainers[i];
	                    if (c && c.store.getUsedCapacity(RESOURCE_ENERGY) < 500) {
	                        haulerBase++;
	                    }
	                }
	            } else {
	                if (roomState.controllerContainers && roomState.controllerContainers.length > 0) {
	                    for (let i = 0; i < roomState.controllerContainers.length; i++) {
	                        const c = roomState.controllerContainers[i];
	                        if (c && c.store.getUsedCapacity(RESOURCE_ENERGY) < 500) {
	                            haulerBase++;
	                        }
	                    }
	                }
	            }

	            if (roomState.storage && roomState.terminal && roomState.linkCount > 0) {
	                // If fully linked, we might not need haulers at all for sources
	                haulerBase = 0;
	            }

	            // Add 1 hauler per 1500 loose energy, max 4
	            let dynamicHaulers = Math.floor(looseEnergy / 1500);
	            limits.hauler = Math.min(4, haulerBase + dynamicHaulers);

	            // Emergency Storage Protocol
	            if (rcl >= 4 && (!roomState.storage || !roomState.storage.my)) {
	                limits.upgrader = 1;
	                limits.builder = 4;
	            }

	            // Expansion Pioneer Limits
	            if (Memory.empire && Memory.empire.colonizeRoom && Memory.empire.colonizeSourceColony === roomName) {
	                limits.claimer = 1;
	                limits.pioneer = 4;
	            }

	            if (roomState.storage && roomState.storage.my) {
	                limits.filler = 1;
	                if (roomState.extensionsCount && roomState.extensionsCount >= 5) {
	                    limits.fastfiller = Math.min(4, Math.floor(roomState.extensionsCount / 5));
	                }
	            }

	            if (roomState.extractor && roomState.mineral && roomState.mineral.mineralAmount > 0) {
	                limits.mineralminer = 1;
	                limits.mineralhauler = 1;
	            }

	            if (roomState.storage && roomState.terminal && roomState.linkCount > 0) {
	                limits.hubmanager = 1;
	            }

	            if (roomState.labs && roomState.labs.length > 0) {
	                limits.scientist = 1;
	            }

	            // --- Tigga-Style Dynamic Energy Cascading ---
	            // 1. Calculate Theoretical Max Income
	            let totalIncome = roomState.sources ? roomState.sources.length * 10 : 0;
	            if (Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
	                const outposts = Memory.rooms[roomName].outposts;
	                for (let i = 0; i < outposts.length; i++) {
	                    const outpostName = outposts[i];
	                    const adjMem = Memory.rooms[outpostName];
	                    if (adjMem && adjMem.sources) {
	                        const isSKRoom = adjMem.roomType === 'sk';
	                        totalIncome += adjMem.sources.length * (isSKRoom ? 13.33 : 10);
	                    }
	                }
	            }

	            // 2. Fixed Overhead Extraction (Energy cost per tick of base roles)
	            let fixedOverhead = 0;
	            fixedOverhead += limits.harvester * (200 / 1500);
	            fixedOverhead += limits.hauler * (300 / 1500);
	            fixedOverhead += limits.filler * (300 / 1500);
	            fixedOverhead += limits.fastfiller * (200 / 1500);
	            // Military/Remote overhead is handled implicitly since they draw from outposts, but let's buffer 10%
	            fixedOverhead += (totalIncome * 0.1);

	            let variableBudget = Math.max(0, totalIncome - fixedOverhead);

	            // 3. Storage-Driven Scaling Multiplier
	            let storageMultiplier = 1.0;
	            if (roomState.storage && roomState.storage.my) {
	                const storageEnergy = roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY);
	                if (storageEnergy > 500000) storageMultiplier = 3.0;      // Explosive scaling
	                else if (storageEnergy > 300000) storageMultiplier = 2.0; // Surplus
	                else if (storageEnergy > 100000) storageMultiplier = 1.5; // Healthy
	                else if (storageEnergy < 20000) storageMultiplier = 0.5;  // Starving
	            } else {
	                // Bootstrapping: Swarm if loose energy is everywhere
	                if (looseEnergy > 2000) storageMultiplier = 2.0;
	            }

	            variableBudget *= storageMultiplier;

	            // Average upgrader/builder costs ~5 energy/tick in usage (depends on WORK parts and RCL)
	            const workerConsumptionRate = Math.min(10, rcl * 1.5);

	            // 4. Calculate Builders
	            let neededBuilders = 0;
	            let hasCriticalRepairs = false;
	            for (let i = 0; i < roomState.rampartCount; i++) {
	                if (roomState.ramparts[i].hits < 5000) { hasCriticalRepairs = true; break; }
	            }
	            if (!hasCriticalRepairs && roomState.repairTargetCount > 0) {
	                for (let i = 0; i < roomState.repairTargetCount; i++) {
	                    const target = roomState.repairTargets[i];
	                    if ((target.structureType === STRUCTURE_WALL || target.structureType === STRUCTURE_RAMPART) && target.hits < 5000) {
	                        hasCriticalRepairs = true; break;
	                    }
	                }
	            }
	            if (hasCriticalRepairs) neededBuilders = 1;
	            else if (roomState.constructionSiteCount > 0) {
	                neededBuilders = Math.min(3, Math.ceil(roomState.constructionSiteCount / 5));
	            }

	            // Route budget to builders first
	            let affordableBuilders = Math.floor(variableBudget / workerConsumptionRate);
	            limits.builder = Math.max(limits.builder || 0, Math.min(neededBuilders, affordableBuilders));

	            variableBudget -= (limits.builder * workerConsumptionRate);

	            // 5. Zero-Waste Upgraders (Remaining budget is dumped entirely into upgrading)
	            let affordableUpgraders = Math.floor(Math.max(0, variableBudget) / workerConsumptionRate);
	            limits.upgrader = Math.max(1, limits.upgrader || 0, affordableUpgraders); // Always 1 to prevent downgrade
	        }

	        if (roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
	            const outposts = Memory.rooms[roomName].outposts;
	            let neededRemoteHarvesters = 0;
	            let neededRemoteBuilders = 0;
	            let totalRemoteHaulerCarryNeeded = 0;
	            let totalSKHaulerCarryNeeded = 0;

	            limits.remoteHarvesterQueue = [];
	            limits.reserverQueue = [];

	            for (let i = 0; i < outposts.length; i++) {
	                const outpostName = outposts[i];
	                const adjMem = Memory.rooms[outpostName];
	                const outpostState = commonjsGlobal.State?.rooms?.get(outpostName);

	                // Military Preemption
	                let isContested = false;
	                if (adjMem && adjMem.hostiles) {
	                    if (adjMem.hostiles.creeps > 0 || adjMem.hostiles.towers > 0 || adjMem.hostiles.invaderCore) {
	                        isContested = true;
	                    }
	                }

	                // If contested, skip economic deployment entirely
	                if (isContested) {
	                    continue;
	                }

	                const isSKRoom = adjMem && adjMem.roomType === 'sk';

	                if (adjMem && adjMem.sources) {
	                    // Calculate Route Length
	                    let distanceRooms = 1;
	                    const route = Game.map.findRoute(roomName, outpostName);
	                    if (route !== ERR_NO_PATH) {
	                        distanceRooms = route.length;
	                    }
	                    const roundTripDistance = distanceRooms * 100;

	                    let isReserved = false;
	                    if (adjMem.controller && adjMem.controller.reservation && (adjMem.controller.reservation.username === 'Bizarrelego' || adjMem.controller.reservation.username === 'Blake') && adjMem.controller.reservation.ticksToEnd > 0) {
	                        isReserved = true;
	                    }

	                    if (isSKRoom) {
	                        limits.skminer = (limits.skminer || 0) + adjMem.sources.length;
	                        limits.skguard = (limits.skguard || 0) + 1;
	                        // SK rooms generate roughly 15 energy/tick including minerals
	                        const carryNeeded = Math.ceil((roundTripDistance * 15) / 50) * adjMem.sources.length;
	                        totalSKHaulerCarryNeeded += carryNeeded;
	                    } else {
	                        const energyPerTick = isReserved ? 10 : 5;
	                        for (let j = 0; j < adjMem.sources.length; j++) {
	                            neededRemoteHarvesters++;
	                            limits.remoteHarvesterQueue.push({
	                                role: 'remoteharvester',
	                                targetRoom: outpostName,
	                                targetSource: adjMem.sources[j].id,
	                                isReserved: isReserved
	                            });
	                        }
	                        const carryNeeded = Math.ceil((roundTripDistance * energyPerTick) / 50) * adjMem.sources.length;
	                        totalRemoteHaulerCarryNeeded += carryNeeded;
	                    }
	                }

	                // Reserver Logic (Skip for SK rooms as they lack controllers to reserve)
	                if (!isSKRoom && rcl >= 3 && adjMem && adjMem.controller && (!adjMem.controller.owner)) {
	                    // Only reserve if reservation is low (< 1000) or missing
	                    if (!adjMem.controller.reservation || adjMem.controller.reservation.ticksToEnd < 1500) {
	                        limits.reserverQueue.push({
	                            role: 'reserver',
	                            targetRoom: outpostName
	                        });
	                    }
	                }

	                // Remote Builder (Janitor) Logic
	                if (outpostState && outpostState.constructionSiteCount > 0) {
	                    neededRemoteBuilders += Math.min(2, Math.ceil(outpostState.constructionSiteCount / 5));
	                }
	            }

	            if (neededRemoteHarvesters > 0) {
	                limits.remoteharvester = neededRemoteHarvesters;

	                // Calculate how many haulers we need based on max carry parts per hauler
	                // generateRemoteHauler base cost is 250 (1 WORK, 1 CARRY, 2 MOVE). Each extra CARRY/MOVE pair is 100.
	                let maxExtraCarry = Math.floor((energyCapacity - 250) / 100);
	                if (maxExtraCarry < 0) maxExtraCarry = 0;
	                let maxCarryPerHauler = 1 + maxExtraCarry;
	                if (maxCarryPerHauler > 24) maxCarryPerHauler = 24; // 1W, 24C, 25M = 50 parts

	                limits.remotehauler = Math.ceil(totalRemoteHaulerCarryNeeded / maxCarryPerHauler);
	            }

	            if (totalSKHaulerCarryNeeded > 0) {
	                // generateSKHauler base cost is 100 (1 CARRY, 1 MOVE). Each extra 2 CARRY/1 MOVE is 150.
	                let maxExtraPairs = Math.floor((energyCapacity - 100) / 150);
	                if (maxExtraPairs < 0) maxExtraPairs = 0;
	                let maxSKCarryPerHauler = 1 + (maxExtraPairs * 2);
	                if (maxSKCarryPerHauler > 33) maxSKCarryPerHauler = 33; // 33 CARRY, 17 MOVE = 50 parts

	                limits.skhauler = Math.ceil(totalSKHaulerCarryNeeded / maxSKCarryPerHauler);
	            }

	            limits.reserver = limits.reserverQueue.length;
	            if (neededRemoteBuilders > 0) limits.remotebuilder = neededRemoteBuilders;
	        }

	        // --- Dynamic Hauler Sizing & Dedication ---
	        limits.haulerQueue = [];
	        limits.remotehauler = 0;

	        const colony = commonjsGlobal.State?.colonies?.get(roomName);
	        if (colony && colony.sources && colony.sources.length > 0) {
	            for (let i = 0; i < colony.sources.length; i++) {
	                const source = colony.sources[i];
	                const distance = RouteDistanceCalculator.getDistance(source.id, source.pos, roomName);

	                // --- Tigga Mathematical Hauler Sizing ---
	                // n = required capacity multiplier (each n = 100 carry capacity = 2 CARRY, 1 MOVE)
	                const n = Math.ceil(distance / 5);

	                // Base cost: each n costs 150 energy
	                const requiredEnergy = n * 150;

	                const cappedEnergy = Math.min(requiredEnergy, energyCapacity || 300);
	                const neededCount = Math.max(1, Math.ceil(requiredEnergy / cappedEnergy));

	                const isRemote = source.pos.roomName !== roomName;
	                const isSKRoom = Memory.rooms[source.pos.roomName] && Memory.rooms[source.pos.roomName].roomType === 'sk';

	                let roleName = 'hauler';
	                if (isRemote) {
	                    roleName = isSKRoom ? 'skhauler' : 'remotehauler';
	                }

	                limits[roleName] = (limits[roleName] || 0) + neededCount;

	                limits.haulerQueue.push({
	                    role: roleName,
	                    targetSource: source.id,
	                    targetRoom: source.pos.roomName,
	                    count: neededCount,
	                    energy: cappedEnergy
	                });
	            }
	        } else {
	            limits.hauler = Math.max(limits.hauler, 2);
	        }
	        // ------------------------------------------

	        if (Memory.empire && Memory.empire.colonizeRoom) {
	            limits.claimer = 1;
	        }

	        let needsScout = false;
	        // Initiates passive intel ingestion at RCL 2 to prepare for early remote expansion.
	        if (rcl >= 2 && roomName) {
	            const queue = [{ name: roomName, depth: 0 }];
	            let qIdx = 0;
	            const visited = new Set([roomName]);
	            const threshold = 10000;

	            while (qIdx < queue.length) {
	                const current = queue[qIdx++];

	                const mem = Memory.rooms && Memory.rooms[current.name];
	                if (!mem || !mem.scoutedAt || (Game.time - mem.scoutedAt) > threshold) {
	                    needsScout = true;
	                    break;
	                }

	                if (current.depth < 2) {
	                    const exits = Game.map.describeExits(current.name);
	                    if (exits) {
	                        for (const dir in exits) {
	                            const adjRoom = exits[dir];
	                            // Skip SK rooms and Sector Centers via fast string parsing (e.g. W4N5)
	                            // Sector centers are coordinates containing 4,5,6
	                            const strLen = adjRoom.length;
	                            let xStr = "", yStr = "";
	                            let parsingX = true;
	                            for (let i = 1; i < strLen; i++) {
	                                const char = adjRoom[i];
	                                if (char === 'N' || char === 'S') { parsingX = false; continue; }
	                                if (parsingX) xStr += char; else yStr += char;
	                            }
	                            const x = parseInt(xStr, 10) % 10;
	                            const y = parseInt(yStr, 10) % 10;
	                            if ((x >= 4 && x <= 6) && (y >= 4 && y <= 6)) continue;

	                            if (!visited.has(adjRoom)) {
	                                visited.add(adjRoom);
	                                queue.push({ name: adjRoom, depth: current.depth + 1 });
	                            }
	                        }
	                    }
	                }
	            }
	        }

	        let hasObserver = false;
	        if (roomState && roomState.observers && roomState.observers.length > 0) {
	            hasObserver = true;
	        }
	        limits.scout = (needsScout && !hasObserver) ? 1 : 0;

	        let hostilesFound = false;
	        let totalHostiles = [];
	        if (roomState && roomState.hostiles && roomState.hostileCount > 0) {
	            hostilesFound = true;
	            totalHostiles = totalHostiles.concat(roomState.hostiles);
	        }
	        if (roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
	            const outposts = Memory.rooms[roomName].outposts;
	            for (let i = 0; i < outposts.length; i++) {
	                const outpostState = commonjsGlobal.State?.rooms?.get(outposts[i]);
	                if (outpostState && outpostState.hostiles && outpostState.hostileCount > 0) {
	                    hostilesFound = true;
	                    totalHostiles = totalHostiles.concat(outpostState.hostiles);
	                }
	            }
	        }

	        // Expansion defense logic
	        if (Memory.empire && Memory.empire.colonizeRoom && Memory.empire.colonizeSourceColony === roomName) {
	            const expState = commonjsGlobal.State?.rooms?.get(Memory.empire.colonizeRoom);
	            if (expState && expState.hostiles && expState.hostileCount > 0) {
	                hostilesFound = true;
	                totalHostiles = totalHostiles.concat(expState.hostiles);
	            }
	        }
	        if (hostilesFound) {
	            limits.defender = 2; // Priority 0 during an active siege
	        }

	        const hasOffensiveQueue = commonjsGlobal.State && commonjsGlobal.State.militaryQueue && commonjsGlobal.State.militaryQueue.length > 0;
	        if (hostilesFound) {
	            // Defensive scaling
	            let defensiveThreat = MilitaryManager.getThreatIndex(totalHostiles);
	            const singleCreepCapacity = Math.max(150, Math.floor((energyCapacity || 300) / 130) * 30);
	            const defensiveSquads = Math.max(1, Math.ceil((defensiveThreat * 1.5) / singleCreepCapacity));

	            limits.meleeCreep = (limits.meleeCreep || 0) + defensiveSquads;
	            limits.rangerCreep = (limits.rangerCreep || 0) + defensiveSquads;
	            limits.medicCreep = (limits.medicCreep || 0) + defensiveSquads;
	        }

	        if (rcl >= 4 && hasOffensiveQueue) {
	            const threatIndex = commonjsGlobal.State.militaryQueue[0].threatIndex || 0;

	            // Estimate single creep max DPS at current RCL energy capacity
	            const singleCreepCapacity = Math.floor((energyCapacity || 300) / 130) * 30;
	            // Add a 50% buffer to strictly exceed the threat
	            const offensiveSquads = Math.max(1, Math.ceil((threatIndex * 1.5) / singleCreepCapacity));

	            limits.meleeCreep = (limits.meleeCreep || 0) + offensiveSquads;
	            limits.rangerCreep = (limits.rangerCreep || 0) + offensiveSquads;
	            limits.medicCreep = (limits.medicCreep || 0) + offensiveSquads;
	        }

	        // Link Transition Protocol
	        if (roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].sources) {
	            let linkedSources = 0;
	            const sourcesData = Memory.rooms[roomName].sources;
	            for (const id in sourcesData) {
	                if (sourcesData[id] && sourcesData[id].isLinked) {
	                    linkedSources++;
	                }
	            }
	            if (linkedSources > 0) {
	                limits.hauler = Math.max(0, (limits.hauler || 0) - linkedSources);
	            }
	        }

	        return limits;
	    }
	}

	class SpawnManager {
	    static run(spawn, colony) {
	        if (spawn.spawning) return;

	        // Throttle declarative census diffing to save CPU
	        if (Game.time % 10 !== 0) return;

	        if (!spawn.room.controller || !spawn.room.controller.my) return;

	        const roomName = spawn.room.name;
	        const energyCapacity = spawn.room.energyCapacityAvailable;
	        const rcl = spawn.room.controller ? spawn.room.controller.level : 1;
	        const roomState = commonjsGlobal.State?.rooms?.get(roomName);

	        if (!commonjsGlobal.Cache) commonjsGlobal.Cache = {};
	        if (!commonjsGlobal.Cache.tickCensus) commonjsGlobal.Cache.tickCensus = new Map();
	        if (!commonjsGlobal.Cache.tickTargetCensus) commonjsGlobal.Cache.tickTargetCensus = new Map();
	        if (commonjsGlobal.Cache.tickCensusTime !== Game.time) {
	            commonjsGlobal.Cache.tickCensus.clear();
	            commonjsGlobal.Cache.tickTargetCensus.clear();
	            commonjsGlobal.Cache.tickCensusTime = Game.time;
	        }

	        let targetCensus = commonjsGlobal.Cache.tickTargetCensus.get(roomName);
	        if (!targetCensus) {
	            // Evaluates the combined needs of the core room and outposts
	            targetCensus = CensusCalculator.getAllLimits(rcl, roomState, roomName, energyCapacity);
	            commonjsGlobal.Cache.tickTargetCensus.set(roomName, targetCensus);
	        }

	        let censusData = commonjsGlobal.Cache.tickCensus.get(roomName);
	        if (!censusData) {
	            const currentCensus = {};
	            const actualCensus = {};
	            let rawBootstrapperCount = 0;

	            // Replaced flat Game.creeps loop with Colony scope iteration
	            const creeps = colony.creeps;
	            for (let i = 0; i < creeps.length; i++) {
	                const c = creeps[i];
	                const role = c.memory.role;

	                actualCensus[role] = (actualCensus[role] || 0) + 1;
	                if (role === 'bootstrapper') rawBootstrapperCount++;

	                // Fixes Generation Die-offs by dynamically calculating precisely when to spawn the replacement
	                let spawnTime = c.body.length * 3;
	                let travelTime = 15; // default local buffer
	                if (c.memory.targetSource && Memory.sources && Memory.sources[c.memory.targetSource] && Memory.sources[c.memory.targetSource].distance) {
	                    travelTime = Memory.sources[c.memory.targetSource].distance;
	                } else if (c.memory.targetRoom) {
	                    travelTime = 50;
	                }
	                let preSpawnThreshold = spawnTime + travelTime;

	                if (!c.spawning && c.ticksToLive !== undefined && c.ticksToLive < preSpawnThreshold) {
	                    continue;
	                }

	                currentCensus[role] = (currentCensus[role] || 0) + 1;
	            }
	            censusData = { currentCensus, actualCensus, rawBootstrapperCount };
	            commonjsGlobal.Cache.tickCensus.set(roomName, censusData);
	        }

	        const { currentCensus, actualCensus, rawBootstrapperCount } = censusData;

	        const getCount = (role) => currentCensus[role] || 0;
	        const getActualCount = (role) => actualCensus[role] || 0;

	        const harvesterCount = getCount('harvester');
	        const haulerCount = getCount('hauler');

	        const actualHarvesterCount = getActualCount('harvester');
	        const actualHaulerCount = getActualCount('hauler');
	        const needsHaulers = (targetCensus['hauler'] || 0) > 0;

	        // Emergency Protocol
	        if (actualHarvesterCount === 0 && (actualHaulerCount === 0 || !needsHaulers) && getActualCount('bootstrapper') === 0 && rawBootstrapperCount === 0) {
	            this.executeSpawn(spawn, 'bootstrapper', EMERGENCY_BODY);
	            return;
	        }

	        if (actualHarvesterCount === 0 && (actualHaulerCount === 0 || !needsHaulers) && (targetCensus['harvester'] || 0) > 0) {
	            if (rawBootstrapperCount < 2) {
	                this.executeSpawn(spawn, 'bootstrapper', EMERGENCY_BODY);
	                return;
	            }
	        }

	        if (harvesterCount === 0 && (targetCensus['harvester'] || 0) > 0) {
	            const currentEnergy = spawn.room.energyAvailable;
	            const body = currentEnergy >= 300 ? CreepBodyBuilder.getBody('harvester', currentEnergy) : EMERGENCY_BODY;
	            this.executeSpawn(spawn, 'harvester', body);
	            return;
	        }
	        if (harvesterCount >= 1 && haulerCount === 0 && (targetCensus['hauler'] || 0) > 0) {
	            const currentEnergy = Math.max(spawn.room.energyAvailable, 100); // Ensure at least 1 CARRY/MOVE can spawn
	            const body = CreepBodyBuilder.getBody('hauler', currentEnergy);
	            this.executeSpawn(spawn, 'hauler', body);
	            return;
	        }

	        // Prevents economic stalling by mathematically ranking missing roles instead of using static arrays.
	        let spawnRequests = [];

	        const standardRoles = ['hubmanager', 'harvester', 'filler', 'bootstrapper', 'skguard', 'mineralhauler', 'fastfiller', 'defender', 'upgrader', 'builder', 'mineralminer', 'claimer', 'pioneer', 'scout', 'scientist', 'skminer', 'skhauler', 'meleeCreep', 'rangerCreep', 'medicCreep'];

	        let hasCriticalRepairs = false;
	        if (roomState.rampartCount > 0) {
	            for (let i = 0; i < roomState.rampartCount; i++) {
	                if (roomState.ramparts[i].hits < 5000) { hasCriticalRepairs = true; break; }
	            }
	        }
	        if (!hasCriticalRepairs && roomState.repairTargetCount > 0) {
	            for (let i = 0; i < roomState.repairTargetCount; i++) {
	                const target = roomState.repairTargets[i];
	                if ((target.structureType === STRUCTURE_WALL || target.structureType === STRUCTURE_RAMPART) && target.hits < 5000) {
	                    hasCriticalRepairs = true; break;
	                }
	            }
	        }

	        const getScore = (role, current, req = null) => {
	            if (role === 'bootstrapper') return 950;
	            if (role === 'harvester') return current === 0 ? 900 : 800 - current * 10;
	            if (role === 'hauler') return current === 0 ? 850 : 750 - current * 10;
	            if (role === 'hubmanager') return current === 0 ? 880 : 600;
	            if (role === 'fastfiller' || role === 'filler') {
	                const energyRatio = spawn.room.energyCapacityAvailable > 0 ? spawn.room.energyAvailable / spawn.room.energyCapacityAvailable : 1;
	                return 800 + (1 - energyRatio) * 100;
	            }
	            if (role === 'defender' || role === 'skguard') {
	                if (roomState.hostiles && roomState.hostileCount > 0) return 1000;
	                return 700;
	            }
	            if (role === 'meleeCreep' || role === 'rangerCreep' || role === 'medicCreep') return 650;
	            if (role === 'remoteharvester') {
	                let distance = (Memory.sources && req && req.targetSource && Memory.sources[req.targetSource]) ? Memory.sources[req.targetSource].distance : 50;
	                return 500 - distance;
	            }
	            if (role === 'remotehauler') {
	                let distance = (Memory.sources && req && req.targetSource && Memory.sources[req.targetSource]) ? Memory.sources[req.targetSource].distance : 50;
	                let bonus = 0;
	                if (req && req.targetRoom) {
	                    const targetState = commonjsGlobal.State?.rooms?.get(req.targetRoom);
	                    if (targetState && targetState.droppedEnergy) {
	                        for(let i=0; i<targetState.droppedEnergyCount; i++) {
	                            if (targetState.droppedEnergy[i] && targetState.droppedEnergy[i].amount > 500) bonus += 50;
	                        }
	                    }
	                }
	                return 450 - distance + bonus;
	            }
	            if (role === 'reserver') return 400;
	            if (role === 'upgrader' || role === 'builder') {
	                if (role === 'upgrader' && spawn.room.controller && spawn.room.controller.ticksToDowngrade < 20000) return 920;
	                if (role === 'builder' && hasCriticalRepairs && harvesterCount >= 1 && haulerCount >= 1) return 800;
	                return 300 - current * 5;
	            }
	            if (role === 'scout') return 200;
	            return 100;
	        };

	        // 1. Gather Standard Roles
	        for (let i = 0; i < standardRoles.length; i++) {
	            const role = standardRoles[i];
	            const limit = targetCensus[role] || 0;
	            const current = getCount(role);
	            if (current < limit) {
	                spawnRequests.push({ role, score: getScore(role, current), isQueue: false });
	            }
	        }

	        // 2. Gather Queue Roles
	        const queues = [
	            { array: targetCensus.haulerQueue, roleCheck: ['hauler', 'remotehauler'] },
	            { array: targetCensus.remoteHarvesterQueue, roleCheck: ['remoteharvester'] },
	            { array: targetCensus.reserverQueue, roleCheck: ['reserver'] }
	        ];

	        for (let q = 0; q < queues.length; q++) {
	            const qData = queues[q];
	            if (!qData.array) continue;
	            for (let j = 0; j < qData.array.length; j++) {
	                const req = qData.array[j];
	                if (!qData.roleCheck.includes(req.role)) continue;

	                let activeCount = 0;
	                for (let k = 0; k < colony.creeps.length; k++) {
	                    const c = colony.creeps[k];
	                    if (c.memory.role === req.role) {
	                        let match = false;
	                        if (req.role === 'reserver' && c.memory.targetRoom === req.targetRoom) match = true;
	                        else if (req.role !== 'reserver' && c.memory.targetSource === req.targetSource) match = true;

	                        if (match) {
	                            let spawnTime = c.body.length * 3;
	                            let travelTime = 50;
	                            if (req.role !== 'reserver' && Memory.sources && Memory.sources[req.targetSource] && Memory.sources[req.targetSource].distance) {
	                                travelTime = Memory.sources[req.targetSource].distance;
	                            } else if (req.role === 'reserver') {
	                                const route = Game.map.findRoute(spawn.room.name, req.targetRoom);
	                                if (route !== ERR_NO_PATH) travelTime = route.length * 50;
	                            }
	                            let preSpawnThreshold = spawnTime + travelTime;
	                            if (c.spawning || c.ticksToLive >= preSpawnThreshold) {
	                                activeCount++;
	                            }
	                        }
	                    }
	                }

	                const targetLimit = (req.role === 'remoteharvester' || req.role === 'reserver') ? 1 : req.count;
	                if (activeCount < targetLimit) {
	                    spawnRequests.push({ role: req.role, score: getScore(req.role, activeCount, req), isQueue: true, req });
	                }
	            }
	        }

	        spawnRequests.sort((a, b) => b.score - a.score);

	        for (let i = 0; i < spawnRequests.length; i++) {
	            const request = spawnRequests[i];
	            const role = request.role;

	            // Prevents economic cannibalism by completely halting all energy sinks (upgraders/builders) until the energy-gathering workforce is at 100% capacity.
	            if (role === 'builder' || role === 'upgrader' || role === 'scout') {
	                if (role === 'builder' && hasCriticalRepairs) ; else if (role === 'upgrader' && spawn.room.controller && spawn.room.controller.ticksToDowngrade < 20000) ; else if (harvesterCount < (targetCensus['harvester'] || 0) || haulerCount < (targetCensus['hauler'] || 0)) {
	                    continue;
	                }
	            }

	            if (request.isQueue) {
	                const req = request.req;
	                let body;
	                let extraMem = { targetSource: req.targetSource, targetRoom: req.targetRoom };

	                if (role === 'remoteharvester') {
	                    body = CreepBodyBuilder.getBody(role, energyCapacity, { targetRoom: req.targetRoom, isReserved: req.isReserved });
	                } else if (role === 'reserver') {
	                    body = CreepBodyBuilder.getBody(role, energyCapacity);
	                } else {
	                    body = CreepBodyBuilder.getBody(role, req.energy);
	                }

	                if (!body || body.length === 0) continue;

	                let cost = 0;
	                for (let j = 0; j < body.length; j++) cost += BODYPART_COST[body[j]];

	                if (spawn.room.energyAvailable >= cost) {
	                    this.executeSpawn(spawn, role, body, extraMem);
	                    return;
	                } else {
	                    if ((role === 'hauler' || role === 'remotehauler' || role === 'remoteharvester' || role === 'harvester' || role === 'skhauler' || role === 'skminer') && spawn.room.energyAvailable >= 300) {
	                        let scaledBody;
	                        if (role === 'remoteharvester') {
	                            scaledBody = CreepBodyBuilder.getBody(role, spawn.room.energyAvailable, { targetRoom: req.targetRoom, isReserved: req.isReserved });
	                        } else {
	                            scaledBody = CreepBodyBuilder.getBody(role, spawn.room.energyAvailable);
	                        }
	                        if (scaledBody && scaledBody.length > 0) {
	                            let scaledCost = 0;
	                            for (let j = 0; j < scaledBody.length; j++) scaledCost += BODYPART_COST[scaledBody[j]];
	                            if (spawn.room.energyAvailable >= scaledCost) {
	                                this.executeSpawn(spawn, role, scaledBody, extraMem);
	                                return;
	                            }
	                        }
	                    }
	                    return;
	                }
	            } else {
	                const bodyParts = CreepBodyBuilder.getBody(role, energyCapacity);
	                if (!bodyParts || bodyParts.length === 0) continue;

	                let cost = 0;
	                for (let j = 0; j < bodyParts.length; j++) {
	                    cost += BODYPART_COST[bodyParts[j]];
	                }

	                if (spawn.room.energyAvailable >= cost) {
	                    this.executeSpawn(spawn, role, bodyParts);
	                    return;
	                } else {
	                    const isEmergencyUpgrader = role === 'upgrader' && spawn.room.controller && spawn.room.controller.ticksToDowngrade < 20000;
	                    if ((role === 'hauler' || role === 'harvester' || isEmergencyUpgrader) && spawn.room.energyAvailable >= 300) {
	                        const scaledBody = CreepBodyBuilder.getBody(role, spawn.room.energyAvailable);
	                        if (scaledBody && scaledBody.length > 0) {
	                            let scaledCost = 0;
	                            for (let j = 0; j < scaledBody.length; j++) scaledCost += BODYPART_COST[scaledBody[j]];
	                            if (spawn.room.energyAvailable >= scaledCost) {
	                                this.executeSpawn(spawn, role, scaledBody);
	                                return;
	                            }
	                        }
	                    }
	                    // Strict abort: Do not skip to lower priority roles if we are missing a higher priority one but just lack energy.
	                    return;
	                }
	            }
	        }
	    }

	    static executeSpawn(spawn, role, bodyParts, extraMemory = {}) {
	        if (!bodyParts || bodyParts.length === 0) return;
	        const name = role + '_' + Game.time + '_' + Math.floor(Math.random() * 1000);
	        const memory = Object.assign({ role: role, colony: spawn.room.name }, extraMemory);
	        spawn.spawnCreep(bodyParts, name, { memory: memory });
	    }
	}

	SpawnManager_1 = SpawnManager;
	return SpawnManager_1;
}

var StateEnums_1;
var hasRequiredStateEnums;

function requireStateEnums () {
	if (hasRequiredStateEnums) return StateEnums_1;
	hasRequiredStateEnums = 1;
	const StateEnums = {
	    // Creep States
	    STATE_IDLE: 0,
	    STATE_GATHER: 1,
	    STATE_WORK: 2,
	    STATE_FLEE: 3,

	    // Action Intents (matches ActionConstants for ease of migration)
	    ACTION_IDLE: 0,
	    ACTION_HARVEST: 1,
	    ACTION_UPGRADE: 2,
	    ACTION_TRANSFER: 3,
	    ACTION_PICKUP: 4,
	    ACTION_WITHDRAW: 5,
	    ACTION_BUILD: 6,
	    ACTION_REPAIR: 7,
	    ACTION_DROP: 8,
	    ACTION_SCOUT: 9,
	    ACTION_MOVE_ROOM: 10,
	    ACTION_ATTACK: 11,
	    ACTION_RANGED_ATTACK: 12,
	    ACTION_HEAL: 13,
	    ACTION_FLEE: 14,
	    ACTION_PATROL: 15,
	    ACTION_RESERVE: 16,
	    ACTION_CLAIM: 17,
	    ACTION_ATTACK_CONTROLLER: 18,
	    ACTION_TRANSFER_ENERGY: 19,
	    ACTION_RUN_REACTION: 20,
	    ACTION_USE_POWER: 21,
	    ACTION_RENEW: 22,
	    ACTION_ENABLE_ROOM: 23,
	    ACTION_MOVE: 24
	};

	StateEnums_1 = StateEnums;
	return StateEnums_1;
}

var MemoryHeap_1;
var hasRequiredMemoryHeap;

function requireMemoryHeap () {
	if (hasRequiredMemoryHeap) return MemoryHeap_1;
	hasRequiredMemoryHeap = 1;
	class MemoryHeap {
	    static init() {
	        if (!commonjsGlobal.MemoryHeap) {
	            commonjsGlobal.MemoryHeap = {
	                creepState: new Int8Array(10000),     // Flat array for state enums
	                moveIntents: new Uint32Array(10000),  // Packed coordinates (roomID << 12 | x << 6 | y)
	                actionIntents: new Map(),             // intent payloads grouped by target or action

	                // Indexing for numerical mapping
	                creepRegistry: new Map(),             // Map creepName -> id
	                idPool: [],                           // Free ids

	                roomRegistry: new Map(),              // Map roomName -> roomID
	                roomIdPool: [],
	                nextRoomId: 1
	            };

	            for (let i = 9999; i >= 1; i--) {
	                commonjsGlobal.MemoryHeap.idPool.push(i);
	            }
	        }
	    }

	    static getCreepId(creepName) {
	        if (!commonjsGlobal.MemoryHeap.creepRegistry.has(creepName)) {
	            const id = commonjsGlobal.MemoryHeap.idPool.pop();
	            if (id === undefined) throw new Error("Creep ID pool exhausted!");
	            commonjsGlobal.MemoryHeap.creepRegistry.set(creepName, id);
	        }
	        return commonjsGlobal.MemoryHeap.creepRegistry.get(creepName);
	    }

	    static freeCreepId(creepName) {
	        if (commonjsGlobal.MemoryHeap.creepRegistry.has(creepName)) {
	            const id = commonjsGlobal.MemoryHeap.creepRegistry.get(creepName);
	            commonjsGlobal.MemoryHeap.idPool.push(id);
	            commonjsGlobal.MemoryHeap.creepState[id] = 0;
	            commonjsGlobal.MemoryHeap.moveIntents[id] = 0;
	            commonjsGlobal.MemoryHeap.creepRegistry.delete(creepName);
	        }
	    }

	    static getRoomId(roomName) {
	        if (!commonjsGlobal.MemoryHeap.roomRegistry.has(roomName)) {
	            let id;
	            if (commonjsGlobal.MemoryHeap.roomIdPool.length > 0) {
	                id = commonjsGlobal.MemoryHeap.roomIdPool.pop();
	            } else {
	                id = commonjsGlobal.MemoryHeap.nextRoomId++;
	            }
	            commonjsGlobal.MemoryHeap.roomRegistry.set(roomName, id);
	        }
	        return commonjsGlobal.MemoryHeap.roomRegistry.get(roomName);
	    }

	    static registerIntent(intentPayload) {
	        // payload: { c: creepName, a: actionEnum, targetId: id, x, y, p: priority }
	        // Group by targetId for structures or just push to an array
	        const target = intentPayload.targetId || 'global';
	        if (!commonjsGlobal.MemoryHeap.actionIntents.has(target)) {
	            commonjsGlobal.MemoryHeap.actionIntents.set(target, []);
	        }
	        commonjsGlobal.MemoryHeap.actionIntents.get(target).push(intentPayload);
	    }

	    static clearIntents() {
	        commonjsGlobal.MemoryHeap.actionIntents.clear();
	    }
	}

	MemoryHeap_1 = MemoryHeap;
	return MemoryHeap_1;
}

var ActionExecutor_1;
var hasRequiredActionExecutor;

function requireActionExecutor () {
	if (hasRequiredActionExecutor) return ActionExecutor_1;
	hasRequiredActionExecutor = 1;
	const ActionConstants = requireActionConstants();
	const StateEnums = requireStateEnums();
	const CacheLib = requireCacheLib();
	const MemoryHeap = requireMemoryHeap();

	/**
	 * Maps intents directly to Screeps API calls, bypassing roles entirely.
	 */
	class ActionExecutor {
	    static run() {
	        MemoryHeap.init();
	        if (!commonjsGlobal.creepHeap) commonjsGlobal.creepHeap = new Map();
	        if (!commonjsGlobal.structureHeap) commonjsGlobal.structureHeap = new Map();

	        const allCreeps = Object.values(Game.creeps).concat(Object.values(Game.powerCreeps));
	        for (const creep of allCreeps) {
	            try {
	                if (creep.fatigue && creep.fatigue > 0) continue;
	                if (creep.ticksToLive === undefined && !creep.name.includes('Operator')) {
	                    if (creep.spawning) continue;
	                }

	                let heap = commonjsGlobal.creepHeap.get(creep.name);
	                if (!heap) {
	                    heap = CacheLib.getDefaultHeap();
	                    commonjsGlobal.creepHeap.set(creep.name, heap);
	                }
	                creep.heap = heap;

	                if (Game.time < heap.sleepUntil) continue;

	                // 1. Movement Execution
	                if (heap.moveDirection) {
	                    creep.move(heap.moveDirection);
	                    heap.moveDirection = null; // Clear after execution
	                }

	                // 2. Opportunistic Execution
	                if (heap.opportunisticTarget) {
	                    const oppTarget = CacheLib.getById(heap.opportunisticTarget);
	                    if (oppTarget) {
	                        creep.repair(oppTarget);
	                    }
	                    heap.opportunisticTarget = null;
	                }

	                const intent = heap.actionIntent;
	                if (!intent || intent === ActionConstants.ACTION_IDLE) continue;

	                if (intent === ActionConstants.ACTION_MOVE_ROOM) {
	                    // Improves architectural consistency by stripping tactical routing from the ActionExecutor
	                    continue;
	                }

	                const target = heap.targetId ? CacheLib.getById(heap.targetId) : null;
	                if (heap.targetId && !target) {
	                    heap.state = 'idle';
	                    heap.actionIntent = ActionConstants.ACTION_IDLE;
	                    heap.targetId = null;
	                    continue;
	                }

	                ActionExecutor.executeIntent(creep, heap, intent, target);
	            } catch (err) {
	                console.log(`[ERROR] ActionExecutor crashed for creep ${creep.name}: ${err.message}\n${err.stack}`);
	            }
	        }

	        // Process MemoryHeap Intended Payloads (New Architecture)
	        for (const [targetId, intents] of commonjsGlobal.MemoryHeap.actionIntents.entries()) {
	            for (let i = 0; i < intents.length; i++) {
	                const intentPayload = intents[i];
	                const creep = Game.creeps[intentPayload.c] || Game.powerCreeps[intentPayload.c];
	                if (!creep) continue;
	                const target = CacheLib.getById(targetId) || null;
	                ActionExecutor.executeMemoryHeapIntent(creep, intentPayload, target);
	            }
	        }
	        MemoryHeap.clearIntents();

	        // Process Structure Native Calls
	        for (const [structureId, heap] of commonjsGlobal.structureHeap.entries()) {
	            const structure = CacheLib.getById(structureId);
	            if (!structure || !heap.actionIntent) continue;

	            const intent = heap.actionIntent;
	            const target = heap.targetId ? CacheLib.getById(heap.targetId) : null;

	            if (intent === ActionConstants.ACTION_ATTACK && target) structure.attack(target);
	            else if (intent === ActionConstants.ACTION_HEAL && target) structure.heal(target);
	            else if (intent === ActionConstants.ACTION_REPAIR && target) structure.repair(target);
	            else if (intent === ActionConstants.ACTION_TRANSFER_ENERGY && target) structure.transferEnergy(target);
	            else if (intent === ActionConstants.ACTION_RUN_REACTION) {
	                const r1 = heap.targetId ? CacheLib.getById(heap.targetId) : null;
	                const r2 = heap.secondaryTargetId ? CacheLib.getById(heap.secondaryTargetId) : null;
	                if (r1 && r2) structure.runReaction(r1, r2);
	            }
	        }
	        commonjsGlobal.structureHeap.clear();
	    }

	    static executeMemoryHeapIntent(creep, payload, target) {
	        let result = ERR_INVALID_TARGET;
	        const intentNum = payload.a;

	        if (intentNum === StateEnums.ACTION_HARVEST) result = creep.harvest(target);
	        else if (intentNum === StateEnums.ACTION_WITHDRAW) result = creep.withdraw(target, payload.res || RESOURCE_ENERGY);
	        else if (intentNum === StateEnums.ACTION_TRANSFER) result = creep.transfer(target, payload.res || RESOURCE_ENERGY);
	        else if (intentNum === StateEnums.ACTION_UPGRADE) result = creep.upgradeController(target);
	        else if (intentNum === StateEnums.ACTION_BUILD) result = creep.build(target);
	        else if (intentNum === StateEnums.ACTION_REPAIR) result = creep.repair(target);
	        else if (intentNum === StateEnums.ACTION_PICKUP) result = creep.pickup(target);
	        else if (intentNum === StateEnums.ACTION_DROP) result = creep.drop(payload.res || RESOURCE_ENERGY);
	        else if (intentNum === StateEnums.ACTION_ATTACK) result = creep.attack(target);
	        else if (intentNum === StateEnums.ACTION_RANGED_ATTACK) result = creep.rangedAttack(target);
	        else if (intentNum === StateEnums.ACTION_HEAL) result = creep.heal(target);
	        else if (intentNum === StateEnums.ACTION_RESERVE) result = creep.reserveController(target);
	        else if (intentNum === StateEnums.ACTION_CLAIM) result = creep.claimController(target);
	        else if (intentNum === StateEnums.ACTION_ATTACK_CONTROLLER) result = creep.attackController(target);
	        else if (intentNum === StateEnums.ACTION_USE_POWER) result = creep.usePower(payload.powerId, target);
	        else if (intentNum === StateEnums.ACTION_RENEW) result = creep.renew(target);
	        else if (intentNum === StateEnums.ACTION_ENABLE_ROOM) result = creep.enableRoom(target);

	        return result;
	    }

	    static executeIntent(creep, heap, intent, target) {
	        let result = ERR_INVALID_TARGET;

	        if (heap.secondaryIntent) {
	            const secTarget = heap.secondaryTargetId ? CacheLib.getById(heap.secondaryTargetId) : null;
	            if (heap.secondaryIntent === ActionConstants.ACTION_PICKUP && secTarget) {
	                creep.pickup(secTarget);
	            }
	        }

	        if (intent === ActionConstants.ACTION_HARVEST) {
	            result = creep.harvest(target);
	        } else if (intent === ActionConstants.ACTION_WITHDRAW) {
	            let res = RESOURCE_ENERGY;
	            if (target.store) {
	                const keys = Object.keys(target.store);
	                let maxAmt = -1;
	                for (let i = 0; i < keys.length; i++) {
	                    const amt = target.store.getUsedCapacity(keys[i]);
	                    if (amt > maxAmt) { maxAmt = amt; res = keys[i]; }
	                }
	            }
	            result = creep.withdraw(target, res);
	        } else if (intent === ActionConstants.ACTION_TRANSFER) {
	            let res = RESOURCE_ENERGY;
	            if (creep.store) {
	                const keys = Object.keys(creep.store);
	                for (let i = 0; i < keys.length; i++) {
	                    if (creep.store.getUsedCapacity(keys[i]) > 0) {
	                        res = keys[i];
	                        if (res !== RESOURCE_ENERGY) break;
	                    }
	                }
	            }
	            result = creep.transfer(target, res);
	        } else if (intent === ActionConstants.ACTION_BUILD) {
	            result = creep.build(target);
	        } else if (intent === ActionConstants.ACTION_REPAIR) {
	            result = creep.repair(target);
	        } else if (intent === ActionConstants.ACTION_UPGRADE) {
	            result = creep.upgradeController(target);
	        } else if (intent === ActionConstants.ACTION_PICKUP) {
	            result = creep.pickup(target);
	        } else if (intent === ActionConstants.ACTION_DROP) {
	            let res = RESOURCE_ENERGY;
	            if (creep.store) {
	                const keys = Object.keys(creep.store);
	                for (let i = 0; i < keys.length; i++) {
	                    if (creep.store.getUsedCapacity(keys[i]) > 0) {
	                        res = keys[i];
	                        if (res !== RESOURCE_ENERGY) break;
	                    }
	                }
	            }
	            result = creep.drop(res);
	        } else if (intent === ActionConstants.ACTION_ATTACK) {
	            result = creep.attack(target);
	        } else if (intent === ActionConstants.ACTION_RANGED_ATTACK) {
	            result = creep.rangedAttack(target);
	        } else if (intent === ActionConstants.ACTION_HEAL) {
	            result = creep.heal(target);
	        } else if (intent === ActionConstants.ACTION_DISMANTLE) {
	            result = creep.dismantle(target);
	        } else if (intent === ActionConstants.ACTION_RESERVE) {
	            result = creep.reserveController(target);
	        } else if (intent === ActionConstants.ACTION_CLAIM) {
	            result = creep.claimController(target);
	        } else if (intent === ActionConstants.ACTION_ATTACK_CONTROLLER) {
	            result = creep.attackController(target);
	        } else if (intent === ActionConstants.ACTION_USE_POWER) {
	            result = creep.usePower(heap.powerId, target);
	        } else if (intent === ActionConstants.ACTION_RENEW) {
	            result = creep.renew(target);
	        } else if (intent === ActionConstants.ACTION_ENABLE_ROOM) {
	            result = creep.enableRoom(target);
	        }

	        if (result === ERR_NOT_IN_RANGE) {
	            let range = 1;
	            if (intent === ActionConstants.ACTION_UPGRADE || intent === ActionConstants.ACTION_BUILD || intent === ActionConstants.ACTION_REPAIR || intent === ActionConstants.ACTION_RANGED_ATTACK) range = 3;
	            if (intent === ActionConstants.ACTION_DROP && target && target.memory && target.memory.role === 'upgrader') range = 1;
	            else if (intent === ActionConstants.ACTION_DROP) range = 3;

	            heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range };
	        } else if (result === OK || result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_FULL || result === ERR_INVALID_TARGET) {
	            if (intent !== ActionConstants.ACTION_HARVEST) {
	                heap.state = 'idle';
	                heap.actionIntent = ActionConstants.ACTION_IDLE;
	                heap.targetId = null;
	            }
	        }
	    }


	}

	ActionExecutor_1 = ActionExecutor;
	return ActionExecutor_1;
}

var MemoryCleanupManager_1;
var hasRequiredMemoryCleanupManager;

function requireMemoryCleanupManager () {
	if (hasRequiredMemoryCleanupManager) return MemoryCleanupManager_1;
	hasRequiredMemoryCleanupManager = 1;
	const MemoryHeap = requireMemoryHeap();

	/**
	 * Clears memory of dead creeps and stale heap entries to prevent bloat.
	 */
	class MemoryCleanupManager {
	    static run() {
	        MemoryHeap.init();
	        if (!commonjsGlobal.creepHeap) commonjsGlobal.creepHeap = new Map();

	        for (const name in Game.creeps) {
	            const creep = Game.creeps[name];
	            if (!commonjsGlobal.creepHeap.has(name)) {
	                commonjsGlobal.creepHeap.set(name, { state: 'idle', stallCount: 0 });
	            }
	            creep.heap = commonjsGlobal.creepHeap.get(name);
	        }

	        for (const name of commonjsGlobal.creepHeap.keys()) {
	            if (!Game.creeps[name]) {
	                commonjsGlobal.creepHeap.delete(name);
	                MemoryHeap.freeCreepId(name);
	            }
	        }

	        // Run every 10 ticks to save CPU for Memory cleanup
	        if (Game.time % 10 !== 0) return;

	        for (const name in Memory.creeps) {
	            if (!Game.creeps[name]) {
	                delete Memory.creeps[name];
	            }
	        }
	    }
	}

	MemoryCleanupManager_1 = MemoryCleanupManager;
	return MemoryCleanupManager_1;
}

var ScoutingManager_1;
var hasRequiredScoutingManager;

function requireScoutingManager () {
	if (hasRequiredScoutingManager) return ScoutingManager_1;
	hasRequiredScoutingManager = 1;
	const ActionConstants = requireActionConstants();

	class ScoutingManager {
	    static run() {
	        if (Game.time % 20 !== 0) return;
	        for (const name in Game.creeps) {
	            const creep = Game.creeps[name];
	            if ((creep.memory.role || '').toLowerCase() !== 'scout' || creep.spawning) continue;

	            const roomState = commonjsGlobal.State?.rooms?.get(creep.memory.colony);
	            if (roomState && roomState.observers && roomState.observers.length > 0) {
	                creep.suicide();

	                // Prevent downstream managers from crashing on the dead object proxy
	                const currentRoomState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	                if (currentRoomState && currentRoomState.creeps) {
	                    const idx = currentRoomState.creeps.indexOf(creep);
	                    if (idx > -1) currentRoomState.creeps.splice(idx, 1);
	                }
	                continue;
	            }

	            // 1. Intent Preservation: If it has ANY destination, it hasn't arrived yet. Let TrafficManager finish.
	            // Improves execution stability by preventing the scout from overwriting its own destination.
	            if (creep.heap.destination) {
	                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
	                continue;
	            }

	            // 3. Target Selection: Safe inside a room, needs a new room to scout
	            const exits = Game.map.describeExits(creep.room.name);
	            if (!exits) continue;

	            let oldestRoom = null;
	            let oldestTime = Infinity;

	            if (!creep.heap.visitedRooms) creep.heap.visitedRooms = [];

	            for (const dir in exits) {
	                const exitRoom = exits[dir];

	                // Prevents fatal pathing deadlocks by utilizing the Game.map API to filter out walled-off beginner sectors and closed map areas.
	                // Safeguarded against older local server API versions where getRoomStatus is undefined.
	                const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(exitRoom) : null;
	                if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) {
	                    continue;
	                }

	                // Avoid Source Keeper / Sector Center rooms to prevent instant death loops
	                if (ScoutingManager.isKeeperRoom(exitRoom)) continue;

	                // Avoid immediate backtracking
	                if (creep.heap.visitedRooms.includes(exitRoom) && Object.keys(exits).length > 1) {
	                    continue;
	                }

	                const scoutedAt = Memory.rooms[exitRoom]?.scoutedAt || 0;
	                if (scoutedAt < oldestTime) {
	                    oldestTime = scoutedAt;
	                    oldestRoom = exitRoom;
	                }
	            }

	            // Fallback: If all exits are visited or SK rooms, pick the oldest valid one anyway
	            if (!oldestRoom) {
	                for (const dir in exits) {
	                    const exitRoom = exits[dir];

	                    const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(exitRoom) : null;
	                    if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) {
	                        continue;
	                    }

	                    if (ScoutingManager.isKeeperRoom(exitRoom)) continue;

	                    const scoutedAt = Memory.rooms[exitRoom]?.scoutedAt || 0;
	                    if (scoutedAt < oldestTime) {
	                        oldestTime = scoutedAt;
	                        oldestRoom = exitRoom;
	                    }
	                }
	            }

	            if (oldestRoom) {
	                // Update visited rooms history without duplicating the current room erroneously
	                if (creep.heap.visitedRooms[creep.heap.visitedRooms.length - 1] !== creep.room.name) {
	                    creep.heap.visitedRooms.push(creep.room.name);
	                }
	                if (creep.heap.visitedRooms.length > 3) {
	                    creep.heap.visitedRooms.shift();
	                }

	                creep.heap.destination = { x: 25, y: 25, roomName: oldestRoom, range: 20 };
	                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
	            }
	        }
	    }

	    /**
	     * Determines if a room is a Source Keeper room or Sector Center based on coordinate math.
	     * Prevents scouts from wandering into instant-death zones.
	     */
	    static isKeeperRoom(roomName) {
	        const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
	        if (!parsed) return false;

	        const x = parseInt(parsed[1]) % 10;
	        const y = parseInt(parsed[2]) % 10;

	        // Rooms ending in 4, 5, or 6 in both X and Y are SK rooms or the Sector Center
	        return (x >= 4 && x <= 6) && (y >= 4 && y <= 6);
	    }

	    /**
	     * Adds mathematical coordinate parsing to identify cross-map transit corridors.
	     */
	    static isHighway(roomName) {
	        const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
	        if (!parsed) return false;

	        const x = parseInt(parsed[1], 10);
	        const y = parseInt(parsed[2], 10);

	        return (x % 10 === 0) || (y % 10 === 0);
	    }
	}

	ScoutingManager_1 = ScoutingManager;
	return ScoutingManager_1;
}

/**
 * Top-Down Intelligence Manager
 * Serializes visible room data to Memory and queues scouting targets.
 */

var IntelManager_1;
var hasRequiredIntelManager;

function requireIntelManager () {
	if (hasRequiredIntelManager) return IntelManager_1;
	hasRequiredIntelManager = 1;
	const ScoutingManager = requireScoutingManager();

	const createRoomMemoryTemplate = () => ({
	    scoutedAt: 0,
	    roomType: 'core', // Enriches the global intel cache with structural map typings, allowing military and economic managers to make O(1) strategic decisions without redundant API calls.
	    accessStatus: 'normal',
	    sources: [], // Stores { id, x, y }
	    mineral: null, // Stores { id, type, x, y }
	    controller: { owner: null, level: 0, safeMode: 0, x: 0, y: 0 },
	    droppedEnergy: 0,
	    hostiles: { creeps: 0, towers: 0, invaderCore: false, dps: 0, hps: 0 }
	});

	class IntelManager {
	    static run() {
	        if (!Memory.rooms) {
	            Memory.rooms = {};
	        }

	        if (!Memory.rooms) {
	            Memory.rooms = {};
	        }

	        IntelManager.processObservers();

	        const visibleRooms = Object.keys(Game.rooms);

	        // Update threat and energy levels for all visible rooms EVERY TICK
	        for (let i = 0; i < visibleRooms.length; i++) {
	            const room = Game.rooms[visibleRooms[i]];
	            IntelManager.updateThreatAndEnergy(room);

	            // Passive Scraping: instantly grab data if unscouted or stale
	            const mem = Memory.rooms[room.name];
	            if (!mem || !mem.scoutedAt || (Game.time - mem.scoutedAt > 500)) {
	                IntelManager.scanAndSave(room);
	            }
	        }

	        if (Game.cpu.bucket <= 500) return;
	        // Run every 10 ticks to save CPU
	        if (Game.time % 10 !== 0) return;

	        for (let i = 0; i < visibleRooms.length; i++) {
	            const room = Game.rooms[visibleRooms[i]];
	            IntelManager.scanAndSave(room);
	            if (room.controller && room.controller.my && room.controller.level >= 3) {
	                IntelManager.evaluateOutposts(room);
	            }
	        }

	        commonjsGlobal.State.scoutQueue = IntelManager.buildScoutQueue(visibleRooms);
	    }

	    static updateThreatAndEnergy(room) {
	        if (!Memory.rooms) Memory.rooms = {};
	        let mem = Memory.rooms[room.name];
	        if (!mem) return;

	        const state = commonjsGlobal.State.rooms.get(room.name);
	        if (!state) return;

	        if (!mem.hostiles) mem.hostiles = { creeps: 0, towers: 0, invaderCore: false, dps: 0, hps: 0 };

	        const hostileCreeps = state.hostiles || [];
	        const towers = state.towers || [];
	        let hostileTowerCount = 0;
	        let totalDps = 0;
	        let totalHps = 0;

	        for (let i = 0; i < towers.length; i++) {
	            if (!towers[i].my && towers[i].structureType === STRUCTURE_TOWER) {
	                hostileTowerCount++;
	                totalDps += 600;
	                totalHps += 400;
	            }
	        }
	        const invaderCores = state.invaderCores || [];

	        for (let i = 0; i < hostileCreeps.length; i++) {
	            const creep = hostileCreeps[i];
	            const body = creep.body;
	            if (body) {
	                for (let j = 0; j < body.length; j++) {
	                    const type = body[j].type;
	                    if (type === ATTACK) totalDps += 30;
	                    else if (type === RANGED_ATTACK) totalDps += 10;
	                    else if (type === HEAL) totalHps += 12;
	                }
	            }
	        }

	        mem.hostiles.creeps = hostileCreeps.length;
	        mem.hostiles.towers = hostileTowerCount;
	        mem.hostiles.invaderCore = invaderCores.length > 0;
	        mem.hostiles.dps = totalDps;
	        mem.hostiles.hps = totalHps;

	        const drops = state.droppedEnergy || [];
	        let totalDrops = 0;
	        for (let i = 0; i < drops.length; i++) {
	            totalDrops += drops[i].amount;
	        }
	        mem.droppedEnergy = totalDrops;
	    }

	    static scanAndSave(room) {
	        if (!Memory.rooms) {
	            Memory.rooms = {};
	        }

	        let mem = Memory.rooms[room.name];
	        if (!mem) {
	            mem = createRoomMemoryTemplate();
	            Memory.rooms[room.name] = mem;
	        }

	        mem.scoutedAt = Game.time;

	        if (ScoutingManager.isHighway(room.name)) mem.roomType = 'highway';
	        else if (ScoutingManager.isKeeperRoom(room.name)) mem.roomType = 'sk';
	        else mem.roomType = 'core';

	        const status = Game.map.getRoomStatus(room.name);
	        mem.accessStatus = status ? status.status : 'normal';

	        // Ensure nested objects exist in case of schema updates on existing memory
	        if (!mem.controller) mem.controller = { owner: null, level: 0, safeMode: 0, x: 0, y: 0 };
	        if (!mem.hostiles) mem.hostiles = { creeps: 0, towers: 0, invaderCore: false, dps: 0, hps: 0 };

	        const state = commonjsGlobal.State.rooms.get(room.name);
	        if (!state) return;

	        // 1. Detailed Source Intelligence
	        const sources = state.sources || [];
	        const memSources = [];
	        for (let i = 0; i < sources.length; i++) {
	            memSources.push({
	                id: sources[i].id,
	                x: sources[i].pos.x,
	                y: sources[i].pos.y
	            });
	        }
	        mem.sources = memSources;

	        // 2. Controller Intelligence
	        const controllerObj = mem.controller;
	        if (room.controller) {
	            controllerObj.owner = room.controller.owner ? room.controller.owner.username : null;
	            controllerObj.level = room.controller.level;
	            controllerObj.safeMode = room.controller.safeMode || 0;
	            controllerObj.x = room.controller.pos.x;
	            controllerObj.y = room.controller.pos.y;
	            if (room.controller.reservation) {
	                controllerObj.reservation = {
	                    username: room.controller.reservation.username,
	                    ticksToEnd: room.controller.reservation.ticksToEnd
	                };
	            } else {
	                controllerObj.reservation = null;
	            }
	        } else {
	            controllerObj.owner = null;
	            controllerObj.reservation = null;
	        }

	        // 3. Mineral Intelligence
	        const mineral = state.mineral;
	        if (mineral) {
	            mem.mineral = {
	                id: mineral.id,
	                type: mineral.mineralType,
	                x: mineral.pos.x,
	                y: mineral.pos.y
	            };
	        } else {
	            mem.mineral = null;
	        }

	        // 4. Hostile Threat Assessment
	        const hostileCreeps = state.hostiles || [];
	        const towers = state.towers || [];

	        let hostileTowerCount = 0;
	        for (let i = 0; i < towers.length; i++) {
	            if (!towers[i].my && towers[i].structureType === STRUCTURE_TOWER) {
	                hostileTowerCount++;
	            }
	        }

	        const invaderCores = state.invaderCores || [];

	        const hostilesObj = mem.hostiles;
	        hostilesObj.creeps = hostileCreeps.length;
	        hostilesObj.towers = hostileTowerCount;
	        hostilesObj.invaderCore = invaderCores.length > 0;

	        // 5. Scavenging Data
	        const drops = state.droppedEnergy || [];
	        let totalDrops = 0;
	        for (let i = 0; i < drops.length; i++) {
	            totalDrops += drops[i].amount;
	        }
	        mem.droppedEnergy = totalDrops;
	    }

	    static buildScoutQueue(visibleRooms) {
	        if (!Memory.rooms) {
	            Memory.rooms = {};
	        }

	        const queue = [];
	        for (let i = 0; i < visibleRooms.length; i++) {
	            const exits = Game.map.describeExits(visibleRooms[i]);
	            if (!exits) continue;

	            const exitRooms = Object.values(exits);
	            for (let j = 0; j < exitRooms.length; j++) {
	                const adjRoom = exitRooms[j];
	                const mem = Memory.rooms[adjRoom];
	                // Reduced from 5000 to 3000. Hostile data goes stale fast.
	                if (!mem || (Game.time - mem.scoutedAt > 3000)) {
	                    if (!queue.includes(adjRoom)) {
	                        queue.push(adjRoom);
	                    }
	                }
	            }
	        }
	        return queue;
	    }

	    static processObservers() {
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;
	        if (!commonjsGlobal.Cache.observerQueues) commonjsGlobal.Cache.observerQueues = {};

	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            const roomState = commonjsGlobal.State.rooms.get(colony.name);
	            if (!roomState || !roomState.observers || roomState.observers.length === 0) continue;

	            const observer = roomState.observers[0];
	            const queueKey = colony.name;

	            // Generate Queue if empty
	            if (!commonjsGlobal.Cache.observerQueues[queueKey] || commonjsGlobal.Cache.observerQueues[queueKey].length === 0) {
	                commonjsGlobal.Cache.observerQueues[queueKey] = IntelManager.generateObserverQueue(colony.name);
	            }

	            const queue = commonjsGlobal.Cache.observerQueues[queueKey];
	            if (queue.length > 0) {
	                // Find next target needing scouting
	                let targetScouted = true;
	                let targetRoom = null;

	                while (targetScouted && queue.length > 0) {
	                    targetRoom = queue.shift(); // take from front
	                    const mem = Memory.rooms[targetRoom];
	                    // If unscouted or older than 5000 ticks, it's a valid target
	                    if (!mem || !mem.scoutedAt || (Game.time - mem.scoutedAt > 5000)) {
	                        targetScouted = false;
	                    }
	                }

	                if (!targetScouted && targetRoom) {
	                    observer.observeRoom(targetRoom);
	                    // Push to back of queue so we eventually cycle through all again
	                    queue.push(targetRoom);
	                }
	            }
	        }
	    }

	    static generateObserverQueue(centerRoomName) {
	        const queue = [];
	        const match = centerRoomName.match(/^([WE])(\d+)([NS])(\d+)$/);
	        if (!match) return queue;

	        let wx = parseInt(match[2]);
	        let wy = parseInt(match[4]);
	        if (match[1] === 'W') wx = ~wx;
	        if (match[3] === 'S') wy = ~wy;

	        for (let dx = -10; dx <= 10; dx++) {
	            for (let dy = -10; dy <= 10; dy++) {
	                if (dx === 0 && dy === 0) continue;
	                const tx = wx + dx;
	                const ty = wy + dy;

	                const p1 = tx < 0 ? 'W' + (~tx) : 'E' + tx;
	                const p2 = ty < 0 ? 'S' + (~ty) : 'N' + ty;
	                const targetName = p1 + p2;

	                // Ensure it exists on the map
	                if (Game.map.getRoomStatus(targetName).status === 'normal') {
	                    queue.push(targetName);
	                }
	            }
	        }
	        return queue;
	    }

	    static evaluateOutposts(room) {
	        if (!Memory.outposts) Memory.outposts = {};

	        const exits = Game.map.describeExits(room.name);
	        const outposts = [];
	        for (const dir in exits) {
	            const adjRoom = exits[dir];
	            const intel = Memory.rooms[adjRoom];
	            if (!intel) continue;

	            // Check if suitable for remote mining
	            if (intel.controller && intel.controller.owner) continue; // Owned by someone
	            if (intel.hostiles && (intel.hostiles.towers > 0 || intel.hostiles.invaderCore)) continue; // Hostile structures

	            // SK rooms are only viable at RCL 6+ due to heavy military requirements
	            if (intel.roomType === 'sk' && (!room.controller || room.controller.level < 6)) continue;

	            if (intel.sources && intel.sources.length > 0) {
	                outposts.push(adjRoom);
	                // Register globally
	                Memory.outposts[adjRoom] = { sourceRoom: room.name, sources: intel.sources.length, roomType: intel.roomType };
	            }
	        }

	        // Save to our room's memory
	        room.memory.outposts = outposts;
	    }
	}

	IntelManager_1 = IntelManager;
	return IntelManager_1;
}

/**
 * Empire-Level Remote Mining Manager
 * Evaluates the mathematical profitability of remote sources using PathFinder.
 * Optimizes CPU and energy utilization by mathematically aborting remote mining operations in mathematically unprofitable or walled-off sectors.
 */

var RemoteMiningManager_1;
var hasRequiredRemoteMiningManager;

function requireRemoteMiningManager () {
	if (hasRequiredRemoteMiningManager) return RemoteMiningManager_1;
	hasRequiredRemoteMiningManager = 1;
	class RemoteMiningManager {
	    static run() {
	        if (Game.time % 100 !== 0) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            RemoteMiningManager.evaluateColonyNeighbors(colony);
	        }
	    }

	    static evaluateColonyNeighbors(colony) {
	        const coreRoom = colony.coreRoom;
	        if (!coreRoom) return;

	        // Need an anchor to measure distance from
	        let anchor = coreRoom.storage;
	        if (!anchor) {
	            const spawns = coreRoom.find(FIND_MY_SPAWNS);
	            if (spawns.length > 0) anchor = spawns[0];
	        }
	        if (!anchor) return;

	        const exits = Game.map.describeExits(coreRoom.name);
	        if (!exits) return;

	        const neighbors = Object.values(exits);
	        for (let i = 0; i < neighbors.length; i++) {
	            const adjRoom = neighbors[i];
	            const intel = Memory.rooms[adjRoom];

	            // Only evaluate if we have Intel and it has sources
	            if (!intel || !intel.sources || intel.sources.length === 0) continue;

	            // Don't evaluate owned rooms
	            if (intel.controller && intel.controller.owner) continue;

	            const isSKRoom = intel.roomType === 'sk';
	            // SK rooms are only profitable if we can afford the military upkeep (approx 3500 energy for Paladin)
	            // The Paladin costs 3500 and lasts 1500 ticks -> ~2.33 energy per tick
	            // A dedicated SKMiner costs about 1200 energy -> 0.8 energy per tick
	            const militaryUpkeepPerTick = isSKRoom ? 2.5 : 0;
	            const minerCost = isSKRoom ? 1200 : 650;

	            let profitable = false;

	            for (let j = 0; j < intel.sources.length; j++) {
	                const source = intel.sources[j];
	                const pos = new RoomPosition(source.x, source.y, adjRoom);

	                const ret = PathFinder.search(
	                    anchor.pos,
	                    { pos: pos, range: 1 },
	                    {
	                        plainCost: 2,
	                        swampCost: 10,
	                        maxOps: 10000
	                    }
	                );

	                if (ret.incomplete || ret.path.length > 60) {
	                    continue; // Dead weight
	                }

	                // Calculate exact costs
	                const distance = ret.path.length;

	                // Hauler needs (distance * 2) * (isSKRoom ? 13 : 10) capacity
	                // SK source is 4000/300 = ~13 energy per tick
	                const energyPerTick = isSKRoom ? 13.33 : 10;
	                const requiredCapacity = distance * 2 * energyPerTick;
	                const haulerCost = Math.ceil(requiredCapacity / 100) * 150;

	                const roadCostPerTick = distance * 0.002;

	                const upkeepCost = (minerCost / 1500) + (haulerCost / 1500) + roadCostPerTick + militaryUpkeepPerTick;

	                const netIncome = energyPerTick - upkeepCost;

	                if (netIncome > 0) {
	                    profitable = true;
	                    break; // If even 1 source is profitable, the room is viable
	                }
	            }

	            if (!profitable) {
	                intel.isDeadWeight = true;
	            } else {
	                intel.isDeadWeight = false;
	            }
	        }
	    }
	}

	RemoteMiningManager_1 = RemoteMiningManager;
	return RemoteMiningManager_1;
}

/**
 * Empire Manager
 * Automates territorial expansion by dynamically linking profitable map sectors to the closest operational Colony.
 */

var EmpireManager_1;
var hasRequiredEmpireManager;

function requireEmpireManager () {
	if (hasRequiredEmpireManager) return EmpireManager_1;
	hasRequiredEmpireManager = 1;
	class EmpireManager {
	    static run() {
	        // Empire-level logic has been modularized.
	        // Outposts -> OutpostManager
	        // Expansion -> ExpansionManager
	        // Logistics -> EmpireLogisticsManager
	    }
	}

	EmpireManager_1 = EmpireManager;
	return EmpireManager_1;
}

/**
 * Bunker Planner - Military Defense Grid
 * Implements Min-Cut flow network to identify natural wall terrain chokepoints.
 * Ramparts are strictly constructed on the cut, preventing energy bleed.
 */

var BunkerPlanner_1;
var hasRequiredBunkerPlanner;

function requireBunkerPlanner () {
	if (hasRequiredBunkerPlanner) return BunkerPlanner_1;
	hasRequiredBunkerPlanner = 1;
	class BunkerPlanner {
	    /**
	     * Minimum vertex cut separating all room exits from the base.
	     * Each tile is split into in-node and out-node (classic vertex-cut construction).
	     * Base tiles get INF capacity (cannot be cut).
	     * The cut identifies the minimum rampart positions.
	     */
	    static computeMinCut(terrain, baseSetArray) {
	        const N = 5002, S = 5000, T = 5001, INF = 999999;
	        const maxEdges = 100000;
	        const head = new Int32Array(N).fill(-1);
	        const next = new Int32Array(maxEdges);
	        const eTo = new Int32Array(maxEdges);
	        const eCap = new Int32Array(maxEdges);
	        let edgeCount = 0;

	        function addEdge(u, v, c) {
	            eTo[edgeCount] = v; eCap[edgeCount] = c; next[edgeCount] = head[u]; head[u] = edgeCount++;
	            eTo[edgeCount] = u; eCap[edgeCount] = 0; next[edgeCount] = head[v]; head[v] = edgeCount++;
	        }

	        // Dilate baseSet by 2 tiles for standoff distance against Ranged Attackers
	        const dilatedBaseSet = new Uint8Array(2500);
	        for (let x = 0; x < 50; x++) {
	            for (let y = 0; y < 50; y++) {
	                if (baseSetArray[x * 50 + y]) {
	                    for (let dx = -2; dx <= 2; dx++) {
	                        for (let dy = -2; dy <= 2; dy++) {
	                            const nx = x + dx, ny = y + dy;
	                            if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50) {
	                                dilatedBaseSet[nx * 50 + ny] = 1;
	                            }
	                        }
	                    }
	                }
	            }
	        }

	        for (let x = 0; x < 50; x++) {
	            for (let y = 0; y < 50; y++) {
	                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
	                const inNode = x * 50 + y, outNode = inNode + 2500;
	                const isBase = dilatedBaseSet[inNode];
	                const isExit = (x === 0 || x === 49 || y === 0 || y === 49);

	                addEdge(inNode, outNode, isBase || isExit ? INF : 1);
	                if (isExit) addEdge(S, inNode, INF);
	                if (isBase) addEdge(outNode, T, INF);
	                const dirs = [
	                    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
	                    { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
	                ];
	                for (let d = 0; d < dirs.length; d++) {
	                    const nx = x + dirs[d].dx, ny = y + dirs[d].dy;
	                    if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
	                    if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
	                    addEdge(outNode, nx * 50 + ny, INF);
	                }
	            }
	        }

	        // Dinic's BFS level graph
	        const level = new Int32Array(N);
	        function bfs() {
	            level.fill(-1); level[S] = 0;
	            const q = [S]; let qi = 0;
	            while (qi < q.length) {
	                const u = q[qi++];
	                for (let ei = head[u]; ei !== -1; ei = next[ei]) {
	                    if (eCap[ei] > 0 && level[eTo[ei]] < 0) { level[eTo[ei]] = level[u] + 1; q.push(eTo[ei]); }
	                }
	            }
	            return level[T] >= 0;
	        }

	        // Dinic's DFS blocking flow
	        const iter = new Int32Array(N);
	        function dfs(u, pushed) {
	            if (u === T) return pushed;
	            for (; iter[u] !== -1; iter[u] = next[iter[u]]) {
	                const ei = iter[u], v = eTo[ei];
	                if (eCap[ei] <= 0 || level[v] !== level[u] + 1) continue;
	                const d = dfs(v, Math.min(pushed, eCap[ei]));
	                if (d > 0) { eCap[ei] -= d; eCap[ei ^ 1] += d; return d; }
	            }
	            return 0;
	        }

	        while (bfs()) {
	            for (let i = 0; i < N; i++) iter[i] = head[i];
	            let f;
	            do { f = dfs(S, INF); } while (f > 0);
	        }

	        // BFS in residual graph from S to find reachable set
	        const reachable = new Uint8Array(N);
	        const q2 = [S]; reachable[S] = 1; let qi2 = 0;
	        while (qi2 < q2.length) {
	            const u = q2[qi2++];
	            for (let ei = head[u]; ei !== -1; ei = next[ei]) {
	                if (eCap[ei] > 0 && !reachable[eTo[ei]]) { reachable[eTo[ei]] = 1; q2.push(eTo[ei]); }
	            }
	        }

	        // Cut tiles: in-node reachable, out-node NOT reachable from S.
	        // WALL-AWARE: natural terrain walls are already impassable (permanent, free).
	        // Only place ramparts on open-terrain tiles in the cut.
	        const ramparts = [];
	        for (let x = 1; x < 49; x++) {
	            for (let y = 1; y < 49; y++) {
	                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
	                const id = x * 50 + y;
	                if (reachable[id] && !reachable[id + 2500]) {
	                    ramparts.push({ x, y });
	                }
	            }
	        }

	        return ramparts;
	    }
	}

	BunkerPlanner_1 = BunkerPlanner;
	return BunkerPlanner_1;
}

/**
 * Production-Grade Room Planner v5 — Diamond Bunker
 *
 * Pipeline:
 *  1. findAnchor        — Distance transform; anchor nudged to road parity.
 *  2. applyCoreStamp    — Hardcoded Core Hub (storage, terminal, factory,
 *                         3 spawns, 6 towers, power spawn, observer, nuker).
 *  3. applyLabStamp     — 2+8 lab cluster (4-quadrant, contiguous only).
 *  4. fillBaseDiamond   — BFS outward from anchor in Manhattan-distance order.
 *                         Checkerboard parity rule: road-parity tiles → road,
 *                         extension-parity tiles → extension. Stops at 60 exts.
 *                         Produces a compact, dense diamond — identical in
 *                         style to the classic Screeps bunker layout.
 *  5. planContainers    — Source + controller containers.
 *  6. planRoads         — Checkerboard is already the internal road grid;
 *                         PathFinder only routes to external resources.
 *  7. computeMinCut     — Dinic’s max-flow for true min-cut. Filters out
 *                         natural terrain walls (free, permanent defense)
 *                         so ramparts only cover open-terrain gaps.
 *  8. addRoadRamparts   — 3-deep road exit airlocks.
 *  9. addOutpostRamparts— Tight rampart rings for external resources.
 */

var RoomPlanner_1;
var hasRequiredRoomPlanner;

function requireRoomPlanner () {
	if (hasRequiredRoomPlanner) return RoomPlanner_1;
	hasRequiredRoomPlanner = 1;
	const BunkerPlanner = requireBunkerPlanner();

	class RoomPlanner {

	    static run() {
	        if (Game.cpu.bucket <= 500) return;
	        // if (Game.time % 50 !== 0) return; // Temporarily disabled for debugging
	        if (!commonjsGlobal.Cache) commonjsGlobal.Cache = { blueprints: new Map() };
	        if (commonjsGlobal.Cache.blueprintVersion !== 4) {
	            commonjsGlobal.Cache.blueprints.clear();
	            commonjsGlobal.Cache.blueprintVersion = 4;
	            for (const name in Game.rooms) delete Game.rooms[name].memory.plannedRcl;
	        }
	        if (!(commonjsGlobal.Cache.blueprints instanceof Map)) commonjsGlobal.Cache.blueprints = new Map();
	        for (const roomName in Game.rooms) {
	            const room = Game.rooms[roomName];
	            if (room.controller && room.controller.my) this.manageRoom(room);
	        }
	    }

	    static manageRoom(room) {
	        if (!commonjsGlobal.Cache) commonjsGlobal.Cache = { blueprints: new Map() };
	        if (!(commonjsGlobal.Cache.blueprints instanceof Map)) commonjsGlobal.Cache.blueprints = new Map();

	        if (!commonjsGlobal.Cache.blueprints.has(room.name) || room.memory.plannedRcl !== room.controller.level) {
	            this.generateBlueprint(room);
	            room.memory.plannedRcl = room.controller.level;
	        }
	    }

	    // ─── Pipeline ────────────────────────────────────────────────────────

	    static generateBlueprint(room) {
	        const terrain = Game.map.getRoomTerrain(room.name);
	        const state = commonjsGlobal.State?.rooms?.get(room.name);

	        const blueprint = {
	            anchor: null,
	            containers: [],
	            roads: [],
	            ramparts: [],
	            outpostRamparts: [],
	            supplierLabs: [],
	            [STRUCTURE_SPAWN]: [],
	            [STRUCTURE_EXTENSION]: [],
	            [STRUCTURE_TOWER]: [],
	            [STRUCTURE_STORAGE]: [],
	            [STRUCTURE_TERMINAL]: [],
	            [STRUCTURE_FACTORY]: [],
	            [STRUCTURE_LAB]: [],
	            [STRUCTURE_OBSERVER]: [],
	            [STRUCTURE_NUKER]: [],
	            [STRUCTURE_POWER_SPAWN]: [],
	            [STRUCTURE_LINK]: []
	        };

	        // Step 1: Anchor
	        let anchor = this.findAnchor(room, terrain);
	        blueprint.anchor = anchor;

	        const visited = new Uint8Array(2500);
	        const fragmentCenters = [];

	        console.log(`[RoomPlanner] Generating new blueprint for room ${room.name}...`);

	        const distanceMap = new Uint16Array(2500);
	        distanceMap.fill(65535);
	        const q = [{x: anchor.x, y: anchor.y}];
	        distanceMap[anchor.x * 50 + anchor.y] = 0;
	        let head = 0;
	        while (head < q.length) {
	            const {x, y} = q[head++];
	            const d = distanceMap[x * 50 + y];
	            const dirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
	            for(let i=0; i<dirs.length; i++) {
	                const nx = x+dirs[i].dx, ny = y+dirs[i].dy;
	                if(nx >= 0 && nx < 50 && ny >= 0 && ny < 50 && terrain.get(nx, ny) !== TERRAIN_MASK_WALL) {
	                    const key = nx * 50 + ny;
	                    if (distanceMap[key] > d + 1) {
	                        distanceMap[key] = d + 1;
	                        q.push({x: nx, y: ny});
	                    }
	                }
	            }
	        }

	        // Step 2: Fast Filler Stamp
	        anchor = this.applyFastFillerStamp(blueprint, terrain, anchor, visited);
	        blueprint.anchor = anchor; // Update blueprint in case of nudging
	        fragmentCenters.push({ x: anchor.x, y: anchor.y });
	        console.log(`[RoomPlanner] Fast Filler packed at anchor: ${anchor.x}, ${anchor.y}`);

	        // Step 3: Core Hub Stamp
	        const coreCenter = this.applyCoreStamp(blueprint, terrain, anchor, visited, distanceMap);
	        if (coreCenter) {
	            fragmentCenters.push(coreCenter);
	            console.log(`[RoomPlanner] Core Hub packed at: ${coreCenter.x}, ${coreCenter.y}`);
	        } else console.log(`[RoomPlanner] WARNING: Failed to find space for Core Hub!`);

	        // Tower Stamp removed in favor of Dynamic Perimeter Towers

	        // Step 5: Lab cluster
	        const labCenter = this.applyLabStamp(blueprint, terrain, anchor, visited, distanceMap);
	        if (labCenter) {
	            fragmentCenters.push(labCenter);
	            console.log(`[RoomPlanner] Lab Cluster packed at: ${labCenter.x}, ${labCenter.y}`);
	        } else console.log(`[RoomPlanner] WARNING: Failed to find space for Lab Cluster!`);

	        // Step 6: Extension Clusters (Plus-sign grids)
	        const extensionCenters = this.applyExtensionClusters(blueprint, terrain, anchor, visited, distanceMap);
	        for (let i = 0; i < extensionCenters.length; i++) fragmentCenters.push(extensionCenters[i]);
	        console.log(`[RoomPlanner] Packed ${extensionCenters.length} extension clusters.`);

	        // Step 6.5: Dynamic Spare Extension Packing
	        this.packSpareExtensions(blueprint, terrain, anchor, visited, distanceMap);

	        // Step 5: Source + controller containers
	        if (state) this.planContainers(blueprint, room, state, terrain, visited, distanceMap);

	        // Step 6: External road routes and fragment connections
	        if (state) this.planRoads(blueprint, room, state, anchor, fragmentCenters);

	        // Step 7: Min-Cut Ramparts
	        blueprint.ramparts = BunkerPlanner.computeMinCut(terrain, visited);

	        // Step 7.5: Dynamic Perimeter Towers
	        this.placePerimeterTowers(blueprint, terrain, anchor, visited);

	        // Step 8: Road exit airlocks (3-deep)
	        this.addRoadRamparts(blueprint);

	        // Step 9: Rampart roads for defender mobility (Done BEFORE outpost ramparts so they don't get roads)
	        this.addRampartRoads(blueprint, anchor);

	        // Step 10: Outpost ramparts for external resources
	        if (state) this.addOutpostRamparts(blueprint, terrain, state);

	        // Step 11: Extractor
	        if (state && state.mineral) {
	            blueprint[STRUCTURE_EXTRACTOR] = blueprint[STRUCTURE_EXTRACTOR] || [];
	            blueprint[STRUCTURE_EXTRACTOR].push({ x: state.mineral.pos.x, y: state.mineral.pos.y });
	        }

	        // Step 11.5: Global Accessibility Flood-Fill Validation
	        this.validateGlobalAccessibility(blueprint, terrain, anchor);

	        // Step 12: Precompile Sets for Visualizer
	        const supplierSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.supplierLabs.length; i++) supplierSet[blueprint.supplierLabs[i].x * 50 + blueprint.supplierLabs[i].y] = 1;
	        blueprint.supplierSet = supplierSet;

	        const roadSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.roads.length; i++) roadSet[blueprint.roads[i].x * 50 + blueprint.roads[i].y] = 1;
	        blueprint.roadSet = roadSet;

	        const outpostSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.outpostRamparts.length; i++) outpostSet[blueprint.outpostRamparts[i].x * 50 + blueprint.outpostRamparts[i].y] = 1;
	        blueprint.outpostSet = outpostSet;

	        commonjsGlobal.Cache.blueprints.set(room.name, blueprint);
	        console.log(`[RoomPlanner] Successfully generated and cached blueprint for ${room.name}!`);
	    }

	    // ─── Step 1: Anchor Finding ──────────────────────────────────────────

	    static findAnchor(room, terrain) {
	        const dt = new PathFinder.CostMatrix();
	        for (let x = 0; x < 50; x++) {
	            for (let y = 0; y < 50; y++) {
	                dt.set(x, y, (terrain.get(x, y) === TERRAIN_MASK_WALL || x <= 2 || y <= 2 || x >= 47 || y >= 47) ? 0 : 255);
	            }
	        }
	        for (let x = 1; x < 49; x++) {
	            for (let y = 1; y < 49; y++) {
	                if (dt.get(x, y) > 0) {
	                    dt.set(x, y, Math.min(dt.get(x - 1, y), dt.get(x, y - 1), dt.get(x - 1, y - 1), dt.get(x + 1, y - 1)) + 1);
	                }
	            }
	        }
	        let maxVal = 0, anchor = { x: 25, y: 25 };
	        for (let x = 48; x >= 1; x--) {
	            for (let y = 48; y >= 1; y--) {
	                if (dt.get(x, y) > 0) {
	                    const val = Math.min(dt.get(x, y), Math.min(dt.get(x + 1, y), dt.get(x, y + 1), dt.get(x + 1, y + 1), dt.get(x - 1, y + 1)) + 1);
	                    dt.set(x, y, val);
	                    if (val > maxVal) { maxVal = val; anchor = { x, y }; }
	                }
	            }
	        }
	        return anchor;
	    }

	    // ─── Tigga Modular Stamps ──────────────────────────────────────────

	    static validateFastFillerClearance(ax, ay, terrain) {
	        const spawns = [{ dx: -2, dy: -1 }, { dx: 2, dy: -1 }, { dx: 0, dy: 2 }];
	        for (let i = 0; i < spawns.length; i++) {
	            const sx = ax + spawns[i].dx, sy = ay + spawns[i].dy;
	            if (sx < 2 || sx > 47 || sy < 2 || sy > 47) return false;
	            let hasClearance = false;
	            for (let cdx = -1; cdx <= 1; cdx++) {
	                for (let cdy = -1; cdy <= 1; cdy++) {
	                    if (cdx === 0 && cdy === 0) continue;
	                    // Ensures spawn clearance, preventing total base deadlock when creeps spawn into a blocked Fast Filler hub.
	                    // Outward means the neighbor is strictly further or equal distance from the anchor center than the spawn itself.
	                    const distToCenter = Math.abs(sx + cdx - ax) + Math.abs(sy + cdy - ay);
	                    const spawnDist = Math.abs(sx - ax) + Math.abs(sy - ay);
	                    if (distToCenter < spawnDist) continue;

	                    if (terrain.get(sx + cdx, sy + cdy) !== TERRAIN_MASK_WALL) {
	                        hasClearance = true;
	                        break;
	                    }
	                }
	                if (hasClearance) break;
	            }
	            if (!hasClearance) return false;
	        }
	        return true;
	    }

	    static applyFastFillerStamp(blueprint, terrain, anchor, visited) {
	        let ax = anchor.x, ay = anchor.y;

	        if (!this.validateFastFillerClearance(ax, ay, terrain)) {
	            let found = false;
	            for (let dx = -1; dx <= 1; dx++) {
	                for (let dy = -1; dy <= 1; dy++) {
	                    if (this.validateFastFillerClearance(ax + dx, ay + dy, terrain)) {
	                        ax += dx; ay += dy; found = true; break;
	                    }
	                }
	                if (found) break;
	            }
	        }

	        const stamp = [
	            // Center Link
	            { type: STRUCTURE_LINK, dx: 0, dy: 0 },
	            // Containers
	            { type: 'container', dx: -2, dy: 0 }, { type: 'container', dx: 2, dy: 0 },
	            // Spawns
	            { type: STRUCTURE_SPAWN, dx: -2, dy: -1 }, { type: STRUCTURE_SPAWN, dx: 2, dy: -1 }, { type: STRUCTURE_SPAWN, dx: 0, dy: 2 },
	            // Extensions
	            { type: STRUCTURE_EXTENSION, dx: -2, dy: -2 }, { type: STRUCTURE_EXTENSION, dx: -1, dy: -2 }, { type: STRUCTURE_EXTENSION, dx: 0, dy: -2 }, { type: STRUCTURE_EXTENSION, dx: 1, dy: -2 }, { type: STRUCTURE_EXTENSION, dx: 2, dy: -2 },
	            { type: STRUCTURE_EXTENSION, dx: 0, dy: -1 },
	            { type: STRUCTURE_EXTENSION, dx: -1, dy: 0 }, { type: STRUCTURE_EXTENSION, dx: 1, dy: 0 },
	            { type: STRUCTURE_EXTENSION, dx: -2, dy: 1 }, { type: STRUCTURE_EXTENSION, dx: 0, dy: 1 }, { type: STRUCTURE_EXTENSION, dx: 2, dy: 1 },
	            { type: STRUCTURE_EXTENSION, dx: -2, dy: 2 }, { type: STRUCTURE_EXTENSION, dx: -1, dy: 2 }, { type: STRUCTURE_EXTENSION, dx: 1, dy: 2 }, { type: STRUCTURE_EXTENSION, dx: 2, dy: 2 }
	        ];

	        for (let i = 0; i < stamp.length; i++) {
	            const { type, dx, dy } = stamp[i];
	            const x = ax + dx, y = ay + dy;
	            if (x < 2 || x > 47 || y < 2 || y > 47 || terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

	            const key = x * 50 + y;
	            if (visited[key]) continue;
	            visited[key] = 1;

	            if (type === 'road') blueprint.roads.push({ x, y });
	            else if (type === 'container') blueprint.containers.push({ x, y, intent: 'core' });
	            else blueprint[type].push({ x, y });
	        }
	        return { x: ax, y: ay };
	    }

	    static findCompactPlacement(stampRotations, terrain, anchor, visited, distanceMap, validatorFn) {
	        const variants = Array.isArray(stampRotations[0]) ? stampRotations : [stampRotations];

	        const coords = [];
	        for (let x = 4; x <= 45; x++) {
	            for (let y = 4; y <= 45; y++) {
	                if (distanceMap[x * 50 + y] !== 65535) {
	                    coords.push({ x, y, dist: distanceMap[x * 50 + y] });
	                }
	            }
	        }
	        coords.sort((a, b) => a.dist - b.dist);

	        for (let i = 0; i < coords.length; i++) {
	            const { x, y } = coords[i];

	            for (let v = 0; v < variants.length; v++) {
	                const stamp = variants[v];
	                let valid = true;
	                for (let j = 0; j < stamp.length; j++) {
	                    const nx = x + stamp[j].dx, ny = y + stamp[j].dy;
	                    if (nx < 4 || nx > 45 || ny < 4 || ny > 45 || terrain.get(nx, ny) === TERRAIN_MASK_WALL) {
	                        valid = false; break;
	                    }
	                    const key = nx * 50 + ny;
	                    if (visited[key]) {
	                        if (stamp[j].type === 'road' && visited[key] === 2) continue;
	                        valid = false; break;
	                    }
	                }
	                if (valid && validatorFn) {
	                    valid = validatorFn(x, y, stamp, terrain, visited);
	                }
	                if (valid) return { cx: x, cy: y, stamp };
	            }
	        }
	        return null;
	    }

	    static applyCoreStamp(blueprint, terrain, anchor, visited, distanceMap) {
	        const stamp = [
	            { type: STRUCTURE_STORAGE, dx: -1, dy: 0 },
	            { type: STRUCTURE_TERMINAL, dx: 1, dy: 0 },
	            { type: STRUCTURE_FACTORY, dx: 0, dy: -1 },
	            { type: STRUCTURE_LINK, dx: 0, dy: 1 },
	            { type: STRUCTURE_NUKER, dx: -1, dy: -1 },
	            { type: STRUCTURE_POWER_SPAWN, dx: 1, dy: -1 },
	            { type: STRUCTURE_OBSERVER, dx: 1, dy: 1 }
	        ];

	        const placement = this.findCompactPlacement(stamp, terrain, anchor, visited, distanceMap);
	        if (placement) {
	            const { cx, cy, stamp: chosenStamp } = placement;
	            for (let i = 0; i < chosenStamp.length; i++) {
	                const { type, dx, dy } = chosenStamp[i];
	                const x = cx + dx, y = cy + dy;
	                visited[x * 50 + y] = 1;
	                blueprint[type].push({ x, y });
	            }
	            return { x: cx, y: cy };
	        }
	        return null;
	    }

	    // Tower stamp removed.

	    static applyLabStamp(blueprint, terrain, anchor, visited, distanceMap) {
	        const variants = [
	            [
	                { dx: -1, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: -1, s: true, type: STRUCTURE_LAB }, { dx: 1, dy: -1, s: true, type: STRUCTURE_LAB }, { dx: 2, dy: -1, s: false, type: STRUCTURE_LAB },
	                { dx: -1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 2, dy: 0, s: false, type: STRUCTURE_LAB },
	                { dx: 0, dy: 1, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 1, s: false, type: STRUCTURE_LAB },
	            ],
	            [
	                { dx: -1, dy: 1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 1, s: true, type: STRUCTURE_LAB }, { dx: 1, dy: 1, s: true, type: STRUCTURE_LAB }, { dx: 2, dy: 1, s: false, type: STRUCTURE_LAB },
	                { dx: -1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 2, dy: 0, s: false, type: STRUCTURE_LAB },
	                { dx: 0, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: -1, s: false, type: STRUCTURE_LAB },
	            ],
	            [
	                { dx: 1, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 0, s: true, type: STRUCTURE_LAB }, { dx: 1, dy: 1, s: true, type: STRUCTURE_LAB }, { dx: 1, dy: 2, s: false, type: STRUCTURE_LAB },
	                { dx: 0, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 2, s: false, type: STRUCTURE_LAB },
	                { dx: -1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: -1, dy: 1, s: false, type: STRUCTURE_LAB },
	            ],
	            [
	                { dx: -1, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: -1, dy: 0, s: true, type: STRUCTURE_LAB }, { dx: -1, dy: 1, s: true, type: STRUCTURE_LAB }, { dx: -1, dy: 2, s: false, type: STRUCTURE_LAB },
	                { dx: 0, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 2, s: false, type: STRUCTURE_LAB },
	                { dx: 1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 1, s: false, type: STRUCTURE_LAB },
	            ]
	        ];

	        const validatorFn = (cx, cy, stamp, terrain, visited) => {
	            for (let i = 0; i < stamp.length; i++) {
	                if (stamp[i].type !== STRUCTURE_LAB) continue;
	                const lx = cx + stamp[i].dx, ly = cy + stamp[i].dy;
	                let hasAccess = false;
	                for (let dx = -1; dx <= 1; dx++) {
	                    for (let dy = -1; dy <= 1; dy++) {
	                        if (dx === 0 && dy === 0) continue;
	                        const nx = lx + dx, ny = ly + dy;
	                        if (nx < 1 || nx > 48 || ny < 1 || ny > 48) continue;
	                        if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;

	                        let inStamp = false;
	                        for (let j = 0; j < stamp.length; j++) {
	                            if (cx + stamp[j].dx === nx && cy + stamp[j].dy === ny) {
	                                inStamp = true; break;
	                            }
	                        }
	                        // Validates Lab stamp placement against a global connectivity graph to ensure fillers can reach every reactor.
	                        if (!inStamp && (!visited[nx * 50 + ny] || visited[nx * 50 + ny] === 2)) {
	                            hasAccess = true; break;
	                        }
	                    }
	                    if (hasAccess) break;
	                }
	                if (!hasAccess) return false;
	            }
	            return true;
	        };

	        const placement = this.findCompactPlacement(variants, terrain, anchor, visited, distanceMap, validatorFn);
	        if (placement) {
	            const { cx, cy, stamp: chosenStamp } = placement;
	            for (let i = 0; i < chosenStamp.length; i++) {
	                const { dx, dy, s } = chosenStamp[i];
	                const x = cx + dx, y = cy + dy;
	                visited[x * 50 + y] = 1;
	                blueprint[STRUCTURE_LAB].push({ x, y });
	                if (s) blueprint.supplierLabs.push({ x, y });
	            }
	            return { x: cx, y: cy };
	        }
	        return null;
	    }

	    static applyExtensionClusters(blueprint, terrain, anchor, visited, distanceMap) {
	        let extensionsPlaced = blueprint[STRUCTURE_EXTENSION].length;
	        const centers = [];

	        const clusterOffsets = [
	            { dx: 0, dy: 0, type: STRUCTURE_EXTENSION },
	            { dx: 0, dy: -1, type: STRUCTURE_EXTENSION },
	            { dx: 0, dy: 1, type: STRUCTURE_EXTENSION },
	            { dx: -1, dy: 0, type: STRUCTURE_EXTENSION },
	            { dx: 1, dy: 0, type: STRUCTURE_EXTENSION },
	            { dx: -1, dy: -1, type: 'road' },
	            { dx: 1, dy: -1, type: 'road' },
	            { dx: -1, dy: 1, type: 'road' },
	            { dx: 1, dy: 1, type: 'road' },
	            { dx: 0, dy: -2, type: 'road' },
	            { dx: 0, dy: 2, type: 'road' },
	            { dx: -2, dy: 0, type: 'road' },
	            { dx: 2, dy: 0, type: 'road' }
	        ];

	        const coords = [];
	        for (let x = 4; x <= 45; x++) {
	            for (let y = 4; y <= 45; y++) {
	                if (distanceMap[x * 50 + y] !== 65535 && (Math.abs(x - anchor.x) % 2 === Math.abs(y - anchor.y) % 2)) {
	                    coords.push({ x, y, dist: distanceMap[x * 50 + y] });
	                }
	            }
	        }
	        coords.sort((a, b) => a.dist - b.dist);

	        for (let i = 0; i < coords.length; i++) {
	            if (extensionsPlaced >= 60) break;
	            const { x, y } = coords[i];

	            let validCluster = true;
	            for (let j = 0; j < clusterOffsets.length; j++) {
	                const nx = x + clusterOffsets[j].dx, ny = y + clusterOffsets[j].dy;
	                if (nx < 4 || nx > 45 || ny < 4 || ny > 45 || terrain.get(nx, ny) === TERRAIN_MASK_WALL) {
	                    validCluster = false; break;
	                }
	                const key = nx * 50 + ny;
	                if (visited[key]) {
	                    if (clusterOffsets[j].type === STRUCTURE_EXTENSION || visited[key] === 1) {
	                        validCluster = false; break;
	                    }
	                }
	            }

	            if (validCluster) {
	                for (let j = 0; j < clusterOffsets.length; j++) {
	                    const nx = x + clusterOffsets[j].dx, ny = y + clusterOffsets[j].dy;
	                    const key = nx * 50 + ny;
	                    if (clusterOffsets[j].type === 'road') {
	                        if (visited[key] !== 2) {
	                            visited[key] = 2;
	                            const dist = Math.max(Math.abs(nx - anchor.x), Math.abs(ny - anchor.y));
	                            blueprint.roads.push({ x: nx, y: ny, dist });
	                        }
	                    } else {
	                        visited[key] = 1;
	                        blueprint[STRUCTURE_EXTENSION].push({ x: nx, y: ny });
	                    }
	                }
	                extensionsPlaced += 5;
	                centers.push({ x, y });
	            }
	        }
	        return centers;
	    }

	    static packSpareExtensions(blueprint, terrain, anchor, visited, distanceMap) {
	        let extensionsPlaced = blueprint[STRUCTURE_EXTENSION].length;
	        if (extensionsPlaced >= 60) return;

	        const coords = [];
	        for (let x = 4; x <= 45; x++) {
	            for (let y = 4; y <= 45; y++) {
	                if (distanceMap[x * 50 + y] !== 65535 && !visited[x * 50 + y]) {
	                    // Extension parity ensures diagonally adjacency to road-parity tiles, avoiding traffic blocks
	                    if (Math.abs(x - anchor.x) % 2 === Math.abs(y - anchor.y) % 2) {
	                        coords.push({ x, y, dist: distanceMap[x * 50 + y] });
	                    }
	                }
	            }
	        }
	        coords.sort((a, b) => a.dist - b.dist);

	        let packedCount = 0;
	        for (let i = 0; i < coords.length; i++) {
	            if (extensionsPlaced >= 60) break;
	            const { x, y } = coords[i];
	            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

	            visited[x * 50 + y] = 1;
	            blueprint[STRUCTURE_EXTENSION].push({ x, y });
	            extensionsPlaced++;
	            packedCount++;
	        }
	        if (packedCount > 0) {
	            console.log(`[RoomPlanner] Dynamically packed ${packedCount} spare extensions into core tiles.`);
	        }
	    }

	    // ─── Step 5: Container Planning ──────────────────────────────────────

	    static planContainers(blueprint, room, state, terrain, visited, distanceMap) {
	        const spawn = state.spawns?.[0];
	        const ref = spawn ? spawn.pos : new RoomPosition(blueprint.anchor.x, blueprint.anchor.y, room.name);
	        const sources = state.sources || [];
	        for (let i = 0; i < sources.length; i++) {
	            const tile = this.findBestAdjacentTile(sources[i].pos, ref, terrain, room.name, 1, distanceMap);
	            if (tile) { tile.intent = 'source'; blueprint.containers.push(tile); visited[tile.x * 50 + tile.y] = 1; }
	        }
	        if (state.controller) {
	            const tile = this.findBestAdjacentTile(state.controller.pos, ref, terrain, room.name, 2, distanceMap);
	            if (tile) { tile.intent = 'controller'; blueprint.containers.push(tile); visited[tile.x * 50 + tile.y] = 1; }
	        }
	        if (state.mineral) {
	            const tile = this.findBestAdjacentTile(state.mineral.pos, ref, terrain, room.name, 1, distanceMap);
	            if (tile) { tile.intent = 'mineral'; blueprint.containers.push(tile); visited[tile.x * 50 + tile.y] = 1; }
	        }
	    }

	    static findBestAdjacentTile(targetPos, referencePos, terrain, roomName, range, distanceMap) {
	        let best = null, bestDist = Infinity;
	        for (let dx = -range; dx <= range; dx++) {
	            for (let dy = -range; dy <= range; dy++) {
	                if (dx === 0 && dy === 0) continue;
	                const x = targetPos.x + dx, y = targetPos.y + dy;
	                if (x < 1 || x > 48 || y < 1 || y > 48) continue;
	                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
	                if (range > 1 && Math.max(Math.abs(dx), Math.abs(dy)) > range) continue;
	                const dist = distanceMap[x * 50 + y];
	                if (dist < bestDist) { bestDist = dist; best = { x, y }; }
	            }
	        }
	        return best;
	    }

	    // ─── Step 6: External Road Routes ────────────────────────────────────

	    /**
	     * The checkerboard diamond is already the internal road grid.
	     * This step only uses PathFinder to route roads from anchor to:
	     *   - Source/controller containers (hauler + upgrader routes)
	     *   - Mineral (future remote mining)
	     *
	     * Existing checkerboard roads are seeded at cost 1 so external paths
	     * merge onto them naturally rather than cutting parallel new roads.
	     */
	    static planRoads(blueprint, room, state, anchor, fragmentCenters) {
	        const anchorPos = new RoomPosition(anchor.x, anchor.y, room.name);

	        const targets = [];
	        for (let i = 0; i < blueprint.containers.length; i++) targets.push(blueprint.containers[i]);
	        if (state.mineral) targets.push({ x: state.mineral.pos.x, y: state.mineral.pos.y });
	        if (fragmentCenters) {
	            for (let i = 0; i < fragmentCenters.length; i++) targets.push(fragmentCenters[i]);
	        }

	        targets.sort((a, b) => {
	            const dA = Math.max(Math.abs(a.x - anchor.x), Math.abs(a.y - anchor.y));
	            const dB = Math.max(Math.abs(b.x - anchor.x), Math.abs(b.y - anchor.y));
	            return dA - dB;
	        });

	        const costs = new PathFinder.CostMatrix();
	        // Seed all existing roads at cost 1 (MST trunk-merging)
	        for (let i = 0; i < blueprint.roads.length; i++) costs.set(blueprint.roads[i].x, blueprint.roads[i].y, 1);

	        // Block all structures
	        const blockTypes = [
	            STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE,
	            STRUCTURE_TERMINAL, STRUCTURE_FACTORY, STRUCTURE_LAB,
	            STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER, STRUCTURE_OBSERVER
	        ];
	        for (let i = 0; i < blockTypes.length; i++) {
	            const arr = blueprint[blockTypes[i]];
	            if (arr) for (let j = 0; j < arr.length; j++) costs.set(arr[j].x, arr[j].y, 255);
	        }

	        for (let i = 0; i < targets.length; i++) {
	            const targetPos = new RoomPosition(targets[i].x, targets[i].y, room.name);
	            const ret = PathFinder.search(anchorPos, { pos: targetPos, range: 1 }, {
	                plainCost: 2,
	                swampCost: 5,  // Strongly penalize swamp — prefer extra plains tiles
	                roomCallback: (rn) => rn === room.name ? costs : false,
	                maxOps: 4000
	            });

	            for (let j = 0; j < ret.path.length; j++) {
	                const step = ret.path[j];
	                if (step.x >= 2 && step.x <= 47 && step.y >= 2 && step.y <= 47 && costs.get(step.x, step.y) !== 1) {
	                    blueprint.roads.push({ x: step.x, y: step.y, isExternal: true });
	                    costs.set(step.x, step.y, 1);
	                }
	            }
	        }
	    }



	    static placePerimeterTowers(blueprint, terrain, anchor, visited) {
	        const rampartSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.ramparts.length; i++) {
	            rampartSet[blueprint.ramparts[i].x * 50 + blueprint.ramparts[i].y] = 1;
	        }

	        const roadSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.roads.length; i++) {
	            roadSet[blueprint.roads[i].x * 50 + blueprint.roads[i].y] = 1;
	        }

	        const inside = new Uint8Array(2500);
	        inside[anchor.x * 50 + anchor.y] = 1;
	        let q = [{ x: anchor.x, y: anchor.y }];
	        let qi = 0;
	        while (qi < q.length) {
	            const cur = q[qi++];
	            const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
	            for (let i = 0; i < dirs.length; i++) {
	                const nx = cur.x + dirs[i].x, ny = cur.y + dirs[i].y;
	                if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50 || terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
	                const key = nx * 50 + ny;
	                if (inside[key] || rampartSet[key]) continue;
	                inside[key] = 1;
	                q.push({ x: nx, y: ny });
	            }
	        }

	        const distFromEdge = new Int32Array(2500).fill(9999);
	        q = [];
	        for (let i = 0; i < blueprint.ramparts.length; i++) {
	            const rp = blueprint.ramparts[i];
	            distFromEdge[rp.x * 50 + rp.y] = 0;
	            q.push(rp);
	        }

	        qi = 0;
	        while (qi < q.length) {
	            const cur = q[qi++];
	            const d = distFromEdge[cur.x * 50 + cur.y];
	            const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }];
	            for (let i = 0; i < dirs.length; i++) {
	                const nx = cur.x + dirs[i].x, ny = cur.y + dirs[i].y;
	                if (nx < 2 || nx > 47 || ny < 2 || ny > 47 || terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
	                const key = nx * 50 + ny;
	                if (inside[key] && distFromEdge[key] > d + 1) {
	                    distFromEdge[key] = d + 1;
	                    q.push({ x: nx, y: ny });
	                }
	            }
	        }

	        const candidates = [];
	        for (let x = 3; x <= 46; x++) {
	            for (let y = 3; y <= 46; y++) {
	                const key = x * 50 + y;
	                // Decentralizes tower placement to maximize perimeter defensive coverage
	                if (inside[key] && !visited[key] && !roadSet[key] && distFromEdge[key] > 0 && distFromEdge[key] < 9999) {
	                    // Ensure the tower is physically accessible by requiring it to be adjacent to a road
	                    let adjRoad = false;
	                    for (let dx = -1; dx <= 1; dx++) {
	                        for (let dy = -1; dy <= 1; dy++) {
	                            if (dx === 0 && dy === 0) continue;
	                            const nx = x + dx, ny = y + dy;
	                            if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50 && roadSet[nx * 50 + ny]) {
	                                adjRoad = true;
	                                break;
	                            }
	                        }
	                        if (adjRoad) break;
	                    }
	                    if (adjRoad) {
	                        candidates.push({ x, y, dist: distFromEdge[key] });
	                    }
	                }
	            }
	        }
	        candidates.sort((a, b) => a.dist - b.dist);

	        const towers = [];
	        const MIN_TOWER_DIST = 4;
	        for (let i = 0; i < candidates.length && towers.length < 6; i++) {
	            const cand = candidates[i];
	            let tooClose = false;
	            for (let j = 0; j < towers.length; j++) {
	                if (Math.max(Math.abs(towers[j].x - cand.x), Math.abs(towers[j].y - cand.y)) < MIN_TOWER_DIST) {
	                    tooClose = true; break;
	                }
	            }
	            if (!tooClose) {
	                towers.push(cand);
	                visited[cand.x * 50 + cand.y] = 1;
	                blueprint[STRUCTURE_TOWER].push({ x: cand.x, y: cand.y });
	            }
	        }
	        console.log(`[RoomPlanner] Dynamically placed ${towers.length} perimeter towers.`);
	    }

	    // ─── Step 8: Road Exit Airlocks ──────────────────────────────────────

	    /**
	     * For every rampart that sits on a road (a "road exit"),
	     * traces 2 tiles inward along the road to create a protected airlock.
	     * Uses a strict single-path trace to prevent clump fan-outs.
	     */
	    static addRoadRamparts(blueprint) {
	        const roadSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.roads.length; i++) roadSet[blueprint.roads[i].x * 50 + blueprint.roads[i].y] = 1;

	        const rampartSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.ramparts.length; i++) rampartSet[blueprint.ramparts[i].x * 50 + blueprint.ramparts[i].y] = 1;

	        const ax = blueprint.anchor.x, ay = blueprint.anchor.y;
	        const newRamparts = [];

	        for (let i = 0; i < blueprint.ramparts.length; i++) {
	            const rp = blueprint.ramparts[i];
	            if (!roadSet[rp.x * 50 + rp.y]) continue;

	            let current = rp;
	            for (let step = 0; step < 3; step++) {
	                let bestNext = null;
	                const cx = current.x, cy = current.y;
	                const cDist = Math.max(Math.abs(cx - ax), Math.abs(cy - ay));

	                const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }];
	                for (let d = 0; d < dirs.length; d++) {
	                    const nx = cx + dirs[d].x, ny = cy + dirs[d].y;
	                    const nDist = Math.max(Math.abs(nx - ax), Math.abs(ny - ay));
	                    const nkey = nx * 50 + ny;
	                    if (nDist < cDist && roadSet[nkey] && !rampartSet[nkey]) {
	                        bestNext = { x: nx, y: ny };
	                        break; // Take the first valid inward road tile
	                    }
	                }

	                if (bestNext) {
	                    rampartSet[bestNext.x * 50 + bestNext.y] = 1;
	                    newRamparts.push(bestNext);
	                    current = bestNext;
	                } else {
	                    break;
	                }
	            }
	        }
	        for (let i = 0; i < newRamparts.length; i++) blueprint.ramparts.push(newRamparts[i]);
	    }

	    // ─── Step 8.5: Rampart Roads ──────────────────────────────────────────

	    /**
	     * Overlays STRUCTURE_ROAD on every placed rampart tile to give defenders
	     * zero-fatigue mobility along the walls.
	     */
	    static addRampartRoads(blueprint, anchor) {
	        const roadSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.roads.length; i++) roadSet[blueprint.roads[i].x * 50 + blueprint.roads[i].y] = 1;

	        const newRoads = [];
	        for (let i = 0; i < blueprint.ramparts.length; i++) {
	            const rp = blueprint.ramparts[i];
	            const rkey = rp.x * 50 + rp.y;
	            if (!roadSet[rkey]) {
	                const dist = Math.max(Math.abs(rp.x - anchor.x), Math.abs(rp.y - anchor.y));
	                newRoads.push({ x: rp.x, y: rp.y, dist });
	                roadSet[rkey] = 1;
	            }
	        }
	        for (let i = 0; i < newRoads.length; i++) blueprint.roads.push(newRoads[i]);
	    }

	    // ─── Step 9: Outpost Ramparts ────────────────────────────────────────

	    /**
	     * BFS inward from anchor (ramparts are boundaries).
	     * Any source/controller/mineral NOT reachable from anchor = outside perimeter.
	     * For each external resource, places a Chebyshev-range-1 rampart ring.
	     */
	    static addOutpostRamparts(blueprint, terrain, state) {
	        // BFS from anchor, ramparts act as walls
	        const rampartSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.ramparts.length; i++) rampartSet[blueprint.ramparts[i].x * 50 + blueprint.ramparts[i].y] = 1;

	        const inside = new Uint8Array(2500);
	        const start = blueprint.anchor;
	        inside[start.x * 50 + start.y] = 1;
	        const q = [{ x: start.x, y: start.y }]; let qi = 0;
	        while (qi < q.length) {
	            const cur = q[qi++];
	            const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
	            for (let i = 0; i < dirs.length; i++) {
	                const nx = cur.x + dirs[i].x, ny = cur.y + dirs[i].y;
	                if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
	                if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
	                const key = nx * 50 + ny;
	                if (inside[key] || rampartSet[key]) continue;
	                inside[key] = 1; q.push({ x: nx, y: ny });
	            }
	        }

	        // Collect resource positions to check
	        const resourcePositions = [];
	        if (state.sources) for (let i = 0; i < state.sources.length; i++) resourcePositions.push(state.sources[i].pos);
	        if (state.controller) resourcePositions.push(state.controller.pos);
	        if (state.mineral) resourcePositions.push(state.mineral.pos);

	        const outpostRamparts = [];
	        for (let r = 0; r < resourcePositions.length; r++) {
	            const pos = resourcePositions[r];
	            if (inside[pos.x * 50 + pos.y]) continue;  // Already inside main perimeter

	            // Place tight rampart ring (range 1) around external resource
	            for (let dx = -1; dx <= 1; dx++) {
	                for (let dy = -1; dy <= 1; dy++) {
	                    if (dx === 0 && dy === 0) continue;
	                    const rx = pos.x + dx, ry = pos.y + dy;
	                    if (rx < 2 || rx > 47 || ry < 2 || ry > 47) continue;
	                    if (terrain.get(rx, ry) === TERRAIN_MASK_WALL) continue;
	                    const key = rx * 50 + ry;
	                    if (!rampartSet[key]) {
	                        rampartSet[key] = 1;
	                        outpostRamparts.push({ x: rx, y: ry });
	                    }
	                }
	            }
	        }

	        blueprint.outpostRamparts = outpostRamparts;
	        for (let i = 0; i < outpostRamparts.length; i++) blueprint.ramparts.push(outpostRamparts[i]);
	    }

	    // ─── Step 11.5: Global Accessibility Flood-Fill ──────────────────────

	    static validateGlobalAccessibility(blueprint, terrain, anchor) {
	        const reachable = new Uint8Array(2500);
	        const q = new Int32Array(2500);
	        let head = 0, tail = 0;

	        // Using user-requested y * 50 + x packing
	        const startKey = anchor.y * 50 + anchor.x;
	        reachable[startKey] = 1;
	        q[tail++] = startKey;

	        const blockSet = new Uint8Array(2500);
	        const solids = [
	            STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE,
	            STRUCTURE_TERMINAL, STRUCTURE_FACTORY, STRUCTURE_LAB, STRUCTURE_NUKER,
	            STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_LINK
	        ];
	        for (let i = 0; i < solids.length; i++) {
	            const arr = blueprint[solids[i]];
	            if (arr) {
	                for (let j = 0; j < arr.length; j++) {
	                    blockSet[arr[j].y * 50 + arr[j].x] = 1;
	                }
	            }
	        }

	        while (head < tail) {
	            const cur = q[head++];
	            const cy = Math.floor(cur / 50), cx = cur % 50;
	            const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }];
	            for (let i = 0; i < dirs.length; i++) {
	                const nx = cx + dirs[i].x, ny = cy + dirs[i].y;
	                if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50 || terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
	                const key = ny * 50 + nx;
	                if (reachable[key]) continue;
	                if (blockSet[key]) continue;

	                reachable[key] = 1;
	                q[tail++] = key;
	            }
	        }

	        let downgraded = 0;
	        const checkAccess = (type) => {
	            const arr = blueprint[type];
	            if (!arr) return;
	            const kept = [];
	            for (let i = 0; i < arr.length; i++) {
	                const p = arr[i];
	                let hasAccess = false;
	                for (let dx = -1; dx <= 1; dx++) {
	                    for (let dy = -1; dy <= 1; dy++) {
	                        if (dx === 0 && dy === 0) continue;
	                        const nx = p.x + dx, ny = p.y + dy;
	                        if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50 && reachable[ny * 50 + nx]) {
	                            hasAccess = true; break;
	                        }
	                    }
	                    if (hasAccess) break;
	                }
	                if (hasAccess) kept.push(p);
	                else {
	                    downgraded++;
	                    blueprint.roads.push({ x: p.x, y: p.y });
	                }
	            }
	            blueprint[type] = kept;
	        };

	        checkAccess(STRUCTURE_SPAWN);
	        checkAccess(STRUCTURE_EXTENSION);
	        checkAccess(STRUCTURE_TOWER);
	        checkAccess(STRUCTURE_LAB);

	        if (downgraded > 0) {
	            console.log(`[RoomPlanner] WARNING: Flood-fill accessibility validation failed for ${downgraded} structures. Downgraded to roads to prevent deadlocks.`);
	        } else {
	            console.log(`[RoomPlanner] Global accessibility validation passed. Base is 100% routable.`);
	        }
	    }

	    // ─── Remote Infrastructure Planning ──────────────────────────────────

	    static planOutpost(coreRoomName, outpostName) {
	        if (!commonjsGlobal.Cache) commonjsGlobal.Cache = { blueprints: new Map() };
	        if (!(commonjsGlobal.Cache.blueprints instanceof Map)) commonjsGlobal.Cache.blueprints = new Map();

	        const coreState = commonjsGlobal.State?.rooms?.get(coreRoomName);
	        if (!coreState) return;

	        let origin = null;
	        if (coreState.storage) origin = coreState.storage.pos;
	        else if (coreState.spawns && coreState.spawns.length > 0) origin = coreState.spawns[0].pos;
	        else {
	            const blueprint = commonjsGlobal.Cache.blueprints.get(coreRoomName);
	            if (blueprint && blueprint.anchor) origin = new RoomPosition(blueprint.anchor.x, blueprint.anchor.y, coreRoomName);
	        }
	        if (!origin) return;

	        const intel = Memory.rooms[outpostName];
	        if (!intel || !intel.sources) return;

	        console.log(`[RoomPlanner] Planning remote infrastructure for outpost ${outpostName} from core ${coreRoomName}...`);

	        for (let i = 0; i < intel.sources.length; i++) {
	            const sourceInfo = intel.sources[i];
	            const target = new RoomPosition(sourceInfo.x, sourceInfo.y, outpostName);

	            const ret = PathFinder.search(origin, { pos: target, range: 1 }, {
	                plainCost: 2,
	                swampCost: 2,
	                roomCallback: (rName) => {
	                    const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(rName) : null;
	                    if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) return false;

	                    const costs = new PathFinder.CostMatrix();
	                    const bp = commonjsGlobal.Cache.blueprints.get(rName);
	                    if (bp && bp.roads) {
	                        for (let j = 0; j < bp.roads.length; j++) {
	                            costs.set(bp.roads[j].x, bp.roads[j].y, 1);
	                        }
	                    }
	                    return costs;
	                }
	            });

	            if (ret.incomplete) {
	                console.log(`[RoomPlanner] Warning: Could not find complete path to source in ${outpostName}`);
	                continue;
	            }

	            for (let j = 0; j < ret.path.length; j++) {
	                const pos = ret.path[j];
	                let bp = commonjsGlobal.Cache.blueprints.get(pos.roomName);
	                if (!bp) {
	                    bp = {
	                        anchor: null, containers: [], roads: [], ramparts: [], outpostRamparts: [], supplierLabs: [],
	                        [STRUCTURE_SPAWN]: [], [STRUCTURE_EXTENSION]: [], [STRUCTURE_TOWER]: [], [STRUCTURE_STORAGE]: [],
	                        [STRUCTURE_TERMINAL]: [], [STRUCTURE_FACTORY]: [], [STRUCTURE_LAB]: [], [STRUCTURE_OBSERVER]: [],
	                        [STRUCTURE_NUKER]: [], [STRUCTURE_POWER_SPAWN]: [], [STRUCTURE_LINK]: []
	                    };
	                    commonjsGlobal.Cache.blueprints.set(pos.roomName, bp);
	                }

	                if (j === ret.path.length - 1) {
	                    let hasContainer = false;
	                    for (let c = 0; c < bp.containers.length; c++) {
	                        if (bp.containers[c].x === pos.x && bp.containers[c].y === pos.y) hasContainer = true;
	                    }
	                    if (!hasContainer) bp.containers.push({ x: pos.x, y: pos.y, intent: 'source' });
	                } else {
	                    let hasRoad = false;
	                    for (let c = 0; c < bp.roads.length; c++) {
	                        if (bp.roads[c].x === pos.x && bp.roads[c].y === pos.y) hasRoad = true;
	                    }
	                    if (!hasRoad) bp.roads.push({ x: pos.x, y: pos.y, isExternal: true });
	                }
	            }
	        }
	    }

	    // ─── Visualizer ──────────────────────────────────────────────────────

	    /**
	     * Renders the full blueprint each tick.
	     * Color legend:
	     *   Roads          — grey dots along the cardinal spine arms
	     *   Extensions     — yellow squares (teeth off the spine)
	     *   Spawns         — orange  |  Storage — green  |  Terminal — cyan
	     *   Factory        — amber   |  Towers  — red
	     *   Supplier labs  — bright cyan + 'S'  |  Reactor labs — purple
	     *   PowerSpawn     — magenta |  Nuker   — dark red
	     *   Ramparts       — green outline
	     *   Road-exit ramp — yellow outline (thicker, airlock corridors)
	     *   Outpost ramp   — orange outline (external resource protection)
	     *   Anchor         — white circle + gear icon
	     */
	    static visualize() {
	        if (!Memory.debugPlanner) return;
	        if (!commonjsGlobal.Cache || !commonjsGlobal.Cache.blueprints) return;

	        for (const [roomName, blueprint] of commonjsGlobal.Cache.blueprints.entries()) {
	            const visual = new RoomVisual(roomName);

	            // Roads
	            if (blueprint.roads) {
	                for (let i = 0; i < blueprint.roads.length; i++) {
	                    const p = blueprint.roads[i];
	                    visual.circle(p.x, p.y, { radius: 0.15, fill: '#888888', opacity: 0.35 });
	                }
	            }

	            // Structures
	            const structureColors = {
	                [STRUCTURE_SPAWN]: '#ffaa00',
	                [STRUCTURE_EXTENSION]: '#ffe066',
	                [STRUCTURE_TOWER]: '#ff4444',
	                [STRUCTURE_STORAGE]: '#44ff44',
	                [STRUCTURE_TERMINAL]: '#44ffff',
	                [STRUCTURE_FACTORY]: '#ff8800',
	                [STRUCTURE_POWER_SPAWN]: '#ff44ff',
	                [STRUCTURE_NUKER]: '#884444',
	                [STRUCTURE_OBSERVER]: '#4488ff',
	            };
	            for (const type in structureColors) {
	                if (!blueprint[type]) continue;
	                for (let i = 0; i < blueprint[type].length; i++) {
	                    const p = blueprint[type][i];
	                    visual.rect(p.x - 0.35, p.y - 0.35, 0.7, 0.7, { fill: structureColors[type], opacity: 0.45 });
	                }
	            }

	            // Labs (supplier = cyan + label, reactor = purple)
	            if (blueprint[STRUCTURE_LAB]) {
	                for (let i = 0; i < blueprint[STRUCTURE_LAB].length; i++) {
	                    const p = blueprint[STRUCTURE_LAB][i];
	                    const isSup = blueprint.supplierSet ? blueprint.supplierSet[p.x * 50 + p.y] : false;
	                    visual.rect(p.x - 0.35, p.y - 0.35, 0.7, 0.7, { fill: isSup ? '#00ffff' : '#cc44ff', opacity: 0.6 });
	                    if (isSup) visual.text('S', p.x, p.y + 0.1, { color: '#000', font: 0.4 });
	                }
	            }

	            // Containers
	            if (blueprint.containers) {
	                for (let i = 0; i < blueprint.containers.length; i++) {
	                    const p = blueprint.containers[i];
	                    visual.rect(p.x - 0.3, p.y - 0.3, 0.6, 0.6, { fill: '#ffffff', opacity: 0.5 });
	                }
	            }

	            // Ramparts
	            if (blueprint.ramparts) {
	                for (let i = 0; i < blueprint.ramparts.length; i++) {
	                    const p = blueprint.ramparts[i];
	                    const key = p.x * 50 + p.y;
	                    const isOutpost = blueprint.outpostSet ? blueprint.outpostSet[key] : false;
	                    const isRoadExit = !isOutpost && blueprint.roadSet ? blueprint.roadSet[key] : false;
	                    visual.rect(p.x - 0.45, p.y - 0.45, 0.9, 0.9, {
	                        fill: 'transparent',
	                        stroke: isOutpost ? '#ff8800' : isRoadExit ? '#ffff00' : '#00ff00',
	                        strokeWidth: isOutpost ? 0.14 : isRoadExit ? 0.12 : 0.07,
	                        opacity: 0.7
	                    });
	                }
	            }

	            // Anchor marker
	            if (blueprint.anchor) {
	                visual.circle(blueprint.anchor.x, blueprint.anchor.y, { radius: 0.28, fill: '#ffffff', opacity: 0.9 });
	                visual.text('⚙', blueprint.anchor.x, blueprint.anchor.y + 0.1, { color: '#000000', font: 0.45 });
	            }
	        }
	    }
	}

	RoomPlanner_1 = RoomPlanner;
	return RoomPlanner_1;
}

var OutpostManager_1;
var hasRequiredOutpostManager;

function requireOutpostManager () {
	if (hasRequiredOutpostManager) return OutpostManager_1;
	hasRequiredOutpostManager = 1;
	const RoomPlanner = requireRoomPlanner();

	/**
	 * Outpost Manager
	 * Brain module that evaluates, acquires, maintains, and drops outposts for each Colony.
	 * Implements V8 Optimization Laws: No dynamic array creation inside tight loops, strictly in-place modifications where applicable.
	 */
	class OutpostManager {
	    static run() {
	        // Run every 50 ticks to evaluate outposts
	        if (Game.time % 50 !== 0) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            OutpostManager.evaluateColonyOutposts(colony);
	        }
	    }

	    static evaluateColonyOutposts(colony) {
	        const roomName = colony.name;
	        const coreState = commonjsGlobal.State.rooms.get(roomName);
	        if (!coreState || !coreState.controller) return;

	        const rcl = coreState.controller.level;
	        let maxOutposts = 0;

	        // Hardcap outposts based on RCL
	        if (rcl >= 8) maxOutposts = 6;
	        else if (rcl >= 6) maxOutposts = 4;
	        else if (rcl === 5) maxOutposts = 3;
	        else if (rcl === 4) maxOutposts = 2;
	        else if (rcl === 3) maxOutposts = 1;

	        if (maxOutposts === 0) return;

	        if (!Memory.rooms[roomName].outposts) {
	            Memory.rooms[roomName].outposts = [];
	        }

	        const outposts = Memory.rooms[roomName].outposts;
	        let updated = false;

	        // 1. Maintenance: Check if we need to drop any current outposts
	        for (let i = outposts.length - 1; i >= 0; i--) {
	            const o = outposts[i];
	            const intel = Memory.rooms[o];

	            let drop = false;
	            if (!intel) drop = true;
	            else if (intel.isDeadWeight) drop = true; // Flagged by RemoteMiningManager (Pathfinder unprofitable)
	            else if (intel.controller && intel.controller.owner) drop = true; // Owned by another player
	            else if (intel.isOccupied) drop = true; // Occupied heavily
	            else if (intel.undefendable && intel.undefendable > Game.time) drop = true; // Too heavily camped

	            if (drop) {
	                outposts.splice(i, 1);
	                updated = true;
	            }
	        }

	        // 2. Acquisition: If we are below the limit, score and claim new outposts
	        if (outposts.length < maxOutposts) {
	            const newOutpost = OutpostManager.getNextBestOutpost(roomName);
	            if (newOutpost) {
	                outposts.push(newOutpost);
	                updated = true;
	                if (!Memory.outposts) Memory.outposts = {};
	                Memory.outposts[newOutpost] = { sourceRoom: roomName };
	                RoomPlanner.planOutpost(roomName, newOutpost);
	            }
	        }

	        // Update colony outposts array directly to prevent waiting for GlobalStateScanner sync
	        if (updated) {
	            colony.outposts.length = 0;
	            for (let i = 0; i < outposts.length; i++) {
	                colony.outposts[i] = outposts[i];
	            }
	        }
	    }

	    static getNextBestOutpost(homeRoom) {
	        // Collect 1 and 2 step neighbors
	        const neighbors = OutpostManager.getNeighbors(homeRoom, 2);

	        let bestRoom = null;
	        let bestScore = -Infinity;

	        // Check globally claimed outposts so we don't steal from another colony
	        const allOutpostsTaken = [];
	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            const outposts = Memory.rooms[colony.name]?.outposts;
	            if (outposts) {
	                for (let i = 0; i < outposts.length; i++) {
	                    allOutpostsTaken.push(outposts[i]);
	                }
	            }
	        }

	        for (let i = 0; i < neighbors.length; i++) {
	            const roomName = neighbors[i];
	            if (allOutpostsTaken.includes(roomName)) continue;

	            const intel = Memory.rooms[roomName];
	            if (!intel || intel.isDeadWeight || !intel.sources || intel.sources.length === 0) continue;
	            if (intel.controller && intel.controller.owner) continue;
	            if (intel.isOccupied) continue;
	            if (intel.undefendable && intel.undefendable > Game.time) continue;

	            // Score calculation
	            let score = 1000;
	            if (intel.sources.length > 1) score = 1500;

	            // Subtract linear distance cost as a heuristic backup.
	            // Real absolute profitability is verified via PathFinder by RemoteMiningManager after acquisition.
	            const linearDist = Game.map.getRoomLinearDistance(homeRoom, roomName);
	            score -= (linearDist * 200);

	            if (score > bestScore) {
	                bestScore = score;
	                bestRoom = roomName;
	            }
	        }

	        return bestRoom;
	    }

	    static getNeighbors(centerRoom, maxDepth) {
	        const visited = [];
	        const queue = [{ room: centerRoom, depth: 0 }];
	        visited.push(centerRoom);

	        let head = 0;
	        while (head < queue.length) {
	            const current = queue[head++];
	            if (current.depth >= maxDepth) continue;

	            const exits = Game.map.describeExits(current.room);
	            if (!exits) continue;

	            for (const dir in exits) {
	                const adj = exits[dir];
	                // Check if valid room
	                const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(adj) : null;
	                if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) {
	                    continue;
	                }

	                // Check SK room
	                if (OutpostManager.isKeeperRoom(adj)) continue;

	                if (!visited.includes(adj)) {
	                    visited.push(adj);
	                    queue.push({ room: adj, depth: current.depth + 1 });
	                }
	            }
	        }

	        // Remove the center room
	        visited.shift();
	        return visited;
	    }

	    static isKeeperRoom(roomName) {
	        const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
	        if (!parsed) return false;
	        const x = parseInt(parsed[1]) % 10;
	        const y = parseInt(parsed[2]) % 10;
	        // Rooms ending in 4, 5, or 6 in both X and Y are SK rooms or the Sector Center
	        return (x >= 4 && x <= 6) && (y >= 4 && y <= 6);
	    }
	}

	OutpostManager_1 = OutpostManager;
	return OutpostManager_1;
}

/**
 * Terminal Manager (Empire Logistics)
 *
 * Implements the Memory.empire.logistics queue.
 * Consumers (RCL 6 rooms, starved rooms, etc.) place requests.
 * Suppliers fulfill them every 10 ticks based on market transaction costs.
 */

var TerminalManager_1;
var hasRequiredTerminalManager;

function requireTerminalManager () {
	if (hasRequiredTerminalManager) return TerminalManager_1;
	hasRequiredTerminalManager = 1;
	class TerminalManager {
	    static run() {
	        if (Game.time % 10 !== 0) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        if (!Memory.empire) Memory.empire = {};
	        if (!Memory.empire.logistics) Memory.empire.logistics = [];

	        TerminalManager.processLogisticsQueue();
	    }

	    /**
	     * API for consumers to request resources.
	     * @param {string} roomName - The colony requesting the resource.
	     * @param {string} resourceType - The RESOURCE_* constant.
	     * @param {number} amount - The exact amount requested.
	     * @param {number} priority - 1 (High/Emergency) to 5 (Low/Progression).
	     */
	    static requestResource(roomName, resourceType, amount, priority = 3) {
	        if (!Memory.empire) Memory.empire = {};
	        if (!Memory.empire.logistics) Memory.empire.logistics = [];

	        // Check if a request already exists to prevent duplicates
	        for (let i = 0; i < Memory.empire.logistics.length; i++) {
	            const req = Memory.empire.logistics[i];
	            if (req.roomName === roomName && req.resourceType === resourceType) {
	                req.amount = amount;
	                req.priority = priority;
	                return;
	            }
	        }

	        Memory.empire.logistics.push({
	            roomName,
	            resourceType,
	            amount,
	            priority,
	            tick: Game.time
	        });
	    }

	    static processLogisticsQueue() {
	        const queue = Memory.empire.logistics;
	        if (!queue || queue.length === 0) return;

	        // Sort by priority (1 is highest), then by oldest request
	        queue.sort((a, b) => {
	            if (a.priority !== b.priority) return a.priority - b.priority;
	            return a.tick - b.tick;
	        });

	        const allRooms = Array.from(commonjsGlobal.State.colonies.values())
	            .map(c => Game.rooms[c.name])
	            .filter(r => r && r.terminal && r.terminal.my && r.storage);

	        // Track terminals that have sent this tick
	        const usedTerminals = new Set();

	        for (let i = 0; i < queue.length; i++) {
	            const request = queue[i];
	            const receiverRoom = Game.rooms[request.roomName];

	            // If the receiver lost their terminal or the request is fulfilled, clear it
	            if (!receiverRoom || !receiverRoom.terminal) {
	                queue.splice(i, 1);
	                i--;
	                continue;
	            }

	            const currentAmount = receiverRoom.terminal.store.getUsedCapacity(request.resourceType) +
	                                  (receiverRoom.storage ? receiverRoom.storage.store.getUsedCapacity(request.resourceType) : 0);

	            if (currentAmount >= request.amount) {
	                queue.splice(i, 1);
	                i--;
	                continue; // Request fulfilled natively
	            }

	            const deficit = request.amount - currentAmount;
	            const batchSize = Math.min(deficit, 25000); // Max 25k per send to prevent choking

	            let bestProvider = null;
	            let minCost = Infinity;

	            for (const provider of allRooms) {
	                if (provider.name === request.roomName) continue;
	                if (usedTerminals.has(provider.name)) continue;
	                if (provider.terminal.cooldown > 0) continue;

	                const available = provider.terminal.store.getUsedCapacity(request.resourceType);
	                if (available < batchSize) continue;

	                // For energy, ensure provider has surplus
	                if (request.resourceType === RESOURCE_ENERGY) {
	                    if (provider.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 100000) continue;
	                }

	                const cost = Game.market.calcTransactionCost(batchSize, provider.name, request.roomName);
	                if (cost < minCost && provider.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= cost + (request.resourceType === RESOURCE_ENERGY ? batchSize : 0)) {
	                    minCost = cost;
	                    bestProvider = provider;
	                }
	            }

	            if (bestProvider) {
	                const result = bestProvider.terminal.send(request.resourceType, batchSize, request.roomName);
	                if (result === OK) {
	                    console.log(`[TerminalManager] FULFILLED (Pri ${request.priority}): Sent ${batchSize} ${request.resourceType} from ${bestProvider.name} to ${request.roomName} (Cost: ${minCost})`);
	                    usedTerminals.add(bestProvider.name);
	                }
	            }
	        }
	    }
	}

	TerminalManager_1 = TerminalManager;
	return TerminalManager_1;
}

/**
 * Global Market Manager
 * Automates global market trading to liquidate excess resources and snipe profitable deals.
 */

var MarketManager_1;
var hasRequiredMarketManager;

function requireMarketManager () {
	if (hasRequiredMarketManager) return MarketManager_1;
	hasRequiredMarketManager = 1;
	class MarketManager {
	    static run() {
	        if (Game.cpu.bucket < 1000) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        // Every 50 ticks, snipe good deals
	        if (Game.time % 50 === 0) {
	            MarketManager.snipeGoodDeals();
	        }

	        // Every 100 ticks, manage active sell orders
	        if (Game.time % 100 === 0) {
	            MarketManager.manageSellOrders();
	        }

	        // Every 6000 ticks, clean up dead orders
	        if (Game.time % 6000 === 0) {
	            MarketManager.cleanUpInactiveOrders();
	        }
	    }

	    /**
	     * Retrieves the 14-day moving average price for a resource.
	     * Caches the result in global to save CPU.
	     */
	    static getResourcePrice(resourceType) {
	        if (!commonjsGlobal.marketPrices) commonjsGlobal.marketPrices = {};
	        if (commonjsGlobal.marketPrices[resourceType] && commonjsGlobal.marketPrices[resourceType].tick > Game.time - 1000) {
	            return commonjsGlobal.marketPrices[resourceType].price;
	        }

	        const history = Game.market.getHistory(resourceType);
	        if (!history || history.length === 0) return undefined;

	        let totalAvg = 0;
	        let days = 0;
	        // Calculate average over the last 14 days
	        for (let i = Math.max(0, history.length - 14); i < history.length; i++) {
	            totalAvg += history[i].avgPrice;
	            days++;
	        }

	        const price = days > 0 ? (totalAvg / days) : history[history.length - 1].avgPrice;
	        commonjsGlobal.marketPrices[resourceType] = { price, tick: Game.time };
	        return price;
	    }

	    static snipeGoodDeals() {
	        const rawMinerals = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];
	        const resourcesToCheck = [RESOURCE_ENERGY, RESOURCE_POWER, ...rawMinerals];

	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            const roomState = commonjsGlobal.State.rooms.get(colony.name);
	            if (!roomState || !roomState.terminal || !roomState.terminal.my || !roomState.storage) continue;
	            if (roomState.terminal.cooldown > 0) continue;

	            const terminal = roomState.terminal;

	            for (let i = 0; i < resourcesToCheck.length; i++) {
	                const res = resourcesToCheck[i];
	                let sellThreshold = 50000;
	                if (res === RESOURCE_POWER) sellThreshold = 5000;
	                if (res === RESOURCE_ENERGY) sellThreshold = 300000;

	                const amount = terminal.store.getUsedCapacity(res);
	                if (amount > sellThreshold) {
	                    MarketManager.lookForGoodDeals(colony.name, res, amount);
	                }
	            }
	        }
	    }

	    static lookForGoodDeals(roomName, mineral, amountAvailable) {
	        let amount = Math.min(amountAvailable, 5000);
	        if (mineral === RESOURCE_POWER) amount = Math.min(amountAvailable, 100);
	        if (mineral === RESOURCE_ENERGY) amount = Math.min(amountAvailable, 10000);

	        const orders = Game.market.getAllOrders(o => o.type === ORDER_BUY && o.resourceType === mineral && o.amount >= amount);
	        if (orders.length === 0) return;

	        let bestOrder = null;
	        let maxProfit = -Infinity;

	        for (let i = 0; i < orders.length; i++) {
	            const o = orders[i];
	            const cost = Game.market.calcTransactionCost(1, roomName, o.roomName);
	            // Profit minus transaction cost (evaluating energy at 0.01 cr/unit for math purposes)
	            const profit = o.price - (0.01 * cost);
	            if (profit > maxProfit) {
	                maxProfit = profit;
	                bestOrder = o;
	            }
	        }

	        const minPrice = MarketManager.getResourcePrice(mineral);
	        if (minPrice === undefined) return;

	        const maxPrice = minPrice * 1.5; // We consider it a good deal if it pays 1.5x average

	        if (bestOrder) {
	            const bestPrice = bestOrder.price - (0.01 * Game.market.calcTransactionCost(1, roomName, bestOrder.roomName));

	            // Only deal if the profit is extremely lucrative, otherwise we maintain sell orders
	            if (bestPrice > maxPrice) {
	                const amountToSend = Math.min(bestOrder.amount, amount);
	                const cost = Game.market.calcTransactionCost(amountToSend, roomName, bestOrder.roomName);
	                const roomTerminal = Game.rooms[roomName]?.terminal;

	                if (roomTerminal && roomTerminal.store.getUsedCapacity(RESOURCE_ENERGY) >= cost) {
	                    Game.market.deal(bestOrder.id, amountToSend, roomName);
	                    console.log(`[MarketManager] SNIPED DEAL: Sold ${amountToSend} ${mineral} from ${roomName} for ${bestOrder.price}. Cost: ${cost} energy.`);
	                }
	            }
	        }
	    }

	    static manageSellOrders() {
	        const rawMinerals = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];

	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            const roomState = commonjsGlobal.State.rooms.get(colony.name);
	            if (!roomState || !roomState.terminal || !roomState.terminal.my || !roomState.storage) continue;

	            for (let i = 0; i < rawMinerals.length; i++) {
	                const mineral = rawMinerals[i];
	                if (roomState.terminal.store.getUsedCapacity(mineral) > 60000) {
	                    MarketManager.maintainSellOrder(colony.name, mineral);
	                }
	            }

	            if (roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 150000 && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000) {
	                MarketManager.maintainSellOrder(colony.name, RESOURCE_ENERGY);
	            }
	        }
	    }

	    static maintainSellOrder(roomName, mineral) {
	        const sellOrders = [];
	        for (const id in Game.market.orders) {
	            const o = Game.market.orders[id];
	            if (o.type === ORDER_SELL && o.resourceType === mineral && o.roomName === roomName) {
	                sellOrders.push(o);
	            }
	        }

	        const sellPrice = MarketManager.getResourcePrice(mineral);
	        if (sellPrice === undefined) return;

	        if (sellOrders.length > 0) {
	            for (let i = 0; i < sellOrders.length; i++) {
	                const order = sellOrders[i];
	                // Update price if we are trying to sell higher than market value (stale order) or lower than market value (losing money)
	                if (order.price > sellPrice || (order.price < sellPrice && order.remainingAmount === 0)) {
	                    console.log(`[MarketManager] Updating price of ${mineral} in ${roomName} to ${sellPrice} (was ${order.price})`);
	                    Game.market.changeOrderPrice(order.id, sellPrice);
	                }
	                if (order.remainingAmount < 2000) {
	                    const addAmount = 10000 - order.remainingAmount;
	                    const fee = addAmount * sellPrice * 0.05; // 5% fee
	                    if (Game.market.credits >= fee) {
	                        console.log(`[MarketManager] Extending sell order of ${mineral} in ${roomName} by ${addAmount}`);
	                        Game.market.extendOrder(order.id, addAmount);
	                    }
	                }
	            }
	        } else {
	            // Create a new order
	            const amount = mineral === RESOURCE_ENERGY ? 50000 : 10000;
	            const fee = amount * sellPrice * 0.05;
	            if (Game.market.credits >= fee) {
	                console.log(`[MarketManager] Creating sell order for ${amount} ${mineral} in ${roomName} for ${sellPrice}`);
	                Game.market.createOrder({ type: ORDER_SELL, resourceType: mineral, price: sellPrice, totalAmount: amount, roomName: roomName });
	            }
	        }
	    }

	    static cleanUpInactiveOrders() {
	        for (const id in Game.market.orders) {
	            const o = Game.market.orders[id];
	            if (!o.active && o.remainingAmount === 0) {
	                Game.market.cancelOrder(o.id);
	            }
	        }
	    }
	}

	MarketManager_1 = MarketManager;
	return MarketManager_1;
}

var ExpansionManager_1;
var hasRequiredExpansionManager;

function requireExpansionManager () {
	if (hasRequiredExpansionManager) return ExpansionManager_1;
	hasRequiredExpansionManager = 1;
	const OutpostManager = requireOutpostManager();

	/**
	 * Expansion Manager
	 * Automates the establishment of new colonies using advanced scoring heuristics (Terrain, Minerals, Outpost Potential).
	 */
	class ExpansionManager {
	    static run() {
	        // Evaluate every 100 ticks. Expansion is a slow, strategic decision.
	        if (Game.time % 100 !== 0) return;

	        // Ensure CPU safety and global State availability
	        if (Game.cpu.bucket < 8000 || Game.cpu.getUsed() > Game.cpu.limit * 0.8) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies || !Memory.rooms) return;

	        if (!Memory.empire) Memory.empire = {};

	        // 1. Maintain active expansion
	        if (Memory.empire.colonizeRoom) {
	            const targetRoomName = Memory.empire.colonizeRoom;
	            const targetRoom = Game.rooms[targetRoomName];

	            // Check success
	            if (targetRoom && targetRoom.controller && targetRoom.controller.my && targetRoom.controller.level >= 2) {
	                console.log(`[ExpansionManager] Expansion successful: ${targetRoomName} reached RCL 2.`);
	                delete Memory.empire.colonizeRoom;
	                delete Memory.empire.colonizeSourceColony;
	                delete Memory.empire.colonizeStartTime;
	                return;
	            }

	            // Check abort timeout (20,000 ticks)
	            if (Memory.empire.colonizeStartTime && Game.time > Memory.empire.colonizeStartTime + 20000) {
	                console.log(`[ExpansionManager] Expansion to ${targetRoomName} failed or stalled. Aborting.`);
	                Memory.rooms[targetRoomName].badExpansion = true;
	                delete Memory.empire.colonizeRoom;
	                delete Memory.empire.colonizeSourceColony;
	                delete Memory.empire.colonizeStartTime;
	                return;
	            }
	            return;
	        }

	        // We can only expand if we have the GCL.
	        const activeColonies = commonjsGlobal.State.colonies.size;
	        if (activeColonies >= Game.gcl.level) return;

	        let bestTarget = null;
	        let bestScore = -Infinity;
	        let bestSourceColony = null;

	        // 2. Score potential candidate rooms
	        for (const roomName in Memory.rooms) {
	            const intel = Memory.rooms[roomName];

	            // Basic viability
	            if (intel.roomType !== 'core') continue;
	            if (intel.controller && intel.controller.owner) continue;
	            if (intel.badExpansion) continue;
	            if (intel.hostiles && (intel.hostiles.towers > 0 || intel.hostiles.invaderCore || intel.hostiles.creeps > 0)) continue;

	            // Must have a controller and sources
	            if (!intel.sources || intel.sources.length === 0) continue;

	            // Distance & Proximity Constraints
	            let minDistanceToColony = Infinity;
	            let closestColony = null;
	            let isTooClose = false;

	            for (const colony of commonjsGlobal.State.colonies.values()) {
	                const dist = Game.map.getRoomLinearDistance(roomName, colony.name);
	                if (dist < minDistanceToColony) {
	                    minDistanceToColony = dist;
	                    closestColony = colony.name;
	                }
	                // Invalid if 1 or 2 rooms away (too close)
	                if (dist <= 2) {
	                    isTooClose = true;
	                    break;
	                }
	            }

	            if (isTooClose || !closestColony) continue;

	            const sourceColonyState = commonjsGlobal.State.rooms.get(closestColony);
	            if (!sourceColonyState || !sourceColonyState.controller || sourceColonyState.controller.level < 4) continue;

	            // Execute Scoring Algorithm
	            let score = ExpansionManager.evaluateExpansion(roomName, minDistanceToColony);
	            if (score === undefined) continue;

	            if (score > bestScore) {
	                bestScore = score;
	                bestTarget = roomName;
	                bestSourceColony = closestColony;
	            }
	        }

	        // 3. Select the best candidate
	        if (bestTarget) {
	            console.log(`[ExpansionManager] Selected new colony target: ${bestTarget} (Score: ${bestScore}). Supplied by: ${bestSourceColony}`);
	            Memory.empire.colonizeRoom = bestTarget;
	            Memory.empire.colonizeSourceColony = bestSourceColony;
	            Memory.empire.colonizeStartTime = Game.time;

	            // Generate and cache a safe route for pioneers
	            Memory.empire.colonizeRoute = ExpansionManager.calculateSafeRoute(bestSourceColony, bestTarget);
	        }
	    }

	    /**
	     * Calculates a multi-room path avoiding hostile strongholds and closed rooms.
	     * Returns an array of room names representing the sequence from startRoom to endRoom.
	     */
	    static calculateSafeRoute(startRoom, endRoom) {
	        const route = Game.map.findRoute(startRoom, endRoom, {
	            routeCallback: (roomName, _fromRoomName) => {
	                const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(roomName) : null;
	                if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) {
	                    return Infinity;
	                }

	                const intel = Memory.rooms[roomName];
	                if (intel) {
	                    if (intel.controller && intel.controller.owner && intel.controller.owner !== 'Bizarrelego') {
	                        return 20; // High cost for enemy rooms
	                    }
	                    if (intel.roomType === 'center' || intel.roomType === 'keeper') {
	                        return 10; // Avoid SK rooms
	                    }
	                }
	                return 1;
	            }
	        });

	        if (route === ERR_NO_PATH) return [];

	        const path = [startRoom];
	        for (let i = 0; i < route.length; i++) {
	            path.push(route[i].room);
	        }
	        return path;
	    }

	    static evaluateExpansion(roomName, minDistanceToColony) {
	        const intel = Memory.rooms[roomName];
	        if (!intel || !intel.sources) return undefined;

	        // Base Sources Value
	        let sourcesScore = intel.sources.length * 50;

	        // Mineral Value
	        let mineralScore = 0;
	        const mineralType = intel.mineral;
	        if (mineralType) {
	            const empireMinerals = commonjsGlobal.State.empireMinerals || [];
	            if (!empireMinerals.includes(mineralType)) {
	                mineralScore += 120;
	                if (mineralType === RESOURCE_CATALYST) {
	                    mineralScore += 80;
	                }
	            }
	        }

	        // Distance Penalty
	        let distanceScore = minDistanceToColony * 2;

	        // Hostile Proximity Penalty
	        let hostilePenalty = 0;
	        const oneAway = OutpostManager.getNeighbors(roomName, 1);
	        for (let i = 0; i < oneAway.length; i++) {
	            const adj = oneAway[i];
	            if (Memory.rooms[adj] && Memory.rooms[adj].isOccupied) {
	                hostilePenalty += 50;
	            }
	        }

	        const twoAway = OutpostManager.getNeighbors(roomName, 2);
	        for (let i = 0; i < twoAway.length; i++) {
	            const adj = twoAway[i];
	            if (Memory.rooms[adj] && Memory.rooms[adj].isOccupied) {
	                hostilePenalty += 20;
	            }
	        }

	        return sourcesScore + mineralScore - distanceScore - hostilePenalty;
	    }
	}

	ExpansionManager_1 = ExpansionManager;
	return ExpansionManager_1;
}

var PowerManager_1;
var hasRequiredPowerManager;

function requirePowerManager () {
	if (hasRequiredPowerManager) return PowerManager_1;
	hasRequiredPowerManager = 1;
	const ActionConstants = requireActionConstants();
	const CacheLib = requireCacheLib();

	/**
	 * Power Manager
	 * Manages the end-game economy via Power Creeps, generating ops and buffing structures.
	 */
	class PowerManager {
	    static run() {
	        if (Game.time % 5 !== 0) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        // Ensure we have an Operator class power creep
	        const operatorName = 'Operator_1';
	        let operator = Game.powerCreeps[operatorName];

	        if (!operator) {
	            // We need to spawn the operator. Find the highest RCL room with a PowerSpawn
	            let bestRoom = null;
	            let highestRCL = 0;

	            for (const colony of commonjsGlobal.State.colonies.values()) {
	                const room = Game.rooms[colony.name];
	                if (room && room.controller && room.controller.level > highestRCL) {
	                    const roomState = commonjsGlobal.State.rooms.get(colony.name);
	                    if (roomState && roomState.powerSpawns && roomState.powerSpawns.length > 0) {
	                        highestRCL = room.controller.level;
	                        bestRoom = room;
	                    }
	                }
	            }

	            if (bestRoom) {
	                const roomState = commonjsGlobal.State.rooms.get(bestRoom.name);
	                const powerSpawn = roomState.powerSpawns[0];

	                // If the power creep exists in the account but is not spawned
	                const pc = Object.values(Game.powerCreeps).find(c => c.className === POWER_CLASS.OPERATOR);
	                if (pc) {
	                    pc.spawn(powerSpawn);
	                    console.log(`[PowerManager] Spawning Operator in ${bestRoom.name}`);
	                }
	            }
	            return;
	        }

	        if (!operator.ticksToLive) return; // Currently spawning

	        if (!operator.heap) {
	            let heap = commonjsGlobal.creepHeap.get(operator.name);
	            if (!heap) {
	                heap = CacheLib.getDefaultHeap();
	                commonjsGlobal.creepHeap.set(operator.name, heap);
	            }
	            operator.heap = heap;
	        }

	        // Renew Power Creep if needed
	        if (operator.ticksToLive < 1000) {
	            const roomState = commonjsGlobal.State.rooms.get(operator.room.name);
	            if (roomState && roomState.powerSpawns && roomState.powerSpawns.length > 0) {
	                const ps = roomState.powerSpawns[0];
	                if (operator.pos.isNearTo(ps)) {
	                    operator.heap.actionIntent = ActionConstants.ACTION_RENEW;
	                    operator.heap.targetId = ps.id;
	                } else {
	                    operator.heap.destination = { x: ps.pos.x, y: ps.pos.y, roomName: ps.pos.roomName, range: 1 };
	                }
	                return; // Prioritize renewing
	            }
	        }

	        // Enable Power in the room if not already enabled
	        if (operator.room.controller && !operator.room.controller.isPowerEnabled) {
	            if (operator.pos.isNearTo(operator.room.controller)) {
	                operator.heap.actionIntent = ActionConstants.ACTION_ENABLE_ROOM;
	                operator.heap.targetId = operator.room.controller.id;
	            } else {
	                operator.heap.destination = { x: operator.room.controller.pos.x, y: operator.room.controller.pos.y, roomName: operator.room.controller.pos.roomName, range: 1 };
	            }
	            return;
	        }

	        // Ops generation loop
	        if (operator.powers[PWR_GENERATE_OPS] && operator.powers[PWR_GENERATE_OPS].cooldown === 0) {
	            operator.heap.actionIntent = ActionConstants.ACTION_USE_POWER;
	            operator.heap.powerId = PWR_GENERATE_OPS;
	            operator.heap.targetId = null;
	        }

	        // Structure buffs (prioritize Factory, then Extension)
	        const roomState = commonjsGlobal.State.rooms.get(operator.room.name);
	        if (!roomState) return;

	        // Operate Factory (if we have a factory and it's active)
	        if (operator.powers[PWR_OPERATE_FACTORY] && operator.powers[PWR_OPERATE_FACTORY].cooldown === 0) {
	            if (roomState.factories && roomState.factories.length > 0) {
	                const factory = roomState.factories[0];
	                if (operator.store.getUsedCapacity(RESOURCE_OPS) >= POWER_INFO[PWR_OPERATE_FACTORY].ops) {
	                    if (operator.pos.inRangeTo(factory, 3)) {
	                        operator.heap.actionIntent = ActionConstants.ACTION_USE_POWER;
	                        operator.heap.powerId = PWR_OPERATE_FACTORY;
	                        operator.heap.targetId = factory.id;
	                    } else {
	                        operator.heap.destination = { x: factory.pos.x, y: factory.pos.y, roomName: factory.pos.roomName, range: 3 };
	                    }
	                    return;
	                }
	            }
	        }

	        // Operate Extension (if storage is nearly full or we need spawning speed)
	        if (operator.powers[PWR_OPERATE_EXTENSION] && operator.powers[PWR_OPERATE_EXTENSION].cooldown === 0) {
	            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000) {
	                if (operator.store.getUsedCapacity(RESOURCE_OPS) >= POWER_INFO[PWR_OPERATE_EXTENSION].ops) {
	                    if (operator.pos.inRangeTo(roomState.storage, 3)) {
	                        operator.heap.actionIntent = ActionConstants.ACTION_USE_POWER;
	                        operator.heap.powerId = PWR_OPERATE_EXTENSION;
	                        operator.heap.targetId = roomState.storage.id;
	                    } else {
	                        operator.heap.destination = { x: roomState.storage.pos.x, y: roomState.storage.pos.y, roomName: roomState.storage.pos.roomName, range: 3 };
	                    }
	                    return;
	                }
	            }
	        }

	        // Idle near the power spawn or storage
	        if (roomState.storage) {
	            if (!operator.pos.inRangeTo(roomState.storage, 3)) {
	                operator.heap.destination = { x: roomState.storage.pos.x, y: roomState.storage.pos.y, roomName: roomState.storage.pos.roomName, range: 3 };
	            }
	        }
	    }
	}

	PowerManager_1 = PowerManager;
	return PowerManager_1;
}

var TrafficManager_1;
var hasRequiredTrafficManager;

function requireTrafficManager () {
	if (hasRequiredTrafficManager) return TrafficManager_1;
	hasRequiredTrafficManager = 1;
	const CacheLib = requireCacheLib();
	const ROLE_PRIORITY = {
	    'meleecreep': 10,
	    'rangercreep': 10,
	    'mediccreep': 10,
	    'defender': 10,
	    'harvester': 8,
	    'upgrader': 8,
	    'fastfiller': 7,
	    'bootstrapper': 6,
	    'filler': 6,
	    'hauler': 5,
	    'builder': 4,
	    'repairman': 4,
	    'scout': 1
	};

	/**
	 * Top-Down Traffic Manager
	 * Per-room packed coordinate recursive DFS traffic resolution.
	 * Improves performance by replacing string concatenation with integer math.
	 * Resolves multi-creep deadlocks via recursive displacement.
	 */
	class TrafficManager {
	    static getPriority(creep) {
	        if (creep.heap && creep.heap.actionIntent === 'idle') {
	            return -1; // Idle creeps turn into "liquid traffic" and yield to everyone
	        }
	        return ROLE_PRIORITY[(creep.memory.role || '').toLowerCase()] || 0;
	    }

	    static isCreepStationaryLocked(creep) {
	        const role = (creep.memory.role || '').toLowerCase();
	        if (role === 'harvester' || role === 'upgrader' || role === 'fastfiller') {
	            if (creep.heap && creep.heap.sitTargetId) {
	                const sitTarget = CacheLib.getById(creep.heap.sitTargetId);
	                if (sitTarget && creep.pos.isEqualTo(sitTarget)) return true;
	            }
	            if (creep.heap && creep.heap.targetId) {
	                const workTarget = CacheLib.getById(creep.heap.targetId);
	                if (workTarget && creep.pos.isNearTo(workTarget)) return true;
	            }
	        }
	        return false;
	    }

	    static run() {
	        if (!commonjsGlobal.creepHeap) return;

	        const creepsByRoom = new Map();

	        // Pass 1: Global Path Generation & Collection
	        for (const creepName in Game.creeps) {
	            const creep = Game.creeps[creepName];
	            try {
	                if (creep.spawning) continue;

	                if (creep.fatigue > 0) {
	                    TrafficManager.addCreepToRoom(creepsByRoom, creep);
	                    continue;
	                }

	                const heap = creep.heap;
	                if (!heap || (!heap.destination && (!heap.fleeGoals || heap.fleeGoals.length === 0))) {
	                    if (heap && heap.path) heap.path = null;
	                    TrafficManager.addCreepToRoom(creepsByRoom, creep);
	                    continue;
	                }

	                const dest = heap.destination;

	                // Check if arrived
	                if (dest && creep.room.name === dest.roomName) {
	                    const range = Math.max(Math.abs(creep.pos.x - dest.x), Math.abs(creep.pos.y - dest.y));
	                    const destRange = dest.range !== undefined ? dest.range : 1;
	                    if (range <= destRange) {
	                        heap.destination = null;
	                        heap.path = null;
	                        TrafficManager.addCreepToRoom(creepsByRoom, creep);
	                        continue;
	                    }
	                }

	                // Stall detection
	                if (!heap.lastPos) heap.lastPos = { x: -1, y: -1, roomName: '' };
	                if (heap.lastPos.x === creep.pos.x && heap.lastPos.y === creep.pos.y && heap.lastPos.roomName === creep.room.name) {
	                    heap.stallCount = (heap.stallCount || 0) + 1;
	                } else {
	                    heap.stallCount = 0;
	                    heap.lastPos.x = creep.pos.x;
	                    heap.lastPos.y = creep.pos.y;
	                    heap.lastPos.roomName = creep.room.name;
	                }

	                // Advance path if creep successfully moved to the first step
	                if (heap.path) {
	                    if (heap.pathIndex === undefined) heap.pathIndex = 0;
	                    while (heap.pathIndex < heap.path.length) {
	                        const step = heap.path[heap.pathIndex];
	                        if (step.x === creep.pos.x && step.y === creep.pos.y && step.roomName === creep.room.name) {
	                            heap.pathIndex++;
	                        } else {
	                            break;
	                        }
	                    }
	                }

	                // Path caching and invalidation
	                let needsPath = false;
	                if (!heap.path || heap.pathIndex >= heap.path.length) needsPath = true;
	                if (dest && heap.pathDest && (heap.pathDest.x !== dest.x || heap.pathDest.y !== dest.y || heap.pathDest.roomName !== dest.roomName)) needsPath = true;
	                if (heap.fleeGoals && heap.pathDest) needsPath = true; // Invalidate if transitioning to flee logic
	                if (heap.stallCount > 2) {
	                    needsPath = true;
	                    heap.stallCount = 0; // Reset after forcing recalculation
	                }

	                if (!needsPath && heap.stallCount > 0 && heap.path && heap.pathIndex < heap.path.length) {
	                    const nextStep = heap.path[heap.pathIndex];
	                    if (nextStep.roomName === creep.room.name) {
	                        const matrix = TrafficManager.getCostMatrix(creep.room.name);
	                        if (matrix.get(nextStep.x, nextStep.y) === 255) {
	                            needsPath = true;
	                            heap.stallCount = 0;
	                        }
	                    }
	                }

	                if (needsPath) {
	                    let pathResult;

	                    if (heap.fleeGoals && heap.fleeGoals.length > 0) {
	                        // Adds native support for multi-target fleeing intents, decoupling tactical evasion logic from low-level path caching.
	                        pathResult = PathFinder.search(creep.pos, heap.fleeGoals, {
	                            flee: true,
	                            plainCost: 2,
	                            swampCost: 10,
	                            roomCallback: TrafficManager.getCostMatrix
	                        });
	                        heap.pathDest = null;
	                    } else {
	                        const targetPos = new RoomPosition(dest.x, dest.y, dest.roomName);
	                        const destRange = dest.range !== undefined ? dest.range : 1;

	                        if (!commonjsGlobal.PathCache) commonjsGlobal.PathCache = new Map();
	                        const pathKey = `${creep.pos.roomName}_${creep.pos.x}_${creep.pos.y}_${dest.roomName}_${dest.x}_${dest.y}_${destRange}`;
	                        const cached = commonjsGlobal.PathCache.get(pathKey);

	                        if (cached && Game.time < cached.expireTime) {
	                            pathResult = { path: cached.path, incomplete: cached.incomplete, isSerialized: true };
	                        } else {
	                            const searchOptions = {
	                                plainCost: 2,
	                                swampCost: 10,
	                                roomCallback: TrafficManager.getCostMatrix
	                            };
	                            if (creep.pos.roomName === targetPos.roomName) {
	                                searchOptions.maxRooms = 1;
	                            }

	                            pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: destRange }, searchOptions);

	                            const serializedPath = pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
	                            commonjsGlobal.PathCache.set(pathKey, {
	                                path: serializedPath,
	                                incomplete: pathResult.incomplete,
	                                expireTime: Game.time + 1500
	                            });

	                            pathResult.path = serializedPath;
	                            pathResult.isSerialized = true;
	                        }

	                        heap.pathDest = { x: dest.x, y: dest.y, roomName: dest.roomName };
	                    }

	                    if (pathResult.incomplete && pathResult.path.length === 0) {
	                        heap.unreachableTargetId = heap.targetId;
	                        heap.targetId = null;
	                        heap.actionIntent = 'idle';
	                        heap.destination = null;
	                        heap.path = null;
	                        if (heap.fleeGoals) heap.fleeGoals = null;
	                        TrafficManager.addCreepToRoom(creepsByRoom, creep);
	                        continue;
	                    }

	                    heap.path = pathResult.isSerialized ? pathResult.path : pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
	                    heap.pathIndex = 0;
	                }

	                TrafficManager.addCreepToRoom(creepsByRoom, creep);
	            } catch (err) {
	                console.log(`[ERROR] TrafficManager Pass 1 crashed for creep ${creepName}: ${err.message}\n${err.stack}`);
	            }
	        }

	        // Pass 2: Per-Room DFS Traffic Resolution
	        for (const [roomName, roomCreeps] of creepsByRoom) {
	            try {
	                TrafficManager.resolveRoomTraffic(roomName, roomCreeps);
	            } catch (err) {
	                console.log(`[ERROR] TrafficManager Pass 2 crashed for room ${roomName}: ${err.message}\n${err.stack}`);
	            }
	        }

	        if (Memory.debugTraffic) TrafficManager.visualize(creepsByRoom);
	    }

	    static addCreepToRoom(map, creep) {
	        let list = map.get(creep.room.name);
	        if (!list) {
	            list = [];
	            map.set(creep.room.name, list);
	        }
	        list.push(creep);
	    }

	    static resolveRoomTraffic(roomName, creeps) {
	        const len = creeps.length;
	        if (len > TrafficManager.creepList.length) {
	            // Dynamically expand buffers if limit is breached
	            const newSize = len + 50;
	            TrafficManager.creepList = new Array(newSize);
	            TrafficManager.nextSteps = new Int32Array(newSize);
	            TrafficManager.resolvedIntents = new Int32Array(newSize);
	            TrafficManager.priorityScore = new Int32Array(newSize);
	            TrafficManager.visited = new Uint8Array(newSize);
	        }

	        // Optimizes V8 heap usage by eliminating per-room TypedArray instantiations, reducing GC churn.
	        TrafficManager.grid.fill(-1);
	        TrafficManager.nextSteps.fill(-1, 0, len);
	        TrafficManager.resolvedIntents.fill(-1, 0, len);
	        TrafficManager.priorityScore.fill(0, 0, len);

	        for (let i = 0; i < len; i++) {
	            const creep = creeps[i];
	            TrafficManager.creepList[i] = creep;
	            const packed = (creep.pos.y * 50) + creep.pos.x;
	            TrafficManager.grid[packed] = i;

	            TrafficManager.priorityScore[i] = TrafficManager.getPriority(creep);

	            if (creep.heap && creep.heap.path && creep.heap.pathIndex < creep.heap.path.length && creep.fatigue === 0) {
	                const step = creep.heap.path[creep.heap.pathIndex];
	                if (step.roomName === roomName) {
	                    TrafficManager.nextSteps[i] = (step.y * 50) + step.x;
	                } else {
	                    TrafficManager.nextSteps[i] = -2; // Special flag: leaving room
	                }
	            } else {
	                TrafficManager.nextSteps[i] = -1; // Idle
	            }
	        }

	        const terrain = Game.map.getRoomTerrain(roomName);
	        const matrix = TrafficManager.getCostMatrix(roomName);

	        // Sort indices by priority so high priority cascades first
	        if (!TrafficManager.sortedIndices || TrafficManager.sortedIndices.length < len) {
	            TrafficManager.sortedIndices = new Uint16Array(len + 50);
	        }
	        const sortedIndices = TrafficManager.sortedIndices.subarray(0, len);
	        for (let i = 0; i < len; i++) sortedIndices[i] = i;
	        sortedIndices.sort((a, b) => TrafficManager.priorityScore[b] - TrafficManager.priorityScore[a]);

	        // --- Train Locking ---
	        // High-priority creeps moving in a synchronized line project their paths onto the grid.
	        // Intersecting intents from lower-priority creeps are proactively deleted.
	        if (!TrafficManager.trainLocks) TrafficManager.trainLocks = new Uint8Array(2500);
	        TrafficManager.trainLocks.fill(0);
	        for (let k = 0; k < len; k++) {
	            const i = sortedIndices[k];
	            if (TrafficManager.priorityScore[i] >= 10 && TrafficManager.nextSteps[i] >= 0) {
	                TrafficManager.trainLocks[TrafficManager.nextSteps[i]] = 1;
	            } else if (TrafficManager.priorityScore[i] < 10 && TrafficManager.nextSteps[i] >= 0) {
	                if (TrafficManager.trainLocks[TrafficManager.nextSteps[i]] === 1) {
	                    TrafficManager.nextSteps[i] = -1; // Delete intersecting intent, forcing them to wait
	                }
	            }
	        }

	        const deadlocks = [];

	        for (let k = 0; k < len; k++) {
	            const i = sortedIndices[k];
	            if (TrafficManager.nextSteps[i] === -1 || TrafficManager.nextSteps[i] === -2) continue;
	            if (TrafficManager.resolvedIntents[i] !== -1) continue;

	            const targetPacked = TrafficManager.nextSteps[i];
	            if (targetPacked < 0 || targetPacked >= 2500) continue;

	            TrafficManager.visited.fill(0, 0, creeps.length);
	            const success = TrafficManager.depthFirstSearch(i, targetPacked, TrafficManager.priorityScore[i], terrain, matrix, creeps.length);

	            if (success) {
	                TrafficManager.resolvedIntents[i] = targetPacked;
	                const origPacked = (TrafficManager.creepList[i].pos.y * 50) + TrafficManager.creepList[i].pos.x;
	                if (TrafficManager.grid[origPacked] === i) TrafficManager.grid[origPacked] = -1;
	                TrafficManager.grid[targetPacked] = i;
	            } else {
	                // Direct swap fallback if DFS fails but priorities allow
	                let swapped = false;
	                const blockerIdx = TrafficManager.grid[targetPacked];
	                if (blockerIdx !== -1 && blockerIdx !== i) {
	                    if (TrafficManager.priorityScore[i] >= TrafficManager.priorityScore[blockerIdx]) {
	                        const blocker = TrafficManager.creepList[blockerIdx];
	                        if (blocker.fatigue === 0 && !TrafficManager.isCreepStationaryLocked(blocker)) {
	                            const origPacked = (TrafficManager.creepList[i].pos.y * 50) + TrafficManager.creepList[i].pos.x;
	                            TrafficManager.resolvedIntents[i] = targetPacked;
	                            TrafficManager.resolvedIntents[blockerIdx] = origPacked;
	                            TrafficManager.grid[origPacked] = blockerIdx;
	                            TrafficManager.grid[targetPacked] = i;
	                            swapped = true;
	                        }
	                    }
	                }
	                if (!swapped) deadlocks.push(i);
	            }
	        }

	        // --- Bipartite Matching Resolution Fallback ---
	        // Top-tier traffic managers model crowded gridlocks as a maximum flow problem.
	        if (deadlocks.length >= 3) {
	            TrafficManager.resolveBipartiteGridlock(deadlocks, terrain, matrix);
	        }

	        // Issue final intents
	        for (let i = 0; i < creeps.length; i++) {
	            const creep = TrafficManager.creepList[i];
	            if (Memory.debugTraffic) {
	                creep.heap._debugResolved = TrafficManager.resolvedIntents[i];
	                creep.heap._debugNext = TrafficManager.nextSteps[i];
	            }

	            let dir = null;

	            if (TrafficManager.resolvedIntents[i] >= 0) {
	                const targetPacked = TrafficManager.resolvedIntents[i];
	                const tx = targetPacked % 50;
	                const ty = Math.floor(targetPacked / 50);
	                dir = creep.pos.getDirectionTo(tx, ty);
	            } else if (TrafficManager.resolvedIntents[i] === -2 || TrafficManager.nextSteps[i] === -2) {
	                const step = creep.heap.path[creep.heap.pathIndex];
	                dir = TrafficManager.getSafeDirection(creep.pos, step);
	            }

	            if (dir) creep.heap.moveDirection = dir; // Transmit resolved orthogonal movement to ActionExecutor
	            TrafficManager.creepList[i] = null; // Free reference to prevent memory leak
	        }
	    }

	    /**
	     * Recursive DFS logic to push chains of creeps efficiently.
	     * Replaces findEmptyAdjacent with multi-depth resolution.
	     */
	    static depthFirstSearch(creepIdx, targetPacked, minScore, terrain, matrix, creepCount) {
	        const tx = targetPacked % 50;
	        const ty = Math.floor(targetPacked / 50);

	        if (terrain.get(tx, ty) === TERRAIN_MASK_WALL) return false;

	        const blockerIdx = TrafficManager.grid[targetPacked];
	        if (blockerIdx === -1) {
	            // Target tile is completely empty. Ensure it's walkable according to the tickMatrix (avoids threat zones).
	            if (matrix.get(tx, ty) === 255) return false;
	            return true;
	        }

	        if (TrafficManager.visited[blockerIdx]) return false; // Cycle detection
	        TrafficManager.visited[blockerIdx] = 1;

	        const blocker = TrafficManager.creepList[blockerIdx];

	        // Fixes engine-level move rejection by failing DFS against fatigued blockers.
	        if (blocker.fatigue > 0) return false;

	        const blockerScore = TrafficManager.getPriority(blocker);
	        if (minScore < blockerScore) return false; // Prevent low-priority creeps from displacing high-priority

	        // Prevents economic collapse by anchoring stationary creeps against high-priority displacement.
	        if (TrafficManager.isCreepStationaryLocked(blocker)) return false;

	        // If the blocker is already leaving the room, we can just assume the tile opens up
	        if (TrafficManager.nextSteps[blockerIdx] === -2) {
	            TrafficManager.resolvedIntents[blockerIdx] = -2;
	            TrafficManager.grid[targetPacked] = -1;
	            return true;
	        }

	        // Try blocker's intended move first (Chain continuation)
	        if (TrafficManager.nextSteps[blockerIdx] >= 0 && TrafficManager.nextSteps[blockerIdx] !== targetPacked) {
	            const bTarget = TrafficManager.nextSteps[blockerIdx];
	            if (TrafficManager.depthFirstSearch(blockerIdx, bTarget, blockerScore, terrain, matrix, creepCount)) {
	                TrafficManager.resolvedIntents[blockerIdx] = bTarget;
	                TrafficManager.grid[targetPacked] = -1;
	                TrafficManager.grid[bTarget] = blockerIdx;
	                return true;
	            }
	        }

	        // Try pushing blocker to adjacent tiles
	        const bx = tx;
	        const by = ty;
	        const dirs = [-51, -50, -49, -1, 1, 49, 50, 51];

	        // Pass 1: Empty Tiles (O(1) resolution priority)
	        for (let d = 0; d < 8; d++) {
	            const newPacked = targetPacked + dirs[d];
	            const nx = newPacked % 50;
	            const ny = Math.floor(newPacked / 50);

	            if (Math.abs(nx - bx) > 1 || Math.abs(ny - by) > 1) continue;
	            if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
	            if (terrain.get(nx, ny) === TERRAIN_MASK_WALL || matrix.get(nx, ny) === 255) continue;

	            if (TrafficManager.grid[newPacked] === -1) {
	                if (TrafficManager.depthFirstSearch(blockerIdx, newPacked, minScore, terrain, matrix, creepCount)) {
	                    TrafficManager.resolvedIntents[blockerIdx] = newPacked;
	                    TrafficManager.grid[targetPacked] = -1;
	                    TrafficManager.grid[newPacked] = blockerIdx;
	                    return true;
	                }
	            }
	        }

	        // Pass 2: Occupied Tiles (Recursive displacement chain)
	        for (let d = 0; d < 8; d++) {
	            const newPacked = targetPacked + dirs[d];
	            const nx = newPacked % 50;
	            const ny = Math.floor(newPacked / 50);

	            if (Math.abs(nx - bx) > 1 || Math.abs(ny - by) > 1) continue;
	            if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
	            if (terrain.get(nx, ny) === TERRAIN_MASK_WALL || matrix.get(nx, ny) === 255) continue;

	            if (TrafficManager.grid[newPacked] !== -1) {
	                if (TrafficManager.depthFirstSearch(blockerIdx, newPacked, minScore, terrain, matrix, creepCount)) {
	                    TrafficManager.resolvedIntents[blockerIdx] = newPacked;
	                    TrafficManager.grid[targetPacked] = -1;
	                    TrafficManager.grid[newPacked] = blockerIdx;
	                    return true;
	                }
	            }
	        }

	        return false;
	    }

	    /**
	     * Resolves dense gridlocks by modeling the cluster as a maximum flow problem.
	     * Uses augmenting paths to find a valid bipartite matching between creeps and tiles.
	     */
	    static resolveBipartiteGridlock(deadlocks, terrain, matrix) {
	        const assignment = new Int32Array(2500);
	        assignment.fill(-1);

	        const targetsMap = new Map();

	        // 1. Define edges (valid moves) for each deadlocked creep
	        for (let i = 0; i < deadlocks.length; i++) {
	            const cIdx = deadlocks[i];
	            const creep = TrafficManager.creepList[cIdx];
	            const origPacked = (creep.pos.y * 50) + creep.pos.x;

	            if (TrafficManager.isCreepStationaryLocked(creep) || creep.fatigue > 0) {
	                targetsMap.set(cIdx, [origPacked]);
	                continue;
	            }

	            const targets = [];

	            // Preference 1: Their intended next step
	            const nextStep = TrafficManager.nextSteps[cIdx];
	            if (nextStep >= 0) {
	                const occupant = TrafficManager.grid[nextStep];
	                if (occupant === -1 || deadlocks.includes(occupant)) {
	                    targets.push(nextStep);
	                }
	            }

	            // Preference 2: Any adjacent empty tile to break the jam
	            const bx = creep.pos.x;
	            const by = creep.pos.y;
	            const dirs = [-51, -50, -49, -1, 1, 49, 50, 51];
	            for (let d = 0; d < 8; d++) {
	                const newPacked = (by * 50) + bx + dirs[d];
	                if (newPacked === nextStep) continue;

	                const nx = newPacked % 50;
	                const ny = Math.floor(newPacked / 50);
	                if (Math.abs(nx - bx) > 1 || Math.abs(ny - by) > 1) continue;
	                if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;
	                if (terrain.get(nx, ny) === TERRAIN_MASK_WALL || matrix.get(nx, ny) === 255) continue;

	                const occupant = TrafficManager.grid[newPacked];
	                if (occupant === -1 || deadlocks.includes(occupant)) {
	                    targets.push(newPacked);
	                }
	            }

	            // Preference 3: Staying still
	            targets.push(origPacked);

	            targetsMap.set(cIdx, targets);
	        }

	        // 2. Compute Maximum Bipartite Matching using DFS Augmenting Paths
	        for (let i = 0; i < deadlocks.length; i++) {
	            const cIdx = deadlocks[i];
	            const visited = new Uint8Array(2500);
	            TrafficManager.bipartiteDFS(cIdx, targetsMap, assignment, visited);
	        }

	        // 3. Apply the results
	        for (let i = 0; i < deadlocks.length; i++) {
	            const cIdx = deadlocks[i];
	            const origPacked = (TrafficManager.creepList[cIdx].pos.y * 50) + TrafficManager.creepList[cIdx].pos.x;
	            TrafficManager.grid[origPacked] = -1;
	        }

	        for (let tilePacked = 0; tilePacked < 2500; tilePacked++) {
	            const cIdx = assignment[tilePacked];
	            if (cIdx !== -1) {
	                TrafficManager.resolvedIntents[cIdx] = tilePacked;
	                TrafficManager.grid[tilePacked] = cIdx;
	            }
	        }
	    }

	    static bipartiteDFS(cIdx, targetsMap, assignment, visited) {
	        const targets = targetsMap.get(cIdx);
	        if (!targets) return false;

	        for (let i = 0; i < targets.length; i++) {
	            const tile = targets[i];
	            if (visited[tile]) continue;
	            visited[tile] = 1;

	            const currentAssignee = assignment[tile];
	            if (currentAssignee === -1 || TrafficManager.bipartiteDFS(currentAssignee, targetsMap, assignment, visited)) {
	                assignment[tile] = cIdx;
	                return true;
	            }
	        }
	        return false;
	    }

	    static getSafeDirection(fromPos, toPos) {
	        if (fromPos.roomName !== toPos.roomName) {
	            if (fromPos.x === 0 && toPos.x === 49) return LEFT;
	            if (fromPos.x === 49 && toPos.x === 0) return RIGHT;
	            if (fromPos.y === 0 && toPos.y === 49) return TOP;
	            if (fromPos.y === 49 && toPos.y === 0) return BOTTOM;
	        }
	        return fromPos.getDirectionTo(toPos.x, toPos.y);
	    }

	    /**
	     * Adds zero-overhead visual debugging for DFS traffic resolution and dynamic cost matrices, gated by Memory.debugTraffic.
	     */
	    static visualize(creepsByRoom) {
	        for (const [roomName, roomCreeps] of creepsByRoom) {
	            const visual = new RoomVisual(roomName);

	            // Draw Threat & Cost Matrix Visualization
	            const tickMatrix = commonjsGlobal.Cache && commonjsGlobal.Cache.tickMatrices ? commonjsGlobal.Cache.tickMatrices.get(roomName) : null;
	            if (tickMatrix) {
	                for (let x = 0; x < 50; x++) {
	                    for (let y = 0; y < 50; y++) {
	                        if (tickMatrix.get(x, y) === 255) {
	                            visual.rect(x - 0.5, y - 0.5, 1, 1, { fill: '#ff0000', opacity: 0.2 });
	                        }
	                    }
	                }
	            }

	            // Draw Creep Intent Visualization
	            for (let i = 0; i < roomCreeps.length; i++) {
	                const creep = roomCreeps[i];
	                const heap = creep.heap;
	                if (!heap) continue;

	                // Fatigue & Stationary Markers
	                if (creep.fatigue > 0) {
	                    visual.circle(creep.pos, { fill: '#0000ff', radius: 0.3, opacity: 0.5 });
	                }
	                const role = (creep.memory.role || '').toLowerCase();
	                if (role === 'harvester' || role === 'upgrader' || heap.sitTargetId) {
	                    visual.text('X', creep.pos.x, creep.pos.y + 0.25, { color: '#ffffff', size: 0.7, font: 'bold' });
	                }

	                // Traffic Resolution Lines
	                const resolved = heap._debugResolved;
	                const nextStepPacked = heap._debugNext;
	                if (resolved !== undefined && resolved >= 0) {
	                    const tx = resolved % 50;
	                    const ty = Math.floor(resolved / 50);

	                    // Did it successfully move to its intended next step?
	                    if (resolved === nextStepPacked) {
	                        visual.line(creep.pos.x, creep.pos.y, tx, ty, { color: '#00ff00', width: 0.15, opacity: 0.8 });
	                    } else {
	                        // Is it a direct swap?
	                        let isSwap = false;
	                        for (let j = 0; j < roomCreeps.length; j++) {
	                            const other = roomCreeps[j];
	                            if (other.name !== creep.name && other.pos.x === tx && other.pos.y === ty) {
	                                if (other.heap && other.heap._debugResolved === (creep.pos.y * 50) + creep.pos.x) {
	                                    isSwap = true;
	                                    break;
	                                }
	                            }
	                        }

	                        if (isSwap) {
	                            visual.line(creep.pos.x, creep.pos.y, tx, ty, { color: '#ffa500', width: 0.15, opacity: 0.8 });
	                        } else {
	                            // It pushed someone or successfully moved somewhere that wasn't its primary nextStep
	                            visual.line(creep.pos.x, creep.pos.y, tx, ty, { color: '#00ff00', width: 0.15, opacity: 0.8 });
	                        }
	                    }
	                } else if (heap.path && heap.path.length > 0 && creep.fatigue === 0) {
	                    // It had a path, but its resolved intent is its own coordinate or -1
	                    const origPacked = (creep.pos.y * 50) + creep.pos.x;
	                    if (resolved === -1 || resolved === origPacked) {
	                        visual.circle(creep.pos, { stroke: '#ff0000', radius: 0.45, fill: 'transparent', strokeWidth: 0.1 });
	                    }
	                }
	            }
	        }
	    }

	    static getCostMatrix(roomName) {
	        if (!commonjsGlobal.Cache) commonjsGlobal.Cache = {};
	        if (!commonjsGlobal.Cache.costMatrices) commonjsGlobal.Cache.costMatrices = new Map();

	        const roomState = commonjsGlobal.State && commonjsGlobal.State.rooms ? commonjsGlobal.State.rooms.get(roomName) : null;
	        const currentStructCount = roomState ? roomState.structureIdCount + (roomState.constructionSiteCount || 0) : 0;

	        const cached = commonjsGlobal.Cache.costMatrices.get(roomName);
	        let baseMatrix;
	        if (cached && cached.structureCount === currentStructCount) {
	            baseMatrix = cached.matrix;
	        } else {
	            baseMatrix = new PathFinder.CostMatrix();
	            if (roomState && roomState.structureIds) {
	                for (let i = 0; i < roomState.structureIdCount; i++) {
	                    const s = CacheLib.getById(roomState.structureIds[i]);
	                    if (s && s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_RAMPART) {
	                        baseMatrix.set(s.pos.x, s.pos.y, 255);
	                    } else if (s && s.structureType === STRUCTURE_ROAD) {
	                        baseMatrix.set(s.pos.x, s.pos.y, 1);
	                    }
	                }
	            }
	            if (roomState && roomState.constructionSites) {
	                const sites = Object.values(roomState.constructionSites);
	                for (let i = 0; i < sites.length; i++) {
	                    const s = sites[i];
	                    if (s && s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_RAMPART) {
	                        baseMatrix.set(s.pos.x, s.pos.y, 255);
	                    }
	                }
	            }
	            commonjsGlobal.Cache.costMatrices.set(roomName, {
	                matrix: baseMatrix,
	                structureCount: currentStructCount
	            });
	        }

	        if (!commonjsGlobal.Cache.tickMatrices) commonjsGlobal.Cache.tickMatrices = new Map();
	        if (commonjsGlobal.Cache.tickMatricesTime !== Game.time) {
	            commonjsGlobal.Cache.tickMatrices.clear();
	            commonjsGlobal.Cache.tickMatricesTime = Game.time;
	        }

	        let tickMatrix = commonjsGlobal.Cache.tickMatrices.get(roomName);
	        if (tickMatrix) return tickMatrix;

	        tickMatrix = baseMatrix.clone();

	        // Injects dynamic threat zones into the tick-cached matrix, forcing civilian creeps to naturally route around danger and allowing rangers to kite along the cost gradient.
	        if (roomState) {
	            const hostiles = roomState.hostiles || [];
	            for (let i = 0; i < hostiles.length; i++) {
	                const hostile = hostiles[i];
	                let isMelee = false;
	                let isRanged = false;

	                for (let j = 0; j < hostile.body.length; j++) {
	                    const type = hostile.body[j].type;
	                    if (type === ATTACK) isMelee = true;
	                    if (type === RANGED_ATTACK) isRanged = true;
	                }

	                const dxRange = isRanged ? 3 : (isMelee ? 1 : 0);
	                if (dxRange > 0) {
	                    for (let dx = -dxRange; dx <= dxRange; dx++) {
	                        for (let dy = -dxRange; dy <= dxRange; dy++) {
	                            const x = hostile.pos.x + dx;
	                            const y = hostile.pos.y + dy;
	                            if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
	                                tickMatrix.set(x, y, Math.min(255, tickMatrix.get(x, y) + 50));
	                            }
	                        }
	                    }
	                }
	            }

	            // Fixes stationary creep deadlocks by injecting their positions as unwalkable (255) into a tick-cached cloned matrix, forcing PathFinder to route around them.
	            for (const creepName in Game.creeps) {
	                const c = Game.creeps[creepName];
	                if (c.room.name !== roomName) continue;
	                const role = (c.memory.role || '').toLowerCase();
	                if (role === 'harvester' || role === 'upgrader' || (c.heap && c.heap.sitTargetId)) {
	                    tickMatrix.set(c.pos.x, c.pos.y, 255);
	                }
	            }
	        }

	        commonjsGlobal.Cache.tickMatrices.set(roomName, tickMatrix);
	        return tickMatrix;
	    }
	}

	// Static Array Allocation for O(1) performance
	TrafficManager.grid = new Int32Array(2500);
	TrafficManager.creepList = new Array(250);
	TrafficManager.nextSteps = new Int32Array(250);
	TrafficManager.resolvedIntents = new Int32Array(250);
	TrafficManager.priorityScore = new Int32Array(250);
	TrafficManager.visited = new Uint8Array(250);

	TrafficManager_1 = TrafficManager;
	return TrafficManager_1;
}

var ConstructionManager_1;
var hasRequiredConstructionManager;

function requireConstructionManager () {
	if (hasRequiredConstructionManager) return ConstructionManager_1;
	hasRequiredConstructionManager = 1;
	const CacheLib = requireCacheLib();

	/**
	 * Decouples blueprint generation from execution, ensuring high-priority structures
	 * are built sequentially without overflowing site limits.
	 */
	class ConstructionManager {
	    static run() {
	        if (Game.time % 51 !== 0) return;
	        if (Object.keys(Game.constructionSites).length >= 100) return;

	        for (const roomName in Game.rooms) {
	            const room = Game.rooms[roomName];
	            if (!room.controller || (!room.controller.my && !commonjsGlobal.Cache?.blueprints?.has(roomName))) continue;

	            const state = commonjsGlobal.State?.rooms?.get(roomName);
	            if (!state) continue;

	            let siteCount = 0;
	            if (state.constructionSiteCount !== undefined) {
	                siteCount = state.constructionSiteCount;
	            } else if (state.constructionSites) {
	                siteCount = Object.keys(state.constructionSites).length;
	            }
	            if (siteCount >= 5) continue;

	            const blueprint = commonjsGlobal.Cache?.blueprints?.get(roomName);
	            if (!blueprint) continue;

	            ConstructionManager.executeRoomBlueprint(room, blueprint, state, 5 - siteCount);
	        }
	    }

	    static executeRoomBlueprint(room, blueprint, state, maxToPlace) {
	        const rcl = room.controller && room.controller.my ? room.controller.level : 0;
	        const priorityArray = [
	            STRUCTURE_SPAWN,
	            STRUCTURE_TOWER,
	            STRUCTURE_EXTENSION,
	            STRUCTURE_STORAGE,
	            STRUCTURE_TERMINAL,
	            STRUCTURE_CONTAINER,
	            STRUCTURE_LINK,
	            STRUCTURE_EXTRACTOR,
	            STRUCTURE_LAB,
	            STRUCTURE_FACTORY,
	            STRUCTURE_ROAD,
	            STRUCTURE_RAMPART
	        ];

	        const existingPositions = new Map();
	        if (state.structureIds) {
	            for (let i = 0; i < state.structureIds.length; i++) {
	                const s = CacheLib.getById(state.structureIds[i]);
	                if (s) {
	                    const packed = (s.pos.y * 50) + s.pos.x;
	                    let arr = existingPositions.get(packed);
	                    if (!arr) { arr = []; existingPositions.set(packed, arr); }
	                    arr.push(s.structureType);
	                }
	            }
	        }
	        if (state.constructionSites) {
	            const sites = Object.values(state.constructionSites);
	            for (let i = 0; i < sites.length; i++) {
	                const s = sites[i];
	                const packed = (s.pos.y * 50) + s.pos.x;
	                let arr = existingPositions.get(packed);
	                if (!arr) { arr = []; existingPositions.set(packed, arr); }
	                arr.push(s.structureType);
	            }
	        }

	        let placed = 0;

	        for (let p = 0; p < priorityArray.length && placed < maxToPlace; p++) {
	            const structureType = priorityArray[p];
	            let positions = [];

	            if (structureType === STRUCTURE_CONTAINER) {
	                const rawPositions = blueprint.containers || [];
	                positions = [];
	                for (let i = 0; i < rawPositions.length; i++) {
	                    const pos = rawPositions[i];
	                    // Core (fast filler) containers are gated until RCL 4
	                    if (pos.intent === 'core' && rcl < 4 && (!room.controller || room.controller.my)) continue;
	                    // Source containers are gated until RCL 3
	                    if (pos.intent === 'source' && rcl < 3 && (!room.controller || room.controller.my)) continue;
	                    // Mineral containers are gated until RCL 6
	                    if (pos.intent === 'mineral' && rcl < 6) continue;
	                    positions.push(pos);
	                }
	            } else if (structureType === STRUCTURE_ROAD) {
	                const rawRoads = blueprint.roads || [];
	                positions = [];

	                let maxExtDist = 0;
	                if (blueprint.anchor && state.structureIds) {
	                    for (let i = 0; i < state.structureIds.length; i++) {
	                        const s = CacheLib.getById(state.structureIds[i]);
	                        if (s && s.structureType === STRUCTURE_EXTENSION) {
	                            const d = Math.max(Math.abs(s.pos.x - blueprint.anchor.x), Math.abs(s.pos.y - blueprint.anchor.y));
	                            if (d > maxExtDist) maxExtDist = d;
	                        }
	                    }
	                }

	                // Buffer ensures roads are placed slightly ahead of the next extension ring
	                const allowedDist = maxExtDist + 2;

	                for (let i = 0; i < rawRoads.length; i++) {
	                    const road = rawRoads[i];
	                    if (road.isExternal) {
	                        if (rcl >= 3 || !room.controller || !room.controller.my) positions.push(road);
	                    } else if (road.dist !== undefined) {
	                        if (road.dist <= allowedDist) positions.push(road);
	                    } else {
	                        positions.push(road);
	                    }
	                }
	            } else if (structureType === STRUCTURE_RAMPART) {
	                positions = blueprint.ramparts || [];
	            } else {
	                positions = blueprint[structureType] || [];
	            }

	            if (!positions || positions.length === 0) continue;

	            const maxAllowed = CONTROLLER_STRUCTURES[structureType] ? CONTROLLER_STRUCTURES[structureType][rcl] : 0;
	            // Note: maxAllowed for containers is always 5 (even at RCL 1) in the engine, but we want our custom RCL logic to govern them
	            if (maxAllowed === 0 && structureType !== STRUCTURE_CONTAINER) continue;

	            let count = 0;
	            if (state.structureIds) {
	                for (let i = 0; i < state.structureIds.length; i++) {
	                    const s = CacheLib.getById(state.structureIds[i]);
	                    if (s && s.structureType === structureType) count++;
	                }
	            }
	            if (state.constructionSites) {
	                const sites = Object.values(state.constructionSites);
	                for (let i = 0; i < sites.length; i++) {
	                    if (sites[i].structureType === structureType) count++;
	                }
	            }

	            for (let i = 0; i < positions.length && placed < maxToPlace; i++) {
	                if (count >= maxAllowed) break;
	                const pos = positions[i];
	                const packed = (pos.y * 50) + pos.x;
	                const arr = existingPositions.get(packed);
	                if (arr && arr.includes(structureType)) continue;

	                if (room.createConstructionSite(pos.x, pos.y, structureType) === OK) {
	                    placed++;
	                    count++;
	                    if (!arr) {
	                        existingPositions.set(packed, [structureType]);
	                    } else {
	                        arr.push(structureType);
	                    }
	                }
	            }
	        }
	    }
	}

	ConstructionManager_1 = ConstructionManager;
	return ConstructionManager_1;
}

var ScienceManager_1;
var hasRequiredScienceManager;

function requireScienceManager () {
	if (hasRequiredScienceManager) return ScienceManager_1;
	hasRequiredScienceManager = 1;
	const ActionConstants = requireActionConstants();

	/**
	 * Science Manager
	 * Automates the 2+8 lab cluster to synthesize advanced compounds.
	 */
	class ScienceManager {
	    static run() {
	        if (!commonjsGlobal.structureHeap) commonjsGlobal.structureHeap = new Map();
	        if (Game.time % 10 !== 0) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        // Basic Target Priority for Phase 1

	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            const roomState = commonjsGlobal.State.rooms.get(colony.name);
	            if (!roomState || !roomState.labs || roomState.labs.length < 3) continue;

	            const blueprint = commonjsGlobal.Cache.blueprints?.get(colony.name);
	            if (!blueprint || !blueprint.supplierLabs || blueprint.supplierLabs.length < 2) continue;

	            const supplierLabs = [];
	            const reactorLabs = [];

	            // Separate suppliers from reactors based on blueprint coordinates
	            for (let i = 0; i < roomState.labs.length; i++) {
	                const lab = roomState.labs[i];
	                let isSupplier = false;
	                for (let j = 0; j < blueprint.supplierLabs.length; j++) {
	                    const sup = blueprint.supplierLabs[j];
	                    if (lab.pos.x === sup.x && lab.pos.y === sup.y) {
	                        supplierLabs.push(lab);
	                        isSupplier = true;
	                        break;
	                    }
	                }
	                if (!isSupplier) {
	                    reactorLabs.push(lab);
	                }
	            }

	            if (supplierLabs.length < 2 || reactorLabs.length === 0) continue;

	            const sup1 = supplierLabs[0];
	            const sup2 = supplierLabs[1];

	            // Assign global science target based on terminal contents to ensure we synthesize needed compounds
	            const terminal = roomState.terminal;
	            let activeReaction = null;

	            if (terminal) {
	                // If we have Z and K, make ZK
	                if (terminal.store.getUsedCapacity(RESOURCE_ZYNTHIUM) > 1000 && terminal.store.getUsedCapacity(RESOURCE_KEANIUM) > 1000) {
	                    activeReaction = { target: RESOURCE_ZYNTHIUM_KEANITE, r1: RESOURCE_ZYNTHIUM, r2: RESOURCE_KEANIUM };
	                } else if (terminal.store.getUsedCapacity(RESOURCE_UTRIUM) > 1000 && terminal.store.getUsedCapacity(RESOURCE_LEMERGIUM) > 1000) {
	                    activeReaction = { target: RESOURCE_UTRIUM_LEMERGITE, r1: RESOURCE_UTRIUM, r2: RESOURCE_LEMERGIUM };
	                }
	                // Write active reaction to memory so the hubManager knows what to load
	                Memory.rooms[colony.name].scienceTarget = activeReaction;
	            } else {
	                Memory.rooms[colony.name].scienceTarget = null;
	            }

	            // Execute Reactions
	            if (sup1.mineralType && sup2.mineralType && sup1.mineralAmount > 0 && sup2.mineralAmount > 0) {
	                // Only react if the minerals in the suppliers are compatible with the target
	                if (activeReaction && (
	                    (sup1.mineralType === activeReaction.r1 && sup2.mineralType === activeReaction.r2) ||
	                    (sup1.mineralType === activeReaction.r2 && sup2.mineralType === activeReaction.r1)
	                )) {
	                    for (let i = 0; i < reactorLabs.length; i++) {
	                        const reactor = reactorLabs[i];
	                        if (reactor.cooldown === 0) {
	                            let heap = commonjsGlobal.structureHeap.get(reactor.id) || {};
	                            heap.actionIntent = ActionConstants.ACTION_RUN_REACTION;
	                            heap.targetId = sup1.id;
	                            heap.secondaryTargetId = sup2.id;
	                            commonjsGlobal.structureHeap.set(reactor.id, heap);
	                        }
	                    }
	                }
	            }
	        }
	    }
	}

	ScienceManager_1 = ScienceManager;
	return ScienceManager_1;
}

var LinkManager_1;
var hasRequiredLinkManager;

function requireLinkManager () {
	if (hasRequiredLinkManager) return LinkManager_1;
	hasRequiredLinkManager = 1;
	const ActionConstants = requireActionConstants();

	/**
	 * Top-Down Link Manager
	 * Identifies Link roles based on proximity and pushes energy to the Core/Hub Link.
	 */
	class LinkManager {
	    static run() {
	        if (!commonjsGlobal.structureHeap) commonjsGlobal.structureHeap = new Map();
	        if (!commonjsGlobal.State || !commonjsGlobal.State.rooms) return;

	        for (const [roomName, roomState] of commonjsGlobal.State.rooms) {
	            if (!roomState.links || roomState.links.length < 2) continue;

	            const room = Game.rooms[roomName];
	            if (!room) continue;

	            let hubLink = null;
	            let controllerLink = null;
	            const sourceLinks = [];

	            // 1. Identify Links
	            for (let i = 0; i < roomState.links.length; i++) {
	                const link = roomState.links[i];
	                if (!link.my) continue;

	                if (roomState.storage && link.pos.inRangeTo(roomState.storage, 2)) {
	                    hubLink = link;
	                } else if (roomState.controller && link.pos.inRangeTo(roomState.controller, 3)) {
	                    controllerLink = link;
	                } else if (roomState.sources) {
	                    for (let j = 0; j < roomState.sources.length; j++) {
	                        if (link.pos.inRangeTo(roomState.sources[j], 2)) {
	                            sourceLinks.push(link);
	                            break;
	                        }
	                    }
	                }
	            }

	            // 2. Push Energy from Source Links
	            for (let i = 0; i < sourceLinks.length; i++) {
	                const srcLink = sourceLinks[i];
	                if (srcLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 400 && srcLink.cooldown === 0) {
	                    // Try to push to Hub Link first
	                    if (hubLink && hubLink.store.getFreeCapacity(RESOURCE_ENERGY) >= srcLink.store.getUsedCapacity(RESOURCE_ENERGY)) {
	                        let heap = commonjsGlobal.structureHeap.get(srcLink.id) || {};
	                        heap.actionIntent = ActionConstants.ACTION_TRANSFER_ENERGY;
	                        heap.targetId = hubLink.id;
	                        commonjsGlobal.structureHeap.set(srcLink.id, heap);
	                    }
	                    // Fallback to Controller Link
	                    else if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= srcLink.store.getUsedCapacity(RESOURCE_ENERGY)) {
	                        let heap = commonjsGlobal.structureHeap.get(srcLink.id) || {};
	                        heap.actionIntent = ActionConstants.ACTION_TRANSFER_ENERGY;
	                        heap.targetId = controllerLink.id;
	                        commonjsGlobal.structureHeap.set(srcLink.id, heap);
	                    }
	                }
	            }

	            // 3. Push Energy from Hub to Controller (if needed)
	            if (hubLink && hubLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 400 && hubLink.cooldown === 0) {
	                if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
	                    let heap = commonjsGlobal.structureHeap.get(hubLink.id) || {};
	                    heap.actionIntent = ActionConstants.ACTION_TRANSFER_ENERGY;
	                    heap.targetId = controllerLink.id;
	                    commonjsGlobal.structureHeap.set(hubLink.id, heap);
	                }
	            }
	        }
	    }
	}

	LinkManager_1 = LinkManager;
	return LinkManager_1;
}

/**
 * Automates the RCL 5+ paradigm shift by dismantling obsolete containers
 * and deprecating hauler quotas in favor of O(1) link networks.
 * Also automates RCL 4 Base Relocations to correct early-game spawn misplacements.
 */

var InfrastructureManager_1;
var hasRequiredInfrastructureManager;

function requireInfrastructureManager () {
	if (hasRequiredInfrastructureManager) return InfrastructureManager_1;
	hasRequiredInfrastructureManager = 1;
	class InfrastructureManager {
	    static run() {
	        if (Game.time % 100 !== 0) return;

	        if (!commonjsGlobal.State || !commonjsGlobal.State.rooms) return;

	        for (const [roomName, roomState] of commonjsGlobal.State.rooms) {
	            const room = Game.rooms[roomName];
	            if (!room || !room.controller || !room.controller.my) continue;

	            if (room.controller.level >= 4) {
	                InfrastructureManager.manageSpawnRelocation(room, roomState);
	            }

	            if (room.controller.level >= 5) {
	                InfrastructureManager.manageLinkTransition(room, roomState, roomName);
	            }
	        }
	    }

	    static manageSpawnRelocation(room, roomState) {
	        if (!roomState.storage || roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 25000) return;

	        const spawns = roomState.spawns || [];
	        if (spawns.length !== 1) return; // Only do this if there's exactly 1 spawn

	        const blueprint = commonjsGlobal.Cache?.blueprints?.get(room.name);
	        if (!blueprint || !blueprint[STRUCTURE_SPAWN] || blueprint[STRUCTURE_SPAWN].length === 0) return;

	        const spawn = spawns[0];
	        let isCorrectlyPlaced = false;

	        for (let i = 0; i < blueprint[STRUCTURE_SPAWN].length; i++) {
	            const plannedPos = blueprint[STRUCTURE_SPAWN][i];
	            if (spawn.pos.x === plannedPos.x && spawn.pos.y === plannedPos.y) {
	                isCorrectlyPlaced = true;
	                break;
	            }
	        }

	        if (!isCorrectlyPlaced) {
	            const censusData = commonjsGlobal.Cache?.tickCensus?.get(room.name);
	            const builderCount = censusData && censusData.currentCensus ? (censusData.currentCensus['builder'] || 0) : 0;

	            if (builderCount >= 2) {
	                console.log(`[InfrastructureManager] Initiating RCL 4 Base Jump in ${room.name}. Destroying misplaced spawn to rebuild at blueprint anchor!`);
	                spawn.destroy();

	                // Prevent downstream crashes
	                if (roomState.spawns) {
	                    const idx = roomState.spawns.indexOf(spawn);
	                    if (idx > -1) {
	                        roomState.spawns.splice(idx, 1);
	                        roomState.spawnCount--;
	                    }
	                }
	            }
	        }
	    }

	    static manageLinkTransition(room, roomState, roomName) {
	        if (!Memory.rooms) Memory.rooms = {};
	        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
	        if (!Memory.rooms[roomName].sources) Memory.rooms[roomName].sources = {};

	        const sources = roomState.sources;
	        if (!sources || sources.length === 0) return;

	        for (let i = 0; i < sources.length; i++) {
	            const source = sources[i];
	            let hasLink = false;

	            if (roomState.links) {
	                for (let j = 0; j < roomState.links.length; j++) {
	                    const link = roomState.links[j];
	                    if (link.my && link.pos.inRangeTo(source, 2)) {
	                        hasLink = true;
	                        break;
	                    }
	                }
	            }

	            if (hasLink) {
	                Memory.rooms[roomName].sources[source.id] = { isLinked: true };

	                if (roomState.containers) {
	                    for (let c = roomState.containerCount - 1; c >= 0; c--) {
	                        const container = roomState.containers[c];
	                        if (Math.max(Math.abs(container.pos.x - source.pos.x), Math.abs(container.pos.y - source.pos.y)) <= 2) {
	                            container.destroy();

	                            // Prevent downstream crashes
	                            roomState.containers.splice(c, 1);
	                            roomState.containerCount--;

	                            if (roomState.repairTargets) {
	                                const rtIdx = roomState.repairTargets.indexOf(container);
	                                if (rtIdx > -1) {
	                                    roomState.repairTargets.splice(rtIdx, 1);
	                                    roomState.repairTargetCount--;
	                                }
	                            }
	                        }
	                    }
	                }
	            } else {
	                if (Memory.rooms[roomName].sources[source.id]) {
	                    Memory.rooms[roomName].sources[source.id].isLinked = false;
	                }
	            }
	        }
	    }
	}

	InfrastructureManager_1 = InfrastructureManager;
	return InfrastructureManager_1;
}

var TowerManager_1;
var hasRequiredTowerManager;

function requireTowerManager () {
	if (hasRequiredTowerManager) return TowerManager_1;
	hasRequiredTowerManager = 1;
	const ActionConstants = requireActionConstants();

	/**
	 * Top-Down Tower Manager
	 * Evaluates room state once per tick to issue commands to all towers.
	 */
	class TowerManager {
	    static run() {
	        if (!commonjsGlobal.structureHeap) commonjsGlobal.structureHeap = new Map();
	        if (!commonjsGlobal.State || !commonjsGlobal.State.rooms) return;

	        for (const [roomName, roomState] of commonjsGlobal.State.rooms) {
	            if (!roomState.towers || roomState.towers.length === 0) continue;

	            const towers = [];
	            for (let i = 0; i < roomState.towers.length; i++) {
	                const t = roomState.towers[i];
	                if (t.my && t.store.getUsedCapacity(RESOURCE_ENERGY) >= 10) {
	                    towers.push(t);
	                }
	            }
	            if (towers.length === 0) continue;

	            // 1. Defense: Attack hostiles
	            if (roomState.hostiles && roomState.hostiles.length > 0) {
	                // Focus fire on the first hostile (IntelManager populates this)
	                const target = roomState.hostiles[0];
	                for (let i = 0; i < towers.length; i++) {
	                    let heap = commonjsGlobal.structureHeap.get(towers[i].id) || {};
	                    heap.actionIntent = ActionConstants.ACTION_ATTACK;
	                    heap.targetId = target.id;
	                    commonjsGlobal.structureHeap.set(towers[i].id, heap);
	                }
	                continue; // Towers are busy defending
	            }

	            const room = Game.rooms[roomName];
	            if (!room) continue;

	            let towersAvailable = [...towers];

	            // 1.5 Emergency Maintenance: Repair critically damaged ramparts/walls (< 10,000 HP) immediately
	            let emergencyTarget = null;
	            if (roomState.repairTargets && roomState.repairTargets.length > 0) {
	                for (let i = 0; i < roomState.repairTargets.length; i++) {
	                    const t = roomState.repairTargets[i];
	                    if ((t.structureType === STRUCTURE_RAMPART || t.structureType === STRUCTURE_WALL) && t.hits < 10000) {
	                        if (!emergencyTarget || t.hits < emergencyTarget.hits) {
	                            emergencyTarget = t;
	                        }
	                    }
	                }
	            }
	            if (emergencyTarget) {
	                for (let i = 0; i < towersAvailable.length; i++) {
	                    let heap = commonjsGlobal.structureHeap.get(towersAvailable[i].id) || {};
	                    heap.actionIntent = ActionConstants.ACTION_REPAIR;
	                    heap.targetId = emergencyTarget.id;
	                    commonjsGlobal.structureHeap.set(towersAvailable[i].id, heap);
	                }
	                continue; // Towers are busy with emergency repair
	            }

	            // 2. Healing: Heal any damaged friendly creeps (from global state, no room.find)
	            let damagedTarget = null;
	            if (roomState.creeps) {
	                for (let i = 0; i < roomState.creeps.length; i++) {
	                    const c = roomState.creeps[i];
	                    if (c.my && c.hits < c.hitsMax - 100) {
	                        damagedTarget = c;
	                        break;
	                    }
	                }
	            }

	            if (damagedTarget && towersAvailable.length > 0) {
	                // One tower is usually enough to heal a creep unless it's under heavy fire, prevents energy drain overkill
	                const healer = towersAvailable.shift();
	                let heap = commonjsGlobal.structureHeap.get(healer.id) || {};
	                heap.actionIntent = ActionConstants.ACTION_HEAL;
	                heap.targetId = damagedTarget.id;
	                commonjsGlobal.structureHeap.set(healer.id, heap);
	            }

	            if (towersAvailable.length === 0) continue;

	            // 3. Maintenance: Repair critical structures and ramparts
	            if (roomState.repairTargets && roomState.repairTargets.length > 0) {
	                // Sort by lowest health
	                roomState.repairTargets.sort((a, b) => a.hits - b.hits);
	                let targetIdx = 0;

	                for (let i = 0; i < towersAvailable.length; i++) {
	                    const tower = towersAvailable[i];
	                    // Only repair if energy is > 50% to reserve for defense
	                    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 500) continue;

	                    const target = roomState.repairTargets[targetIdx];
	                    if (!target) break;

	                    let heap = commonjsGlobal.structureHeap.get(tower.id) || {};
	                    heap.actionIntent = ActionConstants.ACTION_REPAIR;
	                    heap.targetId = target.id;
	                    commonjsGlobal.structureHeap.set(tower.id, heap);

	                    // Optimization: If target is a wall/rampart, keep hitting it with multiple towers.
	                    // If it's a road/container, assign 1 tower per target to prevent massive energy overkill.
	                    if (target.structureType !== STRUCTURE_WALL && target.structureType !== STRUCTURE_RAMPART) {
	                        targetIdx++;
	                    }
	                }
	            }
	        }
	    }
	}

	TowerManager_1 = TowerManager;
	return TowerManager_1;
}

/**
 * TIB - Top-Down V8-Optimized AI
 * Main Execution Pipeline
 */

var hasRequiredMain;

function requireMain () {
	if (hasRequiredMain) return main$1;
	hasRequiredMain = 1;
	// Core Managers
	const GlobalStateScanner = requireGlobalStateScanner(); // Ensure GlobalStateScanner is imported
	const RoomStateScanner = requireRoomStateScanner();
	const SpawnManager = requireSpawnManager();
	const TaskAssignmentManager = requireTaskAssignmentManager();
	const ActionExecutor = requireActionExecutor();
	const MemoryCleanupManager = requireMemoryCleanupManager();
	const IntelManager = requireIntelManager();
	const MilitaryManager = requireMilitaryManager();
	const RemoteMiningManager = requireRemoteMiningManager();
	const EmpireManager = requireEmpireManager();
	const OutpostManager = requireOutpostManager();
	const TerminalManager = requireTerminalManager();
	const MarketManager = requireMarketManager();
	const ExpansionManager = requireExpansionManager();
	const PowerManager = requirePowerManager();
	const TrafficManager = requireTrafficManager();
	const RoomPlanner = requireRoomPlanner();
	const ConstructionManager = requireConstructionManager();
	const ScoutingManager = requireScoutingManager();
	const ScienceManager = requireScienceManager();
	const LinkManager = requireLinkManager();
	const InfrastructureManager = requireInfrastructureManager();
	const TowerManager = requireTowerManager();

	const { ProfilerUtility, Logger, ErrorHandlingUtility, StressTestUtility } = requireSystemLib();

	let _parsedMemory = null;
	let _lastTime = 0;

	main$1.loop = function () {
	    // 1. RawMemory Interceptor (CPU Hack)
	    // Eliminates persistent JSON.parse() CPU overhead by caching the heap-memory binding across ticks.
	    if (_lastTime && _parsedMemory && Game.time === _lastTime + 1) {
	        delete commonjsGlobal.Memory;
	        commonjsGlobal.Memory = _parsedMemory;
	    } else {
	        _parsedMemory = JSON.parse(RawMemory.get() || '{}');
	        delete commonjsGlobal.Memory;
	        commonjsGlobal.Memory = _parsedMemory;
	    }
	    _lastTime = Game.time;
	    // Profiler Start
	    ProfilerUtility.start();

	    // Memory Cleanup
	    ErrorHandlingUtility.wrap(() => MemoryCleanupManager.run(), 'MemoryCleanupManager')();

	    // 1. Global State Scanning
	    ErrorHandlingUtility.wrap(() => GlobalStateScanner.run(), 'GlobalStateScanner')(); // Ensure scanner runs first

	    // 2. Room State Scanning for Owned Rooms
	    ErrorHandlingUtility.wrap(() => {
	        if (!commonjsGlobal.State) commonjsGlobal.State = { rooms: new Map() };
	        for (const roomName in Game.rooms) {
	            const room = Game.rooms[roomName];
	            RoomStateScanner.run(room);
	        }
	    }, 'RoomStateScanner')();

	    // 3. Intel Gathering (serializes visible room data to Memory)
	    ErrorHandlingUtility.wrap(() => IntelManager.run(), 'IntelManager')();

	    // 3.2 Empire-Level Operations
	    ErrorHandlingUtility.wrap(() => RemoteMiningManager.run(), 'RemoteMiningManager')();
	    ErrorHandlingUtility.wrap(() => OutpostManager.run(), 'OutpostManager')();
	    ErrorHandlingUtility.wrap(() => EmpireManager.run(), 'EmpireManager')();
	    ErrorHandlingUtility.wrap(() => TerminalManager.run(), 'TerminalManager')();
	    ErrorHandlingUtility.wrap(() => MarketManager.run(), 'MarketManager')();
	    ErrorHandlingUtility.wrap(() => ExpansionManager.run(), 'ExpansionManager')();
	    ErrorHandlingUtility.wrap(() => PowerManager.run(), 'PowerManager')();

	    // 3.5 Stress Test Injection
	    ErrorHandlingUtility.wrap(() => StressTestUtility.run(), 'StressTestUtility')();

	    // Establish CPU Gating and Colony Priority
	    let coloniesArr = [];
	    if (commonjsGlobal.State && commonjsGlobal.State.colonies) {
	        coloniesArr = Array.from(commonjsGlobal.State.colonies.values());
	        // Sort by RCL (highest to lowest). If equal, prioritize by threat level (hostiles presence)
	        coloniesArr.sort((a, b) => {
	            const stateA = commonjsGlobal.State.rooms.get(a.name);
	            const stateB = commonjsGlobal.State.rooms.get(b.name);
	            const rclA = stateA && stateA.controller ? stateA.controller.level : 0;
	            const rclB = stateB && stateB.controller ? stateB.controller.level : 0;
	            if (rclB !== rclA) return rclB - rclA;

	            const threatA = stateA && stateA.hostileCount > 0 ? 1 : 0;
	            const threatB = stateB && stateB.hostileCount > 0 ? 1 : 0;
	            return threatB - threatA;
	        });
	    }

	    // 3.8 Planning & Scouting (Throttled)
	    ErrorHandlingUtility.wrap(() => {
	        for (const colony of coloniesArr) {
	            // CPU Throttling: Skip non-critical operations for low-priority colonies if CPU is strained
	            if (Game.cpu.getUsed() > Game.cpu.limit * 0.8 && coloniesArr.indexOf(colony) > 0) continue;

	            const room = Game.rooms[colony.name];
	            if (room && room.controller && room.controller.my) {
	                RoomPlanner.manageRoom(room);
	            }
	        }
	        RoomPlanner.visualize();
	    }, 'RoomPlanner')();
	    ErrorHandlingUtility.wrap(() => ConstructionManager.run(), 'ConstructionManager')();
	    ErrorHandlingUtility.wrap(() => ScoutingManager.run(), 'ScoutingManager')();
	    ErrorHandlingUtility.wrap(() => ScienceManager.run(), 'ScienceManager')();

	    // 4. Task Assignment (Scoped by Colony, Throttled)
	    ErrorHandlingUtility.wrap(() => {
	        for (const colony of coloniesArr) {
	            // CPU Throttling: Skip TaskAssignment for low-priority colonies if CPU is critically strained
	            if (Game.cpu.getUsed() > Game.cpu.limit * 0.8 && coloniesArr.indexOf(colony) > 0) continue;
	            TaskAssignmentManager.run(colony);
	        }
	    }, 'TaskAssignmentManager')();

	    // 4.2 Military Management
	    ErrorHandlingUtility.wrap(() => MilitaryManager.run(), 'MilitaryManager')();

	    // 4.5 Link Management
	    ErrorHandlingUtility.wrap(() => LinkManager.run(), 'LinkManager')();

	    // 4.8 Infrastructure Transition
	    ErrorHandlingUtility.wrap(() => InfrastructureManager.run(), 'InfrastructureManager')();

	    // 5. Spawning
	    ErrorHandlingUtility.wrap(() => {
	        if (commonjsGlobal.State && commonjsGlobal.State.colonies) {
	            for (const spawnName in Game.spawns) {
	                const spawn = Game.spawns[spawnName];
	                const colony = commonjsGlobal.State.colonies.get(spawn.room.name);
	                if (colony) {
	                    SpawnManager.run(spawn, colony);
	                }
	            }
	        }
	    }, 'SpawnManager')();

	    // 6. Traffic Management (computes orthogonal move intents, resolves collisions)
	    ErrorHandlingUtility.wrap(() => TrafficManager.run(), 'TrafficManager')();

	    // 7. Intent Execution (Muscle executes all validated orthogonal intents)
	    ErrorHandlingUtility.wrap(() => ActionExecutor.run(), 'ActionExecutor')();

	    // 8. Tower Management (Defense, Healing, and Repair)
	    ErrorHandlingUtility.wrap(() => TowerManager.run(), 'TowerManager')();

	    // Profiler Reporting
	    ProfilerUtility.report();

	    // Logger
	    Logger.run();

	    // Profiler End
	    ProfilerUtility.end();

	    // Serialize RawMemory manually at end of tick
	    RawMemory.set(JSON.stringify(commonjsGlobal.Memory));
	};
	return main$1;
}

var mainExports = requireMain();
var main = /*@__PURE__*/getDefaultExportFromCjs(mainExports);

module.exports = main;
