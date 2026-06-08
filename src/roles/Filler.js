const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Filler = {
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
        if (actionIntent === ActionConstants.ACTION_MOVE_ROOM) {
            const targetRoom = creep.memory.targetRoom;
            if (targetRoom && creep.room.name !== targetRoom) {
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { reusePath: 20 });
            }
            return;
        } else if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
            const resourceType = (target.store && Object.keys(target.store)[0]) || RESOURCE_ENERGY;
            result = creep.withdraw(target, resourceType);
        } else if (actionIntent === ActionConstants.ACTION_TRANSFER) {
            const resourceType = (creep.store && Object.keys(creep.store)[0]) || RESOURCE_ENERGY;
            result = creep.transfer(target, resourceType);
        } else {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
            return;
        }

        if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, { reusePath: 5, visualizePathStyle: { stroke: '#ffff00' } });
        } else if (result === OK ||
            result === ERR_NOT_ENOUGH_RESOURCES ||
            result === ERR_FULL ||
            result === ERR_INVALID_TARGET) {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
        }
    }
};

module.exports = Filler;
