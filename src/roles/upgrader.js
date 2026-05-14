const movement = require('../utils/movement');

// Upgraders must be static. Move once, then stay forever.
function run(creep, room) {
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

        // Prioritize assigned source from UpgraderManager
        let target = null;
        if (creep.heap.sourceId) {
            target = Game.getObjectById(creep.heap.sourceId);
            if (target && (
                (target.resourceType && target.amount > 0) ||
                (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
            )) {
                // Keep target
            } else {
                target = null;
            }
        }

        if (!target) {
            if (creep.heap.targetId) {
                target = Game.getObjectById(creep.heap.targetId);
                // Invalidate if missing or empty
                if (!target ||
                    (target.resourceType && target.amount === 0) ||
                    (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
                    target = null;
                    creep.heap.targetId = null;
                }
            }

            if (!target) {
                const structures = global.State.structuresByRoom.get(room.name);
                const links = structures?.get(STRUCTURE_LINK) || [];
                const containers = structures?.get(STRUCTURE_CONTAINER) || [];
                const dropped = global.State.droppedByRoom.get(room.name) || [];

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

                if (target) {
                    creep.heap.targetId = target.id;
                }
            }
        }

        if (target && creep.store.getFreeCapacity() > 0) {
            if (target.resourceType) {
                creep.pickup(target);
            } else {
                creep.withdraw(target, RESOURCE_ENERGY);
            }
        }
    } catch (e) {
        console.log(`[Upgrader Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
    }
}

// Export the module
module.exports = { run };
