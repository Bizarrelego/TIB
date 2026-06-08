const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Defender = {
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
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.targetId = null;
            return;
        }

        if (actionIntent === ActionConstants.ACTION_ATTACK) {
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
            }
        }
    }
};

module.exports = Defender;
