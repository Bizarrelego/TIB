const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Bootstrapper = {
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

        if (actionIntent === ActionConstants.ACTION_HARVEST) {
            result = creep.harvest(target);
        } else if (actionIntent === ActionConstants.ACTION_PICKUP) {
            result = creep.pickup(target);
        } else if (actionIntent === ActionConstants.ACTION_WITHDRAW) {
            const resourceType = (target.store && Object.keys(target.store)[0]) || RESOURCE_ENERGY;
            result = creep.withdraw(target, resourceType);
        } else if (actionIntent === ActionConstants.ACTION_TRANSFER) {
            const resourceType = (creep.store && Object.keys(creep.store)[0]) || RESOURCE_ENERGY;
            result = creep.transfer(target, resourceType);
        } else if (actionIntent === ActionConstants.ACTION_BUILD) {
            result = creep.build(target);
        } else if (actionIntent === ActionConstants.ACTION_UPGRADE) {
            result = creep.upgradeController(target);
            // Dynamic clustering logic for controllers (max range 3)
            if (result === ERR_NOT_IN_RANGE) {
                creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 3 };
                return;
            } else if (result === OK || result === ERR_NOT_ENOUGH_RESOURCES) {
                const distToController = creep.pos.getRangeTo(target);
                if (distToController > 3 || (distToController === 3 && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
                    creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: 3 };
                }
            }
        } else {
            creep.heap.state = 'idle';
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
            return;
        }

        // Standard distance routing for all intents (except upgrade which has special clustering)
        if (actionIntent !== ActionConstants.ACTION_UPGRADE) {
            if (result === ERR_NOT_IN_RANGE) {
                const range = (actionIntent === ActionConstants.ACTION_BUILD) ? 3 : 1;
                creep.heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range: range };
            } else if (result === OK ||
                result === ERR_NOT_ENOUGH_RESOURCES ||
                result === ERR_FULL ||
                result === ERR_INVALID_TARGET) {
                // If it successfully gathered/transferred/built, or ran out of space/resources, clear intent
                // The manager will flip state based on capacity on the next tick
                if (actionIntent !== ActionConstants.ACTION_HARVEST && actionIntent !== ActionConstants.ACTION_BUILD) {
                    creep.heap.state = 'idle';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
            }
        }
    }
};

module.exports = Bootstrapper;
