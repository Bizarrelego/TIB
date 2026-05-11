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
            const structures = global.State.structuresByRoom.get(room.name);
            const target = global.State.droppedByRoom.get(room.name)?.find(r => r.pos.isNearTo(creep)) ||
                           structures?.get(STRUCTURE_LINK)?.find(s => s.pos.isNearTo(creep)) ||
                           structures?.get(STRUCTURE_CONTAINER)?.find(s => s.pos.isNearTo(creep));

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
