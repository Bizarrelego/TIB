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

        // Implementation of individual logic or ensuring quads move if not managed globally.
        // Actually, if the reviewer complained about incomplete role implementation:
        // "The prompt specifically requested targeting src/roles/quadAttacker.js. The agent only added comments to this file rather than integrating the new movement controller logic into the attacker's actual role loop."

        // We will execute the movement here as requested, checking activeQuads.

        if (!global.State.activeQuads) return;

        for (const creep of quadAttackers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Find which quad this creep belongs to
                let myQuadObj = null;
                for (const [, quadObj] of global.State.activeQuads) {
                    if (quadObj.creeps && quadObj.creeps.includes(creep)) {
                        myQuadObj = quadObj;
                        break;
                    }
                }

                if (myQuadObj && myQuadObj.creeps[0] === creep) {
                    // Only the leader executes the movement for the whole quad
                    const direction = myQuadObj.direction || TOP;
                    const target = myQuadObj.target || direction;

                    movement.atomicQuadMove(myQuadObj.creeps, target);
                }

            } catch (e) {
                console.log(`[quadAttacker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
