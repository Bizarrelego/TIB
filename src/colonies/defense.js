/**
 * @file defense.js
 * @description Manages DEFCON handling, ramparts, and killbox funneling.
 */

const { determineDefcon, DEFCON } = require('../constants/defcon');
const eventBus = require('../os/eventBus');
const rampartMelee = require('../roles/rampartMelee');
// SpawnQueueManager is now accessed indirectly via eventBus for decoupling

module.exports = {
    /**
     * Runs defense logistics for a given room.
     * @param {Room} room
     */
    run(room) {
        try {
            const defconLevel = determineDefcon(room.name);

            if (defconLevel <= DEFCON.CRITICAL) {
                room.memory.haltUpgrades = true;
            } else {
                room.memory.haltUpgrades = false;
            }

            let defenseRepairTarget = null;
            const structuresMap = global.State.structuresByRoom ? global.State.structuresByRoom.get(room.name) : null;

            // Basic logic for repairing critical structures (ramparts, then walls)
            if (structuresMap) {
                const ramparts = structuresMap.get(STRUCTURE_RAMPART) || [];
                const walls = structuresMap.get(STRUCTURE_WALL) || [];

                let lowestHits = Infinity;

                for (const rampart of ramparts) {
                    if (rampart.hits < rampart.hitsMax && rampart.hits < lowestHits) {
                        lowestHits = rampart.hits;
                        defenseRepairTarget = rampart;
                    }
                }

                if (!defenseRepairTarget || defconLevel > DEFCON.CRITICAL) {
                    for (const wall of walls) {
                        if (wall.hits < wall.hitsMax && wall.hits < lowestHits) {
                            lowestHits = wall.hits;
                            defenseRepairTarget = wall;
                        }
                    }
                }
            }

            eventBus.publish('DEFENSE_REPAIR_REQUEST', { room, defenseRepairTarget });

            if (defconLevel <= DEFCON.ALERT) {
                // Request rampartMelee creeps when under attack
                const roomCreeps = global.State.creepsByRoom ? global.State.creepsByRoom.get(room.name) : null;
                let rampartMeleeCount = 0;

                if (roomCreeps) {
                    const rampartMelees = roomCreeps.get('rampartMelee');
                    if (rampartMelees) {
                        rampartMeleeCount = rampartMelees.length;
                    }
                }

                // We must use a proxy or global memory map if we want to decouple completely, but since
                // SpawnQueueManager.globalQueue isn't available, we rely on room memory or just publish blindly
                // and let the Queue handle duplicates (SpawnQueueManager already prevents duplicates natively).

                // Assuming we aim for 1-2 rampartMelee creeps based on DEFCON severity
                const targetCount = defconLevel <= DEFCON.CRITICAL ? 2 : 1;

                if (rampartMeleeCount < targetCount) {
                    eventBus.publish('REQUEST_RAMPART_MELEE', { room });
                }
            }

            // Top-down assignment of targets for rampartMelee
            const roomCreeps = global.State.creepsByRoom ? global.State.creepsByRoom.get(room.name) : null;
            if (roomCreeps) {
                const rampartMelees = roomCreeps.get('rampartMelee') || [];
                for (const creep of rampartMelees) {
                    if (!creep.heap) creep.heap = {};

                    if (!creep.heap.parkPos) {
                        const structuresMapLocal = global.State.structuresByRoom ? global.State.structuresByRoom.get(room.name) : null;
                        if (structuresMapLocal) {
                            const rampartsLocal = structuresMapLocal.get(STRUCTURE_RAMPART) || [];
                            if (rampartsLocal.length > 0) {
                                const originLocal = room.controller || (global.State.spawnsByRoom && global.State.spawnsByRoom.get(room.name) && global.State.spawnsByRoom.get(room.name)[0]);
                                if (originLocal) {
                                    let closestRampart = null;
                                    let minDist = Infinity;
                                    for (const rampart of rampartsLocal) {
                                        const dist = Math.max(Math.abs(rampart.pos.x - originLocal.pos.x), Math.abs(rampart.pos.y - originLocal.pos.y));
                                        if (dist < minDist) {
                                            minDist = dist;
                                            closestRampart = rampart;
                                        }
                                    }
                                    if (closestRampart) {
                                        // Cache as simple coordinate object
                                        creep.heap.parkPos = { x: closestRampart.pos.x, y: closestRampart.pos.y, roomName: closestRampart.pos.roomName };
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Execute defender roles
            rampartMelee.run(room);

        } catch (e) {
            console.error(`[DefenseManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
};
