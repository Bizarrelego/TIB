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
	    ACTION_PATROL: 'patrol'
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
	    constructionSites: Object.create(null),
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
	            state.sources = state.cache.sourceIds.map(id => CacheLib.getById(id)).filter(Boolean);
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

	            const structures = state.cache.structureIds.map(id => CacheLib.getById(id)).filter(Boolean);

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

	            const hostiles = room['find'](FIND_HOSTILE_CREEPS);
	            for (let i = 0; i < hostiles.length; i++) {
	                state.hostiles[state.hostileCount++] = hostiles[i];
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
	    }
	}

	RoomStateScanner.createRoomStateTemplate = createRoomStateTemplate;
	RoomStateScanner_1 = RoomStateScanner;
	return RoomStateScanner_1;
}

var GlobalStateScanner;
var hasRequiredGlobalStateScanner;

function requireGlobalStateScanner () {
	if (hasRequiredGlobalStateScanner) return GlobalStateScanner;
	hasRequiredGlobalStateScanner = 1;
	const RoomStateScanner = requireRoomStateScanner();

	/**
	 * Module responsible for building the global state object by scanning rooms.
	 * Optimized for RCL 1-8 via Single-Pass Binning, V8 Monomorphism, and Object Reuse.
	 * @module GlobalStateScanner
	 */

	function run() {
	    if (!commonjsGlobal.State) commonjsGlobal.State = { rooms: new Map() };

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
	    }
	}

	GlobalStateScanner = {
	    run
	};
	return GlobalStateScanner;
}

var SpawnManager_1;
var hasRequiredSpawnManager;

function requireSpawnManager () {
	if (hasRequiredSpawnManager) return SpawnManager_1;
	hasRequiredSpawnManager = 1;
	// src/colonies/SpawnManager.js
	const EMERGENCY_BODY = [WORK, CARRY, MOVE];

	class CreepBodyBuilder {
	    static getBody(role, energyCapacity) {
	        energyCapacity = energyCapacity || 300;

	        switch (role) {
	            case 'harvester': return this.generateHarvester(energyCapacity);
	            case 'hauler': return this.generateHauler(energyCapacity);
	            case 'upgrader': return this.generateUpgrader(energyCapacity);
	            case 'builder': return this.generateBuilder(energyCapacity);
	            case 'bootstrapper': return [WORK, CARRY, MOVE];
	            case 'filler': return this.generateHauler(energyCapacity);
	            case 'remoteharvester': return this.generateHarvester(energyCapacity);
	            case 'remotehauler': return this.generateHauler(energyCapacity);
	            case 'scout': return [MOVE];
	            case 'miner': return this.generateMiner(energyCapacity);
	            case 'repairman': return [WORK, CARRY, MOVE, MOVE];
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
	        while (cost + 100 <= energy && work < 5) { work++; cost += 100; }
	        if (cost + 50 <= energy && move < 2 && work < 5) { move++; cost += 50; }
	        return this.buildArray(work, carry, move);
	    }

	    static generateHauler(energy) {
	        let carry = 1, move = 1;
	        let cost = 100;
	        while (cost + 150 <= energy && (carry + move + 3) <= 50) { carry += 2; move += 1; cost += 150; }
	        if (cost + 50 <= energy && (carry + move + 1) <= 50) { carry += 1; cost += 50; }
	        return this.buildArray(0, carry, move);
	    }

	    static generateUpgrader(energy) {
	        let work = 1, carry = 1, move = 1;
	        let cost = 200;
	        const maxWork = 15;
	        while (cost + 100 <= energy && work < maxWork && (work + carry + move + 1) <= 50) {
	            work++; cost += 100;
	            if (work % 5 === 0) {
	                if (cost + 50 <= energy && (work + carry + move + 1) <= 50) { carry++; cost += 50; }
	                if (cost + 50 <= energy && (work + carry + move + 1) <= 50) { move++; cost += 50; }
	            }
	        }
	        return this.buildArray(work, carry, move);
	    }

	    static generateBuilder(energy) {
	        let work = 1, carry = 1, move = 1;
	        let cost = 200;
	        while (cost + 200 <= energy && (work + carry + move + 3) <= 50) { work++; carry++; move++; cost += 200; }
	        while (cost + 50 <= energy && (work + carry + move + 1) <= 50) { carry++; cost += 50; }
	        return this.buildArray(work, carry, move);
	    }

	    static generateMiner(energy) {
	        let work = 1, move = 1;
	        let cost = 150;
	        while (cost + 100 <= energy && work < 5) { work++; cost += 100; }
	        return this.buildArray(work, 0, move);
	    }

	    static generateMelee(energy) {
	        const body = [];
	        let cost = 0;
	        const blockCost = BODYPART_COST[TOUGH] * 2 + BODYPART_COST[ATTACK] * 2 + BODYPART_COST[MOVE] * 2;
	        body.push(TOUGH, TOUGH, ATTACK, ATTACK, MOVE, MOVE);
	        cost += blockCost;
	        while (cost + blockCost <= energy && body.length + 6 <= 50) {
	            body.push(TOUGH, TOUGH, ATTACK, ATTACK, MOVE, MOVE);
	            cost += blockCost;
	        }
	        return body;
	    }

	    static generateRanger(energy) {
	        const body = [];
	        let cost = 0;
	        const blockCost = BODYPART_COST[TOUGH] + BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
	        body.push(TOUGH, RANGED_ATTACK, MOVE);
	        cost += blockCost;
	        while (cost + blockCost <= energy && body.length + 3 <= 50) {
	            body.push(TOUGH, RANGED_ATTACK, MOVE);
	            cost += blockCost;
	        }
	        return body;
	    }

	    static generateMedic(energy) {
	        const body = [];
	        let cost = 0;
	        const blockCost = BODYPART_COST[MOVE] + BODYPART_COST[HEAL];
	        body.push(MOVE, HEAL);
	        cost += blockCost;
	        while (cost + blockCost <= energy && body.length + 2 <= 50) {
	            body.push(MOVE, HEAL);
	            cost += blockCost;
	        }
	        return body;
	    }

	    static buildArray(work, carry, move) {
	        const body = [];
	        for (let i = 0; i < work; i++) body.push(WORK);
	        for (let i = 0; i < carry; i++) body.push(CARRY);
	        for (let i = 0; i < move; i++) body.push(MOVE);
	        return body;
	    }
	}

	class CensusCalculator {
	    static get CENSUS_BY_RCL() {
	        return {
	            1: { harvester: 2, hauler: 4, upgrader: 3, builder: 0 },
	            2: { harvester: 2, hauler: 4, upgrader: 4, builder: 3 },
	            3: { harvester: 2, hauler: 3, upgrader: 5, builder: 3 },
	            4: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
	            5: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
	            6: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
	            7: { harvester: 2, hauler: 2, upgrader: 3, builder: 1 },
	            8: { harvester: 2, hauler: 2, upgrader: 1, builder: 1 }
	        };
	    }

	    static getAllLimits(rcl, roomState, roomName) {
	        const limits = Object.assign({}, this.CENSUS_BY_RCL[rcl] || this.CENSUS_BY_RCL[4]);

	        if (roomState) {
	            let looseEnergy = 0;
	            if (roomState.droppedEnergy) {
	                for (let i = 0; i < roomState.droppedEnergyCount; i++) {
	                    try { looseEnergy += roomState.droppedEnergy[i].amount; } catch (e) { /* ignore */ }
	                }
	            }
	            if (roomState.sourceContainers) {
	                for (let i = 0; i < roomState.sourceContainerCount; i++) {
	                    try { looseEnergy += roomState.sourceContainers[i].store.getUsedCapacity(RESOURCE_ENERGY); } catch (e) { /* ignore */ }
	                }
	            }

	            if (looseEnergy > 1500) {
	                const extraHaulers = Math.min(4, Math.floor(looseEnergy / 1500));
	                limits.hauler += extraHaulers;
	            }

	            if (roomState.storage && roomState.storage.my) {
	                limits.filler = 1;
	                limits.repairman = 1;

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
	                limits.miner = 1;
	            }

	            // Emergency Storage Protocol
	            if (rcl >= 4) {
	                if (!roomState.storage || !roomState.storage.my) {
	                    limits.upgrader = 1;
	                    limits.builder = 4;
	                }
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
	                limits.remotehauler = remoteSources * 2;
	            }
	        }

	        let needsScout = false;
	        if (rcl >= 3 && roomName) {
	            const queue = [{name: roomName, depth: 0}];
	            const visited = new Set([roomName]);
	            const threshold = 10000;

	            while (queue.length > 0) {
	                const current = queue.shift();

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
	                            // Skip SK rooms and Sector Centers
	                            const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(adjRoom);
	                            if (parsed) {
	                                const x = parseInt(parsed[1]) % 10;
	                                const y = parseInt(parsed[2]) % 10;
	                                if ((x >= 4 && x <= 6) && (y >= 4 && y <= 6)) continue;
	                            }

	                            if (!visited.has(adjRoom)) {
	                                visited.add(adjRoom);
	                                queue.push({name: adjRoom, depth: current.depth + 1});
	                            }
	                        }
	                    }
	                }
	            }
	        }
	        limits.scout = needsScout ? 1 : 0;

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
	    static run(spawn) {
	        if (spawn.spawning) return;

	        // Throttle declarative census diffing to save CPU
	        if (Game.time % 10 !== 0) return;

	        if (!spawn.room.controller || !spawn.room.controller.my) return;

	        const roomName = spawn.room.name;
	        const energyCapacity = spawn.room.energyCapacityAvailable;
	        const rcl = spawn.room.controller ? spawn.room.controller.level : 1;
	        const roomState = commonjsGlobal.State?.rooms?.get(roomName);

	        const targetCensus = CensusCalculator.getAllLimits(rcl, roomState, roomName);

	        const currentCensus = {};
	        let rawBootstrapperCount = 0;
	        for (const name in Game.creeps) {
	            const c = Game.creeps[name];
	            if (c.memory.colony === roomName || c.memory.room === roomName) {
	                const role = c.memory.role;

	                // Pre-emptive spawning logic based on TTL
	                if (!c.spawning && c.ticksToLive !== undefined && c.ticksToLive < 50) {
	                    continue;
	                }

	                currentCensus[role] = (currentCensus[role] || 0) + 1;
	                if (role === 'bootstrapper') rawBootstrapperCount++;
	            }
	        }

	        const getCount = (role) => currentCensus[role] || 0;

	        const harvesterCount = getCount('harvester');
	        const haulerCount = getCount('hauler');
	        const bootstrapperCount = getCount('bootstrapper');

	        // Emergency Protocol
	        if (harvesterCount === 0 && haulerCount === 0 && bootstrapperCount === 0 && rawBootstrapperCount === 0) {
	            this.executeSpawn(spawn, 'bootstrapper', EMERGENCY_BODY);
	            return;
	        }

	        if (harvesterCount === 0 && haulerCount === 0 && (targetCensus['harvester'] || 0) > 0) {
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

	        const spawnPriority = [
	            'defender', 'filler', 'scout', 'harvester', 'hauler', 'upgrader', 'builder',
	            'repairman', 'remoteharvester', 'remotehauler',
	            'meleeCreep', 'rangerCreep', 'medicCreep'
	        ];

	        for (let i = 0; i < spawnPriority.length; i++) {
	            const role = spawnPriority[i];
	            const limit = targetCensus[role] || 0;
	            const current = getCount(role);

	            if (current < limit) {
	                const bodyParts = CreepBodyBuilder.getBody(role, energyCapacity);
	                if (!bodyParts || bodyParts.length === 0) continue;

	                const cost = bodyParts.reduce((total, part) => total + BODYPART_COST[part], 0);

	                if (spawn.room.energyAvailable >= cost) {
	                    this.executeSpawn(spawn, role, bodyParts);
	                }
	                return; // Stop processing further limits until this high-priority creep is spawned
	            }
	        }
	    }

	    static executeSpawn(spawn, role, bodyParts) {
	        const name = role + '_' + Game.time + '_' + Math.floor(Math.random() * 1000);
	        spawn.spawnCreep(bodyParts, name, { memory: { role: role, colony: spawn.room.name } });
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

var SourceAssignmentModule;
var hasRequiredSourceAssignmentModule;

function requireSourceAssignmentModule () {
	if (hasRequiredSourceAssignmentModule) return SourceAssignmentModule;
	hasRequiredSourceAssignmentModule = 1;
	const ActionConstants = requireActionConstants();

	function assignHarvester(creep, roomState) {
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

	    const source = Game.getObjectById(creep.memory.targetId);
	    if (!source) return;

	    if (roomState.sourceContainers) {
	        for (let i = 0; i < roomState.sourceContainers.length; i++) {
	            const c = roomState.sourceContainers[i];
	            if (c.pos.getRangeTo(source) <= 2) {
	                creep.heap.sitTargetId = c.id;
	                break;
	            }
	        }
	    }
	}

	SourceAssignmentModule = { assignHarvester };
	return SourceAssignmentModule;
}

var TransferAssignmentModule;
var hasRequiredTransferAssignmentModule;

function requireTransferAssignmentModule () {
	if (hasRequiredTransferAssignmentModule) return TransferAssignmentModule;
	hasRequiredTransferAssignmentModule = 1;
	const ActionConstants = requireActionConstants();

	function routeToCoreStructures(creep, roomState) {
	    let bestTarget = null;
	    let bestScore = -1;

	    const evaluateTarget = (target) => {
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

	    roomState.spawns?.forEach(evaluateTarget);
	    roomState.extensions?.forEach(evaluateTarget);
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

	    return false;
	}

	TransferAssignmentModule = { routeToCoreStructures };
	return TransferAssignmentModule;
}

var WithdrawAssignmentModule;
var hasRequiredWithdrawAssignmentModule;

function requireWithdrawAssignmentModule () {
	if (hasRequiredWithdrawAssignmentModule) return WithdrawAssignmentModule;
	hasRequiredWithdrawAssignmentModule = 1;
	const ActionConstants = requireActionConstants();

	function findClosestEnergy(creep, roomState) {
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
	    if (roomState.spawns) {
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

	    if (bestTarget) {
	        bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
	        return { id: bestTarget.id, actionIntent: bestIntent };
	    }
	    return null;
	}

	WithdrawAssignmentModule = { findClosestEnergy };
	return WithdrawAssignmentModule;
}

var UpgradeAssignmentModule;
var hasRequiredUpgradeAssignmentModule;

function requireUpgradeAssignmentModule () {
	if (hasRequiredUpgradeAssignmentModule) return UpgradeAssignmentModule;
	hasRequiredUpgradeAssignmentModule = 1;
	const ActionConstants = requireActionConstants();

	function assignUpgrader(creep, roomState) {
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
	    if (creep.pos.getRangeTo(focusPos.x !== undefined ? new RoomPosition(focusPos.x, focusPos.y, focusPos.roomName) : focusPos) > focusRange) {
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
	                if (link.pos.getRangeTo(creep) <= 1 && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
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

	    // Issue upgrade intent — Upgrader.js will handle movement
	    creep.heap.targetId = roomState.controller.id;
	    creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
	}

	UpgradeAssignmentModule = { assignUpgrader };
	return UpgradeAssignmentModule;
}

var RepairAssignmentModule;
var hasRequiredRepairAssignmentModule;

function requireRepairAssignmentModule () {
	if (hasRequiredRepairAssignmentModule) return RepairAssignmentModule;
	hasRequiredRepairAssignmentModule = 1;
	const ActionConstants = requireActionConstants();

	function assignRepairman(creep, homeState) {
	    if (creep.heap.state === 'gather') {
	        // Priority 1: Scavenge dropped energy
	        const drops = homeState.droppedEnergy || [];
	        let bestDrop = null;
	        let bestAmount = 0;
	        for (let i = 0; i < drops.length; i++) {
	            const d = drops[i];
	            const claimed = d.__gatherClaimed || 0;
	            const available = d.amount - claimed;
	            if (available > bestAmount) {
	                bestAmount = available;
	                bestDrop = d;
	            }
	        }
	        if (bestDrop && bestAmount >= 25) {
	            bestDrop.__gatherClaimed = (bestDrop.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
	            creep.heap.targetId = bestDrop.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
	            return;
	        }

	        // Priority 2: Harvest from source
	        const sources = homeState.sources || [];
	        if (sources.length > 0) {
	            creep.heap.targetId = sources[0].id;
	            creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
	            return;
	        }

	        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	    } else {
	        // Work phase: find repair targets in home and outposts
	        let bestTarget = null;
	        let lowestHealthRatio = 1.0;
	        let targetRoom = creep.memory.colony;

	        // Check home room
	        if (homeState.repairTargets) {
	            for (let i = 0; i < homeState.repairTargets.length; i++) {
	                const t = homeState.repairTargets[i];
	                const ratio = t.hits / t.hitsMax;
	                if (ratio < lowestHealthRatio && ratio < 0.8) {
	                    lowestHealthRatio = ratio;
	                    bestTarget = t;
	                    targetRoom = creep.memory.colony;
	                }
	            }
	        }

	        // Check outposts
	        const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	        for (let o = 0; o < outposts.length; o++) {
	            const outpostState = commonjsGlobal.State.rooms.get(outposts[o]);
	            if (outpostState && outpostState.repairTargets) {
	                for (let i = 0; i < outpostState.repairTargets.length; i++) {
	                    const t = outpostState.repairTargets[i];
	                    const ratio = t.hits / t.hitsMax;
	                    if (ratio < lowestHealthRatio && ratio < 0.8) {
	                        lowestHealthRatio = ratio;
	                        bestTarget = t;
	                        targetRoom = outposts[o];
	                    }
	                }
	            }
	        }

	        if (bestTarget) {
	            if (creep.room.name !== targetRoom) {
	                creep.memory.targetRoom = targetRoom;
	                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
	            } else {
	                creep.heap.targetId = bestTarget.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
	            }
	        } else {
	            // No repair targets — park at a safe idle position near spawn
	            if (homeState.spawns && homeState.spawns.length > 0) {
	                const spawn = homeState.spawns[0];
	                creep.heap.waypointPos = { x: spawn.pos.x + 4, y: spawn.pos.y + 2, roomName: creep.memory.colony };
	            }
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }
	    }
	}

	RepairAssignmentModule = { assignRepairman };
	return RepairAssignmentModule;
}

var TaskAssignmentManager_1;
var hasRequiredTaskAssignmentManager;

function requireTaskAssignmentManager () {
	if (hasRequiredTaskAssignmentManager) return TaskAssignmentManager_1;
	hasRequiredTaskAssignmentManager = 1;
	const ActionConstants = requireActionConstants();
	const CacheLib = requireCacheLib();
	const MathLib = requireMathLib();
	const SourceAssignmentModule = requireSourceAssignmentModule();
	const TransferAssignmentModule = requireTransferAssignmentModule();
	const WithdrawAssignmentModule = requireWithdrawAssignmentModule();
	const UpgradeAssignmentModule = requireUpgradeAssignmentModule();
	const RepairAssignmentModule = requireRepairAssignmentModule();



	/**
	 * Top-Down, Heap-Driven Task Assignment Manager
	 * Optimized for strict Drop-Mining, Stationary Upgrading, and Distance-Weighted Hauling.
	 */
	class TaskAssignmentManager {
	    static run() {
	        if (!commonjsGlobal.creepHeap) commonjsGlobal.creepHeap = new Map();

	        for (const creepName in Game.creeps) {
	            const creep = Game.creeps[creepName];
	            if (creep.spawning) continue;

	            const roomName = creep.memory.room || creep.memory.colony || creep.room.name;
	            const roomState = commonjsGlobal.State?.rooms?.get(roomName);
	            if (!roomState) continue;

	            let heap = commonjsGlobal.creepHeap.get(creep.name);
	            if (!heap) {
	                heap = CacheLib.getDefaultHeap();
	                commonjsGlobal.creepHeap.set(creep.name, heap);
	            }
	            creep.heap = heap;

	            if (Game.time < creep.heap.sleepUntil) continue;

	            if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE && creep.heap.actionIntent !== null) {
	                TaskAssignmentManager.validateCurrentTask(creep);

	                if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE) {
	                    TaskAssignmentManager.reregisterClaim(creep);
	                    continue;
	                }
	            }

	            TaskAssignmentManager.updateCreepState(creep);
	            TaskAssignmentManager.assignTask(creep, roomState);
	        }
	    }

	    static reregisterClaim(creep) {
	        if (!creep.heap.targetId) return;
	        const target = CacheLib.getById(creep.heap.targetId);
	        if (!target) return;

	        if (creep.heap.state === 'gather') {
	            target.__gatherClaimed = (target.__gatherClaimed || 0) + creep.store.getFreeCapacity();
	        } else if (creep.heap.state === 'work' && (creep.heap.actionIntent === ActionConstants.ACTION_TRANSFER || creep.heap.actionIntent === ActionConstants.ACTION_BUILD)) {
	            target.__deliveryClaimed = (target.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
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
	            if (totalUsed > 0 && (role === 'hauler' || role === 'filler' || role === 'remotehauler' || role === 'builder' || role === 'repairman' || role === 'bootstrapper')) {
	                creep.heap.state = 'work';
	            } else {
	                creep.heap.state = 'gather';
	            }
	        }

	        if (creep.heap.state === 'gather' && free === 0) {
	            creep.heap.state = 'work';
	            creep.heap.targetId = null;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        } else if (creep.heap.state === 'work' && totalUsed === 0) {
	            creep.heap.state = 'gather';
	            creep.heap.targetId = null;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
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

	    static assignTask(creep, roomState) {
	        const role = (creep.memory.role || '').toLowerCase();
	        // Military creeps are managed exclusively by MilitaryManager — skip to prevent heap overwrite
	        if (role === 'meleecreep' || role === 'rangercreep' || role === 'mediccreep') return;
	        if (role === 'harvester') SourceAssignmentModule.assignHarvester(creep, roomState);
	        else if (role === 'hauler') TaskAssignmentManager.assignHauler(creep, roomState);
	        else if (role === 'builder') TaskAssignmentManager.assignBuilder(creep, roomState);
	        else if (role === 'bootstrapper') TaskAssignmentManager.assignBootstrapper(creep, roomState);
	        else if (role === 'upgrader') UpgradeAssignmentModule.assignUpgrader(creep, roomState);
	        else if (role === 'filler') TaskAssignmentManager.assignFiller(creep, roomState);
	        else if (role === 'remoteharvester') TaskAssignmentManager.assignRemoteHarvester(creep, roomState);
	        else if (role === 'remotehauler') TaskAssignmentManager.assignRemoteHauler(creep, roomState);
	        else if (role === 'repairman') RepairAssignmentModule.assignRepairman(creep, roomState);
	        else if (role === 'defender') TaskAssignmentManager.assignDefender(creep, roomState);
	        else if (role === 'hubcreep') TaskAssignmentManager.assignHubCreep(creep, roomState);
	        else if (role === 'miner') TaskAssignmentManager.assignMiner(creep, roomState);
	    }

	    static assignMiner(creep, roomState) {
	        if (!roomState.mineral || roomState.mineral.mineralAmount === 0) {
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

	    static assignHubCreep(creep, roomState) {
	        // Find the Hub Link (close to storage)
	        let hubLink = null;
	        if (roomState.links && roomState.storage) {
	            for (let i = 0; i < roomState.links.length; i++) {
	                if (roomState.links[i].pos.inRangeTo(roomState.storage, 2)) {
	                    hubLink = roomState.links[i];
	                    break;
	                }
	            }
	        }

	        const terminal = roomState.terminal;
	        const storage = roomState.storage;

	        if (!storage) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        if (creep.heap.state === 'gather') {
	            // Priority 1: Empty Hub Link
	            if (hubLink && hubLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.targetId = hubLink.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            // Priority 2: Terminal overflow -> Storage
	            if (terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 100000) {
	                creep.heap.targetId = terminal.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            // Priority 3: Storage -> Terminal if storage is overflowing (> 500k)
	            if (terminal && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000 && terminal.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        } else {
	            // Work phase (we are holding energy)

	            // Priority 1: Fill Terminal if we withdrew from Storage due to overflow
	            if (terminal && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000 && terminal.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = terminal.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return;
	            }

	            // Priority 2: Dump everything else into Storage
	            if (storage.store.getFreeCapacity() > 0) {
	                creep.heap.targetId = storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	                return;
	            }

	            // Fallback
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

	    static assignRemoteHarvester(creep, _homeState) {
	        if (!creep.memory.targetRoom) {
	            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	            if (outposts.length > 0) {
	                const counts = new Map();
	                for (const name in Game.creeps) {
	                    const c = Game.creeps[name];
	                    if (c.memory.role === 'remoteHarvester' && c.memory.colony === creep.memory.colony && c.memory.targetRoom) {
	                        counts.set(c.memory.targetRoom, (counts.get(c.memory.targetRoom) || 0) + 1);
	                    }
	                }

	                let bestRoom = outposts[0];
	                let minCount = Infinity;
	                for (let i = 0; i < outposts.length; i++) {
	                    const count = counts.get(outposts[i]) || 0;
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

	        SourceAssignmentModule.assignHarvester(creep, roomState);
	    }

	    static assignRemoteHauler(creep, homeState) {
	        if (creep.heap.state === 'gather') {
	            if (!creep.memory.targetRoom) {
	                const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
	                if (outposts.length > 0) {
	                    const counts = new Map();
	                    for (const name in Game.creeps) {
	                        const c = Game.creeps[name];
	                        if (c.memory.role === 'remoteHauler' && c.memory.colony === creep.memory.colony && c.memory.targetRoom) {
	                            counts.set(c.memory.targetRoom, (counts.get(c.memory.targetRoom) || 0) + 1);
	                        }
	                    }

	                    let bestRoom = outposts[0];
	                    let minCount = Infinity;
	                    for (let i = 0; i < outposts.length; i++) {
	                        const count = counts.get(outposts[i]) || 0;
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

	            let bestTarget = null;
	            let bestAmount = 0;
	            const drops = roomState.droppedEnergy || [];
	            for (let i = 0; i < drops.length; i++) {
	                const d = drops[i];
	                const claimed = d.__gatherClaimed || 0;
	                const available = d.amount - claimed;
	                if (available > bestAmount) {
	                    bestAmount = available;
	                    bestTarget = d;
	                }
	            }

	            if (bestTarget && bestAmount >= 25) {
	                bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
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
	            if (TransferAssignmentModule.routeToCoreStructures(creep, roomState)) return;
	            // No core structures need energy? Idle.
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        }
	    }

	    static assignHauler(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            // Priority 1: Scavenge from Ruins and Tombstones
	            const scavengeTargets = [];
	            if (roomState.ruins) {
	                for (let i = 0; i < roomState.ruins.length; i++) {
	                    if (roomState.ruins[i] && roomState.ruins[i].store && roomState.ruins[i].store.getUsedCapacity() > 0) scavengeTargets.push(roomState.ruins[i]);
	                }
	            }
	            if (roomState.tombstones) {
	                for (let i = 0; i < roomState.tombstones.length; i++) {
	                    if (roomState.tombstones[i] && roomState.tombstones[i].store && roomState.tombstones[i].store.getUsedCapacity() > 0) scavengeTargets.push(roomState.tombstones[i]);
	                }
	            }
	            let bestScavenge = null;
	            let bestScavengeScore = -1;

	            for (let i = 0; i < scavengeTargets.length; i++) {
	                const target = scavengeTargets[i];
	                const amount = target.store.getUsedCapacity();
	                const claimed = target.__gatherClaimed || 0;
	                const remaining = amount - claimed;

	                if (remaining >= Math.min(25, creep.store.getFreeCapacity())) {
	                    const dist = Math.max(Math.abs(creep.pos.x - target.pos.x), Math.abs(creep.pos.y - target.pos.y)) || 1;
	                    const score = remaining / dist;
	                    if (score > bestScavengeScore) {
	                        bestScavengeScore = score;
	                        bestScavenge = target;
	                    }
	                }
	            }

	            if (bestScavenge) {
	                bestScavenge.__gatherClaimed = (bestScavenge.__gatherClaimed || 0) + creep.store.getFreeCapacity();
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
	                    if (roomState.controller && c.pos.getRangeTo(roomState.controller) <= 3) continue;

	                    const amount = c.store.getUsedCapacity();
	                    const claimed = c.__gatherClaimed || 0;
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
	                    bestContainer.__gatherClaimed = (bestContainer.__gatherClaimed || 0) + creep.store.getFreeCapacity();
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
	                    if (roomState.controller && d.pos.getRangeTo(roomState.controller) <= 3) continue;

	                    if (Math.max(Math.abs(d.pos.x - targetHarvester.pos.x), Math.abs(d.pos.y - targetHarvester.pos.y)) <= 2) {
	                        const claimed = d.__gatherClaimed || 0;
	                        const available = d.amount - claimed;
	                        if (available > bestAmount) {
	                            bestAmount = available;
	                            bestTarget = d;
	                            intent = ActionConstants.ACTION_PICKUP;
	                        }
	                    }
	                }

	                if (bestTarget && bestAmount >= 25) {
	                    bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity();
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
	        const hasFiller = roomState.creepCounts && roomState.creepCounts['filler'] > 0;
	        if (roomState.storage && !hasFiller) {
	            if (TransferAssignmentModule.routeToCoreStructures(creep, roomState)) return;
	        }

	        // Priority 1: Dump in Storage if it exists
	        if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) {
	            creep.heap.targetId = roomState.storage.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	            return;
	        }

	        // Priority 2: Fill spawn/extensions (Pre-Storage behavior)
	        if (TransferAssignmentModule.routeToCoreStructures(creep, roomState)) return;

	        // Priority 2: Drop/Transfer at controller
	        if (roomState.controller) {
	            // Check if controller has a container
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
	                creep.heap.targetId = controllerContainer.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	            } else {
	                // Find planned container
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
	                    if (distToTile > 1) { // Walk to adjacent at least!
	                        creep.heap.destination = { x: plannedContainerTile.x, y: plannedContainerTile.y, roomName: creep.room.name, range: 1 };
	                        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                        return;
	                    } else {
	                        // We are within range 1 of the exact tile! Drop it!
	                        creep.heap.targetId = roomState.controller.id; // Fallback target ID for execution validator
	                        creep.heap.actionIntent = ActionConstants.ACTION_DROP;
	                        return;
	                    }
	                } else {
	                    // Absolute fallback if blueprint is completely broken
	                    if (creep.pos.getRangeTo(roomState.controller) > 3) {
	                        creep.heap.destination = { x: roomState.controller.pos.x, y: roomState.controller.pos.y, roomName: creep.room.name, range: 3 };
	                        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                    } else {
	                        creep.heap.targetId = roomState.controller.id;
	                        creep.heap.actionIntent = ActionConstants.ACTION_DROP;
	                    }
	                }
	            }
	        }
	    }

	    static assignBuilder(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            // Distance-aware energy source selection
	            const bestSource = WithdrawAssignmentModule.findClosestEnergy(creep, roomState);
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
	        // Priority 0: Emergency Repair (< 10,000 HP Ramparts/Walls)
	        if (roomState.repairTargets?.length > 0) {
	            let emergencyTarget = null;
	            let emergencyDist = Infinity;
	            for (let i = 0; i < roomState.repairTargets.length; i++) {
	                const t = roomState.repairTargets[i];
	                if ((t.structureType === STRUCTURE_RAMPART || t.structureType === STRUCTURE_WALL) && t.hits < 10000) {
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
	        const siteIds = Object.keys(roomState.constructionSites || {});
	        if (siteIds && siteIds.length > 0) {
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

	        // Priority 2: Repair critically damaged structures (< 50% health only)
	        if (roomState.repairTargets?.length > 0) {
	            let bestTarget = null;
	            let bestDist = Infinity;
	            for (let i = 0; i < roomState.repairTargets.length; i++) {
	                const t = roomState.repairTargets[i];
	                // Only repair critically damaged structures
	                if (t.hits >= t.hitsMax * 0.5) continue;
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
	     */
	    static assignBootstrapper(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            // Priority 1: Pull from Storage if available
	            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.targetId = roomState.storage.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                return;
	            }

	            // First try to scavenge dropped energy like a builder
	            const bestSource = WithdrawAssignmentModule.findClosestEnergy(creep, roomState);
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
	            // Work phase: Fill Spawns/Extensions first to get real creeps spawning
	            if (TransferAssignmentModule.routeToCoreStructures(creep, roomState)) return;

	            // Priority 2: Build critical structures (like containers)
	            const siteIds = Object.keys(roomState.constructionSites || {});
	            if (siteIds && siteIds.length > 0) {
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
	                ActionExecutor.executeCrossRoomTask(creep);
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

	    static executeCrossRoomTask(creep) {
	        const targetRoom = creep.memory.targetRoom;
	        if (!targetRoom) {
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        if (creep.room.name !== targetRoom) {
	            creep.heap.destination = { x: 25, y: 25, roomName: targetRoom, range: 20 };
	        } else {
	            if (creep.pos.x <= 0 || creep.pos.x >= 49 || creep.pos.y <= 0 || creep.pos.y >= 49) {
	                creep.heap.destination = { x: 25, y: 25, roomName: creep.room.name, range: 20 };
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
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
	        // Run every 10 ticks to save CPU
	        if (Game.time % 10 !== 0) return;

	        for (const name in Memory.creeps) {
	            if (!Game.creeps[name]) {
	                delete Memory.creeps[name];
	            }
	        }

	        // Clean stale heap entries for dead creeps
	        if (commonjsGlobal.creepHeap && commonjsGlobal.creepHeap instanceof Map) {
	            for (const name of commonjsGlobal.creepHeap.keys()) {
	                if (!Game.creeps[name]) {
	                    commonjsGlobal.creepHeap.delete(name);
	                }
	            }
	        }
	    }
	}

	MemoryCleanupManager_1 = MemoryCleanupManager;
	return MemoryCleanupManager_1;
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
	const createRoomMemoryTemplate = () => ({
	    scoutedAt: 0,
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

var TrafficManager_1;
var hasRequiredTrafficManager;

function requireTrafficManager () {
	if (hasRequiredTrafficManager) return TrafficManager_1;
	hasRequiredTrafficManager = 1;
	const ROLE_PRIORITY = {
	    'meleecreep': 10,
	    'rangercreep': 10,
	    'mediccreep': 10,
	    'defender': 10,
	    'harvester': 8,
	    'upgrader': 8,
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

	    static run() {
	        if (!commonjsGlobal.creepHeap) return;

	        const creepsByRoom = new Map();

	        // Pass 1: Global Path Generation & Collection
	        for (const creepName in Game.creeps) {
	            const creep = Game.creeps[creepName];
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
	            if (heap.lastPos && heap.lastPos.x === creep.pos.x && heap.lastPos.y === creep.pos.y && heap.lastPos.roomName === creep.room.name) {
	                heap.stallCount = (heap.stallCount || 0) + 1;
	            } else {
	                heap.stallCount = 0;
	                heap.lastPos = { x: creep.pos.x, y: creep.pos.y, roomName: creep.room.name };
	            }

	            // Advance path if creep successfully moved to the first step
	            if (heap.path) {
	                while (heap.path.length > 0 && heap.path[0].x === creep.pos.x && heap.path[0].y === creep.pos.y && heap.path[0].roomName === creep.room.name) {
	                    heap.path.shift();
	                }
	            }

	            // Path caching and invalidation
	            let needsPath = false;
	            if (!heap.path || heap.path.length === 0) needsPath = true;
	            if (dest && heap.pathDest && (heap.pathDest.x !== dest.x || heap.pathDest.y !== dest.y || heap.pathDest.roomName !== dest.roomName)) needsPath = true;
	            if (heap.fleeGoals && heap.pathDest) needsPath = true; // Invalidate if transitioning to flee logic
	            if (heap.stallCount > 2) {
	                needsPath = true;
	                heap.stallCount = 0; // Reset after forcing recalculation
	            }

	            if (!needsPath && heap.stallCount > 0 && heap.path && heap.path.length > 0) {
	                const nextStep = heap.path[0];
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
	                    pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: destRange }, {
	                        plainCost: 2,
	                        swampCost: 10,
	                        roomCallback: TrafficManager.getCostMatrix
	                    });
	                    heap.pathDest = { x: dest.x, y: dest.y, roomName: dest.roomName };
	                }

	                if (pathResult.incomplete && pathResult.path.length === 0) {
	                    heap.unreachableTargetId = heap.targetId;
	                    heap.destination = null;
	                    heap.path = null;
	                    if (heap.fleeGoals) heap.fleeGoals = null;
	                    TrafficManager.addCreepToRoom(creepsByRoom, creep);
	                    continue;
	                }

	                heap.path = pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
	            }

	            TrafficManager.addCreepToRoom(creepsByRoom, creep);
	        }

	        // Pass 2: Per-Room DFS Traffic Resolution
	        for (const [roomName, roomCreeps] of creepsByRoom) {
	            TrafficManager.resolveRoomTraffic(roomName, roomCreeps);
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
	        // Optimizes V8 heap usage by eliminating per-room TypedArray instantiations, reducing GC churn.
	        TrafficManager.grid.fill(-1);
	        TrafficManager.nextSteps.fill(-1, 0, creeps.length);
	        TrafficManager.resolvedIntents.fill(-1, 0, creeps.length);
	        TrafficManager.priorityScore.fill(0, 0, creeps.length);

	        for (let i = 0; i < creeps.length; i++) {
	            const creep = creeps[i];
	            TrafficManager.creepList[i] = creep;
	            const packed = (creep.pos.y * 50) + creep.pos.x;
	            TrafficManager.grid[packed] = i;

	            TrafficManager.priorityScore[i] = TrafficManager.getPriority(creep);

	            if (creep.heap && creep.heap.path && creep.heap.path.length > 0 && creep.fatigue === 0) {
	                const step = creep.heap.path[0];
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
	        const sortedIndices = [];
	        for (let i = 0; i < creeps.length; i++) sortedIndices.push(i);
	        sortedIndices.sort((a, b) => TrafficManager.priorityScore[b] - TrafficManager.priorityScore[a]);

	        for (let k = 0; k < sortedIndices.length; k++) {
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
	                        const origPacked = (TrafficManager.creepList[i].pos.y * 50) + TrafficManager.creepList[i].pos.x;
	                        TrafficManager.resolvedIntents[i] = targetPacked;
	                        TrafficManager.resolvedIntents[blockerIdx] = origPacked;
	                        TrafficManager.grid[origPacked] = blockerIdx;
	                        TrafficManager.grid[targetPacked] = i;
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
	                const step = creep.heap.path[0];
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

	        if (terrain.get(tx, ty) === TERRAIN_MASK_WALL || matrix.get(tx, ty) === 255) return false;

	        const blockerIdx = TrafficManager.grid[targetPacked];
	        if (blockerIdx === -1) return true; // Target tile is completely empty

	        if (TrafficManager.visited[blockerIdx]) return false; // Cycle detection
	        TrafficManager.visited[blockerIdx] = 1;

	        const blocker = TrafficManager.creepList[blockerIdx];

	        // Fixes engine-level move rejection by failing DFS against fatigued blockers.
	        if (blocker.fatigue > 0) return false;

	        const blockerScore = TrafficManager.getPriority(blocker);
	        if (minScore < blockerScore) return false; // Prevent low-priority creeps from displacing high-priority

	        // Prevents economic collapse by anchoring stationary creeps against high-priority displacement.
	        const blockerRole = (blocker.memory.role || '').toLowerCase();
	        if (blockerRole === 'harvester' || blockerRole === 'upgrader') {
	            if (blocker.heap && blocker.heap.sitTargetId) {
	                const sitTarget = Game.getObjectById(blocker.heap.sitTargetId);
	                if (sitTarget && blocker.pos.isEqualTo(sitTarget)) return false;
	            }
	            if (blocker.heap && blocker.heap.targetId) {
	                const workTarget = Game.getObjectById(blocker.heap.targetId);
	                if (workTarget && blocker.pos.isNearTo(workTarget)) return false;
	            }
	        }

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

	        const emptyTiles = [];
	        const occupiedTiles = [];

	        // Partition tiles into empty and occupied
	        for (let d = 0; d < 8; d++) {
	            const newPacked = targetPacked + dirs[d];
	            const nx = newPacked % 50;
	            const ny = Math.floor(newPacked / 50);

	            if (Math.abs(nx - bx) > 1 || Math.abs(ny - by) > 1) continue;
	            if (nx <= 0 || nx >= 49 || ny <= 0 || ny >= 49) continue;

	            if (terrain.get(nx, ny) === TERRAIN_MASK_WALL || matrix.get(nx, ny) === 255) continue;

	            if (TrafficManager.grid[newPacked] === -1) {
	                emptyTiles.push(newPacked);
	            } else {
	                occupiedTiles.push(newPacked);
	            }
	        }

	        // Improves CPU performance by prioritizing O(1) empty tile resolution before triggering recursive displacement chains.
	        for (let i = 0; i < emptyTiles.length; i++) {
	            const newPacked = emptyTiles[i];
	            if (TrafficManager.depthFirstSearch(blockerIdx, newPacked, minScore, terrain, matrix, creepCount)) {
	                TrafficManager.resolvedIntents[blockerIdx] = newPacked;
	                TrafficManager.grid[targetPacked] = -1;
	                TrafficManager.grid[newPacked] = blockerIdx;
	                return true;
	            }
	        }

	        for (let i = 0; i < occupiedTiles.length; i++) {
	            const newPacked = occupiedTiles[i];
	            if (TrafficManager.depthFirstSearch(blockerIdx, newPacked, minScore, terrain, matrix, creepCount)) {
	                TrafficManager.resolvedIntents[blockerIdx] = newPacked;
	                TrafficManager.grid[targetPacked] = -1;
	                TrafficManager.grid[newPacked] = blockerIdx;
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
	        const currentStructCount = roomState ? roomState.structureIdCount : 0;

	        const cached = commonjsGlobal.Cache.costMatrices.get(roomName);
	        let baseMatrix;
	        if (cached && cached.structureCount === currentStructCount) {
	            baseMatrix = cached.matrix;
	        } else {
	            baseMatrix = new PathFinder.CostMatrix();
	            if (roomState && roomState.structureIds) {
	                for (let i = 0; i < roomState.structureIdCount; i++) {
	                    const s = Game.getObjectById(roomState.structureIds[i]);
	                    if (s && s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_CONTAINER && s.structureType !== STRUCTURE_RAMPART) {
	                        baseMatrix.set(s.pos.x, s.pos.y, 255);
	                    } else if (s && s.structureType === STRUCTURE_ROAD) {
	                        baseMatrix.set(s.pos.x, s.pos.y, 1);
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
	        const room = Game.rooms[roomName];
	        if (room) {
	            const hostiles = room.find(FIND_HOSTILE_CREEPS);
	            for (let i = 0; i < hostiles.length; i++) {
	                const hostile = hostiles[i];
	                let isMelee = false;
	                let isRanged = false;

	                for (let j = 0; j < hostile.body.length; j++) {
	                    const type = hostile.body[j].type;
	                    if (type === ATTACK) isMelee = true;
	                    if (type === RANGED_ATTACK) isRanged = true;
	                }

	                if (isMelee) {
	                    for (let dx = -1; dx <= 1; dx++) {
	                        for (let dy = -1; dy <= 1; dy++) {
	                            const x = hostile.pos.x + dx;
	                            const y = hostile.pos.y + dy;
	                            if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
	                                tickMatrix.set(x, y, Math.min(255, tickMatrix.get(x, y) + 50));
	                            }
	                        }
	                    }
	                }

	                if (isRanged) {
	                    for (let dx = -3; dx <= 3; dx++) {
	                        for (let dy = -3; dy <= 3; dy++) {
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
	            const creeps = room.find(FIND_MY_CREEPS);
	            for (let i = 0; i < creeps.length; i++) {
	                const c = creeps[i];
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

	        // Step 2: Fast Filler Stamp
	        this.applyFastFillerStamp(blueprint, terrain, anchor, visited);
	        fragmentCenters.push({ x: anchor.x, y: anchor.y });
	        console.log(`[RoomPlanner] Fast Filler packed at anchor: ${anchor.x}, ${anchor.y}`);

	        // Step 3: Core Hub Stamp
	        const coreCenter = this.applyCoreStamp(blueprint, terrain, anchor, visited);
	        if (coreCenter) {
	            fragmentCenters.push(coreCenter);
	            console.log(`[RoomPlanner] Core Hub packed at: ${coreCenter.x}, ${coreCenter.y}`);
	        } else console.log(`[RoomPlanner] WARNING: Failed to find space for Core Hub!`);

	        // Step 4: Tower Stamp
	        const towerCenter = this.applyTowerStamp(blueprint, terrain, anchor, visited);
	        if (towerCenter) {
	            fragmentCenters.push(towerCenter);
	            console.log(`[RoomPlanner] Tower Array packed at: ${towerCenter.x}, ${towerCenter.y}`);
	        } else console.log(`[RoomPlanner] WARNING: Failed to find space for Tower Array!`);

	        // Step 5: Lab cluster
	        const labCenter = this.applyLabStamp(blueprint, terrain, anchor, visited);
	        if (labCenter) {
	            fragmentCenters.push(labCenter);
	            console.log(`[RoomPlanner] Lab Cluster packed at: ${labCenter.x}, ${labCenter.y}`);
	        } else console.log(`[RoomPlanner] WARNING: Failed to find space for Lab Cluster!`);

	        // Step 6: Extension Clusters (Plus-sign grids)
	        const extensionCenters = this.applyExtensionClusters(blueprint, terrain, anchor, visited);
	        for (let i = 0; i < extensionCenters.length; i++) fragmentCenters.push(extensionCenters[i]);
	        console.log(`[RoomPlanner] Packed ${extensionCenters.length} extension clusters.`);

	        // Step 5: Source + controller containers
	        if (state) this.planContainers(blueprint, room, state, terrain);

	        // Step 6: External road routes and fragment connections
	        if (state) this.planRoads(blueprint, room, state, anchor, fragmentCenters);

	        // Step 7: Min-Cut Ramparts
	        blueprint.ramparts = this.computeMinCut(terrain, visited);

	        // Step 8: Road exit airlocks (3-deep)
	        this.addRoadRamparts(blueprint);

	        // Step 9: Outpost ramparts for external resources
	        if (state) this.addOutpostRamparts(blueprint, terrain, state);

	        // Step 10: Rampart roads for defender mobility
	        this.addRampartRoads(blueprint);

	        // Step 11: Extractor
	        if (state && state.mineral) {
	            blueprint[STRUCTURE_EXTRACTOR] = blueprint[STRUCTURE_EXTRACTOR] || [];
	            blueprint[STRUCTURE_EXTRACTOR].push({ x: state.mineral.pos.x, y: state.mineral.pos.y });
	        }

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

	    static applyFastFillerStamp(blueprint, terrain, anchor, visited) {
	        const ax = anchor.x, ay = anchor.y;
	        const stamp = [
	            { type: STRUCTURE_LINK, dx: 0, dy: 0 },
	            { type: STRUCTURE_SPAWN, dx: -1, dy: 0 },
	            { type: STRUCTURE_SPAWN, dx: 1, dy: 0 },
	            { type: STRUCTURE_SPAWN, dx: 0, dy: -2 },
	            { type: 'container', dx: 0, dy: -1 },
	            { type: 'container', dx: 0, dy: 1 },
	            { type: 'road', dx: -1, dy: -1 },
	            { type: 'road', dx: 1, dy: -1 },
	            { type: 'road', dx: -1, dy: 1 },
	            { type: 'road', dx: 1, dy: 1 },
	            { type: 'road', dx: 0, dy: -3 },
	            { type: 'road', dx: -2, dy: 0 },
	            { type: 'road', dx: 2, dy: 0 },
	            { type: 'road', dx: 0, dy: 2 }
	        ];

	        for (let i = 0; i < stamp.length; i++) {
	            const { type, dx, dy } = stamp[i];
	            const x = ax + dx, y = ay + dy;
	            if (x < 2 || x > 47 || y < 2 || y > 47 || terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

	            const key = x * 50 + y;
	            if (visited[key]) continue;
	            visited[key] = 1;

	            if (type === 'road') blueprint.roads.push({ x, y });
	            else if (type === 'container') blueprint.containers.push({ x, y });
	            else blueprint[type].push({ x, y });
	        }
	    }

	    static findCompactPlacement(stampRotations, terrain, anchor, visited) {
	        const variants = Array.isArray(stampRotations[0]) ? stampRotations : [stampRotations];
	        const queue = [{ x: anchor.x, y: anchor.y }];
	        const seen = new Uint8Array(2500);
	        seen[anchor.x * 50 + anchor.y] = 1;
	        let head = 0;

	        while (head < queue.length) {
	            const { x, y } = queue[head++];

	            for (let v = 0; v < variants.length; v++) {
	                const stamp = variants[v];
	                let valid = true;
	                for (let j = 0; j < stamp.length; j++) {
	                    const nx = x + stamp[j].dx, ny = y + stamp[j].dy;
	                    if (nx < 2 || nx > 47 || ny < 2 || ny > 47 || terrain.get(nx, ny) === TERRAIN_MASK_WALL || visited[nx * 50 + ny]) {
	                        valid = false; break;
	                    }
	                }
	                if (valid) return { cx: x, cy: y, stamp };
	            }

	            const dirs = [{dx:0,dy:-1}, {dx:0,dy:1}, {dx:-1,dy:0}, {dx:1,dy:0}];
	            for (let d = 0; d < dirs.length; d++) {
	                const nx = x + dirs[d].dx, ny = y + dirs[d].dy;
	                if (nx >= 2 && nx <= 47 && ny >= 2 && ny <= 47) {
	                    const key = nx * 50 + ny;
	                    if (!seen[key]) {
	                        seen[key] = 1;
	                        queue.push({ x: nx, y: ny });
	                    }
	                }
	            }
	        }
	        return null;
	    }

	    static applyCoreStamp(blueprint, terrain, anchor, visited) {
	        const stamp = [
	            { type: 'road', dx: 0, dy: 0 },
	            { type: STRUCTURE_STORAGE, dx: -1, dy: 0 },
	            { type: STRUCTURE_TERMINAL, dx: 1, dy: 0 },
	            { type: STRUCTURE_FACTORY, dx: 0, dy: -1 },
	            { type: STRUCTURE_LINK, dx: 0, dy: 1 },
	            { type: STRUCTURE_NUKER, dx: -1, dy: -1 },
	            { type: STRUCTURE_POWER_SPAWN, dx: 1, dy: -1 },
	            { type: STRUCTURE_OBSERVER, dx: 1, dy: 1 },
	            { type: 'road', dx: -2, dy: 0 }, { type: 'road', dx: 2, dy: 0 },
	            { type: 'road', dx: 0, dy: -2 }, { type: 'road', dx: 0, dy: 2 },
	            { type: 'road', dx: -1, dy: 1 }, { type: 'road', dx: -1, dy: -2 }, { type: 'road', dx: 1, dy: -2 }
	        ];

	        const placement = this.findCompactPlacement(stamp, terrain, anchor, visited);
	        if (placement) {
	            const { cx, cy, stamp: chosenStamp } = placement;
	            for (let i = 0; i < chosenStamp.length; i++) {
	                const { type, dx, dy } = chosenStamp[i];
	                const x = cx + dx, y = cy + dy;
	                visited[x * 50 + y] = 1;
	                if (type === 'road') blueprint.roads.push({ x, y });
	                else blueprint[type].push({ x, y });
	            }
	            return { x: cx, y: cy };
	        }
	        return null;
	    }

	    static applyTowerStamp(blueprint, terrain, anchor, visited) {
	        const stamp = [
	            { type: STRUCTURE_TOWER, dx: 0, dy: 0 }, { type: STRUCTURE_TOWER, dx: 1, dy: 0 }, { type: STRUCTURE_TOWER, dx: -1, dy: 0 },
	            { type: STRUCTURE_TOWER, dx: 0, dy: 1 }, { type: STRUCTURE_TOWER, dx: 1, dy: 1 }, { type: STRUCTURE_TOWER, dx: -1, dy: 1 },
	            { type: 'road', dx: 0, dy: -1 }, { type: 'road', dx: 1, dy: -1 }, { type: 'road', dx: -1, dy: -1 },
	            { type: 'road', dx: 0, dy: 2 }, { type: 'road', dx: 1, dy: 2 }, { type: 'road', dx: -1, dy: 2 },
	            { type: 'road', dx: -2, dy: 0 }, { type: 'road', dx: -2, dy: 1 },
	            { type: 'road', dx: 2, dy: 0 }, { type: 'road', dx: 2, dy: 1 }
	        ];

	        const placement = this.findCompactPlacement(stamp, terrain, anchor, visited);
	        if (placement) {
	            const { cx, cy, stamp: chosenStamp } = placement;
	            for (let i = 0; i < chosenStamp.length; i++) {
	                const { type, dx, dy } = chosenStamp[i];
	                const x = cx + dx, y = cy + dy;
	                visited[x * 50 + y] = 1;
	                if (type === 'road') blueprint.roads.push({ x, y });
	                else blueprint[type].push({ x, y });
	            }
	            return { x: cx, y: cy };
	        }
	        return null;
	    }

	    static applyLabStamp(blueprint, terrain, anchor, visited) {
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

	        const placement = this.findCompactPlacement(variants, terrain, anchor, visited);
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

	    static applyExtensionClusters(blueprint, terrain, anchor, visited) {
	        const queue = [{ x: anchor.x, y: anchor.y }];
	        const seen = new Uint8Array(2500);
	        seen[anchor.x * 50 + anchor.y] = 1;

	        let head = 0;
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
	            { dx: 1, dy: 1, type: 'road' }
	        ];

	        while (head < queue.length && extensionsPlaced < 60) {
	            const { x, y } = queue[head++];

	            let validCluster = true;
	            for (let i = 0; i < clusterOffsets.length; i++) {
	                const nx = x + clusterOffsets[i].dx, ny = y + clusterOffsets[i].dy;
	                if (nx < 2 || nx > 47 || ny < 2 || ny > 47 || terrain.get(nx, ny) === TERRAIN_MASK_WALL || visited[nx * 50 + ny]) {
	                    validCluster = false; break;
	                }
	            }

	            if (validCluster) {
	                for (let i = 0; i < clusterOffsets.length; i++) {
	                    const nx = x + clusterOffsets[i].dx, ny = y + clusterOffsets[i].dy;
	                    visited[nx * 50 + ny] = 1;
	                    if (clusterOffsets[i].type === 'road') {
	                        blueprint.roads.push({ x: nx, y: ny });
	                    } else {
	                        blueprint[STRUCTURE_EXTENSION].push({ x: nx, y: ny });
	                    }
	                }
	                extensionsPlaced += 5;
	                centers.push({ x, y });
	            }

	            const dirs = [{ dx: 3, dy: 0 }, { dx: -3, dy: 0 }, { dx: 0, dy: 3 }, { dx: 0, dy: -3 }];
	            for (let d = 0; d < dirs.length; d++) {
	                const nx = x + dirs[d].dx, ny = y + dirs[d].dy;
	                if (nx >= 2 && nx <= 47 && ny >= 2 && ny <= 47) {
	                    const nkey = nx * 50 + ny;
	                    if (!seen[nkey]) {
	                        seen[nkey] = 1;
	                        queue.push({ x: nx, y: ny });
	                    }
	                }
	            }
	        }
	        return centers;
	    }


	    // ─── Step 5: Container Planning ──────────────────────────────────────

	    static planContainers(blueprint, room, state, terrain) {
	        const spawn = state.spawns?.[0];
	        const ref = spawn ? spawn.pos : new RoomPosition(blueprint.anchor.x, blueprint.anchor.y, room.name);
	        const sources = state.sources || [];
	        for (let i = 0; i < sources.length; i++) {
	            const tile = this.findBestAdjacentTile(sources[i].pos, ref, terrain, room.name, 1);
	            if (tile) blueprint.containers.push(tile);
	        }
	        if (state.controller) {
	            const tile = this.findBestAdjacentTile(state.controller.pos, ref, terrain, room.name, 2);
	            if (tile) blueprint.containers.push(tile);
	        }
	        if (state.mineral) {
	            const tile = this.findBestAdjacentTile(state.mineral.pos, ref, terrain, room.name, 1);
	            if (tile) blueprint.containers.push(tile);
	        }
	    }

	    static findBestAdjacentTile(targetPos, referencePos, terrain, roomName, range) {
	        let best = null, bestDist = Infinity;
	        for (let dx = -range; dx <= range; dx++) {
	            for (let dy = -range; dy <= range; dy++) {
	                if (dx === 0 && dy === 0) continue;
	                const x = targetPos.x + dx, y = targetPos.y + dy;
	                if (x < 1 || x > 48 || y < 1 || y > 48) continue;
	                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
	                if (range > 1 && Math.max(Math.abs(dx), Math.abs(dy)) > range) continue;
	                const dist = Math.abs(x - referencePos.x) + Math.abs(y - referencePos.y);
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
	                    blueprint.roads.push({ x: step.x, y: step.y });
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
	    static addRampartRoads(blueprint) {
	        const roadSet = new Uint8Array(2500);
	        for (let i = 0; i < blueprint.roads.length; i++) roadSet[blueprint.roads[i].x * 50 + blueprint.roads[i].y] = 1;

	        const newRoads = [];
	        for (let i = 0; i < blueprint.ramparts.length; i++) {
	            const rp = blueprint.ramparts[i];
	            const rkey = rp.x * 50 + rp.y;
	            if (!roadSet[rkey]) {
	                newRoads.push({ x: rp.x, y: rp.y });
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
	        if (Game.time % 13 !== 0) return;
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
	            if (siteCount >= 3) continue;

	            const blueprint = commonjsGlobal.Cache?.blueprints?.get(roomName);
	            if (!blueprint) continue;

	            ConstructionManager.executeRoomBlueprint(room, blueprint, state, 3 - siteCount);
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

	        const existingPositions = new Set();
	        if (state.structureIds) {
	            for (let i = 0; i < state.structureIds.length; i++) {
	                const s = CacheLib.getById(state.structureIds[i]);
	                if (s) existingPositions.add(`${s.pos.x}_${s.pos.y}_${s.structureType}`);
	            }
	        }
	        if (state.constructionSites) {
	            const sites = Object.values(state.constructionSites);
	            for (let i = 0; i < sites.length; i++) {
	                const s = sites[i];
	                existingPositions.add(`${s.pos.x}_${s.pos.y}_${s.structureType}`);
	            }
	        }

	        let placed = 0;

	        for (let p = 0; p < priorityArray.length && placed < maxToPlace; p++) {
	            const structureType = priorityArray[p];
	            let positions = [];

	            if (structureType === STRUCTURE_CONTAINER) {
	                positions = blueprint.containers || [];
	            } else if (structureType === STRUCTURE_ROAD) {
	                positions = blueprint.roads || [];
	            } else if (structureType === STRUCTURE_RAMPART) {
	                positions = blueprint.ramparts || [];
	            } else {
	                positions = blueprint[structureType] || [];
	            }

	            if (!positions || positions.length === 0) continue;

	            const maxAllowed = CONTROLLER_STRUCTURES[structureType] ? CONTROLLER_STRUCTURES[structureType][rcl] : 0;
	            if (maxAllowed === 0) continue;

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
	                const key = `${pos.x}_${pos.y}_${structureType}`;
	                if (existingPositions.has(key)) continue;

	                if (room.createConstructionSite(pos.x, pos.y, structureType) === OK) {
	                    placed++;
	                    count++;
	                    existingPositions.add(key);
	                }
	            }
	        }
	    }
	}

	ConstructionManager_1 = ConstructionManager;
	return ConstructionManager_1;
}

var ScoutingManager_1;
var hasRequiredScoutingManager;

function requireScoutingManager () {
	if (hasRequiredScoutingManager) return ScoutingManager_1;
	hasRequiredScoutingManager = 1;
	const ActionConstants = requireActionConstants();

	class ScoutingManager {
	    static run() {
	        for (const name in Game.creeps) {
	            const creep = Game.creeps[name];
	            if (creep.memory.role !== 'scout' || creep.spawning) continue;

	            if (!creep.heap) creep.heap = {};

	            // 1. Edge avoidance: if on an edge, pull into the room and wait
	            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
	                creep.heap.destination = { x: 25, y: 25, roomName: creep.room.name, range: 20 };
	                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
	                continue;
	            }

	            // 2. Intent Preservation: If it has ANY destination, it hasn't arrived yet. Let TrafficManager finish.
	            // Improves execution stability by preventing the scout from overwriting its own destination at x=1.
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
	}

	ScoutingManager_1 = ScoutingManager;
	return ScoutingManager_1;
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
	            if (!room || !room.controller || !room.controller.my || room.controller.level < 5) continue;

	            if (!Memory.rooms) Memory.rooms = {};
	            if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
	            if (!Memory.rooms[roomName].sources) Memory.rooms[roomName].sources = {};

	            const sources = roomState.sources;
	            if (!sources || sources.length === 0) continue;

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

	                    // Find and destroy any container within range 2
	                    const containers = room.find(FIND_STRUCTURES, {
	                        filter: s => s.structureType === STRUCTURE_CONTAINER && s.pos.inRangeTo(source, 2)
	                    });

	                    for (let c = 0; c < containers.length; c++) {
	                        containers[c].destroy();
	                    }
	                } else {
	                    if (Memory.rooms[roomName].sources[source.id]) {
	                        Memory.rooms[roomName].sources[source.id].isLinked = false;
	                    }
	                }
	            }
	        }
	    }
	}

	InfrastructureManager_1 = InfrastructureManager;
	return InfrastructureManager_1;
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
	    static run() { this.debug(`Tick ${Game.time} executed successfully.`); }
	}

	class ErrorHandlingUtility {
	    static wrap(fn, context) {
	        return function(...args) {
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
	    start: function() { if (this.enabled) this.metrics.clear(); },
	    end: function() { if (this.enabled) { Logger.debug(`Total CPU used this tick: ${Game.cpu.getUsed().toFixed(3)}`); } },
	    setEnabled: function(state) { this.enabled = state; },
	    wrap: function(fn, name) {
	        const profiler = this;
	        return function(...args) {
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
	    report: function() {
	        if (!this.enabled || this.metrics.size === 0) return;
	        Logger.info('--- Profiler Report ---');
	        for (const [name, data] of this.metrics.entries()) {
	            Logger.info(`${name}: ${data.calls} calls, ${data.totalCpu.toFixed(3)} CPU total, ${(data.totalCpu/data.calls).toFixed(3)} CPU avg`);
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
	                    pos: { x: spawn.pos.x + 3 + i, y: spawn.pos.y + 3 + i, roomName: mainRoom, getRangeTo: function(pos) { return Math.max(Math.abs(this.x - pos.x), Math.abs(this.y - pos.y)); } },
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

	SystemLib = {
	    Logger,
	    ErrorHandlingUtility,
	    ProfilerUtility,
	    StressTestUtility
	};
	return SystemLib;
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
	const TrafficManager = requireTrafficManager();
	const RoomPlanner = requireRoomPlanner();
	const ConstructionManager = requireConstructionManager();
	const ScoutingManager = requireScoutingManager();
	const LinkManager = requireLinkManager();
	const InfrastructureManager = requireInfrastructureManager();

	const { ProfilerUtility, Logger, ErrorHandlingUtility, StressTestUtility } = requireSystemLib();

	main$1.loop = function () {
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

	    // 3.5 Stress Test Injection
	    ErrorHandlingUtility.wrap(() => StressTestUtility.run(), 'StressTestUtility')();

	    // 3.8 Planning & Scouting
	    ErrorHandlingUtility.wrap(() => {
	        for (const roomName in Game.rooms) {
	            const room = Game.rooms[roomName];
	            if (room.controller && room.controller.my) {
	                RoomPlanner.manageRoom(room);
	            }
	        }
	        RoomPlanner.visualize();
	    }, 'RoomPlanner')();
	    ErrorHandlingUtility.wrap(() => ConstructionManager.run(), 'ConstructionManager')();
	    ErrorHandlingUtility.wrap(() => ScoutingManager.run(), 'ScoutingManager')();

	    // 4. Task Assignment
	    ErrorHandlingUtility.wrap(() => TaskAssignmentManager.run(), 'TaskAssignmentManager')();

	    // 4.5 Link Management
	    ErrorHandlingUtility.wrap(() => LinkManager.run(), 'LinkManager')();

	    // 4.8 Infrastructure Transition
	    ErrorHandlingUtility.wrap(() => InfrastructureManager.run(), 'InfrastructureManager')();

	    // 5. Spawning
	    ErrorHandlingUtility.wrap(() => {
	        for (const spawnName in Game.spawns) {
	            SpawnManager.run(Game.spawns[spawnName]);
	        }
	    }, 'SpawnManager')();

	    // 6. Intent Execution
	    ErrorHandlingUtility.wrap(() => ActionExecutor.run(), 'ActionExecutor')();

	    // 7. Traffic Management (resolves collisions and executes bulk move API calls)
	    ErrorHandlingUtility.wrap(() => TrafficManager.run(), 'TrafficManager')();

	    // Profiler Reporting
	    ProfilerUtility.report();

	    // Logger
	    Logger.run();

	    // Profiler End
	    ProfilerUtility.end();
	};
	return main$1;
}

var mainExports = requireMain();
var main = /*@__PURE__*/getDefaultExportFromCjs(mainExports);

module.exports = main;
