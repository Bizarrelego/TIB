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
            const spawns = spawnsMap ? Array.from(spawnsMap.values()) : [];
            for (let i = 0; i < spawns.length; i++) {
                const free = TrafficManager.getVirtualState(spawns[i], RESOURCE_ENERGY).free;
                if (free > 0) {
                    tasks.push({ target: spawns[i], type: 'fill', priority: 100, free });
                }
            }

            const extensionsMap = structures.get(STRUCTURE_EXTENSION);
            const extensions = extensionsMap ? Array.from(extensionsMap.values()) : [];
            for (let i = 0; i < extensions.length; i++) {
                const free = TrafficManager.getVirtualState(extensions[i], RESOURCE_ENERGY).free;
                if (free > 0) {
                    tasks.push({ target: extensions[i], type: 'fill', priority: 90, free });
                }
            }

            const rampartsMap = structures.get(STRUCTURE_RAMPART);
            const ramparts = rampartsMap ? Array.from(rampartsMap.values()) : [];
            for (let i = 0; i < ramparts.length; i++) {
                if (ramparts[i].hits < 5000) {
                    tasks.push({ target: ramparts[i], type: 'repair', priority: 70 });
                }
            }
        }

        const sitesMap = global.State.sitesByRoom.get(room.name);
        const sites = sitesMap ? (sitesMap instanceof Map ? Array.from(sitesMap.values()) : sitesMap) : [];
        for (let i = 0; i < sites.length; i++) {
            tasks.push({ target: sites[i], type: 'build', priority: 80 });
        }

        if (room.controller && room.controller.my) {
            tasks.push({ target: room.controller, type: 'upgrade', priority: 10 });
        }

        tasks.sort((a, b) => b.priority - a.priority);

        // Assign tasks using O(1) top-down assignment logic
        AssignmentUtility.assignTasks(idleWorkers, tasks);
    }
};
