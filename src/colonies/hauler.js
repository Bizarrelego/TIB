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
                    let dropId = creep.heap.dropId;
                    let target = dropId ? Game.getObjectById(dropId) : null;

                    // Re-evaluate target if missing or empty
                    if (!target || (target.amount === 0) || (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
                        target = null;
                        const droppedEnergy = global.State.droppedEnergyByRoom.get(room.name) || [];
                        const tombstones = global.State.tombstonesByRoom.get(room.name) || [];
                        const ruins = global.State.ruinsByRoom.get(room.name) || [];

                        let minDistance = Infinity;

                        // Fast Chebyshev inline lookup
                        const checkTarget = (t) => {
                            const dist = Math.max(Math.abs(creep.pos.x - t.pos.x), Math.abs(creep.pos.y - t.pos.y));
                            if (dist < minDistance) {
                                minDistance = dist;
                                target = t;
                            }
                        };

                        for (let i = 0; i < droppedEnergy.length; i++) checkTarget(droppedEnergy[i]);
                        for (let i = 0; i < tombstones.length; i++) checkTarget(tombstones[i]);
                        for (let i = 0; i < ruins.length; i++) checkTarget(ruins[i]);

                        if (target) {
                            creep.heap.dropId = target.id;
                        } else {
                            creep.heap.dropId = null;
                        }
                    }

                    if (target) {
                        if (target.amount !== undefined) {
                            // Target is a dropped resource
                            if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        } else {
                            // Target is a tombstone or ruin
                            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        }
                    }
                } else {
                    creep.heap.dropId = null; 

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