const ActionConstants = require('../constants/ActionConstants');

const Upgrader = {
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

        if (actionIntent === ActionConstants.ACTION_UPGRADE) {
            if (creep.pos.getRangeTo(target) > 3) {
                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
            } else {
                const result = creep.upgradeController(target);
                if (result === OK && creep.heap.secondaryTargetId && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    const secondary = Game.getObjectById(creep.heap.secondaryTargetId);
                    if (secondary) creep.pickup(secondary);
                } else if (result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_INVALID_TARGET) {
                    creep.heap.state = 'idle';
                }
            }
        } else {
            creep.heap.state = 'idle';
        }
    }
};

module.exports = Upgrader;
