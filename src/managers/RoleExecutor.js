const ActionConstants = require('../constants/ActionConstants');
const CreepHeapUtility = require('../utilities/CreepHeapUtility');

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
                heap = CreepHeapUtility.getDefaultHeap();
                heap.set('sleepUntil', 0);
                global.creepHeap.set(creep.name, heap);
            }
            creep.heap = heap;

            if (Game.time < creep.heap.get('sleepUntil')) continue;

            const actionIntent = creep.heap.get('actionIntent');
            const targetId = creep.heap.get('targetId');

            if (!actionIntent || actionIntent === ActionConstants.get('ACTION_IDLE')) continue;

            if (actionIntent === ActionConstants.get('ACTION_SCOUT') || actionIntent === ActionConstants.get('ACTION_MOVE_ROOM')) {
                RoleExecutor.executeCrossRoomTask(creep);
                continue;
            }

            const target = Game.getObjectById(targetId);
            if (!target) {
                creep.heap.set('state', 'idle');
                creep.heap.set('actionIntent', ActionConstants.get('ACTION_IDLE'));
                continue;
            }

            RoleExecutor.executeTask(creep, target, actionIntent);
        }
    }

    static executeTask(creep, target, actionIntent) {
        let result;

        switch (actionIntent) {
            case ActionConstants.get('ACTION_HARVEST'):
                result = creep.harvest(target);
                if (result === ERR_NOT_ENOUGH_RESOURCES && target.ticksToRegeneration) {
                    creep.heap.set('sleepUntil', Game.time + target.ticksToRegeneration);
                    creep.heap.set('state', 'idle');
                    creep.heap.set('actionIntent', ActionConstants.get('ACTION_IDLE'));
                }
                break;
            case ActionConstants.get('ACTION_PICKUP'):
                result = creep.pickup(target);
                break;
            case ActionConstants.get('ACTION_TRANSFER'):
                result = creep.transfer(target, RESOURCE_ENERGY);
                break;
            case ActionConstants.get('ACTION_UPGRADE'):
                if (creep.pos.getRangeTo(target) > 3) {
                    result = ERR_NOT_IN_RANGE;
                } else {
                    result = creep.upgradeController(target);
                    if (creep.heap.get('secondaryTargetId') && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        const secondary = Game.getObjectById(creep.heap.get('secondaryTargetId'));
                        if (secondary) creep.pickup(secondary);
                    }
                }
                break;
            case ActionConstants.get('ACTION_WITHDRAW'):
                result = creep.withdraw(target, RESOURCE_ENERGY);
                break;
            case ActionConstants.get('ACTION_BUILD'):
                result = creep.build(target);
                break;
            case ActionConstants.get('ACTION_DROP'):
                if (creep.pos.getRangeTo(target) > 2) {
                    result = ERR_NOT_IN_RANGE;
                } else {
                    result = creep.drop(RESOURCE_ENERGY);
                }
                break;
            case ActionConstants.get('ACTION_REPAIR'):
                result = creep.repair(target);
                break;
            default:
                creep.heap.set('state', 'idle');
                creep.heap.set('actionIntent', ActionConstants.get('ACTION_IDLE'));
                return;
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
        } else if (
            result === ERR_FULL || 
            result === ERR_INVALID_TARGET ||
            (result === ERR_NOT_ENOUGH_RESOURCES && actionIntent !== ActionConstants.get('ACTION_UPGRADE'))
        ) {
            creep.heap.set('state', 'idle');
            creep.heap.set('actionIntent', ActionConstants.get('ACTION_IDLE'));
        } else if (result === OK && actionIntent !== ActionConstants.get('ACTION_HARVEST') && actionIntent !== ActionConstants.get('ACTION_UPGRADE') && actionIntent !== ActionConstants.get('ACTION_BUILD') && actionIntent !== ActionConstants.get('ACTION_REPAIR')) {
            creep.heap.set('state', 'idle');
            creep.heap.set('actionIntent', ActionConstants.get('ACTION_IDLE'));
        }
    }

    static executeCrossRoomTask(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            creep.heap.set('actionIntent', ActionConstants.get('ACTION_IDLE'));
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
                creep.heap.set('actionIntent', ActionConstants.get('ACTION_IDLE'));
            }
        } else {
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { reusePath: 10, ignoreCreeps: true });
            } else {
                creep.heap.set('actionIntent', ActionConstants.get('ACTION_IDLE'));
            }
        }
    }
}

module.exports = RoleExecutor;