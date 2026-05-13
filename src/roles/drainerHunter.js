/**
 * @file drainerHunter.js
 * @description Steps 1 tile into tower range, eats damage, heals, uses I-frame bouncing.
 */

const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for drainerHunter role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const drainerHunters = roomCreeps.get('drainerHunter');
        if (!drainerHunters || drainerHunters.length === 0) return;

        for (const creep of drainerHunters) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Predictive Pre-Healing
                if (creep.hits < creep.hitsMax || creep.pos.findInRange(FIND_HOSTILE_STRUCTURES, 5, { filter: s => s.structureType === STRUCTURE_TOWER }).length > 0) {
                    creep.heal(creep);
                }

                const targetRoomName = creep.memory.targetRoom;

                // Border Bouncing (I-Frames)
                // If taking heavy damage, step back to adjacent room
                if (creep.hits < creep.hitsMax * 0.5) {
                    if (room.name === targetRoomName) {
                        // Find nearest exit and step out
                        const exit = creep.pos.findClosestByPath(FIND_EXIT);
                        if (exit) movement.moveTo(creep, exit);
                        continue;
                    } else {
                        // Already in safe room, just heal
                        continue;
                    }
                }

                // If healthy and not in target room, move in
                if (room.name !== targetRoomName && creep.hits === creep.hitsMax) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                // In target room, healthy: Bait towers
                if (room.name === targetRoomName) {
                    // Find a tile that is exactly at the edge of tower range
                    // Scaffolding: Move towards a tower but stop at range 5 (or appropriate range)
                    const towers = room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
                    if (towers.length > 0) {
                        const targetTower = towers[0];
                        if (creep.pos.getRangeTo(targetTower) > 5) {
                            movement.moveTo(creep, targetTower);
                        } else if (creep.pos.getRangeTo(targetTower) < 5) {
                            // Step back slightly
                            const dir = creep.pos.getDirectionTo(targetTower);
                            const oppositeDir = ((dir + 3) % 8) + 1;
                            creep.move(oppositeDir);
                        }
                    }
                }

            } catch (e) {
                console.error(`[drainerHunter Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
