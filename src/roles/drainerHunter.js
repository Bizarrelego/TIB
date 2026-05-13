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

        const roomStructures = global.State.structuresByRoom.get(room.name) || new Map();
        const towers = roomStructures.get(STRUCTURE_TOWER) || [];
        const enemyTowers = towers.filter(t => !t.my);

        for (const creep of drainerHunters) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Predictive Pre-Healing
                // Check if any enemy tower is within range 5 using state instead of findInRange
                const towerInRange = enemyTowers.some(t => creep.pos.getRangeTo(t) <= 5);

                if (creep.hits < creep.hitsMax || towerInRange) {
                    creep.heal(creep);
                }

                const targetRoomName = creep.memory.targetRoom;

                // Border Bouncing (I-Frames)
                // If taking heavy damage, step back to adjacent room
                if (creep.hits < creep.hitsMax * 0.5) {
                    if (room.name === targetRoomName) {
                        // Find nearest exit and step out
                        // Finding exits strictly relies on room pathing/terrain, but avoiding findClosestByPath is better.
                        // Assuming movement.moveTo can handle a RoomPosition at the exit or a direction.
                        // Simplest alternative is moving towards the spawn/home if we must retreat, but
                        // here we just fallback to a cached or memory exit dir to avoid FIND_.
                        // For this implementation, we will use the direction towards the center of the home room,
                        // assuming memory.homeRoom exists.
                        if (creep.memory.homeRoom) {
                           movement.moveTo(creep, new RoomPosition(25, 25, creep.memory.homeRoom));
                        }
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
                    if (enemyTowers.length > 0) {
                        const targetTower = enemyTowers[0]; // Simple targeting
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
