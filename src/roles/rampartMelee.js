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

                if (creep.memory.parkPos) {
                    const parkPos = new RoomPosition(creep.memory.parkPos.x, creep.memory.parkPos.y, creep.memory.parkPos.roomName);
                    if (creep.pos.x !== parkPos.x || creep.pos.y !== parkPos.y || creep.room.name !== parkPos.roomName) {
                        movement.moveTo(creep, parkPos);
                        continue;
                    }
                }

                // Find hostiles in range 1
                let hostilesInRange = [];
                if (global.State.hostilesByRoom && global.State.hostilesByRoom.has(room.name)) {
                    const hostiles = global.State.hostilesByRoom.get(room.name);
                    hostilesInRange = hostiles.filter(h => creep.pos.getRangeTo(h) <= 1);
                }

                if (hostilesInRange.length > 0) {
                    // Prioritize ATTACK, then RANGED_ATTACK, then lowest hits
                    hostilesInRange.sort((a, b) => {
                        let aAttack = a.body ? a.body.some(p => p.type === ATTACK) : true;
                        let bAttack = b.body ? b.body.some(p => p.type === ATTACK) : true;
                        if (aAttack && !bAttack) return -1;
                        if (!aAttack && bAttack) return 1;

                        let aRanged = a.body ? a.body.some(p => p.type === RANGED_ATTACK) : true;
                        let bRanged = b.body ? b.body.some(p => p.type === RANGED_ATTACK) : true;
                        if (aRanged && !bRanged) return -1;
                        if (!aRanged && bRanged) return 1;

                        return a.hits - b.hits;
                    });

                    creep.attack(hostilesInRange[0]);
                } else {
                    if (creep.hits < creep.hitsMax && creep.body.some(p => p.type === HEAL)) {
                        creep.heal(creep);
                    } else {
                        // Find damaged ramparts or walls on or adjacent
                        if (global.State.structuresByRoom && global.State.structuresByRoom.has(room.name)) {
                            const structures = global.State.structuresByRoom.get(room.name);
                            const ramparts = structures.get(STRUCTURE_RAMPART) || [];
                            const walls = structures.get(STRUCTURE_WALL) || [];

                            const targets = ramparts.concat(walls).filter(s => creep.pos.getRangeTo(s) <= 1 && s.hits < s.hitsMax);
                            if (targets.length > 0) {
                                targets.sort((a, b) => a.hits - b.hits);
                                creep.repair(targets[0]);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`[rampartMelee Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
