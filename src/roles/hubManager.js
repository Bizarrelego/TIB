const movement = require('../utils/movement');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const hubManagers = roomCreeps.get('hubManager');
    if (!hubManagers || hubManagers.length === 0) return;

    for (let i = 0; i < hubManagers.length; i++) {
        const creep = hubManagers[i];

        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            // Compatibility for both Map and standard object heap
            const heapIsMap = creep.heap instanceof Map;
            const parkPos = heapIsMap ? creep.heap.get('parkPos') : creep.heap.parkPos;

            // 1. Move to optimized park position
            if (parkPos) {
                if (creep.pos.x !== parkPos.x || creep.pos.y !== parkPos.y) {
                    movement.moveTo(creep, new RoomPosition(parkPos.x, parkPos.y, parkPos.roomName));
                    
                    // Allow intent maximization if adjacent enough during travel
                    if (!creep.pos.isNearTo(parkPos.x, parkPos.y)) {
                        continue;
                    }
                }
            }

            // Note: The execution of the withdraw() or transfer() intent is handled by TrafficManager's
            // `executeIntents()` pipeline ledger mechanism.
            // The HubManager sets the pipeline locks.

            // Fallback execution removed to rely exclusively on TrafficManager pipeline locks
            // and avoid double-execution.
        } catch (e) {
            console.log(`[hubManager Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };