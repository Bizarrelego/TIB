const movement = require('../utils/movement');

module.exports = {
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const haulers = roomCreeps.get('hauler');
        if (!haulers) return;

        for (const creep of haulers) {
            try {
                if (creep.store.getFreeCapacity() > 0) {
                    // Empty/Filling mode
                    let dropId = creep.heap.dropId;
                    let target = dropId ? Game.getObjectById(dropId) : null;

                    if (!target || target.amount === 0) {
                        // Find dropped energy
                        const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
                            filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 0
                        });

                        if (droppedEnergy.length > 0) {
                            const nearestEnergy = creep.pos.findClosestByRange(droppedEnergy);
                            if (nearestEnergy) {
                                target = nearestEnergy;
                                creep.heap.dropId = target.id;
                            }
                        } else {
                            creep.heap.dropId = null;
                        }
                    }

                    if (target) {
                        if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        }
                    }
                } else {
                    // Full/Refill mode
                    creep.heap.dropId = null; // Clear drop target when full

                    let target = null;
                    const structures = global.State.structuresByRoom.get(room.name);

                    if (structures) {
                        const spawns = structures.get(STRUCTURE_SPAWN) || [];
                        for (let i = 0; i < spawns.length; i++) {
                            if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                target = spawns[i];
                                break;
                            }
                        }
                        if (!target) {
                            const extensions = structures.get(STRUCTURE_EXTENSION) || [];
                            for (let i = 0; i < extensions.length; i++) {
                                if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                    target = extensions[i];
                                    break;
                                }
                            }
                        }
                    }

                    if (target) {
                        const result = creep.transfer(target, RESOURCE_ENERGY);
                        if (result === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        }
                    } else if (room.controller) {
                        // No spawns/extensions to fill, refill controller instead or park?
                        // "If core structures are full, refill the Controller (Priority 2)."
                        // We will transfer energy to the controller (upgrade it) since haulers have CARRY and WORK? No haulers only have CARRY.
                        // Wait, haulers have CARRY and MOVE, they can't upgrade.
                        // The user said: "If core structures are full, refill the Controller (Priority 2)."
                        // You can't "refill" a controller by transfer, you have to upgrade. But a Hauler body is `[CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE]`.
                        // Transfer to controller drops the resource? No, transfer to controller is `transfer(target, RESOURCE_ENERGY)` which might drop it or return error for controllers.
                        // Let's implement transfer anyway as requested, maybe it's dropping to a link/container later, or it means dropping at controller.
                        // ACTUALLY, if we just drop near the controller, workers can upgrade.
                        // Or if the prompt literally says "refill the Controller (Priority 2)" using `transfer` might be what they mean if they assume haulers can upgrade, or drop near it.
                        // A controller does not have a `.store` so transfer returns ERR_INVALID_TARGET.
                        // Let's just drop near it.
                        if (creep.pos.inRangeTo(room.controller, 3)) {
                            creep.drop(RESOURCE_ENERGY);
                        } else {
                            movement.moveTo(creep, room.controller);
                        }
                    }
                }
            } catch (e) {
                console.log(`[Hauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
