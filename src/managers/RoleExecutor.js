/**
 * Top-Down Role Executor
 * Processes intent execution based on static Task IDs.
 */
const TaskAssignmentManager = require('./TaskAssignmentManager');
const CreepFatigueUtility = require('../utils/CreepFatigueUtility');
const CreepHeapUtility = require('../utils/CreepHeapUtility');

class RoleExecutor {
    static run() {
        Object.values(Game.creeps).forEach(creep => {
            if (creep.spawning) return;

            if (CreepFatigueUtility.checkFatigue(creep)) return;

            if (!creep.heap || creep.heap instanceof Map || typeof creep.heap !== 'object') {
                creep.heap = CreepHeapUtility.getDefaultHeap();
            }

            const taskId = creep.heap && creep.heap.taskId ? creep.heap.taskId : creep.memory.taskId;

            if (!taskId || taskId === TaskAssignmentManager.TASKS.IDLE) {
                return;
            }

            if (taskId === TaskAssignmentManager.TASKS.SCOUT || taskId === TaskAssignmentManager.TASKS.MOVE_ROOM) {
                RoleExecutor.executeCrossRoomTask(creep);
                return;
            }

            const targetId = creep.heap && creep.heap.targetId ? creep.heap.targetId : creep.memory.targetId;
            const target = Game.getObjectById(targetId);
            if (!target) {
                const targetRoom = creep.heap && creep.heap.targetRoom ? creep.heap.targetRoom : creep.memory.targetRoom;
                if (creep.room.name === targetRoom) {
                    if (creep.heap) creep.heap.targetId = null;
                    creep.memory.targetId = null;
                }
                return;
            }

            RoleExecutor.executeTask(creep, target, taskId);
        });
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
            if (creep.heap) creep.heap.targetId = null;
            creep.memory.targetId = null;
        }
    }

    static executeCrossRoomTask(creep) {
        const targetRoom = creep.heap && creep.heap.targetRoom ? creep.heap.targetRoom : creep.memory.targetRoom;
        if (!targetRoom) {
            if (creep.heap) creep.heap.taskId = TaskAssignmentManager.TASKS.IDLE;
            creep.memory.taskId = TaskAssignmentManager.TASKS.IDLE;
            return;
        }

        if (creep.room.name !== targetRoom) {
            // Range 22 ensures the creep moves just past the room exit.
            // Targeting exact 25, 25 will fail if the center tile is a wall.
            creep.moveTo(new RoomPosition(25, 25, targetRoom), { range: 22, visualizePathStyle: { stroke: '#00ff00' } });
        } else {
             // Reached target room, TaskAssignmentManager will assign local target next tick.
             if (creep.heap) creep.heap.taskId = TaskAssignmentManager.TASKS.IDLE;
             creep.memory.taskId = TaskAssignmentManager.TASKS.IDLE;
        }
    }
}

module.exports = RoleExecutor;