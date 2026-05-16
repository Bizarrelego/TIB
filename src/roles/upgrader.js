const movement = require('../utils/movement');

// Upgraders must be static. Move once, then stay forever.
function run(creep, room) {
    if (room.memory.haltUpgrades) return;

    const controller = room.controller;
    if (!controller) return;

    try {
        if (creep.fatigue > 0) return;

        let controllerContainer = null;
        const structures = global.State.structuresByRoom.get(room.name);
        const containers = structures ? (structures.get(STRUCTURE_CONTAINER) || new Map()) : new Map();

        // Query the room for the Controller Container (within 3 tiles of the controller)
        for (const container of containers.values()) {
            if (container.pos.inRangeTo(controller, 3)) {
                controllerContainer = container;
                break;
            }
        }

        if (controllerContainer) {
            // 1. If the container exists, the creep must move to it
            if (!creep.pos.isEqualTo(controllerContainer.pos)) {
                movement.moveTo(creep, controllerContainer);
            } else {
                // 2. Once creep.pos.isEqualTo(container.pos), permanently stop moving.
                // 3. Every tick, if container has energy, withdraw and upgrade simultaneously
                const hasEnergy = controllerContainer.store.getUsedCapacity(RESOURCE_ENERGY) > 0;

                if (hasEnergy) {
                    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        creep.withdraw(controllerContainer, RESOURCE_ENERGY);
                    }
                    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        creep.upgradeController(controller);
                    }
                } else {
                    // 4. If container is completely empty, sleep and wait for haulers. Do not walk away to harvest.
                    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        creep.upgradeController(controller);
                    }
                }
            }
        } else {
            // Fallback if no container yet: move to controller and upgrade if it has energy
            if (creep.pos.getRangeTo(controller) > 3) {
                movement.moveTo(creep, controller);
            } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.upgradeController(controller);
            } else {
                // Emergency fallback: wait for hauler drops or harvest if strictly needed
                // But prompt says: "Upgraders must not wander or pull from sources unless in emergency fallback."
                // Wait/Sleep if no container.
            }
        }
    } catch (e) {
        console.log(`[Upgrader Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
    }
}

module.exports = { run };
