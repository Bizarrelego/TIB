const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');
const DesignatedDropOffUtility = require('../utilities/DesignatedDropOffUtility');

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
                        // Still try to upgrade if in range while walking
                        if (creep.pos.getRangeTo(target) <= 3) {
                            creep.upgradeController(target);
                        }
                        return;
                    }
                    // Sitting on container — withdraw when low on energy
                    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        creep.withdraw(container, RESOURCE_ENERGY);
                    }
                }
            }

            const result = creep.upgradeController(target);

            let movedToSecondary = false;
            // Opportunistic pickup of nearby dropped energy (same-tick stacking)
            if (creep.heap.secondaryTargetId) {
                const secondary = GameObjectUtility.getById(creep.heap.secondaryTargetId);
                if (secondary) {
                    if (creep.pickup(secondary) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(secondary, { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00' } });
                        movedToSecondary = true;
                    }
                }
            }

            if (result === ERR_NOT_IN_RANGE) {
                const dropPos = DesignatedDropOffUtility.getUpgraderDropOffPosition(target.id);
                if (dropPos && (creep.pos.x !== dropPos.x || creep.pos.y !== dropPos.y)) {
                    if (!movedToSecondary) creep.moveTo(dropPos, { reusePath: 10, visualizePathStyle: { stroke: '#33ff33' } });
                } else {
                    if (!movedToSecondary) creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#33ff33' } });
                }
            } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
                // Out of energy — check if container is also empty
                if (creep.heap.sitTargetId) {
                    const container = GameObjectUtility.getById(creep.heap.sitTargetId);
                    if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        // Container has energy, withdraw next tick — stay put
                        return;
                    }
                }
                // No energy anywhere. Route to the drop-off area so we catch hauler deliveries.
                const dropPos = DesignatedDropOffUtility.getUpgraderDropOffPosition(target.id);
                if (dropPos && (creep.pos.x !== dropPos.x || creep.pos.y !== dropPos.y)) {
                    if (!movedToSecondary) creep.moveTo(dropPos, { reusePath: 10, visualizePathStyle: { stroke: '#33ff33' } });
                    return;
                }

                // If exactly on dropPos, stay there and wait for Hauler.
                // DO NOT go idle. We want to keep intent = UPGRADE so it picks up and upgrades when energy arrives.
            } else if (result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }
            // On OK: do nothing — keep upgrading next tick

        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
            const result = creep.pickup(target);
            if (result === OK) {
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    creep.heap.state = 'idle';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
                return;
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#33ff33' } });
            } else if (result === ERR_FULL || result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }

        } else if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
            const result = creep.withdraw(target, RESOURCE_ENERGY);
            if (result === OK) {
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    creep.heap.state = 'idle';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
                return;
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#33ff33' } });
            } else if (result === ERR_FULL || result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }
        }
    }
};

module.exports = Upgrader;
