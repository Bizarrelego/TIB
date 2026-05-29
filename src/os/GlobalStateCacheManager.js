const eventBus = require('./eventBus');
const roomHasher = require('./roomHasher');
const Logger = require('../utils/logger');
const {
    EVENT_STRUCTURE_DECAY,
    EVENT_CONSTRUCTION_STARTED,
    EVENT_CREEP_DEATH
} = require('../constants/eventTypes');

/**
 * Manages the lifecycle and invalidation of cached global state data.
 */
class GlobalStateCacheManager {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initializes the manager by subscribing to relevant events.
     */
    init() {
        if (this.initialized) return;

        eventBus.subscribe(EVENT_STRUCTURE_DECAY, this.handleStructureDecay.bind(this));
        eventBus.subscribe(EVENT_CONSTRUCTION_STARTED, this.handleConstructionStarted.bind(this));
        eventBus.subscribe(EVENT_CREEP_DEATH, this.handleCreepDeath.bind(this));
        // Note: EVENT_INVALIDATE_COSTMATRIX is already handled somewhat by cache.js, but we can manage stationary positions here if needed

        this.initialized = true;
        Logger.debug('[GlobalStateCacheManager] Initialized event subscriptions.');
    }

    /**
     * Handles structure decay/destruction to invalidate state caches.
     * @param {Object} payload - The event payload.
     */
    handleStructureDecay(payload) {
        const { roomName, event } = payload;
        const objectId = event.objectId;

        if (!objectId || !global.State) return;

        // Remove from structures map
        if (global.State.structures && global.State.structures.has(objectId)) {
            const structure = global.State.structures.get(objectId);
            const structureType = structure.structureType;
            global.State.structures.delete(objectId);

            // Remove from structuresByRoom
            if (global.State.structuresByRoom && global.State.structuresByRoom.has(roomName)) {
                const roomStructures = global.State.structuresByRoom.get(roomName);
                if (roomStructures.has(structureType)) {
                    roomStructures.get(structureType).delete(objectId);
                }
            }

            // Remove from structuresByType
            if (global.State.structuresByType && global.State.structuresByType.has(structureType)) {
                global.State.structuresByType.get(structureType).delete(objectId);
            }

            // Invalidate stationary positions since a structure changed
            if (global.State.stationaryPositions && global.State.stationaryPositions.has(roomName)) {
                global.State.stationaryPositions.delete(roomName);
            }
        }
    }

    /**
     * Handles new construction sites to invalidate state caches.
     * @param {Object} payload - The event payload.
     */
    handleConstructionStarted(payload) {
        const { roomName } = payload;

        if (!global.State) return;

        // Invalidate stationary positions
        if (global.State.stationaryPositions && global.State.stationaryPositions.has(roomName)) {
            global.State.stationaryPositions.delete(roomName);
        }
    }

    /**
     * Handles creep death to invalidate state caches.
     * @param {Object} payload - The event payload.
     */
    handleCreepDeath(payload) {
        const { roomName, event } = payload;
        const creepId = event.objectId;

        if (!creepId || !global.State) return;

        if (global.State.creepsById && global.State.creepsById.has(creepId)) {
            const creep = global.State.creepsById.get(creepId);
            const creepName = creep.name;
            global.State.creepsById.delete(creepId);

            if (global.State.creeps && global.State.creeps.has(creepName)) {
                 global.State.creeps.delete(creepName);
            }

            if (global.State.creepLookup && global.State.creepLookup.has(creepName)) {
                 global.State.creepLookup.delete(creepName);
            }

            // Role and room maps are rebuilt every tick by GlobalStatePopulator, so no strict need to clean here unless needed mid-tick.
        }
    }

    /**
     * Checks if the room hash has changed and invalidates cache if so.
     * @param {string} roomName - The name of the room.
     */
    checkRoomHash(roomName) {
        if (!global.Cache) {
            global.Cache = new Map();
        }
        if (!global.Cache.has('roomHashes')) {
            global.Cache.set('roomHashes', new Map());
        }
        if (!global.Cache.has('costMatrices')) {
            global.Cache.set('costMatrices', new Map());
        }

        if (global.State && !global.State.roomHashes) {
            global.State.roomHashes = new Map();
        }

        const roomHashes = global.Cache.get('roomHashes');
        const costMatrices = global.Cache.get('costMatrices');

        const currentHash = roomHasher.generate(roomName);
        const previousHash = roomHashes.get(roomName);

        if (currentHash !== previousHash) {
            // Hash changed, invalidate the cached cost matrix for this room
            roomHashes.set(roomName, currentHash);

            if (global.State && global.State.roomHashes) {
                global.State.roomHashes.set(roomName, currentHash);
            }

            costMatrices.delete(roomName);

            if (global.State && global.State.costMatrices) {
                global.State.costMatrices.delete(roomName);
            }

            if (global.State && global.State.stationaryPositions) {
                global.State.stationaryPositions.delete(roomName);
            }

            Logger.debug(`[GlobalStateCacheManager] Room hash changed for ${roomName}. Invalidated CostMatrix and StationaryPositions.`);
        }
    }

    /**
     * Runs the cache manager tick logic.
     */
    run() {
        if (!global.State || !global.State.rooms) return;

        for (const roomName of global.State.rooms.keys()) {
            this.checkRoomHash(roomName);
        }
    }
}

const globalStateCacheManager = new GlobalStateCacheManager();
module.exports = globalStateCacheManager;
