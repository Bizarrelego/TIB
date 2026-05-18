/**
 * @file remoteDefender.js
 * @description Paths to remotes, eliminates hostiles via heatmaps, avoids core defenders.
 */

const CombatManager = require('../managers/CombatManager');
const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for remoteDefender role.
     * @param {Room} room The room in which the logic executes.
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const remoteDefenders = roomCreeps.get('remoteDefender');
        if (!remoteDefenders || remoteDefenders.length === 0) return;

        for (const creep of remoteDefenders) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                const targetRoomName = creep.memory.targetRoom;
                if (!targetRoomName) continue;

                if (creep.room.name !== targetRoomName) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                // Move off exit
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                const hostiles = global.State.hostilesByRoom.get(targetRoomName) || [];

                // Kite if taking damage or fighting a dangerous target
                if (CombatManager.kite(creep, hostiles)) {
                    // Attack while kiting if possible
                    const bestTarget = CombatManager.getBestTarget(creep, hostiles);
                    if (bestTarget && creep.pos.getRangeTo(bestTarget) <= 1) {
                        creep.attack(bestTarget);
                    }
                    continue;
                }

                const bestTarget = CombatManager.getBestTarget(creep, hostiles);
                if (bestTarget) {
                    if (creep.attack(bestTarget) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, bestTarget);
                    }
                } else {
                    // Go to center if no targets found
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                }

            } catch (e) {
                console.log(`[remoteDefender Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
