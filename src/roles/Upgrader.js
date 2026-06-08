const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Upgrader = {
    run: function (creep) {
        if (creep.fatigue > 0) return;
        if (!creep.heap) return;

        const targetId = creep.heap.targetId;
        const actionIntent = creep.heap.actionIntent;

        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

        if (actionIntent === ActionConstants.ACTION_UPGRADE) {
            const target = GameObjectUtility.getById(targetId);
            if (!target) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
                return;
            }

            // Tigga-style efficiency: pickup from pile while upgrading
            const secondaryTargetId = creep.heap.secondaryTargetId;
            let pickedUp = false;
            
            if (secondaryTargetId && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                const drop = GameObjectUtility.getById(secondaryTargetId);
                if (drop) {
                    if (creep.pos.getRangeTo(drop) <= 1) {
                        creep.pickup(drop);
                        pickedUp = true;
                    } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                        // Empty and pile is out of range, move to pile
                        creep.moveTo(drop, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
                        return;
                    }
                }
            }

            // Upgrade if we have energy or just picked some up
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || pickedUp) {
                const result = creep.upgradeController(target);
                if (result === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
                } else if (result !== OK && result !== ERR_NOT_ENOUGH_RESOURCES) {
                    creep.heap.state = 'idle';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
            } else if (!secondaryTargetId && creep.pos.getRangeTo(target) > 3) {
                // Empty, no pile nearby, move to controller
                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }
};

module.exports = Upgrader;
