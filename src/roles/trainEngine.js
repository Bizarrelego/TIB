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
                creep.heap = creep.heap || {};
            }

            // 1. Find a cart to pair with
            let pairedCartId = creep.heap.cartId || (creep.heap instanceof Map ? creep.heap.get('cartId') : null);
            let cart = pairedCartId ? Game.getObjectById(pairedCartId) : null;

            if (!cart) {
                if (trainCarts && trainCarts.length > 0) {
                    for (let j = 0; j < trainCarts.length; j++) {
                        const potentialCart = trainCarts[j];
                        const cartHeap = potentialCart.heap instanceof Map ? potentialCart.heap : (potentialCart.heap || {});
                        const cartEngineId = cartHeap instanceof Map ? cartHeap.get('engineId') : cartHeap.engineId;
                        if (!cartEngineId || cartEngineId === creep.id) {
                            cart = potentialCart;
                            pairedCartId = cart.id;
                            if (creep.heap instanceof Map) {
                                creep.heap.set('cartId', cart.id);
                            } else {
                                creep.heap.cartId = cart.id;
                            }
                            if (cart.heap instanceof Map) {
                                cart.heap.set('engineId', creep.id);
                            } else {
                                cart.heap.engineId = creep.id;
                            }
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
            if (cart.heap instanceof Map) {
                cart.heap.set('pulledBy', creep.id);
            } else {
                cart.heap.pulledBy = creep.id;
            }

            // 4. Move to cart's destination
            let destinationId = null;
            const state = cart.heap instanceof Map ? cart.heap.get('state') : cart.heap.state;

            if (state === 'pickup') {
                destinationId = cart.heap instanceof Map ? cart.heap.get('dropId') : cart.heap.dropId;
            } else if (state === 'transfer') {
                destinationId = cart.heap instanceof Map ? cart.heap.get('targetId') : cart.heap.targetId;
            }

            if (destinationId) {
                let targetPos = null;
                if (destinationId === 'controller') {
                    if (room.controller) targetPos = room.controller.pos;
                } else {
                    const target = Game.getObjectById(destinationId);
                    if (target) targetPos = target.pos;
                }

                if (targetPos) {
                    // Engine must position cart adjacent to target.
                    // If cart is not adjacent to target, engine must keep moving towards it,
                    // or move ONTO the target if it's a structure (unless obstacle)
                    // Simplest fix: The engine paths until the CART is near the target.
                    if (!cart.pos.isNearTo(targetPos)) {
                        movement.moveTo(creep, targetPos);
                    } else if (creep.pos.isNearTo(targetPos)) {
                        // Cart is near target, but engine is also near.
                        // We must swap or let the cart do its job.
                        // Actually, if the cart is near the target, it can execute its action!
                        // So if cart is near, we just stop moving the engine.
                        // Cart will execute transfer/withdraw in trainCart.js.
                    }
                }
            }

        } catch (e) {
            console.log(`[trainEngine Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
