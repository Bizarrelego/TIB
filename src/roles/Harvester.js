const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');
const CreepHeapUtility = require('../utilities/CreepHeapUtility');

const Harvester = {
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

        if (actionIntent === ActionConstants.ACTION_HARVEST) {
            // Container-sit: path to the container and sit on it for direct deposit
            if (creep.heap.sitTargetId) {
                const container = GameObjectUtility.getById(creep.heap.sitTargetId);
                if (container && (creep.pos.x !== container.pos.x || creep.pos.y !== container.pos.y)) {
                    creep.heap.destination = { x: container.pos.x, y: container.pos.y, roomName: container.pos.roomName, range: 0 };
                    // Still try to harvest if in range of source while walking
                    if (creep.pos.getRangeTo(target) <= 1) {
                        creep.harvest(target);
                    }
                    return;
                }
            } else {
                // If no container, enforce strict harvest position lock-in
                const assignedPosObj = CreepHeapUtility.getCreepHarvestPosition(creep);
                if (assignedPosObj && (creep.pos.x !== assignedPosObj.x || creep.pos.y !== assignedPosObj.y)) {
                    creep.heap.destination = { x: assignedPosObj.x, y: assignedPosObj.y, roomName: assignedPosObj.roomName, range: 0 };
                    if (creep.pos.getRangeTo(target) <= 1) {
                        creep.harvest(target);
                    }
                    return;
                }
            }

            const result = creep.harvest(target);
            
            if (result === ERR_NOT_IN_RANGE) {
                creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 1 };
            } else if (result === ERR_NOT_ENOUGH_RESOURCES && target.ticksToRegeneration) {
                creep.heap.sleepUntil = Game.time + target.ticksToRegeneration;
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            } else if (result === ERR_INVALID_TARGET) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
            }
        }
    }
};

module.exports = Harvester;