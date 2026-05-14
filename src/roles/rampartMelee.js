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

                // Retreat logic
                if (creep.hits < creep.hitsMax * 0.3) {
                    const spawns = global.State.spawnsByRoom.get(room.name) || [];
                    if (spawns.length > 0) {
                        movement.moveTo(creep, spawns[0].pos);
                    }
                    continue;
                }

                // Assign parkPos if not set
                if (!creep.memory.parkPos) {
                    const structuresMap = global.State.structuresByRoom.get(room.name);
                    if (structuresMap) {
                        const ramparts = structuresMap.get(STRUCTURE_RAMPART) || [];
                        if (ramparts.length > 0) {
                            const origin = room.controller || (global.State.spawnsByRoom.get(room.name) || [])[0];
                            if (origin) {
                                let closestRampart = null;
                                let minDist = Infinity;
                                for (const rampart of ramparts) {
                                    const dist = Math.max(Math.abs(rampart.pos.x - origin.pos.x), Math.abs(rampart.pos.y - origin.pos.y));
                                    if (dist < minDist) {
                                        minDist = dist;
                                        closestRampart = rampart;
                                    }
                                }
                                if (closestRampart) {
                                    creep.memory.parkPos = { x: closestRampart.pos.x, y: closestRampart.pos.y, roomName: closestRampart.pos.roomName };
                                }
                            }
                        }
                    }
                }

                // Pathing to parkPos
                let parked = false;
                if (creep.memory.parkPos) {
                    const parkPos = new RoomPosition(creep.memory.parkPos.x, creep.memory.parkPos.y, creep.memory.parkPos.roomName);
                    if (creep.pos.x !== parkPos.x || creep.pos.y !== parkPos.y) {
                        movement.moveTo(creep, parkPos);
                    } else {
                        parked = true;
                    }
                }

                // Combat logic
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
                console.error(`[rampartMelee Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
