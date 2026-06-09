const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Hauler = {
    run: function (creep) {
        if (creep.fatigue > 0) return;

        if (!creep.heap) return;

        const targetId = creep.heap.targetId;
        const actionIntent = creep.heap.actionIntent;

        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

        const target = GameObjectUtility.getById(targetId);
        if (!target) {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
            return;
        }

        let result;
        if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
            let resourceType = RESOURCE_ENERGY;
            if (target.store) {
                const keys = Object.keys(target.store);
                if (keys.length > 0) {
                    let maxAmt = -1;
                    for (let i = 0; i < keys.length; i++) {
                        const amt = target.store.getUsedCapacity(keys[i]);
                        if (amt > maxAmt) {
                            maxAmt = amt;
                            resourceType = keys[i];
                        }
                    }
                }
            }
            result = creep.withdraw(target, resourceType);
        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
            result = creep.pickup(target);
        } else if (actionIntent === ActionConstants.ACTION_TRANSFER || actionIntent === ActionConstants.ACTION_DROP) {
            let resourceType = RESOURCE_ENERGY;
            if (creep.store) {
                const keys = Object.keys(creep.store);
                if (keys.length > 0) {
                    // Heavily prioritize non-energy resources to clear junk
                    for (let i = 0; i < keys.length; i++) {
                        if (creep.store.getUsedCapacity(keys[i]) > 0) {
                            resourceType = keys[i];
                            if (keys[i] !== RESOURCE_ENERGY) break;
                        }
                    }
                }
            }
            
            if (actionIntent === ActionConstants.ACTION_TRANSFER) {
                result = creep.transfer(target, resourceType);
            } else {
                if (target.memory && target.memory.role === 'upgrader') {
                    if (creep.pos.getRangeTo(target) > 1) {
                        creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 1 };
                        return; 
                    }
                } else {
                    if (creep.pos.getRangeTo(target) > 3) {
                        creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 3 };
                        return; 
                    }
                }
                result = creep.drop(resourceType);
            }
        } else {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
            return;
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 1 };
        } else if (result === OK ||
            result === ERR_NOT_ENOUGH_RESOURCES ||
            result === ERR_FULL ||
            result === ERR_INVALID_TARGET) {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
        }
    }
};

module.exports = Hauler;