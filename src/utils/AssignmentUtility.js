/**
 * @file AssignmentUtility.js
 * @description Utility for assignments.
 */

const { wrapManager } = require('../utils/ManagerErrorBoundary');

/**
 * Runs assignment utility logic.
 */
function run() {
    // Assignment utility logic
}

/**
 * Assigns creeps to tasks using O(1) top-down assignment.
 * Creeps do not bid or scan for jobs.
 * @param {Array<Creep>} creeps - The list of idle creeps to assign.
 * @param {Array<Object>} tasks - A prioritized array of task objects { target, type, priority, ... }.
 */
function assignTasks(creeps, tasks) {
    if (!creeps || creeps.length === 0 || !tasks || tasks.length === 0) return;

    for (let i = 0; i < creeps.length; i++) {
        const creep = creeps[i];

        // Skip if creep already has a task
        if (creep.heap.state && creep.heap.targetId) continue;

        // Find the highest priority valid task
        for (let j = 0; j < tasks.length; j++) {
            const task = tasks[j];
            if (task && task.target) {
                creep.heap.state = task.type;
                creep.heap.targetId = task.target.id;

                // Track task capacity to prevent flocking
                if (task.free !== undefined) {
                    const carrying = creep.store ? creep.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
                    const contribution = carrying > 0 ? carrying : (creep.store ? creep.store.getCapacity() : 50);
                    task.free -= contribution;
                    if (task.free <= 0) {
                        tasks.splice(j, 1);
                    }
                }

                break;
            }
        }
    }
}

module.exports = {
    run: wrapManager(run, 'AssignmentUtility'),
    assignTasks
};
