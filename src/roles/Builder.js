const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Builder = {
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
        if (actionIntent === ActionConstants.ACTION_BUILD) {
            result = creep.build(target);
        } else if (actionIntent === ActionConstants.ACTION_REPAIR) {
            result = creep.repair(target);
        } else if (actionIntent === ActionConstants.ACTION_UPGRADE) {
            result = creep.upgradeController(target);
        } else if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
            result = creep.withdraw(target, RESOURCE_ENERGY);
            // On successful withdraw, immediately idle for work assignment
            if (result === OK) {
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    creep.heap.state = 'idle';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
                return;
            }
        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
            result = creep.pickup(target);
            // On successful pickup, immediately idle for work assignment
            if (result === OK) {
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    creep.heap.state = 'idle';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
                return;
            }
        } else if (actionIntent === ActionConstants.ACTION_DROP) {
            result = creep.drop(RESOURCE_ENERGY);
        }

        if (result === ERR_NOT_IN_RANGE) {
            const range = (actionIntent === ActionConstants.ACTION_BUILD || actionIntent === ActionConstants.ACTION_REPAIR || actionIntent === ActionConstants.ACTION_UPGRADE) ? 3 : 1;
            creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: range };
        } else if (result === ERR_FULL || result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES) {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
        } else if (result === OK) {
            // After successful work action, check if energy is depleted
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }
        }
    }
};

module.exports = Builder;
