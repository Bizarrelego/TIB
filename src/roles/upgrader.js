const TrafficManager = require('../traffic/trafficManager');
const movement = require('../utils/movement');

// Upgraders must be static. Move once, then stay forever.
function run(creep, room) {
    if (room.memory.haltUpgrades) return;

    const controller = room.controller;
    if (!controller) return;

    try {
        if (creep.fatigue > 0) return;

        // Lock position adjacent to controller and pull from drop pile or Storage
        if (creep.pos.getRangeTo(controller) > 1) {
            movement.moveTo(creep, controller);
        } else {
            TrafficManager.registerStatic(creep);

            const storage = room.storage;
            if (storage && storage.isActive()) {
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    const status = TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, creep.store.getFreeCapacity(RESOURCE_ENERGY));
                    if (status !== OK && creep.pos.getRangeTo(storage) > 1) {
                        movement.moveTo(creep, storage);
                    }
                }
            } else {
                // Find dropped energy on exact tile
                const dropped = global.State.droppedByRoom.get(room.name) || new Map();
                let targetDrop = null;
                for (const drop of dropped.values()) {
                    if (drop.resourceType === RESOURCE_ENERGY && creep.pos.isEqualTo(drop.pos)) {
                        targetDrop = drop;
                        break;
                    }
                }

                if (targetDrop && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    creep.pickup(targetDrop);
                }
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.upgradeController(controller);
            }
        }
    } catch (e) {
        console.log(`[Upgrader Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
    }
}

module.exports = { run };
