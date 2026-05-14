/**
 * @file remoteDefender.js
 * @description Paths to remotes, eliminates hostiles via heatmaps, avoids core defenders.
 */

const movement = require('../utils/movement');
const CombatManager = require('../managers/CombatManager');

module.exports = {
    /**
     * Executes logic for remoteDefender role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const remoteDefenders = roomCreeps.get('remoteDefender');
        if (!remoteDefenders || remoteDefenders.length === 0) return;

        for (const creep of remoteDefenders) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                const targetRoom = creep.memory.targetRoom;

                if (creep.room.name !== targetRoom) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoom));
                    continue;
                }

                let hostiles = [];
                if (global.State.hostilesByRoom && global.State.hostilesByRoom.has(room.name)) {
                    hostiles = global.State.hostilesByRoom.get(room.name);
                }

                const kited = CombatManager.kite(creep, hostiles);

                if (!kited && hostiles.length > 0) {
                    // Attack highest priority hostile
                    const bestTarget = CombatManager.getBestTarget(creep, hostiles) || hostiles.sort((a, b) => {
                        let aAttack = a.body ? a.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK) : true;
                        let bAttack = b.body ? b.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK) : true;
                        if (aAttack && !bAttack) return -1;
                        if (!aAttack && bAttack) return 1;

                        let aHeal = a.body ? a.body.some(p => p.type === HEAL) : false;
                        let bHeal = b.body ? b.body.some(p => p.type === HEAL) : false;
                        if (aHeal && !bHeal) return -1;
                        if (!aHeal && bHeal) return 1;

                        let aWork = a.body ? a.body.some(p => p.type === WORK) : false;
                        let bWork = b.body ? b.body.some(p => p.type === WORK) : false;
                        if (aWork && !bWork) return -1;
                        if (!aWork && bWork) return 1;

                        return a.hits - b.hits;
                    })[0];

                    if (bestTarget) {
                        if (creep.pos.getRangeTo(bestTarget) <= 3 && creep.body.some(p => p.type === RANGED_ATTACK)) {
                            creep.rangedAttack(bestTarget);
                        } else if (creep.pos.getRangeTo(bestTarget) <= 1 && creep.body.some(p => p.type === ATTACK)) {
                            creep.attack(bestTarget);
                        } else {
                            movement.moveTo(creep, bestTarget);
                        }
                    }
                } else if (!kited && hostiles.length === 0) {
                    // Patrol / move to center
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoom));
                }

            } catch (e) {
                console.error(`[remoteDefender Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
