/**
 * @file remoteHarvesterHunter.js
 * @description Specialized creep role for hunting remote harvesters in neutral or enemy rooms.
 */

const movement = require('../utils/movement');
const CombatManager = require('../managers/CombatManager');
const CombatTacticsEngine = require('../utils/CombatTacticsEngine');

module.exports = {
    /**
     * Executes logic for remoteHarvesterHunter role.
     * @param {Room} room The room in which the logic executes.
     */
    run(room) {
        if (!global.State || !global.State.creepsByRoom) return;

        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const hunters = roomCreeps.get('remoteHarvesterHunter');
        if (!hunters || hunters.length === 0) return;

        for (const creep of hunters) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                const targetRoomName = creep.memory.targetRoom;
                if (!targetRoomName) continue;

                if (creep.room.name !== targetRoomName) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                // Move off exit
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                const hostilesMap = global.State.hostilesByRoom.get(targetRoomName);
                const hostiles = hostilesMap ? Array.from(hostilesMap.values()) : [];

                // Identify enemy harvesters (creeps with WORK parts)
                const harvesters = [];
                for (let i = 0; i < hostiles.length; i++) {
                    const h = hostiles[i];
                    if (h.getActiveBodyparts && h.getActiveBodyparts(WORK) > 0) {
                        harvesters.push(h);
                    } else if (h.body) {
                         // Fallback check if getActiveBodyparts isn't populated perfectly in mocked test envs
                         for(let j = 0; j < h.body.length; j++) {
                             if (h.body[j].type === WORK) {
                                 harvesters.push(h);
                                 break;
                             }
                         }
                    }
                }

                // Kite if taking damage or fighting a dangerous target
                // We use all hostiles for kiting to avoid getting killed by defenders while hunting harvesters
                const kiteIntents = CombatTacticsEngine.planKite(creep, hostiles);
                if (kiteIntents && kiteIntents.length > 0) {
                    const fleeIntent = kiteIntents.find(i => i.action === 'flee');
                    if (fleeIntent && fleeIntent.target) {
                        movement.moveTo(creep, fleeIntent.target);

                        // Attack while kiting if possible
                        const bestTarget = CombatManager.getBestTarget(creep, harvesters.length > 0 ? harvesters : hostiles);
                        if (bestTarget && creep.pos.getRangeTo(bestTarget) <= 1) {
                            creep.attack(bestTarget);
                        }
                        continue;
                    }
                }

                let target = null;
                if (harvesters.length > 0) {
                    // Find the closest harvester
                    let minDistance = Infinity;
                    for (let i = 0; i < harvesters.length; i++) {
                        const h = harvesters[i];
                        const dist = creep.pos.getRangeTo(h);
                        if (dist < minDistance) {
                            minDistance = dist;
                            target = h;
                        }
                    }
                }

                if (target) {
                    if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else {
                    // Go to center if no targets found
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                }

            } catch (e) {
                console.log(`[remoteHarvesterHunter Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
