const ActionConstants = require('../constants/ActionConstants');

const Harvester = {
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

        if (actionIntent === ActionConstants.ACTION_HARVEST) {
            const result = creep.harvest(target);
            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
            } else if (result === ERR_NOT_ENOUGH_RESOURCES && target.ticksToRegeneration) {
                creep.heap.sleepUntil = Game.time + target.ticksToRegeneration;
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            } else if (result === OK || result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
            }
        } else {
            creep.heap.state = 'idle';
        }
    }
};

module.exports = Harvester;
