const movement = require('../utils/movement');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const trainEngines = roomCreeps.get('trainEngine');
    const trainCarts = roomCreeps.get('trainCart');

    if (!trainEngines || trainEngines.length === 0) return;

    for (let i = 0; i < trainEngines.length; i++) {
        const creep = trainEngines[i];

        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            if (!(creep.heap instanceof Map)) {
                creep.heap = new Map();
            }

            // 1. Find a cart to pair with
            let pairedCartId = creep.heap.get('cartId');
            let cart = pairedCartId ? (global.State.creepLookup && global.State.creepLookup.get(pairedCartId)) : null;

            if (!cart) {
                if (trainCarts && trainCarts.length > 0) {
                    for (let j = 0; j < trainCarts.length; j++) {
                        const potentialCart = trainCarts[j];

                        if (!(potentialCart.heap instanceof Map)) {
                            potentialCart.heap = new Map();
                        }
                        const cartHeap = potentialCart.heap;
                        const cartEngineId = cartHeap.get('engineId');

                        const engineIsDead = cartEngineId && (!global.State.creepLookup || !global.State.creepLookup.get(cartEngineId));

                        if (!cartEngineId || cartEngineId === creep.id || engineIsDead) {
                            cart = potentialCart;
                            pairedCartId = cart.id;
                            creep.heap.set('cartId', cart.id);
                            cartHeap.set('engineId', creep.id);
                            break;
                        }
                    }
                }
            }

            if (!cart) {
                // No cart available, idle or move out of way
                continue;
            }

            // 2. Move to cart if not adjacent
            if (!creep.pos.isNearTo(cart)) {
                movement.moveTo(creep, cart);
                continue;
            }

            // 3. Pull cart
            creep.pull(cart);

            // Signal cart that it is being pulled this tick
            cart.heap.set('pulledBy', creep.id);

            // 4. Move to cart's destination
            let destinationId = null;
            const state = cart.heap.get('state');

            if (state === 'pickup') {
                destinationId = cart.heap.get('dropId');
            } else if (state === 'transfer') {
                destinationId = cart.heap.get('targetId');
            }

            if (destinationId) {
                let targetPos = null;
                if (destinationId === 'controller') {
                    if (room.controller) targetPos = room.controller.pos;
                } else {
                    let target = (global.State.structureCache && global.State.structureCache.get(destinationId)) ||
                                 (global.State.creepLookup && global.State.creepLookup.get(destinationId));

                    if (!target && state === 'pickup' && global.State.droppedByRoom) {
                        const dropped = global.State.droppedByRoom.get(room.name) || [];
                        for (let k = 0; k < dropped.length; k++) {
                            if (dropped[k].id === destinationId) {
                                target = dropped[k];
                                break;
                            }
                        }
                    }

                    if (target) targetPos = target.pos;
                }

                if (targetPos) {
                    if (!cart.pos.isNearTo(targetPos)) {
                        if (creep.pos.isNearTo(targetPos)) {
                            // Engine is adjacent but cart is not. Swap with cart to pull it into range.
                            movement.moveTo(creep, cart);
                        } else {
                            // Neither are near, standard move
                            movement.moveTo(creep, targetPos);
                        }
                    }
                }
            }

        } catch (e) {
            console.log(`[trainEngine Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
