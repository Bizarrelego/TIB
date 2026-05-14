/**
 * @file drainerHunter.js
 * @description Steps 1 tile into tower range, eats damage, heals, uses I-frame bouncing.
 */

const movement = require('../utils/movement');
const CombatManager = require('../managers/CombatManager');

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

        let hostiles = [];
        if (global.State.hostilesByRoom && global.State.hostilesByRoom.has(room.name)) {
            hostiles = global.State.hostilesByRoom.get(room.name);
        }

        for (const creep of drainerHunters) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // 1. Predictive Pre-Healing
                CombatManager.predictivePreHeal(creep, enemyTowers, hostiles);

                const targetRoomName = creep.memory.targetRoom;

                // 2. Border Bouncing (I-Frames)
                if (creep.hits < creep.hitsMax * 0.5) {
                    if (creep.memory.homeRoom) {
                        CombatManager.borderBounce(creep, creep.memory.homeRoom);
                    }
                    continue;
                }

                // If healthy and not in target room, move in
                if (room.name !== targetRoomName && creep.hits === creep.hitsMax) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                // 3. Set target selection strictly to the nearest element within the enemyTowers array
                if (room.name === targetRoomName) {
                    if (enemyTowers.length > 0) {
                        // Find nearest enemy tower
                        let targetTower = enemyTowers[0];
                        let minRange = creep.pos.getRangeTo(targetTower);
                        for (let i = 1; i < enemyTowers.length; i++) {
                            const range = creep.pos.getRangeTo(enemyTowers[i]);
                            if (range < minRange) {
                                minRange = range;
                                targetTower = enemyTowers[i];
                            }
                        }

                        if (creep.pos.getRangeTo(targetTower) > 5) {
                            movement.moveTo(creep, targetTower);
                        } else if (creep.pos.getRangeTo(targetTower) < 5) {
                            // Step back slightly
                            const dir = creep.pos.getDirectionTo(targetTower);
                            const oppositeDir = ((dir + 3) % 8) + 1;
                            creep.move(oppositeDir);
                        }
                    } else if (hostiles.length > 0) {
                        // Kiting when no towers left
                        CombatManager.kite(creep, hostiles);
                    }
                }

            } catch (e) {
                console.error(`[drainerHunter Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
