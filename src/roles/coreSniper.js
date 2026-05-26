/**
 * @file coreSniper.js
 * @description Core Sniping: Block or kill upgraders in low RCL rooms to trigger controller downgrading and wipe neighbors. This role is crucial for asymmetric warfare.
 */

const movement = require('../utils/movement');
const CombatManager = require('../managers/CombatManager');

module.exports = {
    /**
     * Executes logic for coreSniper role.
     * @param {Room} room
     */
    run(room) {
        if (!global.State || !global.State.creepsByRoom) return;

        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const coreSnipers = roomCreeps.get('coreSniper');
        if (!coreSnipers || coreSnipers.length === 0) return;

        for (const creep of coreSnipers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Basic self-preservation logic: retreat if heavily damaged
                if (creep.hits < creep.hitsMax * 0.5) {
                    const homeRoom = creep.memory.homeRoom;
                    if (homeRoom) {
                        CombatManager.borderBounce(creep, homeRoom);
                        continue;
                    }
                }

                const targetRoomName = creep.memory.targetRoom;
                if (!targetRoomName) continue;

                // Move to target room
                if (creep.room.name !== targetRoomName) {
                    const targetPos = new RoomPosition(25, 25, targetRoomName);
                    movement.moveTo(creep, targetPos);
                    continue;
                }

                const targetId = creep.heap.targetId;
                const state = creep.heap.state;

                if (!targetId) {
                    // Go to center if no targets found
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                const target = Game.getObjectById(targetId);
                if (!target) {
                    creep.heap.targetId = null;
                    creep.heap.state = null;
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                if (state === 'attack') {
                    if (creep.pos.isNearTo(target)) {
                        creep.attack(target);
                        // Move with target if it flees
                        movement.moveTo(creep, target);
                    } else {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'attackController') {
                    if (creep.pos.isNearTo(target)) {
                        creep.attackController(target);
                    } else {
                        movement.moveTo(creep, target);
                    }
                }
            } catch (e) {
                console.log(`[coreSniper Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
