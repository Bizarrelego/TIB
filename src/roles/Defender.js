const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Defender = {
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
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
            return;
        }

        if (actionIntent === ActionConstants.ACTION_ATTACK) {
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 1 };
            }
        }
    }
};

module.exports = Defender;
