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

            const distToController = creep.pos.getRangeTo(target);

            // Out of range routing: move to controller if further than range 3
            if (distToController > 3) {
                if (!movedToSecondary) creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#33ff33' } });
            } 
            // Clustering: if exactly at range 3 but empty, move closer to range 2 to tightly cluster for hauler drops
            else if (distToController === 3 && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                if (!movedToSecondary) creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#33ff33' } });
            } else {
                // Anti-spawn-block nudging: if stationary on a spawn/extension, nudge off it
                const roomState = global.State?.rooms?.get(creep.room.name);
                if (roomState && !movedToSecondary && creep.fatigue === 0) {
                    let blocking = false;
                    const checkBlock = (s) => {
                        if (s.pos.x === creep.pos.x && s.pos.y === creep.pos.y) blocking = true;
                    };
                    roomState.spawns?.forEach(checkBlock);
                    roomState.extensions?.forEach(checkBlock);

                    if (blocking) {
                        const dx = Math.floor(Math.random() * 3) - 1;
                        const dy = Math.floor(Math.random() * 3) - 1;
                        if (dx !== 0 || dy !== 0) {
                            creep.moveTo(new RoomPosition(creep.pos.x + dx, creep.pos.y + dy, creep.room.name), { visualizePathStyle: { stroke: '#ff0000' } });
                        }
                    }
                }
            }
            // On OK or within range: do nothing — keep upgrading or sit idle waiting for energy next tick

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
