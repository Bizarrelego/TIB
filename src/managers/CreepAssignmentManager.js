/**
 * @file CreepAssignmentManager.js
 * @description Manager module for generating prioritized tasks and assigning them to creeps using top-down logic.
 */

const AssignmentUtility = require('../utils/AssignmentUtility');
const TrafficManager = require('../traffic/trafficManager');
const DynamicRoleScheduler = require('../colonies/DynamicRoleScheduler');
const TaskPrioritizer = require('../colonies/TaskPrioritizer');

module.exports = {
    /**
     * Executes the task assignment logic for a specific room.
     * Generates a prioritized list of tasks (fill, repair, build, upgrade)
     * and delegates assignment of idle creeps to AssignmentUtility.
     * @param {Room} room - The room context.
     */
    run(room) {
        if (!room || !global.State || !global.State.creepsByRoom) return;

        // 1. Check for critical situations and shift roles if necessary
        DynamicRoleScheduler.run(room);

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

        // 2. Fetch dynamically prioritized tasks based on room state
        const tasks = TaskPrioritizer.getPrioritizedTasks(room);

        // Assign tasks using O(1) top-down assignment logic
        AssignmentUtility.assignTasks(idleWorkers, tasks);
    }
};
