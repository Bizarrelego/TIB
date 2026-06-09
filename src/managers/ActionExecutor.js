const ActionConstants = require('../constants/ActionConstants');
const CacheLib = require('../lib/CacheLib');

/**
 * Maps intents directly to Screeps API calls, bypassing roles entirely.
 */
class ActionExecutor {
    static run() {
        if (!global.creepHeap) global.creepHeap = new Map();
        
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            
            if (creep.spawning || creep.fatigue > 0) continue;

            let heap = global.creepHeap.get(creep.name);
            if (!heap) {
                heap = CacheLib.getDefaultHeap();
                global.creepHeap.set(creep.name, heap);
            }
            creep.heap = heap;

            if (Game.time < heap.sleepUntil) continue;

            const intent = heap.actionIntent;
            if (!intent || intent === ActionConstants.ACTION_IDLE) continue;

            if (intent === ActionConstants.ACTION_MOVE_ROOM) {
                ActionExecutor.executeCrossRoomTask(creep);
                continue;
            }

            const target = heap.targetId ? CacheLib.getById(heap.targetId) : null;
            if (heap.targetId && !target) {
                heap.state = 'idle';
                heap.actionIntent = ActionConstants.ACTION_IDLE;
                heap.targetId = null;
                continue;
            }

            ActionExecutor.executeIntent(creep, heap, intent, target);
        }
    }

    static executeIntent(creep, heap, intent, target) {
        let result = ERR_INVALID_TARGET;

        if (heap.secondaryIntent) {
            const secTarget = heap.secondaryTargetId ? CacheLib.getById(heap.secondaryTargetId) : null;
            if (heap.secondaryIntent === ActionConstants.ACTION_PICKUP && secTarget) {
                creep.pickup(secTarget);
            }
        }

        if (intent === ActionConstants.ACTION_HARVEST) {
            result = creep.harvest(target);
        } else if (intent === ActionConstants.ACTION_WITHDRAW) {
            let res = RESOURCE_ENERGY;
            if (target.store) {
                const keys = Object.keys(target.store);
                let maxAmt = -1;
                for (let i = 0; i < keys.length; i++) {
                    const amt = target.store.getUsedCapacity(keys[i]);
                    if (amt > maxAmt) { maxAmt = amt; res = keys[i]; }
                }
            }
            result = creep.withdraw(target, res);
        } else if (intent === ActionConstants.ACTION_TRANSFER) {
            let res = RESOURCE_ENERGY;
            if (creep.store) {
                const keys = Object.keys(creep.store);
                for (let i = 0; i < keys.length; i++) {
                    if (creep.store.getUsedCapacity(keys[i]) > 0) {
                        res = keys[i];
                        if (res !== RESOURCE_ENERGY) break;
                    }
                }
            }
            result = creep.transfer(target, res);
        } else if (intent === ActionConstants.ACTION_BUILD) {
            result = creep.build(target);
        } else if (intent === ActionConstants.ACTION_REPAIR) {
            result = creep.repair(target);
        } else if (intent === ActionConstants.ACTION_UPGRADE) {
            result = creep.upgradeController(target);
        } else if (intent === ActionConstants.ACTION_PICKUP) {
            result = creep.pickup(target);
        } else if (intent === ActionConstants.ACTION_DROP) {
            let res = RESOURCE_ENERGY;
            if (creep.store) {
                const keys = Object.keys(creep.store);
                for (let i = 0; i < keys.length; i++) {
                    if (creep.store.getUsedCapacity(keys[i]) > 0) {
                        res = keys[i];
                        if (res !== RESOURCE_ENERGY) break;
                    }
                }
            }
            result = creep.drop(res);
        } else if (intent === ActionConstants.ACTION_ATTACK) {
            result = creep.attack(target);
        } else if (intent === ActionConstants.ACTION_RANGED_ATTACK) {
            result = creep.rangedAttack(target);
        } else if (intent === ActionConstants.ACTION_HEAL) {
            result = creep.heal(target);
        } else if (intent === ActionConstants.ACTION_DISMANTLE) {
            result = creep.dismantle(target);
        }

        if (result === ERR_NOT_IN_RANGE) {
            let range = 1;
            if (intent === ActionConstants.ACTION_UPGRADE || intent === ActionConstants.ACTION_BUILD || intent === ActionConstants.ACTION_REPAIR || intent === ActionConstants.ACTION_RANGED_ATTACK) range = 3;
            if (intent === ActionConstants.ACTION_DROP && target && target.memory && target.memory.role === 'upgrader') range = 1;
            else if (intent === ActionConstants.ACTION_DROP) range = 3;

            heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range };
        } else if (result === OK || result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_FULL || result === ERR_INVALID_TARGET) {
            if (intent !== ActionConstants.ACTION_HARVEST && intent !== ActionConstants.ACTION_UPGRADE) {
                heap.state = 'idle';
                heap.actionIntent = ActionConstants.ACTION_IDLE;
                heap.targetId = null;
            }
        }
    }

    static executeCrossRoomTask(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        if (creep.room.name !== targetRoom) {
            creep.heap.destination = { x: 25, y: 25, roomName: targetRoom, range: 20 };
        } else {
            if (creep.pos.x <= 0 || creep.pos.x >= 49 || creep.pos.y <= 0 || creep.pos.y >= 49) {
                creep.heap.destination = { x: 25, y: 25, roomName: creep.room.name, range: 20 };
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }
    }
}

module.exports = ActionExecutor;
