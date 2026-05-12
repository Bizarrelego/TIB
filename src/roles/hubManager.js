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

            // 1. Move to optimized park position
            if (creep.heap.parkPos) {
                if (creep.pos.x !== creep.heap.parkPos.x || creep.pos.y !== creep.heap.parkPos.y) {
                    movement.moveTo(creep, new RoomPosition(creep.heap.parkPos.x, creep.heap.parkPos.y, creep.heap.parkPos.roomName));
                    
                    // Allow intent maximization if adjacent enough during travel
                    if (!creep.pos.isNearTo(creep.heap.parkPos.x, creep.heap.parkPos.y)) {
                        continue;
                    }
                }
            }

            // 2. Execute Assigned Sub-tick Intents
            // The actual calls to creep.withdraw and creep.transfer are now handled inside
            // managers/hubManager.js using TrafficManager sub-tick ledgers.
            // When creep.heap.state is SLEEP, we do nothing to save CPU.
            if (creep.heap.state === 'SLEEP') {
                continue;
            }
        } catch (e) {
            console.log(`[hubManager Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };