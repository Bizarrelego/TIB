/**
 * @file CreepAssignmentManager.js
 * @description Manager module for generating prioritized tasks and assigning them to creeps using top-down logic.
 */

const AssignmentUtility = require('../utils/AssignmentUtility');
const TrafficManager = require('../traffic/trafficManager');

module.exports = {
    /**
     * Executes the task assignment logic for a specific room.
     * Generates a prioritized list of tasks (fill, repair, build, upgrade)
     * and delegates assignment of idle creeps to AssignmentUtility.
     * @param {Room} room - The room context.
     */
    run(room) {
        if (!room || !global.State || !global.State.creepsByRoom) return;

        const roomCreepsMap = global.State.creepsByRoom.get(room.name);
        if (!roomCreepsMap) return;

        // Collect potentially idle creeps (workers, haulers, etc)
        // Adjust this list based on which roles require dynamic task assignment.
        // For simplicity, we can fetch all workers.
        const workers = roomCreepsMap.get('worker');
        if (!workers || workers.length === 0) return;

        const idleWorkers = [];
        for (let i = 0; i < workers.length; i++) {
            const creep = workers[i];
            if (!creep.heap) creep.heap = {};
            if (!creep.heap.state || !creep.heap.targetId) {
                idleWorkers.push(creep);
            }
        }

        if (idleWorkers.length === 0) return;

        const tasks = [];

        const structures = global.State.structuresByRoom.get(room.name);
        if (structures) {
            const spawnsMap = structures.get(STRUCTURE_SPAWN);
            if (spawnsMap) {
                for (const spawn of spawnsMap.values()) {
                    const free = TrafficManager.getVirtualState(spawn, RESOURCE_ENERGY).free;
                    if (free > 0) {
                        tasks.push({ target: spawn, type: 'fill', priority: 100, free });
                    }
                }
            }

            const extensionsMap = structures.get(STRUCTURE_EXTENSION);
            if (extensionsMap) {
                for (const extension of extensionsMap.values()) {
                    const free = TrafficManager.getVirtualState(extension, RESOURCE_ENERGY).free;
                    if (free > 0) {
                        tasks.push({ target: extension, type: 'fill', priority: 90, free });
                    }
                }
            }

            const rampartsMap = structures.get(STRUCTURE_RAMPART);
            if (rampartsMap) {
                for (const rampart of rampartsMap.values()) {
                    if (rampart.hits < 5000) {
                        tasks.push({ target: rampart, type: 'repair', priority: 70 });
                    }
                }
            }
        }

        const sitesMap = global.State.sitesByRoom.get(room.name);
        if (sitesMap) {
            const sitesIter = sitesMap instanceof Map ? sitesMap.values() : sitesMap;
            for (const site of sitesIter) {
                tasks.push({ target: site, type: 'build', priority: 80 });
            }
        }

        if (room.controller && room.controller.my) {
            tasks.push({ target: room.controller, type: 'upgrade', priority: 10 });
        }

        tasks.sort((a, b) => b.priority - a.priority);

        // Assign tasks using O(1) top-down assignment logic
        AssignmentUtility.assignTasks(idleWorkers, tasks);
    }
};
