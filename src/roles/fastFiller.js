const movement = require('../utils/movement');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const fastFillers = roomCreeps.get('fastFiller');
    if (!fastFillers) return;

    for (let i = 0; i < fastFillers.length; i++) {
        const creep = fastFillers[i];
        try {
            creep.heap = creep.heap || {};
            if (creep.fatigue > 0) continue; // Fatigue gating

            const heapIsMap = creep.heap instanceof Map;
            const parkPos = heapIsMap ? creep.heap.get('parkPos') : creep.heap.parkPos;
            const state = heapIsMap ? creep.heap.get('state') : creep.heap.state;
            const sourceId = heapIsMap ? creep.heap.get('sourceId') : creep.heap.sourceId;
            const targetId = heapIsMap ? creep.heap.get('targetId') : creep.heap.targetId;

            // Move to parkPos if not there
            if (parkPos) {
                if (creep.pos.x !== parkPos.x || creep.pos.y !== parkPos.y) {
                    movement.moveTo(creep, new RoomPosition(parkPos.x, parkPos.y, parkPos.roomName));
                    // Intentionally avoid skipping tick to allow Intents to process if adjacent
                    if (!creep.pos.isNearTo(parkPos.x, parkPos.y)) {
                        continue; // Wait until arrived or adjacent enough
                    }
                }
            }

            // Note: The execution of the withdraw() or transfer() intent is handled by TrafficManager's
            // `executeIntents()` pipeline ledger mechanism.
            // The LogisticsManager sets the pipeline locks.

            // For creeps that may be temporarily out of sync, we keep the fallback execution here:
            if (state === 'emptying' && targetId) {
                if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    const tgt = Game.getObjectById(targetId);
                    if (tgt && creep.pos.isNearTo(tgt)) {
                        creep.transfer(tgt, RESOURCE_ENERGY);
                    }
                }
            } else if (state === 'filling' && sourceId) {
                 if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    const src = Game.getObjectById(sourceId);
                    if (src && creep.pos.isNearTo(src)) {
                        creep.withdraw(src, RESOURCE_ENERGY);
                    }
                 }
            }
        } catch (e) {
            console.log(`[fastFiller Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
