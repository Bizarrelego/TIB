const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');

/**
 * @file skMiner.js
 * @description Zero-pathing harvester for Source Keepers sectors.
 */

module.exports = {
    /**
     * Executes logic for skMiner role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name) || new Map();
        const miners = roomCreeps.get('skMiner') || [];
        if (miners.length === 0) return;

        for (const creep of miners) {
            try {
                if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                const targetSourceId = creep.heap.targetSourceId;
                const targetRoomName = creep.memory.targetRoom;

                if (!targetSourceId || !targetRoomName) continue;

                if (creep.room.name !== targetRoomName) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                // In target room, find source via global state
                const sources = global.State.sourcesByRoom.get(targetRoomName) || [];
                let targetSource = null;
                for (const source of sources) {
                    if (source.id === targetSourceId) {
                        targetSource = source;
                        break;
                    }
                }

                if (!targetSource) continue; // Source might be out of vision or invalid

                if (!creep.pos.isNearTo(targetSource)) {
                    movement.moveTo(creep, targetSource);
                    continue;
                }

                // Adjacent to source, zero pathing starts
                TrafficManager.registerHarvest(creep, targetSource);

                // If the creep is full or almost full, it should drop energy if container isn't handling it,
                // but usually skMiner works without dedicated container in early phases or drops it on ground.
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    // It will drop naturally via generic logic or we can force drop
                    creep.drop(RESOURCE_ENERGY);
                }

            } catch (e) {
                console.log(`[skMiner Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
