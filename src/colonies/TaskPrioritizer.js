/**
 * @file TaskPrioritizer.js
 * @description Generates a dynamically prioritized list of tasks for creeps based on real-time room conditions.
 */

const TrafficManager = require('../traffic/trafficManager');

class TaskPrioritizer {
    /**
     * Gets prioritized tasks for a given room.
     * @param {Room} room - The room object.
     * @returns {Array<Object>} A sorted array of task objects: { target, type, priority, free? }
     */
    static getPrioritizedTasks(room) {
        if (!room || !global.State || !global.State.structuresByRoom) return [];

        const tasks = [];
        const structures = global.State.structuresByRoom.get(room.name);
        const sitesMap = global.State.sitesByRoom.get(room.name);

        const defconLevel = room.memory && room.memory.defcon ? room.memory.defcon : 1;
        const energyCrisis = room.energyAvailable < room.energyCapacityAvailable * 0.5;

        // Threat adjustments
        const repairPriorityBoost = defconLevel > 1 ? 50 : 0;
        const fillPriorityBoost = energyCrisis ? 20 : 0;

        if (structures) {
            const spawnsMap = structures.get(STRUCTURE_SPAWN);
            if (spawnsMap) {
                for (const spawn of spawnsMap.values()) {
                    const free = TrafficManager.getVirtualState(spawn, RESOURCE_ENERGY).free;
                    if (free > 0) {
                        tasks.push({ target: spawn, type: 'fill', priority: 100 + fillPriorityBoost, free });
                    }
                }
            }

            const extensionsMap = structures.get(STRUCTURE_EXTENSION);
            if (extensionsMap) {
                for (const extension of extensionsMap.values()) {
                    const free = TrafficManager.getVirtualState(extension, RESOURCE_ENERGY).free;
                    if (free > 0) {
                        tasks.push({ target: extension, type: 'fill', priority: 90 + fillPriorityBoost, free });
                    }
                }
            }

            const rampartsMap = structures.get(STRUCTURE_RAMPART);
            if (rampartsMap) {
                for (const rampart of rampartsMap.values()) {
                    // Under high threat, boost rampart repair priority significantly if HP is low
                    if (rampart.hits < 50000 && defconLevel > 1) {
                        tasks.push({ target: rampart, type: 'repair', priority: 70 + repairPriorityBoost });
                    } else if (rampart.hits < 5000) {
                        tasks.push({ target: rampart, type: 'repair', priority: 70 });
                    }
                }
            }
        }

        if (sitesMap) {
            const sitesIter = sitesMap instanceof Map ? sitesMap.values() : sitesMap;
            for (const site of sitesIter) {
                let buildPriority = 80;
                // Boost priority for critical structures
                if (site.structureType === STRUCTURE_SPAWN || site.structureType === STRUCTURE_TOWER) {
                    buildPriority = 95;
                }
                tasks.push({ target: site, type: 'build', priority: buildPriority });
            }
        }

        if (room.controller && room.controller.my) {
            // Lower upgrade priority if there's an energy crisis or under attack
            let upgradePriority = 10;
            if (defconLevel > 1 || energyCrisis) {
                upgradePriority = 0;
            }
            tasks.push({ target: room.controller, type: 'upgrade', priority: upgradePriority });
        }

        tasks.sort((a, b) => b.priority - a.priority);

        return tasks;
    }
}

module.exports = TaskPrioritizer;
