/**
 * @file remoteHauler.js
 * @description Transports energy from a remote room back to the home colony.
 */

const movement = require('../utils/movement');

/**
 * Executes logic for remoteHauler role.
 * @param {Room} room The home room of the colony managing these creeps.
 */
function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const remoteHaulers = roomCreeps.get('remoteHauler');
    if (!remoteHaulers || remoteHaulers.length === 0) return;

    for (const creep of remoteHaulers) {
        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            const remoteRoomName = creep.memory.remoteRoom;
            const homeRoomName = creep.memory.homeRoom || room.name;

            if (!remoteRoomName || !homeRoomName) continue;

            if (creep.memory.hauling && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.hauling = false;
            }
            if (!creep.memory.hauling && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.hauling = true;
            }

            const state = creep.heap.state;
            const targetId = creep.heap.targetId;

            if (state === 'pickup') {
                if (creep.room.name !== remoteRoomName) {
                    movement.moveTo(creep, new RoomPosition(25, 25, remoteRoomName));
                    continue;
                }
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    movement.moveTo(creep, new RoomPosition(25, 25, remoteRoomName));
                    continue;
                }

                if (!targetId) continue;
                const target = Game.getObjectById(targetId);
                if (target) {
                    if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                }
            } else if (state === 'transfer') {
                if (creep.room.name !== homeRoomName) {
                    movement.moveTo(creep, new RoomPosition(25, 25, homeRoomName));
                    continue;
                }
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    movement.moveTo(creep, new RoomPosition(25, 25, homeRoomName));
                    continue;
                }

                if (!targetId) continue;
                const target = Game.getObjectById(targetId);
                if (target) {
                    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                }
            }

                } catch (e) {
            console.log(`[remoteHauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
