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
            const resourceType = (target.store && Object.keys(target.store)[0]) || RESOURCE_ENERGY;
            result = creep.withdraw(target, resourceType);
        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
            result = creep.pickup(target);
        } else if (actionIntent === ActionConstants.ACTION_TRANSFER) {
            const resourceType = (creep.store && Object.keys(creep.store)[0]) || RESOURCE_ENERGY;
            result = creep.transfer(target, resourceType);
        } else if (actionIntent === ActionConstants.ACTION_DROP) {
            if (target.memory && target.memory.role === 'upgrader') {
                if (creep.pos.getRangeTo(target) > 1) {
                    creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
                    return; 
                }
            } else {
                if (creep.pos.getRangeTo(target) > 3) {
                    creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
                    return; 
                }
            }
            const resourceType = (creep.store && Object.keys(creep.store)[0]) || RESOURCE_ENERGY;
            result = creep.drop(resourceType);
        } else {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
            return;
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
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