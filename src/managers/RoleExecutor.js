/**
 * Top-Down Role Executor
 * Processes intent execution based on static Task IDs.
 * Replaces redundant role-specific files.
 */
const TaskAssignmentManager = require('./TaskAssignmentManager');

class RoleExecutor {
    static run() {
        const creepNames = Object.keys(Game.creeps);
        
        // Tight loop: No dynamic requires, no array allocations.
        for (let i = 0; i < creepNames.length; i++) {
            const creep = Game.creeps[creepNames[i]];
            
            if (creep.spawning) continue;

            const taskId = creep.memory.taskId;
            const targetId = creep.memory.targetId;

            // Skip creeps that have not been assigned a valid target or task
            if (!targetId || !taskId || taskId === TaskAssignmentManager.TASKS.IDLE) {
                continue;
            }

            const target = Game.getObjectById(targetId);
            if (!target) {
                // If target disappeared between assignment and execution, clear it.
                creep.memory.targetId = null;
                continue;
            }

            this.executeTask(creep, target, taskId);
        }
    }

    /**
     * Executes the specific engine intent.
     * @param {Creep} creep 
     * @param {Object} target 
     * @param {number} taskId 
     */
    static executeTask(creep, target, taskId) {
        let result;

        // O(1) State switch. Maps directly to engine C++ bindings.
        switch (taskId) {
            case TaskAssignmentManager.TASKS.HARVEST:
                result = creep.harvest(target);
                break;
            case TaskAssignmentManager.TASKS.PICKUP:
                result = creep.pickup(target);
                break;
            case TaskAssignmentManager.TASKS.TRANSFER:
                result = creep.transfer(target, RESOURCE_ENERGY);
                break;
            case TaskAssignmentManager.TASKS.UPGRADE:
                result = creep.upgradeController(target);
                break;
            case TaskAssignmentManager.TASKS.WITHDRAW:
                result = creep.withdraw(target, RESOURCE_ENERGY);
                break;
            default:
                creep.memory.targetId = null;
                return;
        }

        // Handle pathfinding and invalidation universally
        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        } else if (
            result === ERR_NOT_ENOUGH_RESOURCES || 
            result === ERR_FULL || 
            result === ERR_INVALID_TARGET
        ) {
            // Target is invalid for this intent. Destroy the ID so TaskAssignmentManager 
            // routes the creep to a new target on the next tick.
            creep.memory.targetId = null;
        }
    }
}

module.exports = RoleExecutor;