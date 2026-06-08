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

            // 1. Enforce absolute stasis: Move to range 3, then lock forever.
            const range = creep.pos.getRangeTo(target);
            if (range > 3) {
                creep.moveTo(target, { reusePath: 10, visualizePathStyle: { stroke: '#ffffff' } });
                return; // Do nothing else while walking
            }

            // 2. We are in position. Fast scan for adjacent containers/drops if we need energy.
            let pickedUp = false;
            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                const roomState = global.State?.rooms?.get(creep.room.name);
                if (roomState) {
                    // Check containers first
                    if (roomState.containers) {
                        for (let i = 0; i < roomState.containers.length; i++) {
                            const c = roomState.containers[i];
                            if (c.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && 
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
