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

            if (taskId === TaskAssignmentManager.TASKS.SCOUT || taskId === TaskAssignmentManager.TASKS.MOVE_ROOM) {
                RoleExecutor.executeCrossRoomTask(creep);
                continue;
            }

            const target = Game.getObjectById(targetId);
            if (!target) {
                // Ignore clearing if moving to a room and target isn't visible yet
                if (creep.room.name === creep.memory.targetRoom) {
                    creep.memory.targetId = null;
                }
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
            // Fix: Upgraders must stop at range 3. Controllers are impassable.
            if (taskId === TaskAssignmentManager.TASKS.UPGRADE) {
                creep.moveTo(target, { range: 3, visualizePathStyle: { stroke: '#ffffff' } });
            } else {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
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
            // Fix: Aggressive caching and strict maxOps cutoff to prevent 60 CPU spikes on unreachable rooms.
            const moveResult = creep.moveTo(new RoomPosition(25, 25, targetRoom), { 
                range: 20, 
                reusePath: 50, 
                maxOps: 1000,
                visualizePathStyle: { stroke: '#00ff00' } 
            });

            if (moveResult === ERR_NO_PATH) {
                // Room is walled off or unreachable. Destroy the target to abort infinite pathfinding loops.
                creep.memory.targetRoom = null;
                creep.memory.taskId = TaskAssignmentManager.TASKS.IDLE;
            }
        } else {
            // Check if creep is stuck on the room transition border
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                // IMPROVEMENT: ignoreCreeps bypasses traffic jams at exits, forcing the creep to step off the border.
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { reusePath: 10, ignoreCreeps: true });
            } else {
                // Safely inside the room. Clear task so TaskAssignmentManager can assign a new one.
                creep.memory.taskId = TaskAssignmentManager.TASKS.IDLE;
            }
        }
    }
}

module.exports = RoleExecutor;