const TrafficManager = require('../traffic/trafficManager');
const movement = require('../utils/movement');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const fastFillers = roomCreeps.get('fastFiller');
    if (!fastFillers || fastFillers.length === 0) return;

    for (let i = 0; i < fastFillers.length; i++) {
        const creep = fastFillers[i];
        try {
            if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

            const state = creep.heap.state;
            const targetId = creep.heap.targetId;
            const parkPos = creep.heap.parkPos;

            if (parkPos) {
                const targetPos = new RoomPosition(parkPos.x, parkPos.y, parkPos.roomName || room.name);
                if (creep.pos.x !== targetPos.x || creep.pos.y !== targetPos.y) {
                    movement.moveTo(creep, targetPos);
                    continue;
                }
            }

            TrafficManager.registerStatic(creep);

            if (!state || !targetId) continue;

            const target = Game.getObjectById(targetId);
            if (!target) continue;

            if (state === 'filling') {
                if (target.amount !== undefined) {
                    if (TrafficManager.registerPickup) {
                        TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY);
                    } else {
                        creep.pickup(target);
                    }
                } else {
                    if (TrafficManager.registerWithdraw) {
                        TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY);
                    } else {
                        creep.withdraw(target, RESOURCE_ENERGY);
                    }
                }
            } else if (state === 'emptying') {
                if (TrafficManager.registerTransfer) {
                    TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY);
                } else {
                    creep.transfer(target, RESOURCE_ENERGY);
                }
            }
        } catch (e) {
            console.log(`[fastFiller Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };