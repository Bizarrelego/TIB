/**
 * @file quadAttacker.js
 * @description Integrates with QuadSquadManager to define targets and track health for rotation.
 */

const CombatManager = require('../managers/CombatManager');

module.exports = {
    /**
     * Executes logic for quadAttacker role.
     * Delegates actual movement and attacking to QuadSquadManager.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const quadAttackers = roomCreeps.get('quadAttacker');
        if (!quadAttackers || quadAttackers.length === 0) return;

        if (!global.State.activeQuads) return;

        for (const creep of quadAttackers) {
            try {
                if (creep.fatigue > 0) continue;

                let myQuadObj = null;
                for (const [, quadObj] of global.State.activeQuads) {
                    if (quadObj.creeps && quadObj.creeps.includes(creep)) {
                        myQuadObj = quadObj;
                        break;
                    }
                }

                if (!myQuadObj) continue;

                // Only leader sets the target
                if (myQuadObj.creeps[0] === creep) {
                    const hostiles = global.State.hostilesByRoom ? global.State.hostilesByRoom.get(room.name) : null;
                    const target = CombatManager.getBestTarget(creep, hostiles);

                    if (target) {
                        myQuadObj.target = target;
                        myQuadObj.action = 'attack';
                    } else {
                        // Fallback: move to middle of room or rally point
                        myQuadObj.target = new RoomPosition(25, 25, room.name);
                        myQuadObj.action = 'move';
                    }

                    // Check for rotation if front line takes heavy damage
                    if (creep.hits < creep.hitsMax * 0.8) {
                        myQuadObj.needsRotation = true;
                    }
                }
            } catch (e) {
                console.log(`[quadAttacker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
