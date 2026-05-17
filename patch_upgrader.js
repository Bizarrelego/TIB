const fs = require('fs');

const content = `const movement = require('../utils/movement');

// Upgraders must be static. Move once, then stay forever.
function run(creep, room) {
    if (room.memory.haltUpgrades) return;

    const controller = room.controller;
    if (!controller) return;

    try {
        if (creep.fatigue > 0) return;

        // Lock position near controller and pull from drop pile
        if (creep.pos.getRangeTo(controller) > 3) {
            movement.moveTo(creep, controller);
        } else {
            // Find dropped energy
            const dropped = global.State.droppedByRoom.get(room.name) || new Map();
            let targetDrop = null;
            for (const drop of dropped.values()) {
                if (drop.resourceType === RESOURCE_ENERGY && creep.pos.isNearTo(drop)) {
                    targetDrop = drop;
                    break;
                }
            }

            if (targetDrop && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                creep.pickup(targetDrop);
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.upgradeController(controller);
            }
        }
    } catch (e) {
        console.log(\`[Upgrader Role Error] Room \${room.name}, Creep \${creep.name}: \${e.stack}\`);
    }
}

module.exports = { run };
`;

fs.writeFileSync('src/roles/upgrader.js', content);
