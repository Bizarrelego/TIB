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

            // Move to parkPos if not there
            if (creep.heap.parkPos) {
                if (creep.pos.x !== creep.heap.parkPos.x || creep.pos.y !== creep.heap.parkPos.y) {
                    movement.moveTo(creep, new RoomPosition(creep.heap.parkPos.x, creep.heap.parkPos.y, creep.heap.parkPos.roomName));
                    continue; // Wait until arrived
                }
            }

            if (creep.heap.state === 'emptying') {
                // Emptying (Transferring)
                const targetId = creep.heap.transferTargetId;
                if (targetId) {
                    const target = Game.getObjectById(targetId);
                    if (target && creep.pos.isNearTo(target)) {
                        creep.transfer(target, RESOURCE_ENERGY);
                    }
                }
            } else if (creep.heap.state === 'filling') {
                // Filling (Withdrawing)
                const targetId = creep.heap.withdrawTargetId;
                if (targetId) {
                    const target = Game.getObjectById(targetId);
                    if (target && creep.pos.isNearTo(target)) {
                        creep.withdraw(target, RESOURCE_ENERGY);
                    }
                }
            }
        } catch (e) {
            console.log(`[fastFiller Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
