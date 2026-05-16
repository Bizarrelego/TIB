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
            let cart = pairedCartId ? Game.getObjectById(pairedCartId) : null;

            if (!cart) {
                if (trainCarts && trainCarts.length > 0) {
                    for (let j = 0; j < trainCarts.length; j++) {
                        const potentialCart = trainCarts[j];

                        if (!(potentialCart.heap instanceof Map)) {
                            potentialCart.heap = new Map();
                        }
                        const cartHeap = potentialCart.heap;
                        const cartEngineId = cartHeap.get('engineId');

                        if (!cartEngineId || cartEngineId === creep.id || !Game.getObjectById(cartEngineId)) {
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
                    const target = Game.getObjectById(destinationId);
                    if (target) targetPos = target.pos;
                }

                if (targetPos) {
                    if (!cart.pos.isNearTo(targetPos)) {
                        if (creep.pos.isNearTo(targetPos)) {
                            // Engine is adjacent but cart is not. Find another empty adjacent tile.
                            const terrain = Game.map.getRoomTerrain(room.name);
                            let moved = false;
                            for (let dx = -1; dx <= 1; dx++) {
                                for (let dy = -1; dy <= 1; dy++) {
                                    if (dx === 0 && dy === 0) continue;
                                    const tx = targetPos.x + dx;
                                    const ty = targetPos.y + dy;
                                    if (tx < 0 || tx > 49 || ty < 0 || ty > 49) continue;
                                    if (terrain.get(tx, ty) === TERRAIN_MASK_WALL) continue;

                                    // Make sure we aren't picking the tile we are already standing on
                                    if (tx === creep.pos.x && ty === creep.pos.y) continue;

                                    // Avoid structures if possible
                                    let hasSolid = false;
                                    if (global.State && global.State.structuresByRoom) {
                                        const structuresMap = global.State.structuresByRoom.get(room.name);
                                        if (structuresMap) {
                                            for (const structs of structuresMap.values()) {
                                                for (const s of structs) {
                                                    if (s.pos.x === tx && s.pos.y === ty && OBSTACLE_OBJECT_TYPES.includes(s.structureType)) {
                                                        hasSolid = true;
                                                        break;
                                                    }
                                                }
                                                if (hasSolid) break;
                                            }
                                        }
                                    }
                                    if (!hasSolid) {
                                        movement.moveTo(creep, new RoomPosition(tx, ty, room.name));
                                        moved = true;
                                        break;
                                    }
                                }
                                if (moved) break;
                            }
                            // Fallback if no specific tile was found
                            if (!moved) movement.moveTo(creep, targetPos);
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
