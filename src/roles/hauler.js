const TrafficManager = require('../traffic/trafficManager');
const movement = require('../utils/movement');
const { isWalkable } = require('../utils/roomPositionUtils');

function getUpgraderAnchor(room) {
    if (!global.State.upgraderAnchors) global.State.upgraderAnchors = new Map();
    if (global.State.upgraderAnchors.has(room.name)) return global.State.upgraderAnchors.get(room.name);
    const cpos = room.controller.pos;
    for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) {
                const x = cpos.x + dx;
                const y = cpos.y + dy;
                if (isWalkable(room.name, x, y)) {
                    const pos = new RoomPosition(x, y, room.name);
                    global.State.upgraderAnchors.set(room.name, pos);
                    return pos;
                }
            }
        }
    }
    return null;
}

module.exports = {
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const haulers = roomCreeps.get('hauler');
        if (!haulers) return;


        for (const creep of haulers) {
            try {
                if (creep.fatigue > 0) continue;

                const state = creep.heap.state;
                const targetId = creep.heap.targetId;

                if (!state || !targetId) continue;

                const target = Game.getObjectById(creep.heap.targetId);

                if (creep.heap.state === 'pickup' || creep.heap.state === 'withdraw') {
                    if (target) {
                        if (target.amount !== undefined) {
                            const status = TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, creep.store.getFreeCapacity());
                            if (status !== OK && creep.pos.getRangeTo(target) > 1) {
                                movement.moveTo(creep, target);
                            }
                        } else {
                            const status = TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY, creep.store.getFreeCapacity());
                            if (status !== OK && creep.pos.getRangeTo(target) > 1) {
                                movement.moveTo(creep, target);
                            }
                        }
                    }
                } else if (creep.heap.state === 'transfer') {
                    if (target) {
                        const amount = Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), TrafficManager.getVirtualState(target, RESOURCE_ENERGY).free);
                        if (amount > 0 && TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, amount) === OK) {
                            TrafficManager.lockPipeline(creep.name, creep.id, target.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                        } else if (creep.pos.getRangeTo(target) > 1) {
                            movement.moveTo(creep, target);
                        }
                    } else if (creep.heap.targetId === 'controller' && room.controller) {
                        const anchor = getUpgraderAnchor(room);
                        if (anchor) {
                            if (creep.pos.getRangeTo(anchor) > 1) {
                                movement.moveTo(creep, anchor);
                            } else {
                                creep.drop(RESOURCE_ENERGY);
                            }
                        } else {
                            movement.moveTo(creep, room.controller);
                        }
                    }
                }
            } catch (e) {
                console.log(`[Hauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
