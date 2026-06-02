/**
 * Top-Down Role Executor
 * Processes intent execution based on static Task IDs.
 */
const TaskAssignmentManager = require('./TaskAssignmentManager');

class RoleExecutor {
    static run() {
        const creepNames = Object.keys(Game.creeps);
        
        for (let i = 0; i < creepNames.length; i++) {
            const creep = Game.creeps[creepNames[i]];
            
            if (creep.spawning) continue;

            const taskId = creep.memory.taskId;
            const targetId = creep.memory.targetId;

            if (!taskId || taskId === TaskAssignmentManager.TASKS.IDLE) {
                continue;
            }

            if (taskId === TaskAssignmentManager.TASKS.SCOUT) {
                RoleExecutor.executeScoutTask(creep);
                continue;
            }

            const target = Game.getObjectById(targetId);
            if (!target) {
                creep.memory.targetId = null;
                continue;
            }

            RoleExecutor.executeTask(creep, target, taskId);
        }
    }

    static executeTask(creep, target, taskId) {
        let result;

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
            case TaskAssignmentManager.TASKS.BUILD:
                result = creep.build(target);
                break;
            case TaskAssignmentManager.TASKS.DROP:
                if (!creep.pos.inRangeTo(target, 3)) {
                    result = ERR_NOT_IN_RANGE;
                } else {
                    result = creep.drop(RESOURCE_ENERGY);
                }
                break;
            default:
                creep.memory.targetId = null;
                return;
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
        } else if (
            result === ERR_NOT_ENOUGH_RESOURCES || 
            result === ERR_FULL || 
            result === ERR_INVALID_TARGET
        ) {
            creep.memory.targetId = null;
        }
    }

    static executeScoutTask(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            creep.memory.taskId = TaskAssignmentManager.TASKS.IDLE;
            return;
        }

        if (creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#00ff00' } });
        }
    }
}

module.exports = RoleExecutor;