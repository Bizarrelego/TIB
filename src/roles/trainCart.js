function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const trainCarts = roomCreeps.get('trainCart');
    if (!trainCarts || trainCarts.length === 0) return;

    for (let i = 0; i < trainCarts.length; i++) {
        const creep = trainCarts[i];

        try {
            if (!(creep.heap instanceof Map)) {
                creep.heap = creep.heap || {};
            }

            // 1. Follow engine if pulled
            const pulledById = creep.heap instanceof Map ? creep.heap.get('pulledBy') : creep.heap.pulledBy;
            if (pulledById) {
                const engine = Game.getObjectById(pulledById);
                if (engine) {
                    creep.move(engine);
                }
                // Reset signal for next tick
                if (creep.heap instanceof Map) {
                    creep.heap.set('pulledBy', null);
                } else {
                    creep.heap.pulledBy = null;
                }
            }

            // 2. Execute resource transfers (fallback for TrafficManager)
            // Note: TrafficManager executes pipeline ledger intents, but cart
            // might need to perform fallback API calls if the pipeline doesn't catch it
            // correctly due to custom routing.
            const state = creep.heap instanceof Map ? creep.heap.get('state') : creep.heap.state;

            if (state === 'pickup') {
                const dropId = creep.heap instanceof Map ? creep.heap.get('dropId') : creep.heap.dropId;
                if (dropId) {
                    const target = Game.getObjectById(dropId);
                    if (target && creep.pos.isNearTo(target)) {
                        if (target.amount !== undefined) {
                            creep.pickup(target);
                        } else {
                            creep.withdraw(target, RESOURCE_ENERGY);
                        }
                    }
                }
            } else if (state === 'transfer') {
                const targetId = creep.heap instanceof Map ? creep.heap.get('targetId') : creep.heap.targetId;
                if (targetId) {
                    if (targetId === 'controller') {
                        if (room.controller && creep.pos.inRangeTo(room.controller, 3)) {
                            creep.drop(RESOURCE_ENERGY);
                        }
                    } else {
                        const target = Game.getObjectById(targetId);
                        if (target && creep.pos.isNearTo(target)) {
                            creep.transfer(target, RESOURCE_ENERGY);
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`[trainCart Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
