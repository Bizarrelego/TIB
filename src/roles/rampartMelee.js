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

                creep.heap = creep.heap || {};

                // 1. Swap logic if HP is low
                if (creep.hits < creep.hitsMax * 0.3) {
                    // Try to find a backup to swap with
                    let backup = null;
                    for (const other of rampartMelees) {
                        if (other.id !== creep.id && other.hits > other.hitsMax * 0.8 && creep.pos.isNearTo(other)) {
                            backup = other;
                            break;
                        }
                    }
                    if (backup) {
                        // We use TrafficManager's swap feature indirectly by issuing move commands,
                        // but since we are natively polling for swaps, we can just register with traffic manager if it was exposed.
                        // For now we will rely on standard move which might queue a swap.
                        const dirToBackup = creep.pos.getDirectionTo(backup);
                        creep.move(dirToBackup);
                        continue;
                    }
                }

                // 2. Park on a rampart if not already
                let onRampart = false;
                const structures = creep.room.lookForAt(LOOK_STRUCTURES, creep.pos);
                for (const s of structures) {
                    if (s.structureType === STRUCTURE_RAMPART) {
                        onRampart = true;
                        break;
                    }
                }

                if (!onRampart && creep.memory.targetRampartId) {
                    const targetRampart = Game.getObjectById(creep.memory.targetRampartId);
                    if (targetRampart) {
                        movement.moveTo(creep, targetRampart.pos);
                    }
                }

                // 3. Attack nearby hostiles (Range 1)
                const hostiles = global.State.hostilesByRoom.get(room.name);
                if (hostiles && hostiles.size > 0) {
                    let target = null;
                    for (const h of hostiles.values()) {
                        if (creep.pos.getRangeTo(h) <= 1) {
                            target = h;
                            break;
                        }
                    }
                    if (target) {
                        creep.attack(target);
                    }
                }
            } catch (e) {
                console.error(`[rampartMelee Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
