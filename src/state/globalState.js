const globalStatePopulator = require('./GlobalStatePopulator');
class GlobalStateManager {
    constructor() {
        /** @type {Map<string, any>} */
        this.heapCache = new Map();
        /** @type {boolean} */
        this.isRehydrated = false;
        /** @type {Map<string, any>} */
        this.managers = new Map();
        /** @type {Map<string, Array<Creep>>} */
        this.creepsByRole = new Map();
        /** @type {Map<string, Map<string, Array<Creep>>>} */
        this.creepsByRoom = new Map();
        /** @type {Map<string, Map<string, Map<string, Structure>>>} */
        this.structuresByRoom = new Map();
        /** @type {Map<string, Map<string, Creep>>} */
        this.hostilesByRoom = new Map();
        /** @type {Map<string, Map<string, any>>} */
        this.logisticsByRoom = new Map();
        /** @type {Map<string, Creep>} */
        this.creepLookup = new Map();
        /** @type {Map<string, Map<string, Source>>} */
        this.sourcesByRoom = new Map();
        /** @type {Map<string, Map<string, StructureSpawn>>} */
        this.spawnsByRoom = new Map();
        /** @type {Map<string, StructureController>} */
        this.controllersByRoom = new Map();
        /** @type {Map<string, Map<string, ConstructionSite>>} */
        this.sitesByRoom = new Map();
        /** @type {Map<string, Map<string, Mineral>>} */
        this.mineralsByRoom = new Map();
        /** @type {Map<string, Room>} */
        this.rooms = new Map();
        /** @type {Map<string, Creep>} */
        this.creeps = new Map();
        /** @type {Map<string, Structure>} */
        this.structures = new Map();
        /** @type {string} */
        this.aggressionState = 'Growth';
        /** @type {Map<string, any>} */
        this.sourceAssignments = new Map();
        /** @type {Map<string, any>} */
        this.miningSpotsByRoom = new Map();

        // New properties for optimized global state populator
        /** @type {Map<string, Creep>} */
        this.creepsById = new Map();
        /** @type {Map<string, Map<string, Structure>>} */
        this.structuresByType = new Map();
        /** @type {Map<string, Flag>} */
        this.flags = new Map();
        /** @type {Map<string, Map<string, Flag>>} */
        this.flagsByRoom = new Map();
        /** @type {Map<string, Resource>} */
        this.resources = new Map();
        /** @type {Map<string, ConstructionSite>} */
        this.constructionSites = new Map();
        /** @type {Map<string, Map<string, ConstructionSite>>} */
        this.constructionSitesByType = new Map();
        /** @type {Map<string, StructureSpawn>} */
        this.spawns = new Map();
        /** @type {Map<string, any>} */
        this.structureStates = new Map();
    }

    registerManager(name, instance) {
        this.managers.set(name, instance);
    }

    getManager(name) {
        return this.managers.get(name);
    }

    getStructureState(targetId) {
        const tracker = require('../os/StructureStateTracker');
        return tracker.getState(targetId);
    }

    rehydrate() {
        if (this.isRehydrated) return;

        if (typeof RawMemory !== 'undefined' && RawMemory.segments) {
            for (const segmentId in RawMemory.segments) {
                const segmentData = RawMemory.segments[segmentId];
                if (segmentData) {
                    try {
                        const parsed = JSON.parse(segmentData);
                        if (typeof parsed === 'object' && parsed !== null) {
                            for (const key in parsed) {
                                this.heapCache.set(key, parsed[key]);
                            }
                        }
                    } catch (e) {
                        this.heapCache.set(`segment_${segmentId}`, segmentData);
                    }
                }
            }
        }

        // IMPROVEMENT: Guarantee heap object initialization via proxy for all creeps.
        // Reason: Prevents undefined reading in DeadlockEngine and TrafficManager if a creep's heap hasn't been accessed yet this tick.
        if (typeof Game !== 'undefined' && Game.creeps) {
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep) {
                    // Just accessing the property triggers the getter in memoryProxy.js
                    // which sets up the object in the cache registry if it doesn't exist.
                    // eslint-disable-next-line no-unused-expressions
                    creep.heap;
                }
            }
        }

        this.isRehydrated = true;
    }

    read(key) {
        return this.heapCache.get(key);
    }

    write(key, data) {
        this.heapCache.set(key, data);
    }

    get(key) {
        return this.heapCache.get(key);
    }

    set(key, value) {
        this.heapCache.set(key, value);
    }

    has(key) {
        return this.heapCache.has(key);
    }

    delete(key) {
        this.heapCache.delete(key);
    }

    scan() {
        // Tick slicing state scanner entry point
    }

    update() {
        globalStatePopulator.populate(this);
    }

    clear() {
        this.heapCache.clear();
        this.managers.clear();
        this.creepsByRole.clear();
        this.creepsByRoom.clear();
        this.structuresByRoom.clear();
        this.hostilesByRoom.clear();
        this.logisticsByRoom.clear();
        this.creepLookup.clear();
        this.sourcesByRoom.clear();
        this.spawnsByRoom.clear();
        this.controllersByRoom.clear();
        this.sitesByRoom.clear();
        this.mineralsByRoom.clear();
        this.aggressionState = 'Growth';
        this.sourceAssignments.clear();
        this.miningSpotsByRoom.clear();

        if (this.scannedRooms) this.scannedRooms.clear();
        if (this.rooms) this.rooms.clear();
        if (this.creeps) this.creeps.clear();
        if (this.structures) this.structures.clear();
        if (this.eventCache) this.eventCache.clear();

        this.creepsById.clear();
        this.structuresByType.clear();
        this.flags.clear();
        this.flagsByRoom.clear();
        this.resources.clear();
        this.constructionSites.clear();
        this.constructionSitesByType.clear();
        this.spawns.clear();
        if (this.structureStates) this.structureStates.clear();

        this.isRehydrated = false;
    }
}

module.exports = new GlobalStateManager();
