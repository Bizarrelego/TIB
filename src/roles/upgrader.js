const movement = require('../utils/movement');

// Upgraders must be static. Move once, then stay forever.
function run(creep, room) {
    if (room.memory.haltUpgrades) return;

    const controller = room.controller;
    if (!controller) return;

    try {
        if (creep.fatigue > 0) return;

        if (!creep.heap.rangeToController) {
            creep.heap.rangeToController = creep.pos.getRangeTo(controller);
        }

        // Move to assigned park position
        if (creep.heap.parkPos) {
            // Need to create RoomPosition object if it's deserialized as a simple object
            const targetPos = new RoomPosition(creep.heap.parkPos.x, creep.heap.parkPos.y, creep.heap.parkPos.roomName);
            if (!creep.pos.isEqualTo(targetPos)) {
                movement.moveTo(creep, targetPos);
                creep.heap.rangeToController = creep.pos.getRangeTo(controller);
                return;
            }
        } else if (creep.heap.rangeToController > 3) {
            // Ensure we are parked on the static spot.
            movement.moveTo(creep, controller);
            // Update range cache only while moving
            creep.heap.rangeToController = creep.pos.getRangeTo(controller);
            return;
        }

        // Static logic: Only work if energy is present (delivered by Haulers)
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            creep.upgradeController(controller);
        }

        let controllerContainer = null;
        const structures = global.State.structuresByRoom.get(room.name);
        const containers = structures ? (structures.get(STRUCTURE_CONTAINER) || new Map()) : new Map();

        for (const container of containers.values()) {
            if (container.pos.inRangeTo(controller, 3)) {
                controllerContainer = container;
                break;
            }
        }

        if (controllerContainer) {
            if (!creep.pos.isEqualTo(controllerContainer.pos)) {
                movement.moveTo(creep, controllerContainer);
            } else {
                // Once on the container, withdraw and upgrade simultaneously
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && controllerContainer.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    creep.withdraw(controllerContainer, RESOURCE_ENERGY);
                }
            }
        } else {
            // Wait / Sleep if no container
            if (creep.heap.rangeToController > 3) {
                movement.moveTo(creep, controller);
            }
        }
    } catch (e) {
        console.log(`[Upgrader Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
    }
}

// Export the module
module.exports = { run };
