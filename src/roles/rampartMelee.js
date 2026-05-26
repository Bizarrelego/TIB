/**
 * @file rampartMelee.js
 * @description Parks on choke-points and strikes adjacent enemies. Logic provided by manager.
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

                const parkPos = creep.heap.parkPos;
                if (parkPos) {
                    if (creep.pos.x !== parkPos.x || creep.pos.y !== parkPos.y) {
                        movement.moveTo(creep, parkPos);
                        continue;
                    }
                }

                const targetId = creep.heap.targetId;
                if (targetId) {
                    const target = Game.getObjectById(targetId);
                    if (target && creep.pos.isNearTo(target)) {
                        creep.attack(target);
                    }
                }
            } catch (e) {
                console.log(`[rampartMelee Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};