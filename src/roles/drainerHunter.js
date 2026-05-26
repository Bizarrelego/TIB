/**
 * @file drainerHunter.js
 * @description Hunts drainers based on Top-Down assignments.
 */

const movement = require('../utils/movement');

module.exports = {
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const hunters = roomCreeps.get('drainerHunter');
        if (!hunters || hunters.length === 0) return;

        for (const creep of hunters) {
            try {
                if (creep.fatigue > 0) continue;

                const targetId = creep.heap.targetId;
                if (!targetId) continue;

                const target = Game.getObjectById(targetId);
                if (target) {
                    if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                }
            } catch (e) {
                console.log(`[drainerHunter Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};