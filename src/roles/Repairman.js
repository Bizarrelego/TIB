const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Repairman = {
    run: function (creep) {
        if (creep.fatigue > 0) return;
        if (!creep.heap) return;

        const targetId = creep.heap.targetId;
        const actionIntent = creep.heap.actionIntent;

        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) {
            // Smart Parking: Find an off-road spot away from spawn to avoid blocking
            if (global.State && global.State.rooms && global.State.rooms.has(creep.room.name)) {
                const roomState = global.State.rooms.get(creep.room.name);
                if (roomState.spawns && roomState.spawns.length > 0) {
                    const spawn = roomState.spawns[0];
                    if (creep.pos.getRangeTo(spawn) < 4) {
                        const result = PathFinder.search(creep.pos, { pos: spawn.pos, range: 4 }, {
                            flee: true,
                            roomCallback: function(roomName) {
                                let costs = new PathFinder.CostMatrix;
                                const blueprint = global.Cache?.blueprints?.[roomName];
                                if (blueprint && blueprint.roads) {
                                    // Make roads high cost to encourage stepping off them
                                    for (let i = 0; i < blueprint.roads.length; i++) {
                                        costs.set(blueprint.roads[i].x, blueprint.roads[i].y, 10);
                                    }
                                }
                                return costs;
                            }
                        });
                        if (result.path && result.path.length > 0) {
                            creep.moveByPath(result.path);
                        }
                    }
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
            creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffaa00' } });
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
