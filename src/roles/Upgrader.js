const ActionConstants = require('../constants/ActionConstants');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const Upgrader = {
    run: function (creep) {
        if (creep.fatigue > 0) return;
        if (!creep.heap) return;

        const targetId = creep.heap.targetId;
        const actionIntent = creep.heap.actionIntent;

        if (!targetId || !actionIntent || actionIntent === ActionConstants.ACTION_IDLE) return;

        if (actionIntent === ActionConstants.ACTION_UPGRADE) {
            const target = GameObjectUtility.getById(targetId);
            if (!target) {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                creep.heap.targetId = null;
                return;
            }

            const roomState = global.State?.rooms?.get(creep.room.name);
            let container = null;
            if (roomState && roomState.controllerContainers && roomState.controllerContainers.length > 0) {
                container = roomState.controllerContainers[0];
            }

            // 1. Position around container if one exists, otherwise around controller
            if (container) {
                if (creep.pos.getRangeTo(container) > 1) {
                    creep.moveTo(container, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
                    return;
                }
            } else {
                const range = creep.pos.getRangeTo(target);
                if (range > 3) {
                    creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
                    return; // Do nothing else while walking
                }
            }

            // 2. We are in position. Fast scan for adjacent containers/drops if we need energy.
            let pickedUp = false;
            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    creep.withdraw(container, RESOURCE_ENERGY);
                    pickedUp = true;
                } else if (roomState) {
                    // Check other containers first (e.g. if multiple exist)
                    if (roomState.containers) {
                        for (let i = 0; i < roomState.containers.length; i++) {
                            const c = roomState.containers[i];
                            if (c.id !== (container ? container.id : null) && 
                                c.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && 
                                Math.max(Math.abs(creep.pos.x - c.pos.x), Math.abs(creep.pos.y - c.pos.y)) <= 1) {
                                creep.withdraw(c, RESOURCE_ENERGY);
                                pickedUp = true;
                                break;
                            }
                        }
                    }

                    // Fallback to dropped energy
                    if (!pickedUp && roomState.droppedEnergy) {
                        const drops = roomState.droppedEnergy;
                        for (let i = 0; i < drops.length; i++) {
                            const d = drops[i];
                            if (Math.max(Math.abs(creep.pos.x - d.pos.x), Math.abs(creep.pos.y - d.pos.y)) <= 1) {
                                creep.pickup(d);
                                pickedUp = true;
                                break;
                            }
                        }
                    }
                }
            }

            // 3. Upgrade if we have energy or just picked some up
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 || pickedUp) {
                const result = creep.upgradeController(target);
                if (result !== OK && result !== ERR_NOT_ENOUGH_RESOURCES) {
                    creep.heap.state = 'idle';
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    creep.heap.targetId = null;
                }
            }
        }
    }
};

module.exports = Upgrader;
