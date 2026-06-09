const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

/**
 * Upgrader Role — Pure Muscle.
 * Reads heap intent from TaskAssignmentManager and executes native API only.
 * All energy targeting decisions are made by the Brain (TaskAssignmentManager.assignUpgrader).
 */
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

        let result;

        if (actionIntent === ActionConstants.ACTION_UPGRADE) {
            result = creep.upgradeController(target);
            if (result === ERR_NOT_IN_RANGE) {
                creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 3 };
            } else if (result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }

        } else if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
            result = creep.withdraw(target, RESOURCE_ENERGY);
            if (result === ERR_NOT_IN_RANGE) {
                creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 1 };
            } else if (result === OK || result === ERR_FULL || result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }

        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
            result = creep.pickup(target);
            if (result === ERR_NOT_IN_RANGE) {
                creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 1 };
            } else if (result === OK || result === ERR_FULL || result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }
        }
    }
};

module.exports = Upgrader;
