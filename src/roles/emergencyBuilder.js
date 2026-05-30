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

                if (!creep.heap) creep.heap = {};

                if (creep.heap.working && creep.store[RESOURCE_ENERGY] === 0) creep.heap.working = false;
                if (!creep.heap.working && creep.store.getFreeCapacity() === 0) creep.heap.working = true;

                if (!creep.heap.working) {
                    const sources = global.State.sourcesByRoom.get(room.name) || [];
                    let source = null;
                    let minRange = Infinity;
                    for (const s of sources) {
                        const range = creep.pos.getRangeTo(s);
                        if (range < minRange) {
                            minRange = range;
                            source = s;
                        }
                    }
                    if (source) {
                        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(source);
                        }
                    }
                } else {
                    const structuresMap = global.State.structuresByRoom.get(room.name) || new Map();
                    const spawnsMap = structuresMap.get(STRUCTURE_SPAWN) || new Map();
                    let spawn = null;
                    let minRange = Infinity;
                    for (const sp of spawnsMap.values()) {
                        const range = creep.pos.getRangeTo(sp);
                        if (range < minRange) {
                            minRange = range;
                            spawn = sp;
                        }
                    }
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
