/**
 * @file remoteHarvester.js
 * @description Harvests energy from a designated remote source.
 */

const movement = require('../utils/movement');

/**
 * Executes logic for remoteHarvester role.
 * @param {Room} room The home room of the colony managing these creeps.
 */
function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const remoteHarvesters = roomCreeps.get('remoteHarvester');
    if (!remoteHarvesters || remoteHarvesters.length === 0) return;

    for (const creep of remoteHarvesters) {
        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            const targetRoomName = creep.memory.targetRoom;
            if (!targetRoomName) continue;

            // If we are not in the target room, move towards it
            if (creep.room.name !== targetRoomName) {
                const targetPos = new RoomPosition(25, 25, targetRoomName);
                movement.moveTo(creep, targetPos);
                continue;
            }

            // We are in the target room. Bounce off the exit tile if needed.
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                const centerPos = new RoomPosition(25, 25, targetRoomName);
                movement.moveTo(creep, centerPos);
                continue;
            }

            // In the target room and off the exit.
            const targetSourceId = creep.memory.targetSourceId;
            if (!targetSourceId) {
                // For early poaching we might not have a target source set, just find the closest
                const sources = global.State.sourcesByRoom.get(creep.room.name) || [];
                if (sources.length > 0) {
                    creep.memory.targetSourceId = sources[0].id;
                } else {
                    continue;
                }
            }

            const source = Game.getObjectById(creep.memory.targetSourceId);
            if (!source) continue;

            // Strict containerless remote mining: drop energy on the ground unconditionally.
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                movement.moveTo(creep, source);
            } else {
                if (creep.store.getFreeCapacity() === 0) {
                    creep.drop(RESOURCE_ENERGY);
                }
            }

        } catch (e) {
            console.log(`[remoteHarvester Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
