/**
 * @file emergencyBuilder.js
 * @description Ignores all standard logic. Mines nearest node, directly refills spawn.
 */


module.exports = {
    /**
     * Executes logic for emergencyBuilder role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const emergencyBuilders = roomCreeps.get('emergencyBuilder');
        if (!emergencyBuilders || emergencyBuilders.length === 0) return;

        for (const creep of emergencyBuilders) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                if (creep.store.getFreeCapacity() > 0) {
                    const source = creep.pos.findClosestByPath(FIND_SOURCES) || creep.pos.findClosestByRange(FIND_SOURCES);
                    if (source) {
                        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(source);
                        }
                    }
                } else {
                    const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS) || creep.pos.findClosestByRange(FIND_MY_SPAWNS);
                    if (spawn) {
                        if (creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(spawn);
                        }
                    }
                }
            } catch (e) {
                console.log(`[emergencyBuilder Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
