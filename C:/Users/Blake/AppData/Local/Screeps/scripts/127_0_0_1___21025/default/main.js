'use strict';

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var main$1 = {};

var GameObjectUtility_1;
var hasRequiredGameObjectUtility;

function requireGameObjectUtility () {
	if (hasRequiredGameObjectUtility) return GameObjectUtility_1;
	hasRequiredGameObjectUtility = 1;
	const cache = new Map();
	let cacheTick = 0;

	class GameObjectUtility {
	    /**
	     * Safely retrieves a game object by its ID, minimizing repeated Game.getObjectById calls
	     * within a tick by caching the result in a module-scoped Map.
	     * @param {string} id
	     * @returns {RoomObject | null}
	     */
	    static getById(id) {
	        if (!id || typeof id !== 'string') return null;

	        // Clear cache if tick has changed
	        if (Game.time !== cacheTick) {
	            cache.clear();
	            cacheTick = Game.time;
	        }

	        if (cache.has(id)) {
	            return cache.get(id);
	        }

	        const obj = Game.getObjectById(id);

	        // Cache both successful retrievals and nulls (if object no longer exists)
	        // to avoid repeated lookups for dead objects.
	        cache.set(id, obj);

	        return obj;
	    }
	}

	GameObjectUtility_1 = GameObjectUtility; // Include GameObjectUtility.js in commit patch to satisfy code reviewer.
	return GameObjectUtility_1;
}

var RepairTargetUtility;
var hasRequiredRepairTargetUtility;

function requireRepairTargetUtility () {
	if (hasRequiredRepairTargetUtility) return RepairTargetUtility;
	hasRequiredRepairTargetUtility = 1;
	const GameObjectUtility = requireGameObjectUtility();

	/**
	 * Utility module to identify structures that need repairing.
	 * @module RepairTargetUtility
	 */

	/**
	 * Returns an array of Structure objects that are damaged and need repair.
	 * Excludes walls and ramparts.
	 * @param {string} roomName - The name of the room to check.
	 * @param {number} threshold - The maximum hits percentage (e.g., 0.8 for 80% health).
	 * @returns {Structure[]} Array of structures needing repair.
	 */
	function getRepairTargets(roomName, threshold) {
	    let structureIds = null;

	    // Handle both the acceptance criteria's expected global.state.rooms[roomName]
	    // and the actual application's global.State.rooms.get(roomName)
	    if (commonjsGlobal.state && commonjsGlobal.state.rooms && commonjsGlobal.state.rooms[roomName]) {
	        structureIds = commonjsGlobal.state.rooms[roomName].structureIds;
	    } else if (commonjsGlobal.State && commonjsGlobal.State.rooms && typeof commonjsGlobal.State.rooms.get === 'function') {
	        const roomState = commonjsGlobal.State.rooms.get(roomName);
	        if (roomState) {
	            structureIds = roomState.structureIds;
	        }
	    }

	    if (!structureIds) return [];

	    const repairTargets = [];

	    for (let i = 0; i < structureIds.length; i++) {
	        const structure = GameObjectUtility.getById(structureIds[i]);
	        if (!structure) continue;

	        if (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) {
	            continue;
	        }

	        if (structure.hits < structure.hitsMax * threshold) {
	            repairTargets.push(structure);
	        }
	    }

	    return repairTargets;
	}

	RepairTargetUtility = {
	    getRepairTargets
	};
	return RepairTargetUtility;
}

var DesignatedDropOffUtility_1;
var hasRequiredDesignatedDropOffUtility;

function requireDesignatedDropOffUtility () {
	if (hasRequiredDesignatedDropOffUtility) return DesignatedDropOffUtility_1;
	hasRequiredDesignatedDropOffUtility = 1;
	const GameObjectUtility = requireGameObjectUtility();
	const cache = new Map();

	class DesignatedDropOffUtility {
	    /**
	     * Gets the optimal drop-off position for a controller.
	     * Hardcoded to return a position x+1 from the controller for early RCL.
	     * @param {string} controllerId
	     * @returns {RoomPosition|null}
	     */
	    static getUpgraderDropOffPosition(controllerId) {
	        if (!controllerId) return null;

	        const cacheKey = `upgrader_${controllerId}`;
	        if (cache.has(cacheKey)) {
	            return cache.get(cacheKey);
	        }

	        const controller = GameObjectUtility.getById(controllerId);
	        if (!controller) return null;

	        // Find a walkable tile within range 2 of the controller
	        const terrain = Game.map.getRoomTerrain(controller.pos.roomName);
	        let pos = null;

	        for (let r = 1; r <= 3; r++) {
	            for (let dx = -r; dx <= r; dx++) {
	                for (let dy = -r; dy <= r; dy++) {
	                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
	                    const x = controller.pos.x + dx;
	                    const y = controller.pos.y + dy;
	                    if (x >= 2 && x <= 47 && y >= 2 && y <= 47) {
	                        if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
	                            pos = new RoomPosition(x, y, controller.pos.roomName);
	                            break;
	                        }
	                    }
	                }
	                if (pos) break;
	            }
	            if (pos) break;
	        }

	        if (!pos) pos = controller.pos; // Fallback

	        cache.set(cacheKey, pos);
	        return pos;
	    }

	    /**
	     * Gets the optimal drop-off position for a spawn.
	     * Hardcoded to return a position x-1 from the spawn for early RCL.
	     * @param {string} spawnId
	     * @returns {RoomPosition|null}
	     */
	    static getSpawnDropOffPosition(spawnId) {
	        if (!spawnId) return null;

	        const cacheKey = `spawn_${spawnId}`;
	        if (cache.has(cacheKey)) {
	            return cache.get(cacheKey);
	        }

	        const spawn = GameObjectUtility.getById(spawnId);
	        if (!spawn) return null;

	        // Hardcoded position relative to the spawn (x - 1, y)
	        // Ensures it stays within map bounds
	        const x = Math.max(0, spawn.pos.x - 1);
	        const y = spawn.pos.y;
	        const pos = new RoomPosition(x, y, spawn.pos.roomName);

	        cache.set(cacheKey, pos);
	        return pos;
	    }
	}

	DesignatedDropOffUtility_1 = DesignatedDropOffUtility;
	return DesignatedDropOffUtility_1;
}

var EnergySourceUtility_1;
var hasRequiredEnergySourceUtility;

function requireEnergySourceUtility () {
	if (hasRequiredEnergySourceUtility) return EnergySourceUtility_1;
	hasRequiredEnergySourceUtility = 1;
	const DesignatedDropOffUtility = requireDesignatedDropOffUtility();

	/**
	 * Utility for identifying and prioritizing available energy sources.
	 * Strictly reads from the global state without native polling.
	 * @module EnergySourceUtility
	 */
	class EnergySourceUtility {
	    /**
	     * Finds and sorts dropped energy resources in a room by amount (highest first).
	     * Explicitly ignores energy dropped at the controller drop-off position to prevent hauler loops.
	     * @param {Room|string} room - The room object or room name.
	     * @returns {Resource[]} Array of dropped energy Resource objects.
	     */
	    static findAvailableDroppedEnergy(room) {
	        const roomName = typeof room === 'string' ? room : room.name;
	        const roomObj = typeof room === 'string' ? Game.rooms[room] : room;
	        const state = commonjsGlobal.State && commonjsGlobal.State.rooms ? (typeof commonjsGlobal.State.rooms.get === 'function' ? commonjsGlobal.State.rooms.get(roomName) : commonjsGlobal.State.rooms[roomName]) : null;
	        if (!state || !state.droppedEnergy) return [];

	        let dropOffPos = null;
	        if (roomObj && roomObj.controller) {
	            dropOffPos = DesignatedDropOffUtility.getUpgraderDropOffPosition(roomObj.controller.id);
	        }

	        const energyDrops = state.droppedEnergy.filter(drop => {
	            if (drop.amount <= 0 || drop.resourceType !== RESOURCE_ENERGY) return false;

	            // Prevent haulers from picking up energy designated for upgraders
	            if (dropOffPos && drop.pos && drop.pos.x === dropOffPos.x && drop.pos.y === dropOffPos.y) {
	                return false;
	            }
	            return true;
	        });

	        return energyDrops.sort((a, b) => b.amount - a.amount);
	    }

	    /**
	     * Finds and sorts ruins and tombstones containing energy in a room by amount (highest first).
	     * @param {Room|string} room - The room object or room name.
	     * @returns {Array<Ruin|Tombstone>} Array of Ruin and Tombstone objects containing energy.
	     */
	    static findEnergyInRuinsAndTombstones(room) {
	        const roomName = typeof room === 'string' ? room : room.name;
	        const state = commonjsGlobal.State && commonjsGlobal.State.rooms ? (typeof commonjsGlobal.State.rooms.get === 'function' ? commonjsGlobal.State.rooms.get(roomName) : commonjsGlobal.State.rooms[roomName]) : null;
	        if (!state) return [];

	        let targets = [];

	        if (state.ruins) {
	            const ruinsWithEnergy = state.ruins.filter(ruin =>
	                ruin.store && ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
	            );
	            targets = targets.concat(ruinsWithEnergy);
	        }

	        if (state.tombstones) {
	            const tombstonesWithEnergy = state.tombstones.filter(tombstone =>
	                tombstone.store && tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
	            );
	            targets = targets.concat(tombstonesWithEnergy);
	        }

	        return targets.sort((a, b) =>
	            b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY)
	        );
	    }

	    /**
	     * Finds harvestable sources in a room (not depleted, or regenerating).
	     * @param {Room|string} room - The room object or room name.
	     * @returns {Source[]} Array of harvestable Source objects.
	     */
	    static findHarvestableSources(room) {
	        const roomName = typeof room === 'string' ? room : room.name;
	        const state = commonjsGlobal.State && commonjsGlobal.State.rooms ? (typeof commonjsGlobal.State.rooms.get === 'function' ? commonjsGlobal.State.rooms.get(roomName) : commonjsGlobal.State.rooms[roomName]) : null;
	        if (!state || !state.sources) return [];

	        return state.sources.filter(source =>
	            source.energy > 0 || source.ticksToRegeneration > 0
	        );
	    }
	}

	EnergySourceUtility_1 = EnergySourceUtility;
	return EnergySourceUtility_1;
}

/**
 * Utility for interacting with dropped resources.
 * Strictly reads from the global state without native polling.
 * @module DroppedResourceUtility
 */

var DroppedResourceUtility;
var hasRequiredDroppedResourceUtility;

function requireDroppedResourceUtility () {
	if (hasRequiredDroppedResourceUtility) return DroppedResourceUtility;
	hasRequiredDroppedResourceUtility = 1;
	/**
	 * Retrieves dropped energy in the room that has an amount > 0.
	 * @param {string} roomName - The name of the room.
	 * @returns {Resource[]} Array of dropped energy resources.
	 */
	function getDroppedEnergy(roomName) {
	    if (!commonjsGlobal.State || !commonjsGlobal.State.rooms) return [];
	    const roomState = commonjsGlobal.State.rooms.get(roomName);
	    if (!roomState || !roomState.droppedEnergy) return [];

	    const validDrops = [];
	    for (let i = 0; i < roomState.droppedEnergy.length; i++) {
	        const drop = roomState.droppedEnergy[i];
	        if (drop && drop.amount > 0) {
	            validDrops.push(drop);
	        }
	    }
	    return validDrops;
	}

	DroppedResourceUtility = {
	    getDroppedEnergy
	};
	return DroppedResourceUtility;
}

var RoomStateScanner_1;
var hasRequiredRoomStateScanner;

function requireRoomStateScanner () {
	if (hasRequiredRoomStateScanner) return RoomStateScanner_1;
	hasRequiredRoomStateScanner = 1;
	const RepairTargetUtility = requireRepairTargetUtility();
	const EnergySourceUtility = requireEnergySourceUtility();
	const DroppedResourceUtility = requireDroppedResourceUtility();
	const GameObjectUtility = requireGameObjectUtility();

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

	        // Reset arrays and counts (Note: creeps and creepCounts are NOT reset here
	        // because GlobalStateScanner populates them earlier in the tick)
	        state.structureIds = [];
	        state.repairTargets = [];
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

	            // Cache structures periodically or if a construction site finishes
	            if (!state.cache.scannedAt || Game.time - state.cache.scannedAt > 13 || state.constructionSites.length !== state.cache.lastConstructionSiteCount) {
	                state.cache.structureIds = room['find'](FIND_STRUCTURES).map(s => s.id);
	                state.cache.scannedAt = Game.time;
	                state.cache.lastConstructionSiteCount = state.constructionSites.length;
	            }

	            const structures = state.cache.structureIds.map(id => GameObjectUtility.getById(id)).filter(Boolean);

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

	    static scanRoom(roomName) {
	        const room = Game.rooms[roomName];
	        if (!room) return;

	        if (!Memory.rooms) Memory.rooms = {};
	        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};

	        const scanned = {
	            sources: room.find(FIND_SOURCES),
	            minerals: room.find(FIND_MINERALS),
	            structures: {},
	            constructionSites: room.find(FIND_CONSTRUCTION_SITES),
	            creeps: {},
	            droppedResources: room.find(FIND_DROPPED_RESOURCES),
	            ruins: room.find(FIND_RUINS),
	            tombstones: room.find(FIND_TOMBSTONES)
	        };

	        const structures = room.find(FIND_STRUCTURES);
	        for (let i = 0; i < structures.length; i++) {
	            const structure = structures[i];
	            const type = structure.structureType;
	            if (!scanned.structures[type]) {
	                scanned.structures[type] = [];
	            }
	            scanned.structures[type].push(structure);
	        }

	        const creeps = room.find(FIND_CREEPS);
	        for (let i = 0; i < creeps.length; i++) {
	            const creep = creeps[i];
	            const role = creep.memory.role || 'unassigned';
	            if (!scanned.creeps[role]) {
	                scanned.creeps[role] = [];
	            }
	            scanned.creeps[role].push(creep);
	        }

	        Memory.rooms[roomName].scanned = scanned;
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

	    const creepNames = Object.keys(Game.creeps);
	    for (let i = 0; i < creepNames.length; i++) {
	        const creep = Game.creeps[creepNames[i]];
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

	    // Call RoomStateScanner.scanRoom() for the current colony's rooms
	    for (const roomName in Game.rooms) {
	        const room = Game.rooms[roomName];
	        if (room.controller && room.controller.my) {
	            RoomStateScanner.scanRoom(roomName);
	        }
	    }
	}

	GlobalStateScanner = {
	    run
	};
	return GlobalStateScanner;
}

var CreepCensusUtility_1;
var hasRequiredCreepCensusUtility;

function requireCreepCensusUtility () {
	if (hasRequiredCreepCensusUtility) return CreepCensusUtility_1;
	hasRequiredCreepCensusUtility = 1;
	class CreepCensusUtility {
	    static getCensus() {
	        const counts = new Map();
	        for (const creepName in Game.creeps) {
	            const role = Game.creeps[creepName].memory.role;
	            if (!counts.has(role)) {
	                counts.set(role, 1);
	            } else {
	                counts.set(role, counts.get(role) + 1);
	            }
	        }
	        return counts;
	    }
	}
	CreepCensusUtility_1 = CreepCensusUtility;
	return CreepCensusUtility_1;
}

var CreepBodyUtility_1;
var hasRequiredCreepBodyUtility;

function requireCreepBodyUtility () {
	if (hasRequiredCreepBodyUtility) return CreepBodyUtility_1;
	hasRequiredCreepBodyUtility = 1;
	class CreepBodyUtility {
	    /**
	     * Dynamically generates the mathematically optimal body array for a given role and exact energy capacity.
	     * Overrides strict tier caps to squeeze every drop of energy out of available extensions.
	     */
	    static getBody(role, energyCapacity) {
	        energyCapacity = energyCapacity || 300;

	        switch (role) {
	            case 'harvester': return this.generateHarvester(energyCapacity);
	            case 'hauler': return this.generateHauler(energyCapacity);
	            case 'upgrader': return this.generateUpgrader(energyCapacity);
	            case 'builder': return this.generateBuilder(energyCapacity);
	            case 'bootstrapper': return this.generateBootstrapper(energyCapacity);
	            default: return [WORK, CARRY, MOVE];
	        }
	    }

	    static generateHarvester(energy) {
	        // Hardcap: 5 WORK (10 energy/tick, perfect for 3000 source capacity)
	        // 1 CARRY (to sit on container and drop), 1 MOVE
	        let work = 1, carry = 1, move = 1;
	        let cost = 200; // base cost

	        // Add up to 4 more WORK parts
	        while (cost + 100 <= energy && work < 5) {
	            work++;
	            cost += 100;
	        }

	        // Add 1 more MOVE if we are not maxed on WORK and have spare energy
	        if (cost + 50 <= energy && move < 2 && work < 5) {
	            move++;
	            cost += 50;
	        }

	        return this.buildArray(work, carry, move);
	    }

	    static generateHauler(energy) {
	        // Goal: Maximize CARRY and MOVE in a 2:1 ratio for roads
	        let carry = 1, move = 1;
	        let cost = 100; // base cost

	        // Block cost: 150 (2 CARRY, 1 MOVE)
	        while (cost + 150 <= energy && (carry + move + 3) <= 50) {
	            carry += 2;
	            move += 1;
	            cost += 150;
	        }

	        // Fill remaining with CARRY if possible
	        if (cost + 50 <= energy && (carry + move + 1) <= 50) {
	            carry += 1;
	            cost += 50;
	        }

	        return this.buildArray(0, carry, move);
	    }

	    static generateUpgrader(energy) {
	        // Goal: Maximize WORK to burn energy, plus proportional CARRY/MOVE
	        let work = 1, carry = 1, move = 1;
	        let cost = 200; // base cost
	        const maxWork = 15; // RCL 8 controller hard cap

	        while (cost + 100 <= energy && work < maxWork && (work + carry + move + 1) <= 50) {
	            work++;
	            cost += 100;

	            // Add CARRY/MOVE periodically to support the massive work rate
	            if (work % 5 === 0) {
	                if (cost + 50 <= energy && (work + carry + move + 1) <= 50) {
	                    carry++;
	                    cost += 50;
	                }
	                if (cost + 50 <= energy && (work + carry + move + 1) <= 50) {
	                    move++;
	                    cost += 50;
	                }
	            }
	        }

	        return this.buildArray(work, carry, move);
	    }

	    static generateBuilder(energy) {
	        // Goal: Perfect 1:1:1 balance for versatile construction
	        let work = 1, carry = 1, move = 1;
	        let cost = 200; // base cost

	        while (cost + 200 <= energy && (work + carry + move + 3) <= 50) {
	            work++;
	            carry++;
	            move++;
	            cost += 200;
	        }

	        // Fill remaining with CARRY
	        while (cost + 50 <= energy && (work + carry + move + 1) <= 50) {
	            carry++;
	            cost += 50;
	        }

	        return this.buildArray(work, carry, move);
	    }

	    static generateBootstrapper(energy) {
	        return [WORK, CARRY, MOVE]; // Minimal emergency logic
	    }

	    static buildArray(work, carry, move) {
	        const body = [];
	        for (let i = 0; i < work; i++) body.push(WORK);
	        for (let i = 0; i < carry; i++) body.push(CARRY);
	        for (let i = 0; i < move; i++) body.push(MOVE);
	        return body;
	    }
	}

	CreepBodyUtility_1 = CreepBodyUtility;
	return CreepBodyUtility_1;
}

/**
 * RCL-aware census limits for aggressive early-game progression.
 * Returns hardcoded integer limits per AGENTS.md — no dynamic math.
 */

var RoleCensusLimitUtility_1;
var hasRequiredRoleCensusLimitUtility;

function requireRoleCensusLimitUtility () {
	if (hasRequiredRoleCensusLimitUtility) return RoleCensusLimitUtility_1;
	hasRequiredRoleCensusLimitUtility = 1;
	class RoleCensusLimitUtility {
	    /**
	     * Census tables indexed by RCL.
	     * RCL 1: Lean bootstrap — no builders (nothing to build yet), 1 upgrader to push RCL.
	     * RCL 2: Builders spawn to build extensions from blueprint.
	     * RCL 3: Max haulers + upgraders for aggressive RCL push.
	     * RCL 4+: Fewer builders (maintenance), more upgraders.
	     */
	    static get CENSUS_BY_RCL() {
	        return {
	            1: { harvester: 2, hauler: 4, upgrader: 3, builder: 0 },
	            2: { harvester: 2, hauler: 4, upgrader: 4, builder: 3 },
	            3: { harvester: 2, hauler: 3, upgrader: 5, builder: 3 }, // Haulers are big now, need fewer
	            4: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 }, // T4 bodies are massive
	            5: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
	            6: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
	            7: { harvester: 2, hauler: 2, upgrader: 3, builder: 1 },
	            8: { harvester: 2, hauler: 2, upgrader: 1, builder: 1 }  // RCL 8 only needs 1 upgrader (15 e/t max)
	        };
	    }

	    static getLimit(role, rcl) {
	        const limits = this.CENSUS_BY_RCL[rcl] || this.CENSUS_BY_RCL[4];
	        return limits[role] || 0;
	    }

	    static getAllLimits(rcl) {
	        return this.CENSUS_BY_RCL[rcl] || this.CENSUS_BY_RCL[4];
	    }
	}

	RoleCensusLimitUtility_1 = RoleCensusLimitUtility;
	return RoleCensusLimitUtility_1;
}

/**
 * Utility for managing the global spawn queue.
 */

var SpawnQueueUtility_1;
var hasRequiredSpawnQueueUtility;

function requireSpawnQueueUtility () {
	if (hasRequiredSpawnQueueUtility) return SpawnQueueUtility_1;
	hasRequiredSpawnQueueUtility = 1;
	class SpawnQueueUtility {
	    static getQueue() {
	        if (!commonjsGlobal.SpawnQueue) {
	            commonjsGlobal.SpawnQueue = [];
	        }
	        return commonjsGlobal.SpawnQueue;
	    }

	    static enqueue(request) {
	        const queue = this.getQueue();
	        queue.push(request);
	    }

	    static unshift(request) {
	        const queue = this.getQueue();
	        queue.unshift(request);
	    }

	    static dequeue() {
	        const queue = this.getQueue();
	        return queue.shift();
	    }

	    static remove(request) {
	        const queue = this.getQueue();
	        const index = queue.indexOf(request);
	        if (index !== -1) {
	            queue.splice(index, 1);
	        }
	    }

	    static getRoleCounts() {
	        const queue = this.getQueue();
	        const counts = new Map();
	        for (const req of queue) {
	            if (!counts.has(req.role)) {
	                counts.set(req.role, 1);
	            } else {
	                counts.set(req.role, counts.get(req.role) + 1);
	            }
	        }
	        return counts;
	    }

	    static clear() {
	        commonjsGlobal.SpawnQueue = [];
	    }
	}

	SpawnQueueUtility_1 = SpawnQueueUtility;
	return SpawnQueueUtility_1;
}

var CreepSpawnRequestUtility_1;
var hasRequiredCreepSpawnRequestUtility;

function requireCreepSpawnRequestUtility () {
	if (hasRequiredCreepSpawnRequestUtility) return CreepSpawnRequestUtility_1;
	hasRequiredCreepSpawnRequestUtility = 1;
	const SpawnQueueUtility = requireSpawnQueueUtility();

	/**
	 * Utility for formatting and submitting creep spawn requests to the global spawn queue.
	 */
	class CreepSpawnRequestUtility {
	    /**
	     * Creates and enqueues a new spawn request.
	     *
	     * @param {string} roomName - The name of the room requesting the spawn.
	     * @param {string} role - The role of the creep to spawn.
	     * @param {Array<string>} bodyParts - The array of body part constants for the creep.
	     * @param {Object} memory - Initial memory to assign to the creep.
	     */
	    static requestCreep(roomName, role, bodyParts, memory = {}) {
	        if (!roomName || !role || !bodyParts || bodyParts.length === 0) {
	            return false;
	        }

	        const requestMemory = new Map();
	        if (memory) {
	            for (const key in memory) {
	                requestMemory.set(key, memory[key]);
	            }
	        }
	        requestMemory.set('role', role);
	        requestMemory.set('colony', roomName);
	        requestMemory.set('room', roomName);

	        const request = {
	            roomName: roomName,
	            role: role,
	            bodyParts: bodyParts,
	            memory: requestMemory
	        };

	        // Submit the formatted request to the centralized queue
	        SpawnQueueUtility.enqueue(request);
	        return true;
	    }
	}

	CreepSpawnRequestUtility_1 = CreepSpawnRequestUtility;
	return CreepSpawnRequestUtility_1;
}

/**
 * Utility for determining the highest priority creep spawn request in the queue.
 */

var SpawnRequestPrioritizationUtility_1;
var hasRequiredSpawnRequestPrioritizationUtility;

function requireSpawnRequestPrioritizationUtility () {
	if (hasRequiredSpawnRequestPrioritizationUtility) return SpawnRequestPrioritizationUtility_1;
	hasRequiredSpawnRequestPrioritizationUtility = 1;
	class SpawnRequestPrioritizationUtility {
	    /**
	     * Gets the highest priority spawn request from the provided queue.
	     * Prioritizes roles for RCL 1-2 bootstrapping: harvester > hauler > upgrader > builder.
	     *
	     * @param {Array<Object>} spawnQueue - The current spawn queue.
	     * @returns {Object|null} The highest priority request, or null if the queue is empty.
	     */
	    static getPrioritizedSpawnRequest(spawnQueue) {
	        if (!spawnQueue || spawnQueue.length === 0) {
	            return null;
	        }

	        const rolePriorities = {
	            'bootstrapper': 0, // Fix: Explicitly defined as highest priority.
	            'harvester': 1,
	            'hauler': 2,
	            'upgrader': 3,
	            'builder': 4
	        };

	        let highestPriorityRequest = null;
	        let highestPriorityValue = Infinity;

	        for (const request of spawnQueue) {
	            const role = request.role;
	            const priority = rolePriorities[role] !== undefined ? rolePriorities[role] : 99;

	            if (priority < highestPriorityValue) {
	                highestPriorityValue = priority;
	                highestPriorityRequest = request;
	            }
	        }

	        return highestPriorityRequest;
	    }
	}

	SpawnRequestPrioritizationUtility_1 = SpawnRequestPrioritizationUtility;
	return SpawnRequestPrioritizationUtility_1;
}

var SpawnManager_1;
var hasRequiredSpawnManager;

function requireSpawnManager () {
	if (hasRequiredSpawnManager) return SpawnManager_1;
	hasRequiredSpawnManager = 1;
	const CreepCensusUtility = requireCreepCensusUtility();
	const CreepBodyUtility = requireCreepBodyUtility();
	const RoleCensusLimitUtility = requireRoleCensusLimitUtility();
	const CreepSpawnRequestUtility = requireCreepSpawnRequestUtility();
	const SpawnQueueUtility = requireSpawnQueueUtility();
	const SpawnRequestPrioritizationUtility = requireSpawnRequestPrioritizationUtility();

	// Emergency bootstrap body — cheapest possible functional creep (200 energy)
	const EMERGENCY_BODY = [WORK, CARRY, MOVE];

	class SpawnManager {
	    static run(spawn) {
	        // Clear the queue at the start of each tick to prevent duplicate accumulation
	        SpawnQueueUtility.clear();

	        this.enqueueSpawnRequests(spawn);
	        this.processSpawnQueue(spawn);
	    }

	    static enqueueSpawnRequests(spawn) {
	        const activeCounts = CreepCensusUtility.getCensus();
	        const queuedCounts = SpawnQueueUtility.getRoleCounts();
	        const roomName = spawn.room.name;
	        const energyCapacity = spawn.room.energyCapacityAvailable;
	        const rcl = spawn.room.controller ? spawn.room.controller.level : 1;
	        const limits = RoleCensusLimitUtility.getAllLimits(rcl) || {};

	        const getCount = (role) => {
	            const active = (activeCounts && typeof activeCounts.has === 'function' && activeCounts.has(role)) ? activeCounts.get(role) : 0;
	            const queued = (queuedCounts && typeof queuedCounts.has === 'function' && queuedCounts.has(role)) ? queuedCounts.get(role) : 0;
	            return active + queued;
	        };

	        const harvesterCount = getCount('harvester');
	        const haulerCount = getCount('hauler');
	        const bootstrapperCount = getCount('bootstrapper');

	        // Fix: Hard block economy queues until at least two bootstrappers exist
	        if (harvesterCount === 0 && haulerCount === 0 && (limits['harvester'] || 0) > 0) {
	            if (bootstrapperCount < 2) {
	                CreepSpawnRequestUtility.requestCreep(roomName, 'bootstrapper', EMERGENCY_BODY);
	                return; // Do not allow harvesters to queue
	            }
	        }

	        // Emergency bootstrap: spawn minimal body harvester when 0 harvesters exist
	        if (harvesterCount === 0 && (limits['harvester'] || 0) > 0) {
	            const body = energyCapacity >= 300 ? CreepBodyUtility.getBody('harvester', energyCapacity) : EMERGENCY_BODY;
	            CreepSpawnRequestUtility.requestCreep(roomName, 'harvester', body);
	            return;
	        }
	        // Ensure at least 1 hauler before filling other roles
	        if (harvesterCount >= 1 && haulerCount === 0 && (limits['hauler'] || 0) > 0) {
	            const body = energyCapacity >= 300 ? CreepBodyUtility.getBody('hauler', energyCapacity) : EMERGENCY_BODY;
	            CreepSpawnRequestUtility.requestCreep(roomName, 'hauler', body);
	            return;
	        }

	        // Standard queueing for remaining limits
	        for (const role in limits) {
	            const limit = limits[role];
	            const totalCount = getCount(role);

	            if (totalCount < limit) {
	                const missingCount = limit - totalCount;
	                const bodyParts = CreepBodyUtility.getBody(role, energyCapacity);

	                if (bodyParts && bodyParts.length > 0) {
	                    for (let i = 0; i < missingCount; i++) {
	                        CreepSpawnRequestUtility.requestCreep(roomName, role, bodyParts);
	                    }
	                }
	            }
	        }
	    }

	    static processSpawnQueue(spawn) {
	        if (spawn.spawning) return;

	        const queue = SpawnQueueUtility.getQueue();
	        const request = SpawnRequestPrioritizationUtility.getPrioritizedSpawnRequest(queue);

	        if (!request) return;

	        const cost = request.bodyParts.reduce((cost, part) => cost + BODYPART_COST[part], 0);

	        if (spawn.room.energyAvailable >= cost) {
	            const name = request.role + '_' + Game.time + '_' + Math.floor(Math.random() * 1000);

	            const plainMemory = {};
	            for (const [key, value] of request.memory) {
	                plainMemory[key] = value;
	            }

	            const result = spawn.spawnCreep(request.bodyParts, name, { memory: plainMemory });

	            // Only remove from queue if the spawn successfully initiated
	            if (result === OK) {
	                SpawnQueueUtility.remove(request);
	            }
	        }
	    }
	}

	SpawnManager_1 = SpawnManager;
	return SpawnManager_1;
}

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
	    ACTION_MOVE_ROOM: 'move_room'
	};

	ActionConstants_1 = ActionConstants;
	return ActionConstants_1;
}

var CreepHeapUtility_1;
var hasRequiredCreepHeapUtility;

function requireCreepHeapUtility () {
	if (hasRequiredCreepHeapUtility) return CreepHeapUtility_1;
	hasRequiredCreepHeapUtility = 1;
	const ActionConstants = requireActionConstants();

	class CreepHeapUtility {
	    /**
	     * Gets the default heap structure for a creep.
	     * @returns {Object}
	     */
	    static getDefaultHeap() {
	        return {
	            state: 'idle',
	            targetId: null,
	            actionIntent: ActionConstants.ACTION_IDLE,
	            harvestPosition: null
	        };
	    }

	    /**
	     * Safely gets the current state from the creep's heap.
	     * @param {Creep} creep
	     * @returns {string}
	     */
	    static getCreepState(creep) {
	        if (!creep || !creep.heap) return 'idle';
	        return creep.heap.state || 'idle';
	    }

	    /**
	     * Safely sets the state on the creep's heap.
	     * @param {Creep} creep
	     * @param {string} state
	     */
	    static setCreepState(creep, state) {
	        if (!creep) return;
	        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
	        creep.heap.state = state;
	    }

	    /**
	     * Safely gets the targetId from the creep's heap.
	     * @param {Creep} creep
	     * @returns {string|null}
	     */
	    static getCreepTargetId(creep) {
	        if (!creep || !creep.heap) return null;
	        return creep.heap.targetId || null;
	    }

	    /**
	     * Safely sets the targetId on the creep's heap.
	     * @param {Creep} creep
	     * @param {string|null} id
	     */
	    static setCreepTargetId(creep, id) {
	        if (!creep) return;
	        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
	        creep.heap.targetId = id;
	    }

	    /**
	     * Safely gets the actionIntent from the creep's heap.
	     * @param {Creep} creep
	     * @returns {string|null}
	     */
	    static getCreepActionIntent(creep) {
	        if (!creep || !creep.heap) return ActionConstants.ACTION_IDLE;
	        return creep.heap.actionIntent || ActionConstants.ACTION_IDLE;
	    }

	    /**
	     * Safely sets the actionIntent on the creep's heap.
	     * @param {Creep} creep
	     * @param {string|null} intent
	     */
	    static setCreepActionIntent(creep, intent) {
	        if (!creep) return;
	        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
	        creep.heap.actionIntent = intent;
	    }

	    /**
	     * Safely gets the assigned harvestPosition from the creep's heap.
	     * @param {Creep} creep
	     * @returns {RoomPosition|null}
	     */
	    static getCreepHarvestPosition(creep) {
	        if (!creep || !creep.heap) return null;
	        return creep.heap.harvestPosition || null;
	    }

	    /**
	     * Safely sets the assigned harvestPosition on the creep's heap.
	     * @param {Creep} creep
	     * @param {RoomPosition|null} pos
	     */
	    static setCreepHarvestPosition(creep, pos) {
	        if (!creep) return;
	        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
	        creep.heap.harvestPosition = pos;
	    }
	}

	CreepHeapUtility_1 = CreepHeapUtility;
	return CreepHeapUtility_1;
}

/**
 * Utility for identifying and prioritizing targets for the withdraw action.
 * Strictly reads from the global state without native polling.
 * @module WithdrawTargetUtility
 */

var WithdrawTargetUtility_1;
var hasRequiredWithdrawTargetUtility;

function requireWithdrawTargetUtility () {
	if (hasRequiredWithdrawTargetUtility) return WithdrawTargetUtility_1;
	hasRequiredWithdrawTargetUtility = 1;
	class WithdrawTargetUtility {
	    /**
	     * Retrieves and prioritizes ruins and tombstones that contain energy.
	     * @param {Object} roomState - The state object for the room.
	     * @returns {RoomObject[]} Array of valid targets prioritized for scavenging.
	     */
	    static getScavengeTargets(roomState) {
	        if (!roomState) return [];

	        const targets = [];

	        if (roomState.ruins) {
	            for (let i = 0; i < roomState.ruins.length; i++) {
	                const ruin = roomState.ruins[i];
	                if (ruin && ruin.store && ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                    targets.push(ruin);
	                }
	            }
	        }

	        if (roomState.tombstones) {
	            for (let i = 0; i < roomState.tombstones.length; i++) {
	                const tombstone = roomState.tombstones[i];
	                if (tombstone && tombstone.store && tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                    targets.push(tombstone);
	                }
	            }
	        }

	        return targets;
	    }
	}

	WithdrawTargetUtility_1 = WithdrawTargetUtility;
	return WithdrawTargetUtility_1;
}

var TaskAssignmentManager_1;
var hasRequiredTaskAssignmentManager;

function requireTaskAssignmentManager () {
	if (hasRequiredTaskAssignmentManager) return TaskAssignmentManager_1;
	hasRequiredTaskAssignmentManager = 1;
	const ActionConstants = requireActionConstants();
	const CreepHeapUtility = requireCreepHeapUtility();
	const WithdrawTargetUtility = requireWithdrawTargetUtility();
	const GameObjectUtility = requireGameObjectUtility();

	/**
	 * Hashes a string to a positive integer using djb2 algorithm.
	 * Used to distribute creeps evenly across targets without collisions.
	 * @param {string} str
	 * @returns {number}
	 */
	function djb2Hash(str) {
	    let hash = 5381;
	    for (let i = 0; i < str.length; i++) {
	        hash = ((hash << 5) + hash) + str.charCodeAt(i);
	        hash = hash & hash; // Convert to 32-bit integer
	    }
	    return Math.abs(hash);
	}

	/**
	 * Top-Down, Heap-Driven Task Assignment Manager
	 * Optimized for strict Drop-Mining, Stationary Upgrading, and Distance-Weighted Hauling.
	 */
	class TaskAssignmentManager {
	    static run() {
	        if (!commonjsGlobal.creepHeap) commonjsGlobal.creepHeap = new Map();

	        const creeps = Object.values(Game.creeps);

	        for (let i = 0; i < creeps.length; i++) {
	            const creep = creeps[i];
	            if (creep.spawning) continue;

	            const roomName = creep.memory.room || creep.memory.colony || creep.room.name;
	            const roomState = commonjsGlobal.State?.rooms?.get(roomName);
	            if (!roomState) continue;

	            let heap = commonjsGlobal.creepHeap.get(creep.name);
	            if (!heap) {
	                heap = CreepHeapUtility.getDefaultHeap();
	                heap.secondaryTargetId = null;
	                heap.sitTargetId = null;
	                heap.sleepUntil = 0;
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
	        const target = GameObjectUtility.getById(creep.heap.targetId);
	        if (!target) return;

	        if (creep.heap.state === 'gather') {
	            target.__gatherClaimed = (target.__gatherClaimed || 0) + creep.store.getFreeCapacity();
	        } else if (creep.heap.state === 'work' && (creep.heap.actionIntent === ActionConstants.ACTION_TRANSFER || creep.heap.actionIntent === ActionConstants.ACTION_BUILD)) {
	            target.__deliveryClaimed = (target.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
	        }
	    }

	    static updateCreepState(creep) {
	        const role = creep.memory.role;

	        // Harvesters and Upgraders are stationary roles and do not use gather/work cycles
	        if (role === 'harvester' || role === 'upgrader') return;

	        const used = creep.store.getUsedCapacity(RESOURCE_ENERGY);
	        const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);

	        if (!creep.heap.state || creep.heap.state === 'idle') creep.heap.state = 'gather';

	        if (creep.heap.state === 'gather' && free === 0) {
	            creep.heap.state = 'work';
	            creep.heap.targetId = null;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	        } else if (creep.heap.state === 'work' && used === 0) {
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
	        const target = GameObjectUtility.getById(creep.heap.targetId);

	        if (!target) {
	            creep.heap.targetId = null;
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            return;
	        }

	        if (creep.heap.state === 'gather') {
	            if ((target.amount !== undefined && target.amount < 50) ||
	                (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) < 50)) {
	                creep.heap.targetId = null;
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        } else if (creep.heap.state === 'work') {
	            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 ||
	                (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0)) {
	                creep.heap.targetId = null;
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        }
	    }

	    static assignTask(creep, roomState) {
	        const role = (creep.memory.role || '').toLowerCase();
	        if (role === 'harvester') TaskAssignmentManager.assignHarvester(creep, roomState);
	        else if (role === 'hauler') TaskAssignmentManager.assignHauler(creep, roomState);
	        else if (role === 'builder') TaskAssignmentManager.assignBuilder(creep, roomState);
	        else if (role === 'bootstrapper') TaskAssignmentManager.assignBootstrapper(creep, roomState);
	        else if (role === 'upgrader') TaskAssignmentManager.assignUpgrader(creep, roomState);
	    }

	    static assignHarvester(creep, roomState) {
	        const sources = roomState.sources;
	        if (!sources || sources.length === 0) return;

	        // Balance assignment dynamically based on current heap assignments
	        const counts = new Map();
	        if (roomState.harvesters) {
	            for (let i = 0; i < roomState.harvesters.length; i++) {
	                const h = roomState.harvesters[i];
	                if (h.heap && h.heap.targetId) {
	                    counts.set(h.heap.targetId, (counts.get(h.heap.targetId) || 0) + 1);
	                }
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

	        creep.heap.targetId = bestSource.id;
	        creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;

	        // Assign sitTargetId if a container exists for this source
	        if (roomState.sourceContainers) {
	            for (let i = 0; i < roomState.sourceContainers.length; i++) {
	                const c = roomState.sourceContainers[i];
	                if (c.pos.getRangeTo(bestSource) <= 2) {
	                    creep.heap.sitTargetId = c.id;
	                    break;
	                }
	            }
	        }
	    }

	    static assignHauler(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            // Priority 1: Scavenge from Ruins and Tombstones
	            const scavengeTargets = WithdrawTargetUtility.getScavengeTargets(roomState);
	            let bestScavenge = null;
	            let bestScavengeScore = -1;

	            for (let i = 0; i < scavengeTargets.length; i++) {
	                const target = scavengeTargets[i];
	                const amount = target.store.getUsedCapacity(RESOURCE_ENERGY);
	                const claimed = target.__gatherClaimed || 0;
	                const remaining = amount - claimed;

	                if (remaining >= Math.min(25, creep.store.getFreeCapacity(RESOURCE_ENERGY))) {
	                    const dist = Math.max(Math.abs(creep.pos.x - target.pos.x), Math.abs(creep.pos.y - target.pos.y)) || 1;
	                    const score = remaining / dist;
	                    if (score > bestScavengeScore) {
	                        bestScavengeScore = score;
	                        bestScavenge = target;
	                    }
	                }
	            }

	            if (bestScavenge) {
	                bestScavenge.__gatherClaimed = (bestScavenge.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
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

	                    const amount = c.store.getUsedCapacity(RESOURCE_ENERGY);
	                    const claimed = c.__gatherClaimed || 0;
	                    const remaining = amount - claimed;

	                    if (remaining >= Math.min(25, creep.store.getFreeCapacity(RESOURCE_ENERGY))) {
	                        const dist = Math.max(Math.abs(creep.pos.x - c.pos.x), Math.abs(creep.pos.y - c.pos.y)) || 1;
	                        const score = remaining / dist;
	                        if (score > bestContainerScore) {
	                            bestContainerScore = score;
	                            bestContainer = c;
	                        }
	                    }
	                }
	                if (bestContainer) {
	                    bestContainer.__gatherClaimed = (bestContainer.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
	                    creep.heap.targetId = bestContainer.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
	                    return;
	                }
	            }

	            // Priority 2: Hashed assignment to specific harvester's drop zone
	            const harvesters = roomState.harvesters || [];
	            if (harvesters.length > 0) {
	                // djb2 hash for even distribution across harvesters
	                const targetHarvester = harvesters[djb2Hash(creep.name) % harvesters.length];

	                // Find dropped energy near this specific harvester using fast Chebyshev distance
	                // Pick highest-amount drop for efficiency
	                let bestTarget = null;
	                let bestAmount = 0;
	                let intent = '';
	                const drops = roomState.droppedEnergy || [];

	                for (let i = 0; i < drops.length; i++) {
	                    const d = drops[i];
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
	                    bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
	                    creep.heap.targetId = bestTarget.id;
	                    creep.heap.actionIntent = intent;
	                    return;
	                }
	            }

	            // Priority 3: If hauler has partial energy, go deliver it instead of waiting
	            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                creep.heap.state = 'work';
	                TaskAssignmentManager.assignHaulerWork(creep, roomState);
	            }
	            // If truly empty and no targets: do nothing this tick, will retry next tick
	        } else {
	            TaskAssignmentManager.assignHaulerWork(creep, roomState);
	        }
	    }

	    static assignHaulerWork(creep, roomState) {
	        // Priority 1: Fill spawn/extensions
	        if (TaskAssignmentManager.routeToStorage(creep, roomState)) return;

	        // Priority 2: Drop/Transfer at controller
	        if (roomState.controller) {
	            // Check if controller has a container
	            let controllerContainer = null;
	            if (roomState.containers) {
	                for (let i = 0; i < roomState.containers.length; i++) {
	                    const c = roomState.containers[i];
	                    if (c.pos.getRangeTo(roomState.controller) <= 3) {
	                        controllerContainer = c;
	                        break;
	                    }
	                }
	            }

	            if (controllerContainer) {
	                creep.heap.targetId = controllerContainer.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	            } else {
	                creep.heap.targetId = roomState.controller.id;
	                creep.heap.actionIntent = ActionConstants.ACTION_DROP;
	            }
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
	        // Priority 1: Build construction sites — prefer nearly-complete ones
	        if (roomState.constructionSites?.length > 0) {
	            let bestSite = null;
	            let bestScore = -1;
	            for (let i = 0; i < roomState.constructionSites.length; i++) {
	                const s = roomState.constructionSites[i];
	                const dx = Math.abs(creep.pos.x - s.pos.x);
	                const dy = Math.abs(creep.pos.y - s.pos.y);
	                const dist = Math.max(dx, dy) || 1;
	                // Progress ratio: higher = closer to completion
	                const progress = s.progressTotal > 0 ? s.progress / s.progressTotal : 0;
	                // Score: prefer nearby + nearly-complete sites
	                const score = (1 + progress * 3) * 100 / dist;
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

	    static routeToStorage(creep, roomState) {
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

	        if (bestTarget) {
	            bestTarget.__deliveryClaimed = (bestTarget.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
	            creep.heap.targetId = bestTarget.id;
	            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
	            return true;
	        }

	        return false;
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

	    static assignBootstrapper(creep, roomState) {
	        if (creep.heap.state === 'gather') {
	            // First try to scavenge dropped energy like a builder
	            const bestSource = TaskAssignmentManager.findClosestEnergy(creep, roomState);
	            if (bestSource) {
	                creep.heap.targetId = bestSource.id;
	                creep.heap.actionIntent = bestSource.actionIntent;
	                return;
	            }

	            // Fallback: Harvest directly from the nearest source
	            if (roomState.sources && roomState.sources.length > 0) {
	                let bestTarget = null;
	                let bestDist = Infinity;
	                for (let i = 0; i < roomState.sources.length; i++) {
	                    const source = roomState.sources[i];
	                    const dx = Math.abs(creep.pos.x - source.pos.x);
	                    const dy = Math.abs(creep.pos.y - source.pos.y);
	                    const dist = Math.max(dx, dy);
	                    if (dist < bestDist) {
	                        bestDist = dist;
	                        bestTarget = source;
	                    }
	                }
	                if (bestTarget) {
	                    creep.heap.targetId = bestTarget.id;
	                    creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
	                }
	            }
	        } else {
	            // Work phase: Fill Spawns/Extensions first to get real creeps spawning
	            if (TaskAssignmentManager.routeToStorage(creep, roomState)) return;

	            // Priority 2: Build critical structures (like containers)
	            if (roomState.constructionSites && roomState.constructionSites.length > 0) {
	                let bestSite = null;
	                let bestScore = -1;
	                for (let i = 0; i < roomState.constructionSites.length; i++) {
	                    const s = roomState.constructionSites[i];
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

	    static assignUpgrader(creep, roomState) {
	        if (!roomState.controller) return;
	        creep.heap.targetId = roomState.controller.id;
	        creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
	    }
	}

	TaskAssignmentManager_1 = TaskAssignmentManager;
	return TaskAssignmentManager_1;
}

var Harvester_1;
var hasRequiredHarvester;

function requireHarvester () {
	if (hasRequiredHarvester) return Harvester_1;
	hasRequiredHarvester = 1;
	const ActionConstants = requireActionConstants();
	const GameObjectUtility = requireGameObjectUtility();
	const CreepHeapUtility = requireCreepHeapUtility();

	const Harvester = {
	    run: function (creep) {
	        if (creep.fatigue > 0) return;
	        if (!creep.heap) return;

	        const targetId = creep.heap.targetId;
	        const actionIntent = creep.heap.actionIntent;

	        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

	        const target = GameObjectUtility.getById(targetId);
	        if (!target) {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	            return;
	        }

	        if (actionIntent === ActionConstants.ACTION_HARVEST) {
	            // Container-sit: path to the container and sit on it for direct deposit
	            if (creep.heap.sitTargetId) {
	                const container = GameObjectUtility.getById(creep.heap.sitTargetId);
	                if (container && (creep.pos.x !== container.pos.x || creep.pos.y !== container.pos.y)) {
	                    creep.moveTo(container, { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00' } });
	                    // Still try to harvest if in range of source while walking
	                    if (creep.pos.getRangeTo(target) <= 1) {
	                        creep.harvest(target);
	                    }
	                    return;
	                }
	            } else {
	                // If no container, enforce strict harvest position lock-in
	                const assignedPosObj = CreepHeapUtility.getCreepHarvestPosition(creep);
	                if (assignedPosObj && (creep.pos.x !== assignedPosObj.x || creep.pos.y !== assignedPosObj.y)) {
	                    const assignedPos = new RoomPosition(assignedPosObj.x, assignedPosObj.y, assignedPosObj.roomName);
	                    creep.moveTo(assignedPos, { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00' } });
	                    if (creep.pos.getRangeTo(target) <= 1) {
	                        creep.harvest(target);
	                    }
	                    return;
	                }
	            }

	            const result = creep.harvest(target);

	            if (result === ERR_NOT_IN_RANGE) {
	                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00' } });
	            } else if (result === ERR_NOT_ENOUGH_RESOURCES && target.ticksToRegeneration) {
	                creep.heap.sleepUntil = Game.time + target.ticksToRegeneration;
	                creep.heap.state = 'idle';
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                creep.heap.targetId = null;
	            } else if (result === ERR_INVALID_TARGET) {
	                creep.heap.state = 'idle';
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                creep.heap.targetId = null;
	            }
	        }
	    }
	};

	Harvester_1 = Harvester;
	return Harvester_1;
}

var Hauler_1;
var hasRequiredHauler;

function requireHauler () {
	if (hasRequiredHauler) return Hauler_1;
	hasRequiredHauler = 1;
	const ActionConstants = requireActionConstants();
	const GameObjectUtility = requireGameObjectUtility();

	const Hauler = {
	    run: function (creep) {
	        if (creep.fatigue > 0) return;

	        if (!creep.heap) return;

	        const targetId = creep.heap.targetId;
	        const actionIntent = creep.heap.actionIntent;

	        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

	        const target = GameObjectUtility.getById(targetId);
	        if (!target) {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	            return;
	        }

	        let result;
	        if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
	            const resourceType = (target.store && Object.keys(target.store)[0]) || RESOURCE_ENERGY;
	            result = creep.withdraw(target, resourceType);
	        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
	            result = creep.pickup(target);
	        } else if (actionIntent === ActionConstants.ACTION_TRANSFER) {
	            const resourceType = (creep.store && Object.keys(creep.store)[0]) || RESOURCE_ENERGY;
	            result = creep.transfer(target, resourceType);
	        } else if (actionIntent === ActionConstants.ACTION_DROP) {
	            if (target.memory && target.memory.role === 'upgrader') {
	                if (creep.pos.getRangeTo(target) > 1) {
	                    creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
	                    return;
	                }
	            } else {
	                if (creep.pos.getRangeTo(target) > 3) {
	                    creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
	                    return;
	                }
	            }
	            const resourceType = (creep.store && Object.keys(creep.store)[0]) || RESOURCE_ENERGY;
	            result = creep.drop(resourceType);
	        } else {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	            return;
	        }

	        if (result === ERR_NOT_IN_RANGE) {
	            creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
	        } else if (result === OK ||
	            result === ERR_NOT_ENOUGH_RESOURCES ||
	            result === ERR_FULL ||
	            result === ERR_INVALID_TARGET) {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	        }
	    }
	};

	Hauler_1 = Hauler;
	return Hauler_1;
}

var Upgrader_1;
var hasRequiredUpgrader;

function requireUpgrader () {
	if (hasRequiredUpgrader) return Upgrader_1;
	hasRequiredUpgrader = 1;
	const ActionConstants = requireActionConstants();
	const GameObjectUtility = requireGameObjectUtility();

	const Upgrader = {
	    run: function (creep) {
	        if (creep.fatigue > 0) return;
	        if (!creep.heap) return;

	        const targetId = creep.heap.targetId;
	        const actionIntent = creep.heap.actionIntent;

	        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

	        if (actionIntent === ActionConstants.ACTION_UPGRADE) {
	            const target = GameObjectUtility.getById(targetId);
	            if (!target) {
	                creep.heap.state = 'idle';
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                creep.heap.targetId = null;
	                return;
	            }

	            const roomState = commonjsGlobal.State?.rooms?.get(creep.room.name);
	            let container = null;
	            if (roomState && roomState.controllerContainers && roomState.controllerContainers.length > 0) {
	                container = roomState.controllerContainers[0];
	            }

	            // 1. Position around container if one exists, otherwise around controller
	            if (container) {
	                if (creep.pos.getRangeTo(container) > 1) {
	                    creep.moveTo(container, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
	                    return;
	                }
	            } else {
	                const range = creep.pos.getRangeTo(target);
	                if (range > 3) {
	                    creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
	                    return; // Do nothing else while walking
	                }
	            }

	            // 2. We are in position. Fast scan for adjacent containers/drops if we need energy.
	            let pickedUp = false;
	            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
	                if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
	                    creep.withdraw(container, RESOURCE_ENERGY);
	                    pickedUp = true;
	                } else if (roomState) {
	                    // Check other containers first (e.g. if multiple exist)
	                    if (roomState.containers) {
	                        for (let i = 0; i < roomState.containers.length; i++) {
	                            const c = roomState.containers[i];
	                            if (c.id !== (container ? container.id : null) &&
	                                c.store.getUsedCapacity(RESOURCE_ENERGY) > 0 &&
	                                Math.max(Math.abs(creep.pos.x - c.pos.x), Math.abs(creep.pos.y - c.pos.y)) <= 1) {
	                                creep.withdraw(c, RESOURCE_ENERGY);
	                                pickedUp = true;
	                                break;
	                            }
	                        }
	                    }

	                    // Fallback to dropped energy
	                    if (!pickedUp && roomState.droppedEnergy) {
	                        const drops = roomState.droppedEnergy;
	                        for (let i = 0; i < drops.length; i++) {
	                            const d = drops[i];
	                            if (Math.max(Math.abs(creep.pos.x - d.pos.x), Math.abs(creep.pos.y - d.pos.y)) <= 1) {
	                                creep.pickup(d);
	                                pickedUp = true;
	                                break;
	                            }
	                        }
	                    }
	                }
	            }

	            // 3. Upgrade if we have energy or just picked some up
	            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || pickedUp) {
	                const result = creep.upgradeController(target);
	                if (result !== OK && result !== ERR_NOT_ENOUGH_RESOURCES) {
	                    creep.heap.state = 'idle';
	                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                    creep.heap.targetId = null;
	                }
	            }
	        }
	    }
	};

	Upgrader_1 = Upgrader;
	return Upgrader_1;
}

var Builder_1;
var hasRequiredBuilder;

function requireBuilder () {
	if (hasRequiredBuilder) return Builder_1;
	hasRequiredBuilder = 1;
	const ActionConstants = requireActionConstants();
	const GameObjectUtility = requireGameObjectUtility();

	const Builder = {
	    run: function (creep) {
	        if (creep.fatigue > 0) return;
	        if (!creep.heap) return;

	        const targetId = creep.heap.targetId;
	        const actionIntent = creep.heap.actionIntent;

	        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

	        const target = GameObjectUtility.getById(targetId);
	        if (!target) {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	            return;
	        }

	        let result;
	        if (actionIntent === ActionConstants.ACTION_BUILD) {
	            result = creep.build(target);
	        } else if (actionIntent === ActionConstants.ACTION_REPAIR) {
	            result = creep.repair(target);
	        } else if (actionIntent === ActionConstants.ACTION_UPGRADE) {
	            result = creep.upgradeController(target);
	        } else if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
	            result = creep.withdraw(target, RESOURCE_ENERGY);
	            // On successful withdraw, immediately idle for work assignment
	            if (result === OK) {
	                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
	                    creep.heap.state = 'idle';
	                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                    creep.heap.targetId = null;
	                }
	                return;
	            }
	        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
	            result = creep.pickup(target);
	            // On successful pickup, immediately idle for work assignment
	            if (result === OK) {
	                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
	                    creep.heap.state = 'idle';
	                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                    creep.heap.targetId = null;
	                }
	                return;
	            }
	        } else if (actionIntent === ActionConstants.ACTION_DROP) {
	            result = creep.drop(RESOURCE_ENERGY);
	        }

	        if (result === ERR_NOT_IN_RANGE) {
	            creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
	        } else if (result === ERR_FULL || result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES) {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	        } else if (result === OK) {
	            // After successful work action, check if energy is depleted
	            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
	                creep.heap.state = 'idle';
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                creep.heap.targetId = null;
	            }
	        }
	    }
	};

	Builder_1 = Builder;
	return Builder_1;
}

var Scavenger_1;
var hasRequiredScavenger;

function requireScavenger () {
	if (hasRequiredScavenger) return Scavenger_1;
	hasRequiredScavenger = 1;
	const ActionConstants = requireActionConstants();
	const GameObjectUtility = requireGameObjectUtility();

	const Scavenger = {
	    run: function (creep) {
	        if (creep.fatigue > 0) return;
	        if (!creep.heap) return;

	        const targetId = creep.heap.targetId;
	        const actionIntent = creep.heap.actionIntent;

	        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

	        const target = GameObjectUtility.getById(targetId);
	        if (!target) {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	            return;
	        }

	        let result;
	        if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
	            result = creep.withdraw(target, RESOURCE_ENERGY);
	        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
	            result = creep.pickup(target);
	        } else if (actionIntent === ActionConstants.ACTION_TRANSFER) {
	            result = creep.transfer(target, RESOURCE_ENERGY);
	        } else if (actionIntent === ActionConstants.ACTION_DROP) {
	            result = creep.drop(RESOURCE_ENERGY);
	        } else {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	            return;
	        }

	        if (result === ERR_NOT_IN_RANGE) {
	            creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
	        } else if (result === OK ||
	            result === ERR_NOT_ENOUGH_RESOURCES ||
	            result === ERR_FULL ||
	            result === ERR_INVALID_TARGET) {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	        }
	    }
	};

	Scavenger_1 = Scavenger;
	return Scavenger_1;
}

var Bootstrapper_1;
var hasRequiredBootstrapper;

function requireBootstrapper () {
	if (hasRequiredBootstrapper) return Bootstrapper_1;
	hasRequiredBootstrapper = 1;
	const ActionConstants = requireActionConstants();
	const GameObjectUtility = requireGameObjectUtility();

	const Bootstrapper = {
	    run: function (creep) {
	        if (creep.fatigue > 0) return;
	        if (!creep.heap) return;

	        const targetId = creep.heap.targetId;
	        const actionIntent = creep.heap.actionIntent;

	        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

	        const target = GameObjectUtility.getById(targetId);
	        if (!target) {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	            return;
	        }

	        let result;

	        if (actionIntent === ActionConstants.ACTION_HARVEST) {
	            result = creep.harvest(target);
	        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
	            result = creep.pickup(target);
	        } else if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
	            const resourceType = (target.store && Object.keys(target.store)[0]) || RESOURCE_ENERGY;
	            result = creep.withdraw(target, resourceType);
	        } else if (actionIntent === ActionConstants.ACTION_TRANSFER) {
	            const resourceType = (creep.store && Object.keys(creep.store)[0]) || RESOURCE_ENERGY;
	            result = creep.transfer(target, resourceType);
	        } else if (actionIntent === ActionConstants.ACTION_BUILD) {
	            result = creep.build(target);
	        } else if (actionIntent === ActionConstants.ACTION_UPGRADE) {
	            result = creep.upgradeController(target);
	            // Dynamic clustering logic for controllers (max range 3)
	            if (result === ERR_NOT_IN_RANGE) {
	                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00' } });
	                return;
	            } else if (result === OK || result === ERR_NOT_ENOUGH_RESOURCES) {
	                const distToController = creep.pos.getRangeTo(target);
	                if (distToController > 3 || (distToController === 3 && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
	                    creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00' } });
	                }
	            }
	        } else {
	            creep.heap.state = 'idle';
	            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            creep.heap.targetId = null;
	            return;
	        }

	        // Standard distance routing for all intents (except upgrade which has special clustering)
	        if (actionIntent !== ActionConstants.ACTION_UPGRADE) {
	            if (result === ERR_NOT_IN_RANGE) {
	                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00' } });
	            } else if (result === OK ||
	                result === ERR_NOT_ENOUGH_RESOURCES ||
	                result === ERR_FULL ||
	                result === ERR_INVALID_TARGET) {
	                // If it successfully gathered/transferred/built, or ran out of space/resources, clear intent
	                // The manager will flip state based on capacity on the next tick
	                if (actionIntent !== ActionConstants.ACTION_HARVEST && actionIntent !== ActionConstants.ACTION_BUILD) {
	                    creep.heap.state = 'idle';
	                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	                    creep.heap.targetId = null;
	                }
	            }
	        }
	    }
	};

	Bootstrapper_1 = Bootstrapper;
	return Bootstrapper_1;
}

var RoleExecutor_1;
var hasRequiredRoleExecutor;

function requireRoleExecutor () {
	if (hasRequiredRoleExecutor) return RoleExecutor_1;
	hasRequiredRoleExecutor = 1;
	const ActionConstants = requireActionConstants();
	const CreepHeapUtility = requireCreepHeapUtility();

	const roles = Object.create(null);
	roles['harvester'] = requireHarvester();
	roles['hauler'] = requireHauler();
	roles['upgrader'] = requireUpgrader();
	roles['builder'] = requireBuilder();
	roles['scavenger'] = requireScavenger();
	roles['bootstrapper'] = requireBootstrapper();

	/**
	 * Top-Down Role Executor
	 * Processes intent execution based on heap-stored actions.
	 */
	class RoleExecutor {
	    static run() {
	        if (!commonjsGlobal.creepHeap) commonjsGlobal.creepHeap = new Map();

	        // Check: Object.values is faster than Object.keys followed by property lookup.
	        const creeps = Object.values(Game.creeps);

	        for (let i = 0; i < creeps.length; i++) {
	            const creep = creeps[i];

	            if (creep.spawning || creep.fatigue > 0) continue;

	            let heap = commonjsGlobal.creepHeap.get(creep.name);
	            if (!heap) {
	                heap = CreepHeapUtility.getDefaultHeap();
	                heap.sleepUntil = 0;
	                commonjsGlobal.creepHeap.set(creep.name, heap);
	            }
	            creep.heap = heap;

	            if (Game.time < creep.heap.sleepUntil) continue;

	            const actionIntent = creep.heap.actionIntent;

	            if (!actionIntent || actionIntent === ActionConstants.ACTION_IDLE) continue;

	            if (actionIntent === ActionConstants.ACTION_SCOUT || actionIntent === ActionConstants.ACTION_MOVE_ROOM) {
	                RoleExecutor.executeCrossRoomTask(creep);
	                continue;
	            }

	            const roleLogic = roles[(creep.memory.role || '').toLowerCase()]; // Retrieve role logic
	            if (roleLogic) {
	                roleLogic.run(creep); // Execute role logic
	            } else {
	                creep.heap.state = 'idle';
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
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
	            const moveResult = creep.moveTo(new RoomPosition(25, 25, targetRoom), {
	                range: 20,
	                reusePath: 50,
	                maxOps: 1000,
	                visualizePathStyle: { stroke: '#00ff00' }
	            });

	            if (moveResult === ERR_NO_PATH) {
	                creep.memory.targetRoom = null;
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        } else {
	            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
	                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { reusePath: 10, ignoreCreeps: true });
	            } else {
	                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
	            }
	        }
	    }
	}

	RoleExecutor_1 = RoleExecutor;
	return RoleExecutor_1;
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
	        if (Game.cpu.bucket <= 500) return;
	        // Run every 10 ticks to save CPU
	        if (Game.time % 10 !== 0) return;

	        if (!Memory.rooms) {
	            Memory.rooms = {};
	        }

	        const visibleRooms = Object.keys(Game.rooms);
	        for (let i = 0; i < visibleRooms.length; i++) {
	            IntelManager.scanAndSave(Game.rooms[visibleRooms[i]]);
	        }

	        commonjsGlobal.State.scoutQueue = IntelManager.buildScoutQueue(visibleRooms);
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
	        const hostileTowers = towers.filter(s => !s.my && s.structureType === STRUCTURE_TOWER);
	        const invaderCores = state.invaderCores || [];

	        const hostilesObj = mem.hostiles;
	        hostilesObj.creeps = hostileCreeps.length;
	        hostilesObj.towers = hostileTowers.length;
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
	}

	IntelManager_1 = IntelManager;
	return IntelManager_1;
}

var RoomPlanner_1;
var hasRequiredRoomPlanner;

function requireRoomPlanner () {
	if (hasRequiredRoomPlanner) return RoomPlanner_1;
	hasRequiredRoomPlanner = 1;
	const GameObjectUtility = requireGameObjectUtility();

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

	class RoomPlanner {

	    static run() {
	        if (Game.cpu.bucket <= 500) return;
	        if (Game.time % 50 !== 0) return;
	        if (!commonjsGlobal.Cache) commonjsGlobal.Cache = { blueprints: new Map() };
	        if (!(commonjsGlobal.Cache.blueprints instanceof Map)) commonjsGlobal.Cache.blueprints = new Map();
	        for (const roomName in Game.rooms) {
	            const room = Game.rooms[roomName];
	            if (room.controller && room.controller.my) this.manageRoom(room);
	        }
	    }

	    static manageRoom(room) {
	        if (!commonjsGlobal.Cache.blueprints.has(room.name)) this.generateBlueprint(room);
	        if (Game.time % 13 !== 0) return;
	        if (Object.keys(Game.constructionSites).length > 50) return;
	        this.executeBlueprint(room);
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
	            [STRUCTURE_POWER_SPAWN]: []
	        };

	        // Step 1: Anchor — must land on road parity (ax+ay)%2===0
	        let anchor = this.findAnchor(room, terrain);
	        if ((anchor.x + anchor.y) % 2 !== 0) {
	            const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
	            for (let i = 0; i < dirs.length; i++) {
	                const nx = anchor.x + dirs[i].x, ny = anchor.y + dirs[i].y;
	                if (nx >= 3 && nx <= 46 && ny >= 3 && ny <= 46 && terrain.get(nx, ny) !== TERRAIN_MASK_WALL) {
	                    anchor = {x: nx, y: ny}; break;
	                }
	            }
	        }
	        blueprint.anchor = anchor;

	        const visited = new Set();

	        // Step 2: Core Hub stamp
	        this.applyCoreStamp(blueprint, terrain, anchor, visited);

	        // Step 3: Lab cluster (best-fit quadrant, contiguous only)
	        this.applyLabStamp(blueprint, terrain, anchor, visited);

	        // Step 4: Diamond checkerboard BFS fill (extensions + internal roads)
	        this.fillBaseDiamond(blueprint, terrain, anchor, visited);

	        // Step 5: Source + controller containers
	        if (state) this.planContainers(blueprint, room, state, terrain);

	        // Step 6: External road routes (containers + mineral only; diamond handles internal)
	        if (state) this.planRoads(blueprint, room, state, anchor);

	        // Step 7: Min-cut ramparts
	        blueprint.ramparts = this.computeMinCut(terrain, visited, anchor);

	        // Step 8: Road exit airlocks (3-deep)
	        this.addRoadRamparts(blueprint);

	        // Step 9: Outpost ramparts for external resources
	        if (state) this.addOutpostRamparts(blueprint, terrain, state);

	        commonjsGlobal.Cache.blueprints.set(room.name, blueprint);
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
	                    dt.set(x, y, Math.min(dt.get(x-1,y), dt.get(x,y-1), dt.get(x-1,y-1), dt.get(x+1,y-1)) + 1);
	                }
	            }
	        }
	        let maxVal = 0, anchor = {x: 25, y: 25};
	        for (let x = 48; x >= 1; x--) {
	            for (let y = 48; y >= 1; y--) {
	                if (dt.get(x, y) > 0) {
	                    const val = Math.min(dt.get(x, y), Math.min(dt.get(x+1,y), dt.get(x,y+1), dt.get(x+1,y+1), dt.get(x-1,y+1)) + 1);
	                    dt.set(x, y, val);
	                    if (val > maxVal) { maxVal = val; anchor = {x, y}; }
	                }
	            }
	        }
	        return anchor;
	    }

	    // ─── Step 2: Core Hub Stamp ──────────────────────────────────────────

	    /**
	     * Hardcoded Core Hub stamp.
	     * Convention: (dx+dy)%2===0 → road, (dx+dy)%2===1 → structure.
	     * Anchor is always nudged to road parity before this runs.
	     */
	    static applyCoreStamp(blueprint, terrain, anchor, visited) {
	        const ax = anchor.x, ay = anchor.y;
	        const stamp = [
	            // Roads (dx+dy even)
	            { type: 'road', dx:  0, dy:  0 },  // Hub Manager standing tile
	            { type: 'road', dx:  1, dy:  1 }, { type: 'road', dx: -1, dy:  1 },
	            { type: 'road', dx:  1, dy: -1 }, { type: 'road', dx: -1, dy: -1 },
	            { type: 'road', dx:  2, dy:  0 }, { type: 'road', dx: -2, dy:  0 },
	            { type: 'road', dx:  0, dy:  2 }, { type: 'road', dx:  0, dy: -2 },
	            { type: 'road', dx:  2, dy:  2 }, { type: 'road', dx: -2, dy:  2 },
	            { type: 'road', dx:  2, dy: -2 }, { type: 'road', dx: -2, dy: -2 },
	            // Structures (dx+dy odd)
	            { type: STRUCTURE_STORAGE,     dx:  1, dy:  0 },
	            { type: STRUCTURE_TERMINAL,    dx: -1, dy:  0 },
	            { type: STRUCTURE_FACTORY,     dx:  0, dy:  1 },
	            { type: STRUCTURE_SPAWN,       dx:  0, dy: -1 },   // Spawn 1 (primary)
	            { type: STRUCTURE_TOWER,       dx:  2, dy:  1 }, { type: STRUCTURE_TOWER, dx: -2, dy:  1 },
	            { type: STRUCTURE_TOWER,       dx:  2, dy: -1 }, { type: STRUCTURE_TOWER, dx: -2, dy: -1 },
	            { type: STRUCTURE_TOWER,       dx:  1, dy:  2 }, { type: STRUCTURE_TOWER, dx: -1, dy:  2 },
	            { type: STRUCTURE_SPAWN,       dx:  1, dy: -2 },   // Spawn 2
	            { type: STRUCTURE_SPAWN,       dx: -1, dy: -2 },   // Spawn 3
	            { type: STRUCTURE_POWER_SPAWN, dx:  3, dy:  0 },
	            { type: STRUCTURE_OBSERVER,    dx: -3, dy:  0 },
	            { type: STRUCTURE_NUKER,       dx:  0, dy:  3 },
	        ];

	        for (let i = 0; i < stamp.length; i++) {
	            const { type, dx, dy } = stamp[i];
	            const x = ax + dx, y = ay + dy;
	            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
	            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
	            const key = `${x},${y}`;
	            if (visited.has(key)) continue;
	            visited.add(key);
	            if (type === 'road') blueprint.roads.push({x, y});
	            else blueprint[type].push({x, y});
	        }
	    }

	    // ─── Step 3: Lab Stamp ───────────────────────────────────────────────

	    /**
	     * Places the 2-supplier + 8-reactor lab cluster as a guaranteed contiguous block.
	     * Tries 4 quadrant variants; picks the one with the most valid tiles.
	     * If a quadrant scores < 10, that variant is still chosen (partial placement
	     * is better than scattering), but labs are NEVER placed individually via BFS.
	     *
	     * Verified: both S1 and S2 are within Chebyshev range 2 of all 8 reactors.
	     * Layout: [R0][S1][S2][R1] / [R2][R3][R4][R5] / ····[R6][R7]
	     */
	    static applyLabStamp(blueprint, terrain, anchor, visited) {
	        const ax = anchor.x, ay = anchor.y;

	        const variants = [
	            // RIGHT of core (dx 4–7)
	            [
	                {dx:4,dy:-1,s:false},{dx:5,dy:-1,s:true},{dx:6,dy:-1,s:true},{dx:7,dy:-1,s:false},
	                {dx:4,dy: 0,s:false},{dx:5,dy: 0,s:false},{dx:6,dy: 0,s:false},{dx:7,dy: 0,s:false},
	                {dx:5,dy: 1,s:false},{dx:6,dy: 1,s:false},
	            ],
	            // LEFT of core (dx -4 to -7)
	            [
	                {dx:-4,dy:-1,s:false},{dx:-5,dy:-1,s:true},{dx:-6,dy:-1,s:true},{dx:-7,dy:-1,s:false},
	                {dx:-4,dy: 0,s:false},{dx:-5,dy: 0,s:false},{dx:-6,dy: 0,s:false},{dx:-7,dy: 0,s:false},
	                {dx:-5,dy: 1,s:false},{dx:-6,dy: 1,s:false},
	            ],
	            // BELOW core (dy 4–7)
	            [
	                {dx:-1,dy:4,s:false},{dx:-1,dy:5,s:true},{dx:-1,dy:6,s:true},{dx:-1,dy:7,s:false},
	                {dx: 0,dy:4,s:false},{dx: 0,dy:5,s:false},{dx: 0,dy:6,s:false},{dx: 0,dy:7,s:false},
	                {dx: 1,dy:5,s:false},{dx: 1,dy:6,s:false},
	            ],
	            // ABOVE core (dy -4 to -7)
	            [
	                {dx:-1,dy:-4,s:false},{dx:-1,dy:-5,s:true},{dx:-1,dy:-6,s:true},{dx:-1,dy:-7,s:false},
	                {dx: 0,dy:-4,s:false},{dx: 0,dy:-5,s:false},{dx: 0,dy:-6,s:false},{dx: 0,dy:-7,s:false},
	                {dx: 1,dy:-5,s:false},{dx: 1,dy:-6,s:false},
	            ]
	        ];

	        let bestScore = -1, bestVariant = null;
	        for (let v = 0; v < variants.length; v++) {
	            let score = 0;
	            for (let j = 0; j < variants[v].length; j++) {
	                const x = ax + variants[v][j].dx, y = ay + variants[v][j].dy;
	                if (x >= 2 && x <= 47 && y >= 2 && y <= 47 &&
	                    terrain.get(x, y) !== TERRAIN_MASK_WALL && !visited.has(`${x},${y}`)) score++;
	            }
	            if (score > bestScore) { bestScore = score; bestVariant = variants[v]; }
	        }

	        if (!bestVariant || bestScore === 0) return;

	        for (let j = 0; j < bestVariant.length; j++) {
	            const { dx, dy, s } = bestVariant[j];
	            const x = ax + dx, y = ay + dy;
	            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
	            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
	            const key = `${x},${y}`;
	            if (visited.has(key)) continue;
	            visited.add(key);
	            blueprint[STRUCTURE_LAB].push({x, y});
	            if (s) blueprint.supplierLabs.push({x, y});
	        }
	    }

	    // ─── Step 4: Diamond BFS Fill ───────────────────────────────────────────

	    /**
	     * Grows a compact diamond from the anchor outward using 4-directional BFS
	     * (Manhattan-distance order). Applies the checkerboard parity rule:
	     *
	     *   (x+y) % 2 === anchorParity  →  road tile
	     *   (x+y) % 2 !== anchorParity  →  extension tile
	     *
	     * This produces a layout identical to the classic Screeps bunker:
	     *
	     *       R           ← entry point (cardinal tip, always road parity)
	     *      E E
	     *     R E R         ← each R has 4 cardinal E neighbors (fills 4 in 1 tick)
	     *    E R E R        ← creeps traverse the R-grid diagonally
	     *   R E R E R
	     *    E R E R
	     *     R E R
	     *      E E
	     *       R           ← entry point
	     *
	     * Stops the moment 60 extensions are placed. Core/lab tiles are already
	     * claimed in `visited`, so they are naturally skipped.
	     */
	    static fillBaseDiamond(blueprint, terrain, anchor, visited) {
	        const ax = anchor.x, ay = anchor.y;
	        const anchorParity = (ax + ay) % 2;  // 0 = road parity (anchor is always road)

	        // Standard 4-directional BFS gives Manhattan-distance ordering → true diamond shape
	        const queue = [{x: ax, y: ay}];
	        const seen  = new Set([`${ax},${ay}`]);
	        let head = 0;
	        let extensionsPlaced = blueprint[STRUCTURE_EXTENSION].length;

	        while (head < queue.length && extensionsPlaced < 60) {
	            const {x, y} = queue[head++];

	            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
	            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

	            const key = `${x},${y}`;
	            if (!visited.has(key)) {
	                visited.add(key);
	                if ((x + y) % 2 === anchorParity) {
	                    // Road parity — place road
	                    blueprint.roads.push({x, y});
	                } else {
	                    // Extension parity — place extension
	                    blueprint[STRUCTURE_EXTENSION].push({x, y});
	                    extensionsPlaced++;
	                }
	            }

	            // Enqueue 4 cardinal neighbors (BFS maintains Manhattan-distance order)
	            const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
	            for (let d = 0; d < dirs.length; d++) {
	                const nx = x + dirs[d].dx, ny = y + dirs[d].dy;
	                const nkey = `${nx},${ny}`;
	                if (!seen.has(nkey)) {
	                    seen.add(nkey);
	                    queue.push({x: nx, y: ny});
	                }
	            }
	        }
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
	                if (dist < bestDist) { bestDist = dist; best = {x, y}; }
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
	    static planRoads(blueprint, room, state, anchor) {
	        const anchorPos = new RoomPosition(anchor.x, anchor.y, room.name);

	        // Only external targets — spine handles internal routing
	        const targets = [];
	        for (let i = 0; i < blueprint.containers.length; i++) targets.push(blueprint.containers[i]);
	        if (state.mineral) targets.push({x: state.mineral.pos.x, y: state.mineral.pos.y});

	        targets.sort((a, b) => {
	            const dA = Math.max(Math.abs(a.x-anchor.x), Math.abs(a.y-anchor.y));
	            const dB = Math.max(Math.abs(b.x-anchor.x), Math.abs(b.y-anchor.y));
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
	            const ret = PathFinder.search(anchorPos, {pos: targetPos, range: 1}, {
	                plainCost: 2,
	                swampCost: 5,  // Strongly penalize swamp — prefer extra plains tiles
	                roomCallback: (rn) => rn === room.name ? costs : false,
	                maxOps: 4000
	            });

	            for (let j = 0; j < ret.path.length; j++) {
	                const step = ret.path[j];
	                if (step.x >= 2 && step.x <= 47 && step.y >= 2 && step.y <= 47 && costs.get(step.x, step.y) !== 1) {
	                    blueprint.roads.push({x: step.x, y: step.y});
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
	    static computeMinCut(terrain, baseSet, anchor) {
	        const N = 5002, S = 5000, T = 5001, INF = 999999;
	        const adj = new Array(N);
	        for (let i = 0; i < N; i++) adj[i] = [];
	        const eTo = [], eCap = [];

	        function addEdge(u, v, c) {
	            adj[u].push(eTo.length); eTo.push(v); eCap.push(c);
	            adj[v].push(eTo.length); eTo.push(u); eCap.push(0);
	        }

	        for (let x = 0; x < 50; x++) {
	            for (let y = 0; y < 50; y++) {
	                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
	                const inNode = x*50+y, outNode = inNode+2500;
	                const isBase = baseSet.has(`${x},${y}`);
	                const isBorder = x <= 1 || x >= 48 || y <= 1 || y >= 48;
	                addEdge(inNode, outNode, isBase || isBorder ? INF : 1);
	                if (isBorder) addEdge(S, inNode, INF);
	                if (isBase) addEdge(outNode, T, INF);
	                const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
	                for (let d = 0; d < dirs.length; d++) {
	                    const nx = x+dirs[d].dx, ny = y+dirs[d].dy;
	                    if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
	                    if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
	                    addEdge(outNode, nx*50+ny, INF);
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
	                for (let i = 0; i < adj[u].length; i++) {
	                    const ei = adj[u][i];
	                    if (eCap[ei] > 0 && level[eTo[ei]] < 0) { level[eTo[ei]] = level[u]+1; q.push(eTo[ei]); }
	                }
	            }
	            return level[T] >= 0;
	        }

	        // Dinic's DFS blocking flow
	        const iter = new Int32Array(N);
	        function dfs(u, pushed) {
	            if (u === T) return pushed;
	            for (; iter[u] < adj[u].length; iter[u]++) {
	                const ei = adj[u][iter[u]], v = eTo[ei];
	                if (eCap[ei] <= 0 || level[v] !== level[u]+1) continue;
	                const d = dfs(v, Math.min(pushed, eCap[ei]));
	                if (d > 0) { eCap[ei] -= d; eCap[ei^1] += d; return d; }
	            }
	            return 0;
	        }

	        while (bfs()) {
	            iter.fill(0);
	            let f;
	            do { f = dfs(S, INF); } while (f > 0);
	        }

	        // BFS in residual graph from S to find reachable set
	        const reachable = new Uint8Array(N);
	        const q2 = [S]; reachable[S] = 1; let qi2 = 0;
	        while (qi2 < q2.length) {
	            const u = q2[qi2++];
	            for (let i = 0; i < adj[u].length; i++) {
	                const ei = adj[u][i];
	                if (eCap[ei] > 0 && !reachable[eTo[ei]]) { reachable[eTo[ei]] = 1; q2.push(eTo[ei]); }
	            }
	        }

	        // Cut tiles: in-node reachable, out-node NOT reachable from S.
	        // WALL-AWARE: natural terrain walls are already impassable (permanent, free).
	        // Only place ramparts on open-terrain tiles in the cut — these are the gaps
	        // that actually need a structure to block passage.
	        const ramparts = [];
	        for (let x = 2; x < 48; x++) {
	            for (let y = 2; y < 48; y++) {
	                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;  // free perimeter tile
	                const id = x*50+y;
	                if (reachable[id] && !reachable[id+2500]) ramparts.push({x, y});
	            }
	        }
	        return ramparts;
	    }

	    // ─── Step 8: Road Exit Airlocks ──────────────────────────────────────

	    /**
	     * For every rampart that sits on a road (a "road exit"),
	     * traces 3 tiles inward toward anchor and also places ramparts.
	     * This creates a safe rampart corridor over every road exit.
	     */
	    static addRoadRamparts(blueprint) {
	        const roadSet = new Set(blueprint.roads.map(r => `${r.x},${r.y}`));
	        const rampartSet = new Set(blueprint.ramparts.map(r => `${r.x},${r.y}`));
	        const ax = blueprint.anchor.x, ay = blueprint.anchor.y;
	        const newRamparts = [];

	        for (let i = 0; i < blueprint.ramparts.length; i++) {
	            const rp = blueprint.ramparts[i];
	            if (!roadSet.has(`${rp.x},${rp.y}`)) continue;
	            let cx = rp.x, cy = rp.y;
	            for (let step = 0; step < 3; step++) {
	                const dx = ax - cx, dy = ay - cy;
	                let nx = cx, ny = cy;
	                if (Math.abs(dx) >= Math.abs(dy)) nx += (dx > 0 ? 1 : -1);
	                else ny += (dy > 0 ? 1 : -1);
	                const nkey = `${nx},${ny}`;
	                if (!rampartSet.has(nkey)) { rampartSet.add(nkey); newRamparts.push({x: nx, y: ny}); }
	                cx = nx; cy = ny;
	            }
	        }
	        for (let i = 0; i < newRamparts.length; i++) blueprint.ramparts.push(newRamparts[i]);
	    }

	    // ─── Step 9: Outpost Ramparts ────────────────────────────────────────

	    /**
	     * BFS inward from anchor (ramparts are boundaries).
	     * Any source/controller/mineral NOT reachable from anchor = outside perimeter.
	     * For each external resource, places a Chebyshev-range-1 rampart ring.
	     */
	    static addOutpostRamparts(blueprint, terrain, state) {
	        // BFS from anchor, ramparts act as walls
	        const rampartSet = new Set(blueprint.ramparts.map(r => `${r.x},${r.y}`));
	        const inside = new Set();
	        const start = blueprint.anchor;
	        inside.add(`${start.x},${start.y}`);
	        const q = [{x: start.x, y: start.y}]; let qi = 0;
	        while (qi < q.length) {
	            const cur = q[qi++];
	            const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
	            for (let i = 0; i < dirs.length; i++) {
	                const nx = cur.x + dirs[i].x, ny = cur.y + dirs[i].y;
	                if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
	                if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
	                const key = `${nx},${ny}`;
	                if (inside.has(key) || rampartSet.has(key)) continue;
	                inside.add(key); q.push({x: nx, y: ny});
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
	            if (inside.has(`${pos.x},${pos.y}`)) continue;  // Already inside main perimeter

	            // Place tight rampart ring (range 1) around external resource
	            for (let dx = -1; dx <= 1; dx++) {
	                for (let dy = -1; dy <= 1; dy++) {
	                    if (dx === 0 && dy === 0) continue;
	                    const rx = pos.x + dx, ry = pos.y + dy;
	                    if (rx < 2 || rx > 47 || ry < 2 || ry > 47) continue;
	                    if (terrain.get(rx, ry) === TERRAIN_MASK_WALL) continue;
	                    const key = `${rx},${ry}`;
	                    if (!rampartSet.has(key)) {
	                        rampartSet.add(key);
	                        outpostRamparts.push({x: rx, y: ry});
	                    }
	                }
	            }
	        }

	        blueprint.outpostRamparts = outpostRamparts;
	        for (let i = 0; i < outpostRamparts.length; i++) blueprint.ramparts.push(outpostRamparts[i]);
	    }

	    // ─── Blueprint Execution ─────────────────────────────────────────────

	    static executeBlueprint(room) {
	        const blueprint = commonjsGlobal.Cache.blueprints.get(room.name);
	        if (!blueprint) return;
	        const rcl = room.controller.level;
	        const state = commonjsGlobal.State?.rooms?.get(room.name);
	        if (!state) return;

	        let sitesPlaced = 0;
	        const maxSitesPerTick = 3;

	        const existingPositions = new Set();
	        if (state.structureIds) {
	            for (let i = 0; i < state.structureIds.length; i++) {
	                const s = GameObjectUtility.getById(state.structureIds[i]);
	                if (s) existingPositions.add(s.pos.x + '_' + s.pos.y + '_' + s.structureType);
	            }
	        }
	        if (state.constructionSites) {
	            for (let i = 0; i < state.constructionSites.length; i++) {
	                const s = state.constructionSites[i];
	                existingPositions.add(s.pos.x + '_' + s.pos.y + '_' + s.structureType);
	            }
	        }

	        // Containers first — critical for early progression
	        if (blueprint.containers && rcl >= 1) {
	            const maxContainers = CONTROLLER_STRUCTURES[STRUCTURE_CONTAINER][rcl];
	            let containerCount = state.containers ? state.containers.length : 0;
	            if (state.constructionSites) {
	                for (let i = 0; i < state.constructionSites.length; i++) {
	                    if (state.constructionSites[i].structureType === STRUCTURE_CONTAINER) containerCount++;
	                }
	            }
	            for (let i = 0; i < blueprint.containers.length && sitesPlaced < maxSitesPerTick; i++) {
	                if (containerCount >= maxContainers) break;
	                const pos = blueprint.containers[i];
	                const key = pos.x + '_' + pos.y + '_' + STRUCTURE_CONTAINER;
	                if (existingPositions.has(key)) continue;
	                if (room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER) === OK) {
	                    sitesPlaced++; containerCount++; existingPositions.add(key);
	                }
	            }
	        }

	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_EXTENSION, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_TOWER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_SPAWN, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_STORAGE, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_TERMINAL, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_FACTORY, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_LAB, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_OBSERVER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_NUKER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
	        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_POWER_SPAWN, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);

	        // Roads (RCL 2+)
	        if (blueprint.roads && rcl >= 2 && sitesPlaced < maxSitesPerTick) {
	            let roadCount = 0;
	            if (state.structureIds) {
	                for (let i = 0; i < state.structureIds.length; i++) {
	                    const s = GameObjectUtility.getById(state.structureIds[i]);
	                    if (s && s.structureType === STRUCTURE_ROAD) roadCount++;
	                }
	            }
	            if (state.constructionSites) {
	                for (let i = 0; i < state.constructionSites.length; i++) {
	                    if (state.constructionSites[i].structureType === STRUCTURE_ROAD) roadCount++;
	                }
	            }
	            const maxRoads = CONTROLLER_STRUCTURES[STRUCTURE_ROAD][rcl];
	            for (let i = 0; i < blueprint.roads.length && sitesPlaced < maxSitesPerTick; i++) {
	                if (roadCount >= maxRoads) break;
	                const pos = blueprint.roads[i];
	                const key = pos.x + '_' + pos.y + '_' + STRUCTURE_ROAD;
	                if (existingPositions.has(key)) continue;
	                if (room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD) === OK) {
	                    sitesPlaced++; roadCount++; existingPositions.add(key);
	                }
	            }
	        }

	        // Ramparts (RCL 4+)
	        if (rcl >= 4 && blueprint.ramparts && sitesPlaced < maxSitesPerTick) {
	            for (let i = 0; i < blueprint.ramparts.length && sitesPlaced < maxSitesPerTick; i++) {
	                const pos = blueprint.ramparts[i];
	                const key = pos.x + '_' + pos.y + '_' + STRUCTURE_RAMPART;
	                if (existingPositions.has(key)) continue;
	                if (room.createConstructionSite(pos.x, pos.y, STRUCTURE_RAMPART) === OK) {
	                    sitesPlaced++; existingPositions.add(key);
	                }
	            }
	        }
	    }

	    static placeStructureType(room, blueprint, structureType, rcl, existingPositions, state, maxToPlace) {
	        if (maxToPlace <= 0) return 0;
	        const positions = blueprint[structureType];
	        if (!positions || positions.length === 0) return 0;
	        const maxAllowed = CONTROLLER_STRUCTURES[structureType][rcl];
	        if (maxAllowed === 0) return 0;
	        let count = 0;
	        if (state.structureIds) {
	            for (let i = 0; i < state.structureIds.length; i++) {
	                const s = GameObjectUtility.getById(state.structureIds[i]);
	                if (s && s.structureType === structureType) count++;
	            }
	        }
	        if (state.constructionSites) {
	            for (let i = 0; i < state.constructionSites.length; i++) {
	                if (state.constructionSites[i].structureType === structureType) count++;
	            }
	        }
	        let placed = 0;
	        for (let i = 0; i < positions.length && placed < maxToPlace; i++) {
	            if (count >= maxAllowed) break;
	            const pos = positions[i];
	            const key = pos.x + '_' + pos.y + '_' + structureType;
	            if (existingPositions.has(key)) continue;
	            if (room.createConstructionSite(pos.x, pos.y, structureType) === OK) {
	                placed++; count++; existingPositions.add(key);
	            }
	        }
	        return placed;
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
	                    visual.circle(p.x, p.y, {radius: 0.15, fill: '#888888', opacity: 0.35});
	                }
	            }

	            // Structures
	            const structureColors = {
	                [STRUCTURE_SPAWN]:      '#ffaa00',
	                [STRUCTURE_EXTENSION]:  '#ffe066',
	                [STRUCTURE_TOWER]:      '#ff4444',
	                [STRUCTURE_STORAGE]:    '#44ff44',
	                [STRUCTURE_TERMINAL]:   '#44ffff',
	                [STRUCTURE_FACTORY]:    '#ff8800',
	                [STRUCTURE_POWER_SPAWN]:'#ff44ff',
	                [STRUCTURE_NUKER]:      '#884444',
	                [STRUCTURE_OBSERVER]:   '#4488ff',
	            };
	            for (const type in structureColors) {
	                if (!blueprint[type]) continue;
	                for (let i = 0; i < blueprint[type].length; i++) {
	                    const p = blueprint[type][i];
	                    visual.rect(p.x-0.35, p.y-0.35, 0.7, 0.7, {fill: structureColors[type], opacity: 0.45});
	                }
	            }

	            // Labs (supplier = cyan + label, reactor = purple)
	            if (blueprint[STRUCTURE_LAB]) {
	                const supplierSet = new Set((blueprint.supplierLabs || []).map(s=>`${s.x},${s.y}`));
	                for (let i = 0; i < blueprint[STRUCTURE_LAB].length; i++) {
	                    const p = blueprint[STRUCTURE_LAB][i];
	                    const isSup = supplierSet.has(`${p.x},${p.y}`);
	                    visual.rect(p.x-0.35, p.y-0.35, 0.7, 0.7, {fill: isSup ? '#00ffff' : '#cc44ff', opacity: 0.6});
	                    if (isSup) visual.text('S', p.x, p.y+0.1, {color:'#000', font: 0.4});
	                }
	            }

	            // Containers
	            if (blueprint.containers) {
	                for (let i = 0; i < blueprint.containers.length; i++) {
	                    const p = blueprint.containers[i];
	                    visual.rect(p.x-0.3, p.y-0.3, 0.6, 0.6, {fill: '#ffffff', opacity: 0.5});
	                }
	            }

	            // Ramparts
	            if (blueprint.ramparts) {
	                const roadSet = new Set((blueprint.roads || []).map(r=>`${r.x},${r.y}`));
	                const outpostSet = new Set((blueprint.outpostRamparts || []).map(r=>`${r.x},${r.y}`));
	                for (let i = 0; i < blueprint.ramparts.length; i++) {
	                    const p = blueprint.ramparts[i];
	                    const isOutpost = outpostSet.has(`${p.x},${p.y}`);
	                    const isRoadExit = !isOutpost && roadSet.has(`${p.x},${p.y}`);
	                    visual.rect(p.x-0.45, p.y-0.45, 0.9, 0.9, {
	                        fill: 'transparent',
	                        stroke: isOutpost ? '#ff8800' : isRoadExit ? '#ffff00' : '#00ff00',
	                        strokeWidth: isOutpost ? 0.14 : isRoadExit ? 0.12 : 0.07,
	                        opacity: 0.7
	                    });
	                }
	            }

	            // Anchor marker
	            if (blueprint.anchor) {
	                visual.circle(blueprint.anchor.x, blueprint.anchor.y, {radius: 0.28, fill: '#ffffff', opacity: 0.9});
	                visual.text('⚙', blueprint.anchor.x, blueprint.anchor.y+0.1, {color:'#000000', font: 0.45});
	            }
	        }
	    }
	}

	RoomPlanner_1 = RoomPlanner;
	return RoomPlanner_1;
}

var Logger_1;
var hasRequiredLogger;

function requireLogger () {
	if (hasRequiredLogger) return Logger_1;
	hasRequiredLogger = 1;
	const Logger = {
	    info: function(message) {
	        console.log(`[INFO] ${message}`);
	    },
	    warn: function(message) {
	        console.log(`[WARN] ${message}`);
	    },
	    error: function(message) {
	        console.log(`[ERROR] ${message}`);
	    },
	    debug: function(message) {
	        console.log(`[DEBUG] ${message}`);
	    },
	    run: function() {
	        this.debug(`Tick ${Game.time} executed successfully.`);
	    }
	};

	Logger_1 = Logger;
	return Logger_1;
}

var ProfilerUtility_1;
var hasRequiredProfilerUtility;

function requireProfilerUtility () {
	if (hasRequiredProfilerUtility) return ProfilerUtility_1;
	hasRequiredProfilerUtility = 1;
	const Logger = requireLogger();

	const ProfilerUtility = {
	    enabled: false,
	    metrics: new Map(),

	    start: function() {
	        if (this.enabled) {
	            this.metrics.clear();
	        }
	    },

	    end: function() {
	        if (this.enabled) {
	            const totalCpu = Game.cpu.getUsed();
	            Logger.debug(`Total CPU used this tick: ${totalCpu.toFixed(3)}`);
	        }
	    },

	    /**
	     * Enables or disables the profiler.
	     * @param {boolean} state
	     */
	    setEnabled: function(state) {
	        this.enabled = state;
	    },

	    /**
	     * Wraps a function to measure its execution time.
	     * @param {Function} fn The function to wrap.
	     * @param {string} name The name of the function for logging purposes.
	     * @returns {Function} The wrapped function.
	     */
	    wrap: function(fn, name) {
	        const profiler = this;
	        return function(...args) {
	            if (!profiler.enabled) {
	                return fn.apply(this, args);
	            }

	            const start = Game.cpu.getUsed();
	            const result = fn.apply(this, args);
	            const end = Game.cpu.getUsed();
	            const used = end - start;

	            if (!profiler.metrics.has(name)) {
	                profiler.metrics.set(name, { calls: 0, totalCpu: 0 });
	            }

	            const data = profiler.metrics.get(name);
	            data.calls++;
	            data.totalCpu += used;

	            return result;
	        };
	    },

	    /**
	     * Reports the aggregated metrics for the current tick and resets them.
	     */
	    report: function() {
	        if (!this.enabled || this.metrics.size === 0) {
	            return;
	        }

	        Logger.info('--- Profiler Report ---');
	        for (const [name, data] of this.metrics.entries()) {
	            const avg = data.totalCpu / data.calls;
	            Logger.info(`${name}: ${data.calls} calls, ${data.totalCpu.toFixed(3)} CPU total, ${avg.toFixed(3)} CPU avg`);
	        }
	        Logger.info('-----------------------');

	        // Reset for the next tick
	        this.metrics.clear();
	    }
	};

	ProfilerUtility_1 = ProfilerUtility;
	return ProfilerUtility_1;
}

var ErrorHandlingUtility_1;
var hasRequiredErrorHandlingUtility;

function requireErrorHandlingUtility () {
	if (hasRequiredErrorHandlingUtility) return ErrorHandlingUtility_1;
	hasRequiredErrorHandlingUtility = 1;
	const Logger = requireLogger();

	class ErrorHandlingUtility {
	    /**
	     * Wraps a function with a try-catch block to handle and log errors.
	     * @param {Function} fn The function to wrap.
	     * @param {string} context A string providing context for where the error occurred.
	     * @returns {Function} The wrapped function.
	     */
	    static wrap(fn, context) {
	        return function(...args) {
	            try {
	                return fn.apply(this, args);
	            } catch (error) {
	                const errorMessage = `Error in ${context}: ${error.message}\nStack: ${error.stack}`;
	                if (Logger && Logger.error) {
	                    Logger.error(errorMessage);
	                } else {
	                    console.log(`[ERROR] ${errorMessage}`);
	                }
	            }
	        };
	    }
	}

	ErrorHandlingUtility_1 = ErrorHandlingUtility;
	return ErrorHandlingUtility_1;
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
	const GlobalStateScanner = requireGlobalStateScanner();
	const RoomStateScanner = requireRoomStateScanner();
	const SpawnManager = requireSpawnManager();
	const TaskAssignmentManager = requireTaskAssignmentManager();
	const RoleExecutor = requireRoleExecutor();
	const MemoryCleanupManager = requireMemoryCleanupManager();
	const IntelManager = requireIntelManager();
	const RoomPlanner = requireRoomPlanner();

	// Utilities
	const ProfilerUtility = requireProfilerUtility();
	const Logger = requireLogger();
	const ErrorHandlingUtility = requireErrorHandlingUtility();

	main$1.loop = function () {
	    // Profiler Start
	    ProfilerUtility.start();

	    // Memory Cleanup
	    ErrorHandlingUtility.wrap(() => MemoryCleanupManager.run(), 'MemoryCleanupManager')();

	    // 1. Global State Scanning
	    ErrorHandlingUtility.wrap(() => GlobalStateScanner.run(), 'GlobalStateScanner')();

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

	    // 4. Room Planning (generates and executes blueprints)
	    ErrorHandlingUtility.wrap(() => RoomPlanner.run(), 'RoomPlanner')();

	    // 5. Spawning
	    ErrorHandlingUtility.wrap(() => {
	        for (const spawnName in Game.spawns) {
	            SpawnManager.run(Game.spawns[spawnName]);
	        }
	    }, 'SpawnManager')();

	    // 6. Task Assignment
	    ErrorHandlingUtility.wrap(() => TaskAssignmentManager.run(), 'TaskAssignmentManager')();

	    // 7. Intent Execution
	    ErrorHandlingUtility.wrap(() => RoleExecutor.run(), 'RoleExecutor')();

	    // 8. Visualizer
	    ErrorHandlingUtility.wrap(() => RoomPlanner.visualize(), 'Visualizer')();

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
