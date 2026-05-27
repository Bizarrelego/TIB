/**
 * @file SourceManager.js
 * @description Centralized source management module responsible for tracking source regeneration,
 * calculating optimal mining positions, managing source sleep states, and providing an API
 * for other managers to query source status and assign harvesters.
 */

const sourceSleep = require('../utils/sourceSleep');
const MiningPlanner = require('../colonies/MiningPlanner');

const SourceManager = {
    /**
     * Initialize source data for a given room.
     * Plugs into MiningPlanner to establish optimal mining spots,
     * and sets up empty source assignments.
     * @param {string} roomName - The name of the room
     */
    init(roomName) {
        if (global.State && !global.State.sourceAssignments) {
            global.State.sourceAssignments = new Map();
        }

        MiningPlanner.planMiningSpots(roomName);
    },

    /**
     * Return the optimal RoomPosition for a harvester for a given source.
     * @param {string} sourceId - The ID of the source.
     * @returns {Object|null} The {x, y} object for optimal position, or null.
     */
    getOptimalMiningSpot(sourceId) {
        if (!global.State || !global.State.miningSpotsByRoom) return null;

        for (const spotsMap of global.State.miningSpotsByRoom.values()) {
            if (spotsMap.has(sourceId)) {
                return spotsMap.get(sourceId);
            }
        }

        return null;
    },

    /**
     * Return true if the source is not in a sleep state.
     * @param {string} sourceId - The ID of the source.
     * @returns {boolean} True if the source is active and not sleeping.
     */
    isSourceActive(sourceId) {
        if (!global.State) return true;

        if (global.State.sourcesCache && global.State.sourcesCache.has(sourceId)) {
            const cache = global.State.sourcesCache.get(sourceId);
            if (cache.has('wakeTick') && typeof Game !== 'undefined' && Game.time < cache.get('wakeTick')) {
                return false;
            }
        }

        // Check if we can get the actual source object
        let targetSource = null;
        if (typeof Game !== 'undefined' && Game.getObjectById) {
            targetSource = Game.getObjectById(sourceId);
        }

        if (targetSource) {
            return !sourceSleep.isSleeping(targetSource);
        }

        return true;
    },

    /**
     * Return a list of active sources with available capacity in the room.
     * Assumes maximum harvesters per source is based on WORK parts or standard 1 per source logic.
     * For now, standardizes on 'available capacity' meaning it doesn't have an assigned harvester.
     * @param {string} roomName - The room name.
     * @returns {Array} List of source objects.
     */
    getAvailableSources(roomName) {
        if (!global.State || !global.State.sourcesByRoom) return [];

        const roomSources = global.State.sourcesByRoom.get(roomName) || [];
        const sourceAssignments = global.State.sourceAssignments || new Map();

        const available = [];
        for (const source of roomSources) {
            if (this.isSourceActive(source.id)) {
                // Determine if it has available capacity (e.g., no harvester assigned)
                const assigned = sourceAssignments.get(source.id) || [];
                // Base simple assumption: 1 harvester per source is typical in some parts of this code.
                // However, early game allows up to 3 WORK parts per source.
                // Since this manages assignment, if there are 0 assigned, it's definitely available.
                if (assigned.length === 0) {
                    available.push(source);
                }
            }
        }

        return available;
    },

    /**
     * Register a harvester to a source.
     * @param {string} sourceId - The source ID.
     * @param {string} creepId - The ID of the harvester creep.
     */
    assignHarvester(sourceId, creepId) {
        if (!global.State) return;

        if (!global.State.sourceAssignments) {
            global.State.sourceAssignments = new Map();
        }

        let assigned = global.State.sourceAssignments.get(sourceId);
        if (!assigned) {
            assigned = [];
            global.State.sourceAssignments.set(sourceId, assigned);
        }

        if (!assigned.includes(creepId)) {
            assigned.push(creepId);
        }

        // Top-Down Assignment: explicitly set the optimal mining spot to the creep's heap
        let creep = null;
        if (global.State.creepLookup) {
            creep = global.State.creepLookup.get(creepId);
        } else if (typeof Game !== 'undefined' && Game.creeps) {
            // Fallback to name search if lookup isn't available
            for (const name in Game.creeps) {
                if (Game.creeps[name].id === creepId) {
                    creep = Game.creeps[name];
                    break;
                }
            }
        }

        if (creep) {
            if (!creep.heap) creep.heap = {};
            const optimalSpot = this.getOptimalMiningSpot(sourceId);
            creep.heap.targetId = sourceId;
            if (optimalSpot && !creep.heap.targetPos) {
                const sourceObj = Game.getObjectById(sourceId);
                const rName = sourceObj ? sourceObj.room.name : creep.pos.roomName;
                creep.heap.targetPos = { x: optimalSpot.x, y: optimalSpot.y, roomName: rName };
            }
        }
        }
    }
};

module.exports = SourceManager;
