const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Harvester = {
    run: function (creep) {
        if (creep.fatigue > 0) return;
        if (!creep.heap) return;

        const targetId = creep.heap.targetId;
        const actionIntent = creep.heap.actionIntent;

        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

        const target = GameObjectUtility.getById(targetId);
        if (!target) {
            creep.heap.state = 'idle';
            return;
        }

        if (actionIntent === ActionConstants.ACTION_HARVEST) {
            const result = creep.harvest(target);
            if (result === ERR_NOT_ENOUGH_RESOURCES && target.ticksToRegeneration) {
                creep.heap.sleepUntil = Game.time + target.ticksToRegeneration;
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            } else if (result === ERR_NOT_IN_RANGE || result === OK || result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
            }
        }
    }
};

module.exports = Harvester;
