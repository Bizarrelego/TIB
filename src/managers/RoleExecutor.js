/**
 * Top-Down Role Executor
 * Processes intent execution based on heap-stored actions.
 */
class RoleExecutor {
    static run() {
        if (!global.creepHeap) global.creepHeap = new Map();
        
        // Check: Object.values is faster than Object.keys followed by property lookup.
        const creeps = Object.values(Game.creeps);
        
        for (let i = 0; i < creeps.length; i++) {
            const creep = creeps[i];
            
            if (creep.spawning || creep.fatigue > 0) continue;

            let heap = global.creepHeap.get(creep.name);
            if (!heap) {
                heap = { state: 'idle', actionIntent: 'idle', targetId: null, sleepUntil: 0 };
                global.creepHeap.set(creep.name, heap);
            }
            creep.heap = heap;

            if (Game.time < creep.heap.sleepUntil) continue;

            const actionIntent = creep.heap.actionIntent;
            const targetId = creep.heap.targetId;

            if (!actionIntent || actionIntent === 'idle') continue;

            if (actionIntent === 'scout' || actionIntent === 'move_room') {
                RoleExecutor.executeCrossRoomTask(creep);
                continue;
            }

            const target = Game.getObjectById(targetId);
            if (!target) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = 'idle';
                continue;
            }

            RoleExecutor.executeTask(creep, target, actionIntent);
        }
    }

    static executeTask(creep, target, actionIntent) {
        let result;

        switch (actionIntent) {
            case 'harvest':
                result = creep.harvest(target);
                if (result === ERR_NOT_ENOUGH_RESOURCES && target.ticksToRegeneration) {
                    creep.heap.sleepUntil = Game.time + target.ticksToRegeneration;
                    creep.heap.state = 'idle';
                    creep.heap.actionIntent = 'idle';
                }
                break;
            case 'pickup':
                result = creep.pickup(target);
                break;
            case 'transfer':
                result = creep.transfer(target, RESOURCE_ENERGY);
                break;
            case 'upgrade':
                if (creep.pos.getRangeTo(target) > 3) {
                    result = ERR_NOT_IN_RANGE;
                } else {
                    result = creep.upgradeController(target);
                    if (creep.heap.secondaryTargetId && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        const secondary = Game.getObjectById(creep.heap.secondaryTargetId);
                        if (secondary) creep.pickup(secondary);
                    }
                }
                break;
            case 'withdraw':
                result = creep.withdraw(target, RESOURCE_ENERGY);
                break;
            case 'build':
                result = creep.build(target);
                break;
            case 'drop':
                if (creep.pos.getRangeTo(target) > 2) {
                    result = ERR_NOT_IN_RANGE;
                } else {
                    result = creep.drop(RESOURCE_ENERGY);
                }
                break;
            case 'repair':
                result = creep.repair(target);
                break;
            default:
                creep.heap.state = 'idle';
                creep.heap.actionIntent = 'idle';
                return;
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
        } else if (
            result === ERR_FULL || 
            result === ERR_INVALID_TARGET ||
            (result === ERR_NOT_ENOUGH_RESOURCES && actionIntent !== 'upgrade')
        ) {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = 'idle';
        } else if (result === OK && actionIntent !== 'harvest' && actionIntent !== 'upgrade' && actionIntent !== 'build' && actionIntent !== 'repair') {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = 'idle';
        }
    }

    static executeCrossRoomTask(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            creep.heap.actionIntent = 'idle';
            return;
        }

        if (creep.room.name !== targetRoom) {
            const moveResult = creep.moveTo(new RoomPosition(25, 25, targetRoom), { 
                range: 20, 
                reusePath: 50, 
                maxOps: 1000,
                visualizePathStyle: { stroke: '#00ff00' } 
            });

            if (moveResult === ERR_NO_PATH) {
                creep.memory.targetRoom = null;
                creep.heap.actionIntent = 'idle';
            }
        } else {
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { reusePath: 10, ignoreCreeps: true });
            } else {
                creep.heap.actionIntent = 'idle';
            }
        }
    }
}

module.exports = RoleExecutor;