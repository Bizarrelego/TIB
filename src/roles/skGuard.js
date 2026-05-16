const movement = require('../utils/movement');

/**
 * @file skGuard.js
 * @description Guard for SK sectors. Tracks lair spawn ticks to engage Source Keepers.
 */

module.exports = {
    /**
     * Executes logic for skGuard role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name) || new Map();
        const guards = roomCreeps.get('skGuard') || [];
        if (guards.length === 0) return;

        for (const creep of guards) {
            try {
                if (creep.fatigue > 0) continue;

                const targetRoomName = creep.memory.targetRoom;

                if (!targetRoomName) continue;

                if (creep.room.name !== targetRoomName) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    if (creep.hits < creep.hitsMax) creep.heal(creep);
                    continue;
                }

                // In target room
                let isEngaged = false;
                const hostiles = global.State.hostilesByRoom.get(room.name) || [];

                if (hostiles.length > 0) {
                    // Find closest hostile
                    let closestHostile = null;
                    let minRange = Infinity;

                    for (const hostile of hostiles) {
                        const range = creep.pos.getRangeTo(hostile);
                        if (range < minRange) {
                            minRange = range;
                            closestHostile = hostile;
                        }
                    }

                    if (closestHostile) {
                        isEngaged = true;
                        if (minRange > 1) {
                            movement.moveTo(creep, closestHostile);
                        }

                        if (minRange <= 1) {
                            creep.attack(closestHostile);
                        } else if (minRange <= 3) {
                            creep.rangedAttack(closestHostile);
                        }

                        // Heal if damaged and not needing to heal others
                        if (creep.hits < creep.hitsMax) {
                            creep.heal(creep);
                        }
                    }
                }

                if (!isEngaged) {
                    // Find lair to camp
                    const lairsHeap = global.State.skLairsHeap ? global.State.skLairsHeap.get(room.name) : null;
                    if (lairsHeap && lairsHeap.size > 0) {
                        let bestLairId = null;
                        let minTicks = Infinity;

                        for (const [id, ticks] of lairsHeap.entries()) {
                            if (ticks < minTicks) {
                                minTicks = ticks;
                                bestLairId = id;
                            }
                        }

                        if (bestLairId) {
                            const structuresMap = global.State.structuresByRoom.get(room.name);
                            if (structuresMap) {
                                const lairs = structuresMap.get(STRUCTURE_KEEPER_LAIR);
                                if (lairs) {
                                    let bestLair = null;
                                    if (lairs instanceof Map) {
                                        bestLair = lairs.get(bestLairId);
                                    } else if (Array.isArray(lairs)) {
                                        bestLair = lairs.find(l => l.id === bestLairId);
                                    }

                                    if (bestLair && !creep.pos.isNearTo(bestLair)) {
                                        movement.moveTo(creep, bestLair);
                                    }
                                }
                            }
                        }
                    }

                    if (creep.hits < creep.hitsMax) {
                        creep.heal(creep);
                    }
                }

            } catch (e) {
                console.log(`[skGuard Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
