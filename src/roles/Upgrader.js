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
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
            return;
        }

        if (actionIntent === ActionConstants.ACTION_UPGRADE) {
            // Container-sit: if assigned a container, walk to it and withdraw
            if (creep.heap.sitTargetId) {
                const container = GameObjectUtility.getById(creep.heap.sitTargetId);
                if (container) {
                    if (creep.pos.getRangeTo(container) > 0) {
                        creep.moveTo(container, { reusePath: 10, visualizePathStyle: { stroke: '#33ff33' } });
                        return;
                    }
                    // Sitting on container — withdraw when low on energy
                    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        creep.withdraw(container, RESOURCE_ENERGY);
                    }
                }
            }

            const result = creep.upgradeController(target);

            // Opportunistic pickup of nearby dropped energy (same-tick stacking)
            if (creep.heap.secondaryTargetId) {
                const secondary = GameObjectUtility.getById(creep.heap.secondaryTargetId);
                if (secondary) creep.pickup(secondary);
            }

            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#33ff33' } });
            } else if (result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }
            // On OK: do nothing — keep upgrading next tick
        }
    }
};

module.exports = Upgrader;
