const ActionConstants = require('../constants/ActionConstants');

const Builder = {
    run: function (creep) {
        if (creep.fatigue > 0) return;
        if (!creep.heap) return;

        const targetId = creep.heap.targetId;
        const actionIntent = creep.heap.actionIntent;

        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

        const target = Game.getObjectById(targetId);
        if (!target) {
            creep.heap.state = 'idle';
            return;
        }

        let result;
        if (actionIntent === ActionConstants.ACTION_BUILD) {
            result = creep.build(target);
        } else if (actionIntent === ActionConstants.ACTION_REPAIR) {
            result = creep.repair(target);
        } else if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
            result = creep.withdraw(target, RESOURCE_ENERGY);
        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
            result = creep.pickup(target);
        } else if (actionIntent === ActionConstants.ACTION_DROP) {
            if (creep.pos.getRangeTo(target) > 2) {
                result = ERR_NOT_IN_RANGE;
            } else {
                result = creep.drop(RESOURCE_ENERGY);
            }
        } else {
            creep.heap.state = 'idle';
            return;
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
        } else if (result === OK || result === ERR_FULL || result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES) {
            creep.heap.state = 'idle';
        }
    }
};

module.exports = Builder;
