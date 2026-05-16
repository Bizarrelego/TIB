function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const trainCarts = roomCreeps.get('trainCart');
    if (!trainCarts || trainCarts.length === 0) return;

    for (let i = 0; i < trainCarts.length; i++) {
        const creep = trainCarts[i];

        try {
            if (!(creep.heap instanceof Map)) {
                creep.heap = new Map();
            }

            // 1. Follow engine if pulled
            const pulledById = creep.heap.get('pulledBy');
            if (pulledById) {
                const engine = (global.State.creepLookup && global.State.creepLookup.get(pulledById));
                if (engine) {
                    creep.move(engine);
                }
                // Reset signal for next tick
                creep.heap.set('pulledBy', null);
            }

            // 2. Execute resource transfers (fallback for TrafficManager)
            // Note: TrafficManager executes pipeline ledger intents, but cart
            // might need to perform fallback API calls if the pipeline doesn't catch it
            // correctly due to custom routing.
            const state = creep.heap.get('state');

            if (state === 'pickup') {
                const dropId = creep.heap.get('dropId');
                if (dropId) {
                    let target = (global.State.structureCache && global.State.structureCache.get(dropId)) ||
                                 (global.State.creepLookup && global.State.creepLookup.get(dropId));

                    if (!target && global.State.droppedByRoom) {
                        const dropped = global.State.droppedByRoom.get(room.name) || [];
                        for (let k = 0; k < dropped.length; k++) {
                            if (dropped[k].id === dropId) {
                                target = dropped[k];
                                break;
                            }
                        }
                    }

                    if (target && creep.pos.isNearTo(target)) {
                        if (target.amount !== undefined) {
                            creep.pickup(target);
                        } else {
                            creep.withdraw(target, RESOURCE_ENERGY);
                        }
                    }
                }
            } else if (state === 'transfer') {
                const targetId = creep.heap.get('targetId');
                if (targetId) {
                    if (targetId === 'controller') {
                        if (room.controller && creep.pos.inRangeTo(room.controller, 3)) {
                            creep.drop(RESOURCE_ENERGY);
                        }
                    } else {
                        const target = (global.State.structureCache && global.State.structureCache.get(targetId)) ||
                                       (global.State.creepLookup && global.State.creepLookup.get(targetId));
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
