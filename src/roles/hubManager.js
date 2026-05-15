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

            const parkPos = creep.heap.parkPos;
            const state = creep.heap.state;
            const sourceId = creep.heap.sourceId;
            const targetId = creep.heap.targetId;

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
            // The LogisticsManager sets the pipeline locks.

            // For creeps that may be temporarily out of sync, we keep the fallback execution here:
            if (
                state === 'fill_link' || state === 'empty_link' ||
                state === 'fill_terminal' || state === 'empty_terminal' ||
                state === 'fill_storage' || state === 'empty_storage'
            ) {
                const srcId = sourceId;
                const tgtId = targetId;

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