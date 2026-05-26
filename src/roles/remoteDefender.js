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

                const state = creep.heap.state;
                const targetId = creep.heap.targetId;

                if (state === 'kite') {
                    if (targetId) {
                        const kiteTarget = Game.getObjectById(targetId);
                        if (kiteTarget && creep.pos.isNearTo(kiteTarget)) {
                            creep.attack(kiteTarget);
                        }
                    }
                    continue; // Kiting movement already handled or should be handled by manager, or fallback
                }

                if (targetId) {
                    const target = Game.getObjectById(targetId);
                    if (target) {
                        if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        }
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
