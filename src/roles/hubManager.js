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
            if (creep.heap.state === 'fill_link' || creep.heap.state === 'empty_link') {
                const srcId = creep.heap.sourceId;
                const tgtId = creep.heap.targetId;

                if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                    const src = Game.getObjectById(srcId);
                    if (src && creep.pos.isNearTo(src)) {
                        creep.withdraw(src, RESOURCE_ENERGY);
                    }
                } else {
                    const tgt = Game.getObjectById(tgtId);
                    if (tgt && creep.pos.isNearTo(tgt)) {
                        creep.transfer(tgt, RESOURCE_ENERGY);
                    }
                }
            }
        } catch (e) {
            console.log(`[hubManager Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };