const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

/**
 * Medic role. Pure muscle — reads heap, executes native API.
 * Uses rangedHeal when target is 2-3 tiles away, heal when adjacent.
 * Brain: MilitaryManager
 */
const MedicCreep = {
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

        if (actionIntent === ActionConstants.ACTION_HEAL) {
            if (!targetId) return;
            const target = GameObjectUtility.getById(targetId);
            if (!target) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
                return;
            }

            const range = creep.pos.getRangeTo(target);

            if (range <= 1) {
                // Adjacent: use full heal
                const result = creep.heal(target);
                if (result === OK || result === ERR_INVALID_TARGET) {
                    creep.heap.state = 'idle';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
            } else if (range <= 3) {
                // In ranged heal range: use ranged heal and close in simultaneously
                creep.rangedHeal(target);
                creep.moveTo(target, {
                    reusePath: 3,
                    visualizePathStyle: { stroke: '#00ff88', opacity: 0.5 }
                });
            } else {
                // Out of range: close in
                creep.moveTo(target, {
                    reusePath: 5,
                    visualizePathStyle: { stroke: '#00ff88', opacity: 0.5 }
                });
            }
        }
    }
};

module.exports = MedicCreep;
