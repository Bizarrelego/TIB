/**
 * @file quadAttacker.js
 * @description Atomic lockstep movement. Works with quadHealer.
 */

const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for quadAttacker role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const quadAttackers = roomCreeps.get('quadAttacker');
        if (!quadAttackers || quadAttackers.length === 0) return;

        for (const creep of quadAttackers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                creep.heap = creep.heap || {};

                // Note: The actual quad atomic movement and synchronized burst is managed
                // in src/operations/offense.js so here we just do basic attack/heal
                // if there are hostiles nearby, assuming offense manager moves us.

                const hostiles = global.State.hostilesByRoom.get(room.name);
                let target = null;
                if (hostiles && hostiles.size > 0) {
                    let minRange = Infinity;
                    for (const h of hostiles.values()) {
                        const range = creep.pos.getRangeTo(h);
                        if (range < minRange) {
                            minRange = range;
                            target = h;
                        }
                    }
                }

                if (target && creep.pos.getRangeTo(target) <= 1) {
                    creep.attack(target);
                } else if (target && creep.pos.getRangeTo(target) <= 3) {
                    creep.rangedAttack(target);
                }
            } catch (e) {
                console.error(`[quadAttacker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
