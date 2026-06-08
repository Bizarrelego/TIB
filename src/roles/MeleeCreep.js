const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

/**
 * Melee combat role. Pure muscle — reads heap, executes native API.
 * Brain: MilitaryManager
 */
const MeleeCreep = {
    run: function (creep) {
        if (creep.fatigue > 0) return;
        if (!creep.heap) return;

        const actionIntent = creep.heap.actionIntent;
        const targetId = creep.heap.targetId;

        if (!actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

        if (actionIntent === ActionConstants.ACTION_MOVE_ROOM) {
            const targetRoom = creep.memory.targetRoom;
            if (targetRoom && creep.room.name !== targetRoom) {
                creep.moveTo(new RoomPosition(25, 25, targetRoom), {
                    reusePath: 20,
                    visualizePathStyle: { stroke: '#ff4444', opacity: 0.4, lineStyle: 'dashed' }
                });
            }
            return;
        }

        if (actionIntent === ActionConstants.ACTION_PATROL) {
            const wp = creep.heap.waypointPos;
            if (wp) {
                const dest = new RoomPosition(wp.x, wp.y, wp.roomName);
                if (creep.pos.getRangeTo(dest) > 1) {
                    creep.moveTo(dest, { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00', opacity: 0.3 } });
                } else {
                    creep.heap.state = 'idle';
                }
            }
            return;
        }

        if (actionIntent === ActionConstants.ACTION_ATTACK) {
            if (!targetId) return;
            const target = GameObjectUtility.getById(targetId);
            if (!target) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
                return;
            }
            const result = creep.attack(target);
            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 3,
                    visualizePathStyle: { stroke: '#ff0000', opacity: 0.6 }
                });
            } else if (result === OK || result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }
        }
    }
};

module.exports = MeleeCreep;
