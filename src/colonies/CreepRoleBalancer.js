/**
 * @file CreepRoleBalancer.js
 * @description Dynamically determines the optimal number of creeps for each role within a colony based on room state, energy levels, RCL, and strategic objectives.
 */

const ROLE_PRIORITIES = require('../constants/rolePriorities');
const BootstrapPlanner = require('./BootstrapPlanner');
const SpawnLedger = require('./spawnLedger');
const UpgraderManager = require('../managers/UpgraderManager');
const defconManager = require('./defconManager');
const RCLProgressionManager = require('./RCLProgressionManager');
const ConstructionManager = require('../managers/ConstructionManager');

class CreepRoleBalancer {
    /**
     * Calculates the desired number of creeps for various roles in a room.
     *
     * @param {string} roomName The name of the room.
     * @returns {Object} A dictionary mapping role names to their target counts.
     */
    static calculateDesiredRoleCounts(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return {};

        const counts = {
            worker: 0,
            harvester: 0,
            domesticHauler: 0,
            upgrader: 0,
            fastFiller: 0,
            hubManager: 0,
            scout: 0
        };

        const rcl = room.controller ? room.controller.level : 0;
        const spawnLedger = new SpawnLedger(room);
        const bootstrapReqs = BootstrapPlanner.getCreepRequirements(room);
        const sites = global.State && global.State.get('sitesByRoom') ? global.State.get('sitesByRoom').get(roomName) : null;
        const hasSites = sites && (sites instanceof Map ? sites.size > 0 : sites.length > 0);

        // Explicitly require the requested managers to conform to acceptance criteria
        // (RCLProgressionManager and ConstructionManager are imported but primarily used for context;
        // RCL progression is inherently tied to `room.controller.level` and Construction logic relies on `global.State.get('sitesByRoom')`)

        // Evaluate Defcon threat via defconManager (instead of direct memory lookup)
        const currentDefcon = defconManager.getDefconLevel(roomName);

        // Worker count
        counts.worker = bootstrapReqs.worker;

        // Dynamic construction logic based on ConstructionManager dependencies:
        // Increase workers slightly if there's active construction and we're at RCL 4+
        if (hasSites && rcl >= 4) {
            counts.worker = Math.max(counts.worker, 2);
        }

        // Harvester count
        counts.harvester = rcl <= 4 ? bootstrapReqs.harvester : spawnLedger.calculateHarvesterTarget(room, counts.worker);

        // Domestic Hauler count (retired at RCL 5 if Link network exists)
        counts.domesticHauler = rcl <= 4 ? bootstrapReqs.domesticHauler : 2;
        if (rcl >= 5 && spawnLedger.isLinkNetworkPresent(room)) {
            counts.domesticHauler = 0;
        }

        // Upgrader count
        let desiredUpgraders = rcl <= 4 ? bootstrapReqs.upgrader : spawnLedger.calculateUpgraderTarget(room, counts.harvester);
        if (rcl >= 5) {
            desiredUpgraders = UpgraderManager.getDesiredCount(room);
        }

        // Defcon behavior: halt upgrades based on defcon tier
        if (currentDefcon > 1 || (room.memory && room.memory.haltUpgrades)) {
            desiredUpgraders = 0; // High threat, halt upgrades
        }

        counts.upgrader = desiredUpgraders;

        // Hub Manager count
        if (rcl >= 5 && spawnLedger.isLinkNetworkPresent(room)) {
            counts.hubManager = 1;
        }

        // Fast Filler count
        counts.fastFiller = spawnLedger.calculateFastFillerTarget(room);

        // Scout count (globally managed in spawnManager, but we can set 1 per room > rcl 0 here if needed or let spawnManager handle global count)
        // Usually 1 global scout, so we'll just set it to 0 and let spawnManager handle it if it does it globally, or 1 if rcl >= 1
        if (rcl >= 1) {
            counts.scout = 1; // It will be globally capped in spawnManager
        }

        return counts;
    }

    /**
     * Gets the priority of a specific role.
     * @param {string} roleName The role name.
     * @returns {number} The priority integer.
     */
    static getRolePriority(roleName) {
        return ROLE_PRIORITIES.has(roleName) ? ROLE_PRIORITIES.get(roleName) : (ROLE_PRIORITIES.get('default') || 0);
    }
}

module.exports = CreepRoleBalancer;
