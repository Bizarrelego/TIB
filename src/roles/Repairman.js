const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Repairman = {
    run: function (creep) {
        if (creep.fatigue > 0) return;
        if (!creep.heap) return;

        const targetId = creep.heap.targetId;
        const actionIntent = creep.heap.actionIntent;

        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) {
            // Parking: Brain writes waypointPos, we just write destination
            const wp = creep.heap.waypointPos;
            if (wp) {
                const dest = new RoomPosition(wp.x, wp.y, wp.roomName);
                if (creep.pos.getRangeTo(dest) > 1) {
                    creep.heap.destination = { x: dest.x, y: dest.y, roomName: dest.roomName, range: 1 };
                }
            }
            return;
        }

        const target = GameObjectUtility.getById(targetId);
        if (!target) {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
            return;
        }

        let result;
        if (actionIntent === ActionConstants.ACTION_REPAIR) {
            result = creep.repair(target);
        } else if (actionIntent === ActionConstants.ACTION_HARVEST) {
            result = creep.harvest(target);
        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
            result = creep.pickup(target);
            if (result === OK) {
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    creep.heap.state = 'work';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
                return;
            }
        }

        if (result === ERR_NOT_IN_RANGE) {
            const range = actionIntent === ActionConstants.ACTION_REPAIR ? 3 : 1;
            creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: range };
        } else if (result === ERR_FULL || result === ERR_INVALID_TARGET || result === ERR_NOT_ENOUGH_RESOURCES) {
            creep.heap.state = 'idle'; // Reset state logic will catch it
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
        } else if (result === OK) {
            if (actionIntent === ActionConstants.ACTION_REPAIR) {
                if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 || target.hits === target.hitsMax) {
                    creep.heap.state = 'gather';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
            } else if (actionIntent === ActionConstants.ACTION_HARVEST) {
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    creep.heap.state = 'work';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
            }
        }
    }
};

module.exports = Repairman;
