const movement = require('../utils/movement');
const LinkManager = require('../managers/LinkManager');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const upgraders = roomCreeps.get('upgrader');
    if (!upgraders) return;

    for (let i = 0; i < upgraders.length; i++) {
        const creep = upgraders[i];

        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                if (room.controller) {
                    if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, room.controller);
                    }
                }
            }

            if (creep.store.getFreeCapacity() > 0) {
                const controllerLink = LinkManager.getControllerLink(room.name);

                if (controllerLink) {
                    if (creep.pos.isNearTo(controllerLink)) {
                        creep.withdraw(controllerLink, RESOURCE_ENERGY);
                    } else {
                        movement.moveTo(creep, controllerLink);
                    }
                } else {
                    // Fallback to container or dropped energy
                    const structuresMap = global.State.structuresByRoom.get(room.name);
                    let target = null;
                    if (structuresMap) {
                        const containers = structuresMap.get(STRUCTURE_CONTAINER) || [];
                        for (let j = 0; j < containers.length; j++) {
                            if (containers[j].store.getUsedCapacity(RESOURCE_ENERGY) > 0 && containers[j].pos.inRangeTo(room.controller, 3)) {
                                target = containers[j];
                                break;
                            }
                        }
                    }

                    if (target) {
                        if (creep.pos.isNearTo(target)) {
                            creep.withdraw(target, RESOURCE_ENERGY);
                        } else {
                            movement.moveTo(creep, target);
                        }
                    } else {
                        // Avoid room.find per constraints.
                        // Wait for controller link or just move to controller
                        if (room.controller) {
                            movement.moveTo(creep, room.controller);
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`[Upgrader Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
