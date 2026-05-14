/* global STRUCTURE_FACTORY */
/**
 * @file EnergyRequestManager.js
 * @description Scans the room, identifies all structures needing energy (requests) and sources of energy (supplies),
 * and prioritizes them for top-down task assignments to haulers.
 */

const resourceUtils = require('../utils/resourceUtils');

class EnergyRequestManager {
    /**
     * Identifies and prioritizes structures that need energy in the room.
     * Higher priority number means more urgent.
     * @param {string} roomName - The name of the room.
     * @returns {Array<{target: Structure, priority: number, amount: number}>} Prioritized list of energy requests.
     */
    static getEnergyRequests(roomName) {
        const requests = [];

        const spawns = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_SPAWN]);
        const extensions = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_EXTENSION]);
        const towers = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_TOWER]);
        const labs = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_LAB]);
        const storage = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_STORAGE]);
        const terminal = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_TERMINAL]);
        const factory = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_FACTORY]);
        const powerSpawn = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_POWER_SPAWN]);

        // Priority 100: Spawns and Extensions
        for (let i = 0; i < spawns.length; i++) {
            requests.push({ target: spawns[i], priority: 100, amount: spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }
        for (let i = 0; i < extensions.length; i++) {
            requests.push({ target: extensions[i], priority: 100, amount: extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }

        // Priority 80: Towers (especially if empty)
        for (let i = 0; i < towers.length; i++) {
            const tower = towers[i];
            const free = tower.store.getFreeCapacity(RESOURCE_ENERGY);
            const priority = free > 500 ? 90 : 80;
            requests.push({ target: tower, priority: priority, amount: free });
        }

        // Priority 60: Labs
        for (let i = 0; i < labs.length; i++) {
            requests.push({ target: labs[i], priority: 60, amount: labs[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }

        // Priority 50: Power Spawn
        for (let i = 0; i < powerSpawn.length; i++) {
            requests.push({ target: powerSpawn[i], priority: 50, amount: powerSpawn[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }

        // Priority 40: Factory
        for (let i = 0; i < factory.length; i++) {
            if (factory[i].store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
                requests.push({ target: factory[i], priority: 40, amount: Math.min(10000 - factory[i].store.getUsedCapacity(RESOURCE_ENERGY), factory[i].store.getFreeCapacity(RESOURCE_ENERGY)) });
            }
        }

        // Priority 20: Terminal (up to 50k)
        for (let i = 0; i < terminal.length; i++) {
            const term = terminal[i];
            const energy = term.store.getUsedCapacity(RESOURCE_ENERGY);
            if (energy < 50000) {
                requests.push({ target: term, priority: 20, amount: 50000 - energy });
            }
        }

        // Priority 10: Storage
        for (let i = 0; i < storage.length; i++) {
            requests.push({ target: storage[i], priority: 10, amount: storage[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }

        // Sort requests by priority (descending)
        requests.sort((a, b) => b.priority - a.priority);

        return requests;
    }

    /**
     * Identifies and prioritizes energy sources in the room.
     * Higher priority number means it should be picked up first.
     * @param {string} roomName - The name of the room.
     * @returns {Array<{target: Resource|Structure|Tombstone|Ruin, priority: number, amount: number}>} Prioritized list of energy supplies.
     */
    static getEnergySupplies(roomName) {
        const supplies = [];

        // Dropped Energy
        let dropped = [];
        if (global.State.droppedEnergyByRoom && global.State.droppedEnergyByRoom.has(roomName)) {
            dropped = global.State.droppedEnergyByRoom.get(roomName) || [];
        } else if (global.State.droppedByRoom && global.State.droppedByRoom.has(roomName)) {
            dropped = global.State.droppedByRoom.get(roomName) || [];
        }

        for (let i = 0; i < dropped.length; i++) {
            const resource = dropped[i];
            if ((resource.resourceType === undefined || resource.resourceType === RESOURCE_ENERGY) && resource.amount > 50) {
                // Priority 100: Large dropped energy piles
                const priority = resource.amount > 500 ? 100 : 80;
                supplies.push({ target: resource, priority: priority, amount: resource.amount });
            }
        }

        // Tombstones
        const tombstones = (global.State.tombstonesByRoom && global.State.tombstonesByRoom.get(roomName)) || [];
        for (let i = 0; i < tombstones.length; i++) {
            const tombstone = tombstones[i];
            if (tombstone.store) {
                const amount = tombstone.store.getUsedCapacity(RESOURCE_ENERGY);
                if (amount > 0) {
                    supplies.push({ target: tombstone, priority: 90, amount: amount });
                }
            }
        }

        // Ruins
        const ruins = (global.State.ruinsByRoom && global.State.ruinsByRoom.get(roomName)) || [];
        for (let i = 0; i < ruins.length; i++) {
            const ruin = ruins[i];
            if (ruin.store) {
                const amount = ruin.store.getUsedCapacity(RESOURCE_ENERGY);
                if (amount > 0) {
                    supplies.push({ target: ruin, priority: 90, amount: amount });
                }
            }
        }

        // Containers
        const containers = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_CONTAINER]);
        for (let i = 0; i < containers.length; i++) {
            const container = containers[i];
            const amount = container.store.getUsedCapacity(RESOURCE_ENERGY);
            // Priority 70: Full containers
            const priority = amount > 1500 ? 75 : 70;
            supplies.push({ target: container, priority: priority, amount: amount });
        }

        // Links (only withdraw from non-hub links if needed, though usually haulers don't withdraw from hub links directly unless acting as hubManager)
        // Usually haulers shouldn't empty links, that's up to hubManager or dedicated link management, but we'll include it at low priority
        const links = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_LINK]);
        for (let i = 0; i < links.length; i++) {
             // Let's deprioritize links for general haulers to avoid conflicts with hubManager/upgrader link logic
            const link = links[i];
            const amount = link.store.getUsedCapacity(RESOURCE_ENERGY);
            supplies.push({ target: link, priority: 30, amount: amount });
        }

        // Terminal (if it has excess energy, we can use it)
        const terminal = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_TERMINAL]);
        for (let i = 0; i < terminal.length; i++) {
            const term = terminal[i];
            const energy = term.store.getUsedCapacity(RESOURCE_ENERGY);
            if (energy > 55000) {
                supplies.push({ target: term, priority: 20, amount: energy - 50000 });
            }
        }

        // Storage (always available as a low priority source if nothing else is)
        const storage = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_STORAGE]);
        for (let i = 0; i < storage.length; i++) {
            const store = storage[i];
            const amount = store.store.getUsedCapacity(RESOURCE_ENERGY);
            supplies.push({ target: store, priority: 10, amount: amount });
        }

        // Sort supplies by priority (descending)
        supplies.sort((a, b) => b.priority - a.priority);

        return supplies;
    }
}

module.exports = EnergyRequestManager;
