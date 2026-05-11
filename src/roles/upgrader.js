const movement = require('../utils/movement');

// Upgraders must be static. Move once, then stay forever.
function run(room) {
    const upgraders = global.State.creepsByRoom.get(room.name)?.get('upgrader') || [];
    const controller = global.State.controllersByRoom.get(room.name);

    if (!controller) return;

    for (const creep of upgraders) {
        try {
            if (creep.fatigue > 0) continue;

            // Ensure we are parked on the static spot.
            // Do NOT use movement if already in range of controller.
            if (creep.pos.getRangeTo(controller) > 3) {
                movement.moveTo(creep, controller);
                continue;
            }

            // Static logic: Only work if energy is present (delivered by Haulers)
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.upgradeController(controller);
            }

            // Pickup dropped energy or withdraw from link if available without moving
            let target = null;
            if (!creep.heap.resourceMap) {
                creep.heap.resourceMap = new Map();
            }

            const structures = global.State.structuresByRoom.get(room.name);
            const links = structures?.get(STRUCTURE_LINK) || [];
            const containers = structures?.get(STRUCTURE_CONTAINER) || [];
            const dropped = global.State.droppedByRoom.get(room.name) || [];

            // Simple iteration to avoid array.find() O(N*M) loop anti-pattern
            for (let i = 0; i < dropped.length; i++) {
                if (creep.pos.isNearTo(dropped[i].pos)) {
                    target = dropped[i];
                    break;
                }
            }

            if (!target) {
                for (let i = 0; i < links.length; i++) {
                    if (creep.pos.isNearTo(links[i].pos)) {
                        target = links[i];
                        break;
                    }
                }
            }

            if (!target) {
                for (let i = 0; i < containers.length; i++) {
                    if (creep.pos.isNearTo(containers[i].pos)) {
                        target = containers[i];
                        break;
                    }
                }
            }

            if (target && creep.store.getFreeCapacity() > 0) {
                if (target.resourceType) creep.pickup(target);
                else creep.withdraw(target, RESOURCE_ENERGY);
            }
        } catch (e) {
            console.log(`[Upgrader Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
