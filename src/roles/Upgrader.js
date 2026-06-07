const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Upgrader = {
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

        if (actionIntent === ActionConstants.ACTION_UPGRADE) {
            const result = creep.upgradeController(target);
            if (creep.heap.secondaryTargetId) {
                const secondary = GameObjectUtility.getById(creep.heap.secondaryTargetId);
                if (secondary) creep.pickup(secondary);
            }
            if (result === ERR_NOT_IN_RANGE || result === OK || result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
            }
        }
    }
};

module.exports = Upgrader;
