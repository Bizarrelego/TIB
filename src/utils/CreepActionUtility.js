const TaskAssignmentManager = require('../managers/TaskAssignmentManager');

class CreepActionUtility {
    static executeAction(creep) {
        try {
            const roleModule = require('../roles/' + creep.memory.role);
            roleModule.run(creep);
        } catch (e) {
            // Role module not found or failed, fall back to legacy task execution
            const taskId = creep.memory.taskId;
            if (!taskId || taskId === TaskAssignmentManager.TASKS.IDLE) {
                return;
            }

            if (taskId === TaskAssignmentManager.TASKS.SCOUT || taskId === TaskAssignmentManager.TASKS.MOVE_ROOM) {
                CreepActionUtility.executeCrossRoomTask(creep);
                return;
            }

            const targetId = creep.memory.targetId;
            const target = Game.getObjectById(targetId);

            if (!target) {
                if (creep.room.name === creep.memory.targetRoom) {
                    creep.memory.targetId = null;
                }
                return;
            }

            CreepActionUtility.executeTask(creep, target, taskId);
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

    static executeCrossRoomTask(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            creep.memory.taskId = TaskAssignmentManager.TASKS.IDLE;
            return;
        }

        if (creep.room.name !== targetRoom) {
            creep.moveTo(new RoomPosition(25, 25, targetRoom), { range: 22, visualizePathStyle: { stroke: '#00ff00' } });
        } else {
             creep.memory.taskId = TaskAssignmentManager.TASKS.IDLE;
        }
    }
}

module.exports = CreepActionUtility;
