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
	    ACTION_RESERVE: 'reserve'
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
	    s.sourceContainers = []; s.controllerContainers = []; s.droppedEnergy = []; s.ruins = []; s.tombstones = [];
	    s.constructionSites = Object.create(null);
	    s.validDroppedEnergy = []; s.availableDroppedEnergy = []; s.energyInRuinsAndTombstones = [];
	    s.harvestableSources = []; s.hostiles = []; s.invaderCores = []; s.structureIds = []; s.repairTargets = [];
	    s.creeps = []; s.harvesters = []; s.upgraders = []; s.ramparts = [];
	    s.spawnCount = 0; s.extensionCount = 0; s.towerCount = 0; s.linkCount = 0; s.labCount = 0;
	    s.containerCount = 0; s.sourceContainerCount = 0; s.controllerContainerCount = 0; s.droppedEnergyCount = 0;
	    s.ruinCount = 0; s.tombstoneCount = 0; s.constructionSiteCount = 0; s.validDroppedEnergyCount = 0;
	    s.availableDroppedEnergyCount = 0; s.energyInRuinsAndTombstonesCount = 0; s.harvestableSourceCount = 0;
	    s.hostileCount = 0; s.invaderCoreCount = 0; s.structureIdCount = 0; s.repairTargetCount = 0; s.rampartCount = 0;
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
	        state.hostileCount = 0;
	        state.rampartCount = 0;
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
	            state.sources = [];
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
	                state.cache.structureIds = room['find'](FIND_STRUCTURES).map(s => s.id);
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
	                    case STRUCTURE_INVADER_CORE: state.invaderCores[state.invaderCoreCount++] = s; break;
	                    case STRUCTURE_RAMPART: if (s.my) state.ramparts[state.rampartCount++] = s; break;
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
	            state.droppedEnergy.length = state.droppedEnergyCount;
	            state.ruins.length = state.ruinCount;
	            state.tombstones.length = state.tombstoneCount;
	            state.hostiles.length = state.hostileCount;
	            state.invaderCores.length = state.invaderCoreCount;
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
	        roomState.creeps = [];
	        roomState.harvesters = [];
	        roomState.upgraders = [];
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
	            roomState.creepCounts[role]++;
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

var SpawnManager_1;
var hasRequiredSpawnManager;

function requireSpawnManager () {
	if (hasRequiredSpawnManager) return SpawnManager_1;
	hasRequiredSpawnManager = 1;
	// src/colonies/SpawnManager.js
	const { RouteDistanceCalculator } = requireSystemLib();
	const EMERGENCY_BODY = [WORK, CARRY, MOVE];

	class CreepBodyBuilder {
	    static getBody(role, energyCapacity) {
	        energyCapacity = energyCapacity || 300;

	        switch (role) {
	            case 'harvester': return this.generateHarvester(energyCapacity);
	            case 'hauler': return this.generateHauler(energyCapacity);
	            case 'upgrader': return this.generateUpgrader(energyCapacity);
	            case 'builder': return this.generateBuilder(energyCapacity);
	            case 'pioneer': return this.generatePioneer(energyCapacity);
	            case 'bootstrapper': return [WORK, CARRY, MOVE];
	            case 'fastfiller': {
	                let carry = 1;
	                let cost = 100;
	                while (cost + 50 <= energyCapacity && carry < 4) { carry++; cost += 50; }
	                return this.buildArray(0, carry, 1);
	            }
	            case 'filler': return this.generateHauler(energyCapacity);
	            case 'remoteharvester': return this.generateHarvester(energyCapacity);
	            case 'remotehauler': return this.generateHauler(energyCapacity);
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
	            default: return [WORK, CARRY, MOVE];
	        }
	    }

	    static generateHarvester(energy) {
	        let work = 1, carry = 1, move = 1;
	        let cost = 200;
	        // Cap at 6 WORK, 1 CARRY, 3 MOVE
	        while (cost + 100 <= energy && work < 6) { work++; cost += 100; }
	        while (cost + 50 <= energy && move < 3) { move++; cost += 50; }
	        return this.buildArray(work, carry, move);
	    }

	    static generateHauler(energy) {
	        // Pure CARRY/MOVE 1:1, capped at 50 parts
	        let carry = 1, move = 1;
	        let cost = 100;
	        while (cost + 100 <= energy && (carry + move + 2) <= 50) {
	            carry += 1;
	            move += 1;
	            cost += 100;
	        }
	        return this.buildArray(0, carry, move);
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
	    static get CENSUS_BY_RCL() {
	        return {
	            1: { harvester: 2, hauler: 4, upgrader: 3, builder: 0 },
	            2: { harvester: 2, hauler: 4, upgrader: 4, builder: 3 },
	            3: { harvester: 2, hauler: 3, upgrader: 4, builder: 3 },
	            4: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
	            5: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
	            6: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
	            7: { harvester: 2, hauler: 2, upgrader: 3, builder: 1 },
	            8: { harvester: 2, hauler: 2, upgrader: 1, builder: 1 }
	        };
	    }

	    static getAllLimits(rcl, roomState, roomName, energyCapacity) {
	        const limits = Object.assign({}, this.CENSUS_BY_RCL[rcl] || this.CENSUS_BY_RCL[4]);

	        if (roomState) {
	            let looseEnergy = 0;
	            if (roomState.droppedEnergy) {
	                for (let i = 0; i < roomState.droppedEnergyCount; i++) {
	                    const drop = roomState.droppedEnergy[i];
	                    if (drop && drop.amount) looseEnergy += drop.amount;
	                }
	            }
	            if (roomState.sourceContainers) {
	                for (let i = 0; i < roomState.sourceContainerCount; i++) {
	                    const container = roomState.sourceContainers[i];
	                    if (container && container.store) looseEnergy += container.store.getUsedCapacity(RESOURCE_ENERGY);
	                }
	            }

	            if (roomState.storage && roomState.storage.my) {
	                limits.filler = 1;

	                if (roomState.extensionsCount && roomState.extensionsCount >= 5) {
	                    limits.fastfiller = Math.min(4, Math.floor(roomState.extensionsCount / 5));
	                }

	                const storageEnergy = roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY);
	                if (storageEnergy < 50000) {
	                    limits.upgrader = Math.min(limits.upgrader, 1);
	                } else if (storageEnergy > 300000) {
	                    limits.upgrader += 3;
	                } else if (storageEnergy > 200000) {
	                    limits.upgrader += 2;
	                } else if (storageEnergy > 100000) {
	                    limits.upgrader += 1;
	                }
	            }

	            if (roomState.terminal && roomState.terminal.my) {
	                const terminalEnergy = roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY);
	                if (terminalEnergy > 50000) {
	                    limits.upgrader += 1;
	                    limits.builder += 1;
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
	                // Skeleton scaffold for Scientist logic
	                limits.scientist = 1;
	            }

	            // Emergency Storage Protocol
	            if (rcl >= 4) {
	                if (!roomState.storage || !roomState.storage.my) {
	                    limits.upgrader = 1;
	                    limits.builder = 4;
	                }
	            }

	            // Expansion Pioneer Limits
	            if (Memory.empire && Memory.empire.colonizeRoom && Memory.empire.colonizeSourceColony === roomName) {
	                limits.claimer = 1;
	                limits.pioneer = 4;
	            }
	        }

	        if (roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
	            const outposts = Memory.rooms[roomName].outposts;
	            let remoteSources = 0;
	            for (let i = 0; i < outposts.length; i++) {
	                const adjMem = Memory.rooms[outposts[i]];
	                if (adjMem && adjMem.sources) {
	                    remoteSources += adjMem.sources.length;
	                }
	            }
	            if (remoteSources > 0) {
	                limits.remoteharvester = remoteSources;
	                limits.remotehauler = remoteSources;
	            }
	            if (rcl >= 4 && outposts.length > 0) {
	                limits.reserver = outposts.length;
	            }
	        }

	        // --- Dynamic Hauler Sizing & Dedication ---
	        limits.haulerQueue = [];
	        limits.hauler = 0;
	        limits.remotehauler = 0;

	        const colony = commonjsGlobal.State?.colonies?.get(roomName);
	        if (colony && colony.sources && colony.sources.length > 0) {
	            for (let i = 0; i < colony.sources.length; i++) {
	                const source = colony.sources[i];
	                const distance = RouteDistanceCalculator.getDistance(source.id, source.pos, roomName);

	                // Math: 10 energy/tick generation. Round trip = 2*distance.
	                // Required capacity = 20 * distance.
	                // 1 CARRY = 50 capacity. So we need Math.ceil((20 * distance) / 50) = Math.ceil(distance * 0.4)
	                // We use Math.ceil(distance * 0.5) for a 20% pathing buffer.
	                const requiredCarry = Math.ceil(distance * 0.5);

	                // 150 energy buys [CARRY, CARRY, MOVE] which is 2 CARRY parts
	                const requiredEnergy = Math.ceil(requiredCarry / 2) * 150;

	                const cappedEnergy = Math.min(requiredEnergy, energyCapacity || 300);
	                // Math.max(1) ensures we always spawn at least 1 hauler if energy is low
	                const neededCount = Math.max(1, Math.ceil(requiredEnergy / cappedEnergy));

	                const isRemote = source.pos.roomName !== roomName;
	                const roleName = isRemote ? 'remotehauler' : 'hauler';

	                limits[roleName] += neededCount;

	                limits.haulerQueue.push({
	                    role: roleName,
	                    targetSource: source.id,
	                    targetRoom: source.pos.roomName,
	                    count: neededCount,
	                    energy: cappedEnergy
	                });
	            }
	        } else {
	            limits.hauler = this.CENSUS_BY_RCL[rcl]?.hauler || 2;
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
	        if (roomState && roomState.hostiles && roomState.hostileCount > 0) hostilesFound = true;
	        if (!hostilesFound && roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
	            const outposts = Memory.rooms[roomName].outposts;
	            for (let i = 0; i < outposts.length; i++) {
	                const outpostState = commonjsGlobal.State?.rooms?.get(outposts[i]);
	                if (outpostState && outpostState.hostiles && outpostState.hostileCount > 0) {
	                    hostilesFound = true;
	                    break;
	                }
	            }
	        }
	        if (hostilesFound) {
	            limits.defender = 2; // Priority 0 during an active siege
	        }

	        const hasOffensiveQueue = commonjsGlobal.State && commonjsGlobal.State.militaryQueue && commonjsGlobal.State.militaryQueue.length > 0;
	        if (hostilesFound) {
	            limits.meleeCreep = Math.min(2, (limits.meleeCreep || 0) + 1);
	            limits.rangerCreep = Math.min(2, (limits.rangerCreep || 0) + 1);
	            limits.medicCreep = Math.min(2, (limits.medicCreep || 0) + 1);
	        }

	        if (rcl >= 4 && hasOffensiveQueue) {
	            limits.meleeCreep = Math.min(2, (limits.meleeCreep || 0) + 1);
	            limits.rangerCreep = Math.min(2, (limits.rangerCreep || 0) + 1);
	            limits.medicCreep = Math.min(2, (limits.medicCreep || 0) + 1);
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

	                // Fixes Generation Die-offs by triggering replacement spawns before the current workforce expires, ensuring zero downtime on critical infrastructure.
	                if (!c.spawning && c.ticksToLive !== undefined && c.ticksToLive < 75) {
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
	            const body = energyCapacity >= 300 ? CreepBodyBuilder.getBody('harvester', energyCapacity) : EMERGENCY_BODY;
	            this.executeSpawn(spawn, 'harvester', body);
	            return;
	        }
	        if (harvesterCount >= 1 && haulerCount === 0 && (targetCensus['hauler'] || 0) > 0) {
	            const body = energyCapacity >= 300 ? CreepBodyBuilder.getBody('hauler', energyCapacity) : EMERGENCY_BODY;
	            this.executeSpawn(spawn, 'hauler', body);
	            return;
	        }

	        // Prevents economic stalling by ensuring early-game scouts yield the spawn queue to critical energy-generating roles.
	        const spawnPriority = [
	            'hubmanager', 'harvester', 'filler', 'hauler', 'bootstrapper', 'mineralhauler', 'fastfiller', 'defender', 'upgrader', 'builder',
	            'mineralminer', 'claimer', 'pioneer', 'scout', 'scientist', 'remoteharvester', 'remotehauler', 'reserver',
	            'meleeCreep', 'rangerCreep', 'medicCreep'
	        ];

	        for (let i = 0; i < spawnPriority.length; i++) {
	            const role = spawnPriority[i];
	            const limit = targetCensus[role] || 0;
	            const current = getCount(role);

	            if (current < limit) {
	                // Prevents economic cannibalism by completely halting all energy sinks (upgraders/builders) until the energy-gathering workforce is at 100% capacity.
	                if (role === 'builder' || role === 'upgrader' || role === 'scout') {
	                    if (harvesterCount < (targetCensus['harvester'] || 0) || haulerCount < (targetCensus['hauler'] || 0)) {
	                        continue;
	                    }
	                }

	                if ((role === 'hauler' || role === 'remotehauler') && targetCensus.haulerQueue) {
	                    let spawned = false;
	                    for (let j = 0; j < targetCensus.haulerQueue.length; j++) {
	                        const req = targetCensus.haulerQueue[j];
	                        if (req.role !== role) continue;

	                        let activeCount = 0;
	                        for (let k = 0; k < roomState.creeps.length; k++) {
	                            const c = roomState.creeps[k];
	                            if (c.memory.role === role && c.memory.targetSource === req.targetSource && (c.spawning || c.ticksToLive >= 75)) {
	                                activeCount++;
	                            }
	                        }

	                        if (activeCount < req.count) {
	                            const body = CreepBodyBuilder.getBody('hauler', req.energy);
	                            this.executeSpawn(spawn, role, body, { targetSource: req.targetSource, targetRoom: req.targetRoom });
	                            spawned = true;
	                            break;
	                        }
	                    }
	                    if (spawned) return;
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
	                        // Strict abort: Do not skip to lower priority roles if we are missing a higher priority one but just lack energy.
	                        return;
	                    }
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
	        else if (role === 'fastfiller') TaskAssignmentManager.assignFastFiller(creep, roomState);
	        else if (role === 'remoteharvester') TaskAssignmentManager.assignRemoteHarvester(creep, roomState);
	        else if (role === 'remotehauler') TaskAssignmentManager.assignRemoteHauler(creep, roomState);
	        else if (role === 'reserver') TaskAssignmentManager.assignReserver(creep, roomState);
	        else if (role === 'defender') TaskAssignmentManager.assignDefender(creep, roomState);
	        else if (role === 'hubmanager') TaskAssignmentManager.assignHubManager(creep, roomState);
	        else if (role === 'mineralminer') TaskAssignmentManager.assignMineralMiner(creep, roomState);
	        else if (role === 'mineralhauler') TaskAssignmentManager.assignMineralHauler(creep, roomState);
	        else if (role === 'claimer') TaskAssignmentManager.assignClaimer(creep, roomState);
	        else if (role === 'scientist') TaskAssignmentManager.assignScientist(creep, roomState);
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
	            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
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
	            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
	            return;
	        }

	        const targetRoomState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	        if (targetRoomState && targetRoomState.controller) {
	            creep.heap.targetId = targetRoomState.controller.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_CLAIM;
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
	                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
	                return;
	            }
	            creep.heap.targetId = homeState.hostiles[0].id;
	            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
	            return;
	        }

	        // Priority 2: Defend outposts
	        const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	        for (let i = 0; i < outposts.length; i++) {
	            const outpostState = commonjsGlobal.State.rooms.get(outposts[i]);
	            if (outpostState && outpostState.hostiles && outpostState.hostiles.length > 0) {
	                if (creep.room.name !== outposts[i]) {
	                    creep.memory.targetRoom = outposts[i];
	                    creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
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
	        if (!creep.memory.targetRoom) {
	            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	            if (outposts.length > 0) {
	                const census = TaskAssignmentManager.getRemoteCensus();
	                let bestRoom = outposts[0];
	                let minCount = Infinity;
	                for (let i = 0; i < outposts.length; i++) {
	                    const key = `remoteHarvester_${creep.memory.colony}_${outposts[i]}`;
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

	        if (creep.room.name !== creep.memory.targetRoom) {
	            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
	            return;
	        }

	        const roomState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	        if (!roomState) return;

	        TaskAssignmentManager.assignHarvester(creep, roomState);
	    }

	    static assignReserver(creep, _roomState) {
	        if (!creep.memory.targetRoom) {
	            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	            if (outposts.length > 0) {
	                const census = TaskAssignmentManager.getRemoteCensus();
	                let bestRoom = outposts[0];
	                let minCount = Infinity;
	                for (let i = 0; i < outposts.length; i++) {
	                    const key = `reserver_${creep.memory.colony}_${outposts[i]}`;
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

	        if (creep.room.name !== creep.memory.targetRoom) {
	            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
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
	            if (creep.room.name !== creep.memory.targetRoom) {
	                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
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
	                creep.memory.targetRoom = creep.memory.colony;
	                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
	                return;
	            }
	            TaskAssignmentManager.assignHaulerWork(creep, homeState);
	        }
	    }

	    static assignFastFiller(creep, roomState) {
	        const blueprint = commonjsGlobal.Cache?.blueprints?.get(creep.room.name);
	        if (!blueprint || !blueprint.anchor) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        const ax = blueprint.anchor.x;
	        const ay = blueprint.anchor.y;

	        const stands = [
	            { x: ax - 1, y: ay - 1 },
	            { x: ax + 1, y: ay - 1 },
	            { x: ax - 1, y: ay + 1 },
	            { x: ax + 1, y: ay + 1 }
	        ];

	        if (!creep.heap.sitTargetId) {
	            let bestStand = null;
	            for (let i = 0; i < stands.length; i++) {
	                const s = stands[i];
	                let occupied = false;
	                for (const name in Game.creeps) {
	                    const other = Game.creeps[name];
	                    if (other.id === creep.id) continue;
	                    if (other.memory.role === 'fastfiller' && other.heap && other.heap.sitPos) {
	                        if (other.heap.sitPos.x === s.x && other.heap.sitPos.y === s.y) occupied = true;
	                    }
	                }
	                if (!occupied) {
	                    bestStand = s;
	                    break;
	                }
	            }
	            if (bestStand) {
	                creep.heap.sitPos = bestStand;
	                creep.heap.sitTargetId = 'stand_' + bestStand.x + '_' + bestStand.y;
	            }
	        }

	        if (creep.heap.sitPos) {
	            if (creep.pos.x !== creep.heap.sitPos.x || creep.pos.y !== creep.heap.sitPos.y) {
	                creep.heap.destination = { x: creep.heap.sitPos.x, y: creep.heap.sitPos.y, roomName: creep.room.name, range: 0 };
	                creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
	                return;
	            }
	        }

	        if (creep.heap.state === 'gather') {
	            let energySource = null;
	            if (roomState.links) {
	                for (let i = 0; i < roomState.linkCount; i++) {
	                    const l = roomState.links[i];
	                    if (l.pos.x === ax && l.pos.y === ay && l.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                        energySource = l; break;
	                    }
	                }
	            }
	            if (!energySource && roomState.containers) {
	                for (let i = 0; i < roomState.containerCount; i++) {
	                    const c = roomState.containers[i];
	                    if ((c.pos.x === ax - 2 || c.pos.x === ax + 2) && c.pos.y === ay && c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                        energySource = c; break;
	                    }
	                }
	            }
	            if (energySource) {
	                creep.heap.targetId = energySource.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        } else {
	            let target = null;
	            if (roomState.spawns) {
	                for (let i = 0; i < roomState.spawnCount; i++) {
	                    const s = roomState.spawns[i];
	                    if (s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.isNearTo(s)) {
	                        target = s; break;
	                    }
	                }
	            }
	            if (!target && roomState.extensions) {
	                for (let i = 0; i < roomState.extensionCount; i++) {
	                    const e = roomState.extensions[i];
	                    if (e.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.isNearTo(e)) {
	                        target = e; break;
	                    }
	                }
	            }

	            if (target) {
	                creep.heap.targetId = target.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        }
	    }

	    static assignFiller(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            // Filler only pulls from Storage
	            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.targetId = roomState.storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	            } else {
	                // If no storage (or empty), filler sleeps or idles
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        } else {
	            // Priority: Fill spawns, extensions, towers
	            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState)) return;
	            // Wait in the target room indefinitely, or do something if needed
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

	        if (roomState.sourceContainers) {
	            for (let i = 0; i < roomState.sourceContainers.length; i++) {
	                const c = roomState.sourceContainers[i];
	                if (Math.max(Math.abs(c.pos.x - source.pos.x), Math.abs(c.pos.y - source.pos.y)) <= 2) {
	                    creep.heap.sitTargetId = c.id;
	                    break;
	                }
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

	        // Check spawn — only if spawn has enough to not starve spawning (300+)
	        // IMPORTANT: Bootstrappers are strictly forbidden from withdrawing from spawns to prevent infinite withdraw/transfer loops.
	        if (roomState.spawns && creep.memory.role !== 'bootstrapper') {
	            for (let i = 0; i < roomState.spawns.length; i++) {
	                const spawn = roomState.spawns[i];
	                if (spawn.store.getUsedCapacity(RESOURCE_ENERGY) < 300) continue;
	                const dx = Math.abs(creep.pos.x - spawn.pos.x);
	                const dy = Math.abs(creep.pos.y - spawn.pos.y);
	                const dist = Math.max(dx, dy);
	                if (dist < bestDist) {
	                    bestDist = dist;
	                    bestTarget = spawn;
	                    bestIntent = ActionConstants.ACTION_WITHDRAW;
	                }
	            }
	        }

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

	        // Emergency Override: If storage exists but we have 0 alive fillers, haulers MUST step in to fill core structures
	        const hasFiller = roomState.creepCounts && (roomState.creepCounts['filler'] > 0 || roomState.creepCounts['fastfiller'] > 0);
	        if (roomState.storage && !hasFiller) {
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

	        // Priority 2: Fill spawn/extensions (Pre-Storage behavior)
	        if (TaskAssignmentManager.routeToCoreStructures(creep, roomState)) return;

	        // We already handled controller drops for non-link rooms above Storage priority.
	        // If we reach here, either we have a link, or we have Storage and controller is full,
	        // but if Storage is full, we should still drop at controller if needed as a last resort.
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
	            // Work phase: Fill Spawns/Extensions first to get real creeps spawning (ignore towers)
	            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState, false)) return;

	            // Priority 2: Build critical structures (like containers) if spawns are 100% full
	            if (roomState.constructionSites) {
	                let bestSite = null;
	                let bestScore = -1;
	                for (const siteId in roomState.constructionSites) {
	                    const s = CacheLib.getById(siteId) || roomState.constructionSites[siteId];
	                    if (!s) continue;
	                    const dist = Math.max(Math.abs(creep.pos.x - s.pos.x), Math.abs(creep.pos.y - s.pos.y)) || 1;
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

var ActionExecutor_1;
var hasRequiredActionExecutor;

function requireActionExecutor () {
	if (hasRequiredActionExecutor) return ActionExecutor_1;
	hasRequiredActionExecutor = 1;
	const ActionConstants = requireActionConstants();
	const CacheLib = requireCacheLib();

	/**
	 * Maps intents directly to Screeps API calls, bypassing roles entirely.
	 */
	class ActionExecutor {
	    static run() {
	        if (!commonjsGlobal.creepHeap) commonjsGlobal.creepHeap = new Map();

	        for (const creepName in Game.creeps) {
	            const creep = Game.creeps[creepName];

	            try {
	                if (creep.spawning || creep.fatigue > 0) continue;

	                let heap = commonjsGlobal.creepHeap.get(creep.name);
	                if (!heap) {
	                    heap = CacheLib.getDefaultHeap();
	                    commonjsGlobal.creepHeap.set(creep.name, heap);
	                }
	                creep.heap = heap;

	                if (Game.time < heap.sleepUntil) continue;

	                const intent = heap.actionIntent;
	                if (!intent || intent === ActionConstants.ACTION_IDLE) continue;

	                if (intent === ActionConstants.ACTION_MOVE_ROOM) {
	                    // Improves architectural consistency by stripping tactical routing from the ActionExecutor, preventing it from silently overwriting intents generated by the ScoutingManager.
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
	                console.log(`[ERROR] ActionExecutor crashed for creep ${creepName}: ${err.message}\n${err.stack}`);
	            }
	        }
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

/**
 * Clears memory of dead creeps and stale heap entries to prevent bloat.
 */

var MemoryCleanupManager_1;
var hasRequiredMemoryCleanupManager;

function requireMemoryCleanupManager () {
	if (hasRequiredMemoryCleanupManager) return MemoryCleanupManager_1;
	hasRequiredMemoryCleanupManager = 1;
	class MemoryCleanupManager {
	    static run() {
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
	    hostiles: { creeps: 0, towers: 0, invaderCore: false }
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

	        if (!mem.hostiles) mem.hostiles = { creeps: 0, towers: 0, invaderCore: false };

	        const hostileCreeps = state.hostiles || [];
	        const towers = state.towers || [];
	        let hostileTowerCount = 0;
	        for (let i = 0; i < towers.length; i++) {
	            if (!towers[i].my && towers[i].structureType === STRUCTURE_TOWER) {
	                hostileTowerCount++;
	            }
	        }
	        const invaderCores = state.invaderCores || [];

	        mem.hostiles.creeps = hostileCreeps.length;
	        mem.hostiles.towers = hostileTowerCount;
	        mem.hostiles.invaderCore = invaderCores.length > 0;

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
	        if (!mem.hostiles) mem.hostiles = { creeps: 0, towers: 0, invaderCore: false };

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
	        } else {
	            controllerObj.owner = null;
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
	            if (intel.sources && intel.sources.length > 0) {
	                outposts.push(adjRoom);
	                // Register globally
	                Memory.outposts[adjRoom] = { sourceRoom: room.name, sources: intel.sources.length };
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
	            const roomState = commonjsGlobal.State.rooms.get(coreRoom.name);
	            const spawns = roomState ? roomState.spawns : [];
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

	            // Don't evaluate owned rooms or SK rooms
	            if (intel.controller && intel.controller.owner) continue;
	            if (intel.roomType === 'sk') continue;

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

	                // 5 WORK, 1 CARRY, 2 MOVE
	                const harvesterCost = 650;

	                // Hauler needs (distance * 2) * 10 capacity to make round trip
	                // A 100 capacity block (2 CARRY, 1 MOVE) costs 150 energy.
	                const requiredCapacity = distance * 2 * 10;
	                const haulerCost = Math.ceil(requiredCapacity / 100) * 150;

	                // Road decays 1 hp per 1000 ticks. Costs 1 energy per hp to repair. Average 0.001 per tile.
	                // Accounting for swamp multipliers, we estimate 0.002 average.
	                const roadCostPerTick = distance * 0.002;

	                const upkeepCost = (harvesterCost / 1500) + (haulerCost / 1500) + roadCostPerTick;

	                // Source yields 3000 energy every 300 ticks = 10 energy/tick
	                const netIncome = 10 - upkeepCost;

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
	        if (Game.time % 100 !== 0) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        // Reset outposts globally to recalculate optimally
	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            if (Memory.rooms[colony.name]) {
	                Memory.rooms[colony.name].outposts = [];
	            }
	        }

	        const validOutposts = [];

	        // Find all viable remote rooms
	        for (const roomName in Memory.rooms) {
	            const intel = Memory.rooms[roomName];

	            // Validate viability
	            if (!intel || intel.isDeadWeight) continue;
	            if (intel.controller && intel.controller.owner) continue; // Owned room
	            if (intel.roomType === 'core') continue; // We own it

	            // Validate threat level (0 threat)
	            if (intel.hostiles && (intel.hostiles.towers > 0 || intel.hostiles.invaderCore)) continue;

	            if (intel.sources && intel.sources.length > 0) {
	                validOutposts.push(roomName);
	            }
	        }

	        // Assign each outpost to the closest colony
	        for (let i = 0; i < validOutposts.length; i++) {
	            const outpost = validOutposts[i];
	            let bestColony = null;
	            let bestDist = Infinity;

	            for (const colony of commonjsGlobal.State.colonies.values()) {
	                const dist = Game.map.getRoomLinearDistance(colony.name, outpost);
	                // Basic range check: remote mining is generally inefficient beyond 2 rooms linear
	                if (dist <= 2 && dist < bestDist) {
	                    bestDist = dist;
	                    bestColony = colony;
	                }
	            }

	            if (bestColony) {
	                if (!Memory.rooms[bestColony.name].outposts) {
	                    Memory.rooms[bestColony.name].outposts = [];
	                }
	                Memory.rooms[bestColony.name].outposts.push(outpost);

	                // Update intel with assignments for global tracking
	                if (!Memory.outposts) Memory.outposts = {};
	                Memory.outposts[outpost] = {
	                    sourceRoom: bestColony.name,
	                    sources: Memory.rooms[outpost].sources.length
	                };
	            }
	        }
	    }
	}

	EmpireManager_1 = EmpireManager;
	return EmpireManager_1;
}

/**
 * Empire Logistics Manager
 * Balances resources across the empire by transferring energy and minerals between colony Terminals.
 */

var EmpireLogisticsManager_1;
var hasRequiredEmpireLogisticsManager;

function requireEmpireLogisticsManager () {
	if (hasRequiredEmpireLogisticsManager) return EmpireLogisticsManager_1;
	hasRequiredEmpireLogisticsManager = 1;
	class EmpireLogisticsManager {
	    static run() {
	        if (Game.time % 50 !== 0) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        const senders = [];
	        const receivers = [];

	        // 1. Identify Senders and Receivers
	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            const roomState = commonjsGlobal.State.rooms.get(colony.name);
	            if (!roomState || !roomState.storage || !roomState.terminal || !roomState.terminal.my) continue;

	            const storageEnergy = roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY);
	            const terminalEnergy = roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY);

	            // We need energy in terminal to send, but we also want to balance based on Storage health
	            if (storageEnergy > 300000 && terminalEnergy > 10000) {
	                senders.push({ roomName: colony.name, terminal: roomState.terminal, storageEnergy });
	            } else if (storageEnergy < 50000) {
	                receivers.push({ roomName: colony.name, terminal: roomState.terminal, storageEnergy });
	            }
	        }

	        // Sort senders (richest first) and receivers (poorest first)
	        senders.sort((a, b) => b.storageEnergy - a.storageEnergy);
	        receivers.sort((a, b) => a.storageEnergy - b.storageEnergy);

	        // 2. Execute Energy Transfers
	        for (let i = 0; i < receivers.length; i++) {
	            if (senders.length === 0) break;

	            const receiver = receivers[i];
	            const sender = senders[0]; // Take the richest sender

	            if (receiver.terminal.store.getFreeCapacity() > 50000) { // Ensure space
	                const sendAmount = Math.min(25000, sender.terminal.store.getUsedCapacity(RESOURCE_ENERGY));

	                if (sendAmount >= 5000) {
	                    const result = sender.terminal.send(RESOURCE_ENERGY, sendAmount, receiver.roomName);
	                    if (result === OK) {
	                        // Successfully sent, remove this sender from the list since a terminal can only send once per tick
	                        senders.shift();
	                    }
	                }
	            }
	        }

	        // Mineral balancing would follow a similar logic structure here
	    }
	}

	EmpireLogisticsManager_1 = EmpireLogisticsManager;
	return EmpireLogisticsManager_1;
}

/**
 * Global Market Manager
 * Automates global market trading to liquidate excess resources and prevent terminal gridlock.
 */

var MarketManager_1;
var hasRequiredMarketManager;

function requireMarketManager () {
	if (hasRequiredMarketManager) return MarketManager_1;
	hasRequiredMarketManager = 1;
	class MarketManager {
	    static run() {
	        if (Game.time % 100 !== 0) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies) return;

	        const rawMinerals = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];

	        for (const colony of commonjsGlobal.State.colonies.values()) {
	            const roomState = commonjsGlobal.State.rooms.get(colony.name);
	            if (!roomState || !roomState.terminal || !roomState.terminal.my) continue;

	            const terminal = roomState.terminal;

	            // 1. Energy Liquidation
	            const energyAmount = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
	            if (energyAmount > 150000) {
	                const sellAmount = Math.min(25000, energyAmount - 150000);
	                MarketManager.liquidateResource(RESOURCE_ENERGY, sellAmount, colony.name);
	            }

	            // 2. Mineral Liquidation
	            for (let i = 0; i < rawMinerals.length; i++) {
	                const minType = rawMinerals[i];
	                const amount = terminal.store.getUsedCapacity(minType);
	                if (amount > 50000) {
	                    const sellAmount = Math.min(10000, amount - 50000);
	                    MarketManager.liquidateResource(minType, sellAmount, colony.name);
	                }
	            }
	        }
	    }

	    static liquidateResource(resourceType, amount, roomName) {
	        if (amount <= 0) return;

	        const orders = Game.market.getAllOrders(order => order.resourceType === resourceType &&
	                                                         order.type === ORDER_BUY &&
	                                                         order.amount > 0);

	        if (orders.length === 0) return;

	        // Sort by highest price
	        orders.sort((a, b) => b.price - a.price);

	        const bestOrder = orders[0];
	        const dealAmount = Math.min(amount, bestOrder.amount);

	        // Ensure we have enough credits to pay for the transfer cost
	        const cost = Game.market.calcTransactionCost(dealAmount, roomName, bestOrder.roomName);
	        if (Game.rooms[roomName].terminal.store.getUsedCapacity(RESOURCE_ENERGY) < cost) {
	            return; // Cannot afford transfer
	        }

	        Game.market.deal(bestOrder.id, dealAmount, roomName);
	        console.log(`[MarketManager] Liquidated ${dealAmount} ${resourceType} from ${roomName} for ${bestOrder.price} credits each.`);
	    }
	}

	MarketManager_1 = MarketManager;
	return MarketManager_1;
}

/**
 * Expansion Manager
 * Automates the establishment of new colonies.
 */

var ExpansionManager_1;
var hasRequiredExpansionManager;

function requireExpansionManager () {
	if (hasRequiredExpansionManager) return ExpansionManager_1;
	hasRequiredExpansionManager = 1;
	class ExpansionManager {
	    static run() {
	        // Evaluate every 100 ticks. Expansion is a slow, strategic decision.
	        if (Game.time % 100 !== 0) return;

	        // Ensure CPU safety and global State availability
	        if (Game.cpu.bucket < 8000 || Game.cpu.getUsed() > Game.cpu.limit * 0.8) return;
	        if (!commonjsGlobal.State || !commonjsGlobal.State.colonies || !Memory.rooms) return;

	        // Ensure we have a colonize target or we can support one.
	        if (!Memory.empire) Memory.empire = {};
	        if (Memory.empire.colonizeRoom) {
	            // Already expanding
	            const targetRoom = Game.rooms[Memory.empire.colonizeRoom];
	            if (targetRoom && targetRoom.controller && targetRoom.controller.my && targetRoom.controller.level >= 1) {
	                // Expansion successful
	                delete Memory.empire.colonizeRoom;
	                delete Memory.empire.colonizeSourceColony;
	            }
	            return;
	        }

	        // We can only expand if we have the GCL.
	        const activeColonies = commonjsGlobal.State.colonies.size;
	        if (activeColonies >= Game.gcl.level) return;

	        const candidateRooms = [];

	        // 1. Evaluate IntelManager data
	        for (const roomName in Memory.rooms) {
	            const intel = Memory.rooms[roomName];

	            // Basic suitability
	            if (intel.roomType !== 'core') continue;
	            if (intel.controller && intel.controller.owner) continue;

	            // Must have 2 sources
	            if (!intel.sources || intel.sources.length < 2) continue;

	            // Threat check
	            if (intel.hostiles && (intel.hostiles.towers > 0 || intel.hostiles.invaderCore || intel.hostiles.creeps > 0)) continue;

	            // Distance Check: Must be >= 3 rooms away from any existing colony
	            let minDistanceToColony = Infinity;
	            let closestColony = null;

	            for (const colony of commonjsGlobal.State.colonies.values()) {
	                const dist = Game.map.getRoomLinearDistance(roomName, colony.name);
	                if (dist < minDistanceToColony) {
	                    minDistanceToColony = dist;
	                    closestColony = colony.name;
	                }
	            }

	            if (minDistanceToColony >= 3 && closestColony) {
	                // Ensure the closest colony has the economy (RCL 4+) to support an expansion
	                const colonyState = commonjsGlobal.State.rooms.get(closestColony);
	                if (colonyState && colonyState.controller && colonyState.controller.level >= 4) {
	                    candidateRooms.push({ roomName, closestColony, minDistanceToColony });
	                }
	            }
	        }

	        // 2. Select the best candidate
	        if (candidateRooms.length > 0) {
	            // Sort by proximity to nearest friendly colony (closer is easier to reinforce)
	            candidateRooms.sort((a, b) => a.minDistanceToColony - b.minDistanceToColony);

	            const bestCandidate = candidateRooms[0];
	            Memory.empire.colonizeRoom = bestCandidate.roomName;
	            Memory.empire.colonizeSourceColony = bestCandidate.closestColony;
	        }
	    }
	}

	ExpansionManager_1 = ExpansionManager;
	return ExpansionManager_1;
}

/**
 * Power Manager
 * Manages the end-game economy via Power Creeps, generating ops and buffing structures.
 */

var PowerManager_1;
var hasRequiredPowerManager;

function requirePowerManager () {
	if (hasRequiredPowerManager) return PowerManager_1;
	hasRequiredPowerManager = 1;
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

	        // Renew Power Creep if needed
	        if (operator.ticksToLive < 1000) {
	            const roomState = commonjsGlobal.State.rooms.get(operator.room.name);
	            if (roomState && roomState.powerSpawns && roomState.powerSpawns.length > 0) {
	                const ps = roomState.powerSpawns[0];
	                if (operator.pos.isNearTo(ps)) {
	                    operator.renew(ps);
	                } else {
	                    operator.moveTo(ps);
	                }
	                return; // Prioritize renewing
	            }
	        }

	        // Enable Power in the room if not already enabled
	        if (operator.room.controller && !operator.room.controller.isPowerEnabled) {
	            if (operator.pos.isNearTo(operator.room.controller)) {
	                operator.enableRoom(operator.room.controller);
	            } else {
	                operator.moveTo(operator.room.controller);
	            }
	            return;
	        }

	        // Ops generation loop
	        if (operator.powers[PWR_GENERATE_OPS] && operator.powers[PWR_GENERATE_OPS].cooldown === 0) {
	            operator.usePower(PWR_GENERATE_OPS);
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
	                        operator.usePower(PWR_OPERATE_FACTORY, factory);
	                    } else {
	                        operator.moveTo(factory);
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
	                        operator.usePower(PWR_OPERATE_EXTENSION, roomState.storage);
	                    } else {
	                        operator.moveTo(roomState.storage);
	                    }
	                    return;
	                }
	            }
	        }

	        // Idle near the power spawn or storage
	        if (roomState.storage) {
	            if (!operator.pos.inRangeTo(roomState.storage, 3)) {
	                operator.moveTo(roomState.storage);
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
	                            pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: destRange }, {
	                                plainCost: 2,
	                                swampCost: 10,
	                                roomCallback: TrafficManager.getCostMatrix
	                            });

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
	                        }
	                    }
	                }
	            }
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

	            if (dir) creep.move(dir);
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
	            baseMatrix = PathFinder.CostMatrix.deserialize(cached.matrix);
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
	                matrix: baseMatrix.serialize(),
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
	        blueprint.ramparts = this.computeMinCut(terrain, visited);

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

	    // ─── Step 7: Min-Cut Ramparts (Dinic's Max-Flow) ─────────────────────

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
	        // Only place ramparts on open-terrain tiles in the cut — these are the gaps
	        // that actually need a structure to block passage.
	        const ramparts = [];
	        for (let x = 1; x < 49; x++) {
	            for (let y = 1; y < 49; y++) {
	                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;  // free perimeter tile
	                const id = x * 50 + y;
	                if (reachable[id] && !reachable[id + 2500]) {
	                    ramparts.push({ x, y });
	                }
	            }
	        }

	        return ramparts;
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
	            if (!room.controller || !room.controller.my) continue;

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
	        const rcl = room.controller.level;
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
	                    if (pos.intent === 'core' && rcl < 4) continue;
	                    // Source containers are gated until RCL 3
	                    if (pos.intent === 'source' && rcl < 3) continue;
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
	                        if (rcl >= 3) positions.push(road);
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

/**
 * Science Manager
 * Automates the 2+8 lab cluster to synthesize advanced compounds.
 */

var ScienceManager_1;
var hasRequiredScienceManager;

function requireScienceManager () {
	if (hasRequiredScienceManager) return ScienceManager_1;
	hasRequiredScienceManager = 1;
	class ScienceManager {
	    static run() {
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
	                            reactor.runReaction(sup1, sup2);
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

/**
 * Top-Down Link Manager
 * Identifies Link roles based on proximity and pushes energy to the Core/Hub Link.
 */

var LinkManager_1;
var hasRequiredLinkManager;

function requireLinkManager () {
	if (hasRequiredLinkManager) return LinkManager_1;
	hasRequiredLinkManager = 1;
	class LinkManager {
	    static run() {
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
	                        srcLink.transferEnergy(hubLink);
	                    }
	                    // Fallback to Controller Link
	                    else if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= srcLink.store.getUsedCapacity(RESOURCE_ENERGY)) {
	                        srcLink.transferEnergy(controllerLink);
	                    }
	                }
	            }

	            // 3. Push Energy from Hub to Controller (if needed)
	            if (hubLink && hubLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 400 && hubLink.cooldown === 0) {
	                if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
	                    hubLink.transferEnergy(controllerLink);
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
	                    for (let c = 0; c < roomState.containerCount; c++) {
	                        const container = roomState.containers[c];
	                        if (Math.max(Math.abs(container.pos.x - source.pos.x), Math.abs(container.pos.y - source.pos.y)) <= 2) {
	                            container.destroy();
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

/**
 * Top-Down Tower Manager
 * Evaluates room state once per tick to issue commands to all towers.
 */

var TowerManager_1;
var hasRequiredTowerManager;

function requireTowerManager () {
	if (hasRequiredTowerManager) return TowerManager_1;
	hasRequiredTowerManager = 1;
	class TowerManager {
	    static run() {
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
	                    towers[i].attack(target);
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
	                    towersAvailable[i].repair(emergencyTarget);
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
	                healer.heal(damagedTarget);
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

	                    tower.repair(target);

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
	const RemoteMiningManager = requireRemoteMiningManager();
	const EmpireManager = requireEmpireManager();
	const EmpireLogisticsManager = requireEmpireLogisticsManager();
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
	            if (room.controller && room.controller.my) {
	                RoomStateScanner.run(room);
	            }
	        }
	    }, 'RoomStateScanner')();

	    // 3. Intel Gathering (serializes visible room data to Memory)
	    ErrorHandlingUtility.wrap(() => IntelManager.run(), 'IntelManager')();

	    // 3.2 Empire-Level Operations
	    ErrorHandlingUtility.wrap(() => RemoteMiningManager.run(), 'RemoteMiningManager')();
	    ErrorHandlingUtility.wrap(() => EmpireManager.run(), 'EmpireManager')();
	    ErrorHandlingUtility.wrap(() => EmpireLogisticsManager.run(), 'EmpireLogisticsManager')();
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

	    // 6. Intent Execution
	    ErrorHandlingUtility.wrap(() => ActionExecutor.run(), 'ActionExecutor')();

	    // 7. Traffic Management (resolves collisions and executes bulk move API calls)
	    ErrorHandlingUtility.wrap(() => TrafficManager.run(), 'TrafficManager')();

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
