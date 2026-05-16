/**
 * @file rampartMelee.js
 * @description Parks on choke-points. Swaps with backups at <30% HP. Range 1 targeting.
 */

const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for rampartMelee role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const rampartMelees = roomCreeps.get('rampartMelee');
        if (!rampartMelees || rampartMelees.length === 0) return;

        for (const creep of rampartMelees) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // If retreating, clear memory.parkPos so defense.js doesn't immediately assign a new one,
                // and skip the move-to-parkPos logic.
                if (creep.heap.retreating) {
                    delete creep.memory.parkPos; // Ensure it doesn't get rehydrated
                }

                // State machine assigned by defense.js top-down.
                // We should expect creep.heap.parkPos to be assigned if missing
                if (!creep.heap.retreating && !creep.heap.parkPos && creep.memory.parkPos) {
                    creep.heap.parkPos = creep.memory.parkPos;
                }

                let parked = false;
                if (!creep.heap.retreating && creep.heap.parkPos) {
                    if (creep.pos.x !== creep.heap.parkPos.x || creep.pos.y !== creep.heap.parkPos.y) {
                        movement.moveTo(creep, creep.heap.parkPos);
                    } else {
                        parked = true;
                    }
                }

                // Combat logic without native distance checks (rely on state and simple O(N) Chebyshev)
                let hostilesInRange = false;
                const hostiles = global.State.hostilesByRoom.get(room.name) || [];
                for (const hostile of hostiles) {
                    if (Math.max(Math.abs(creep.pos.x - hostile.pos.x), Math.abs(creep.pos.y - hostile.pos.y)) <= 1) {
                        creep.attack(hostile);
                        hostilesInRange = true;
                        break;
                    }
                }

                // Energy acquisition and repair logic if stationed on rampart and no immediate threats
                if (!hostilesInRange && parked) {
                    let shouldRepair = false;
                    let targetRampart = null;

                    const structuresMap = global.State.structuresByRoom.get(room.name);
                    if (structuresMap) {
                        const ramparts = structuresMap.get(STRUCTURE_RAMPART) || [];
                        for (const rampart of ramparts) {
                            if (rampart.pos.x === creep.pos.x && rampart.pos.y === creep.pos.y) {
                                if (rampart.hits < rampart.hitsMax) {
                                    shouldRepair = true;
                                    targetRampart = rampart;
                                }
                                break;
                            }
                        }
                    }

                    if (shouldRepair && targetRampart) {
                        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                            // Try to pick up dropped energy
                            const droppedMap = global.State.droppedByRoom ? global.State.droppedByRoom.get(room.name) : null;
                            if (droppedMap) {
                                const energies = droppedMap.get(RESOURCE_ENERGY) || [];
                                for (const energy of energies) {
                                    if (Math.max(Math.abs(creep.pos.x - energy.pos.x), Math.abs(creep.pos.y - energy.pos.y)) <= 1) {
                                        creep.pickup(energy);
                                        break;
                                    }
                                }
                            }

                            // Try to withdraw from nearby container/storage/link if no dropped energy or picking up failed
                            if (structuresMap) {
                                const containers = structuresMap.get(STRUCTURE_CONTAINER) || [];
                                const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
                                const links = structuresMap.get(STRUCTURE_LINK) || [];

                                const sources = [...containers, ...storages, ...links];
                                for (const source of sources) {
                                    if (Math.max(Math.abs(creep.pos.x - source.pos.x), Math.abs(creep.pos.y - source.pos.y)) <= 1) {
                                        if (source.store && source.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                                            creep.withdraw(source, RESOURCE_ENERGY);
                                            break;
                                        }
                                    }
                                }
                            }
                        } else {
                            creep.repair(targetRampart);
                        }
                    }
                }

            } catch (e) {
                console.log(`[rampartMelee Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
