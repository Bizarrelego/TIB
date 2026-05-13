/**
 * @file remoteDefender.js
 * @description Paths to remotes, eliminates hostiles via heatmaps, avoids core defenders.
 */

const movement = require('../utils/movement');

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

                creep.heap = creep.heap || {};

                if (creep.memory.targetRoom && creep.pos.roomName !== creep.memory.targetRoom) {
                    movement.moveTo(creep, new RoomPosition(25, 25, creep.memory.targetRoom));
                    if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL) > 0) {
                        creep.heal(creep);
                    }
                    continue;
                }

                const hostiles = global.State.hostilesByRoom.get(room.name);
                let target = null;
                let minRange = Infinity;

                if (hostiles && hostiles.size > 0) {
                    for (const h of hostiles.values()) {
                        const range = creep.pos.getRangeTo(h);
                        if (range < minRange) {
                            minRange = range;
                            target = h;
                        }
                    }
                }

                if (target) {
                    // Basic kiting logic: stay at range 3 if possible
                    if (minRange > 3) {
                        movement.moveTo(creep, target.pos);
                    } else if (minRange < 3) {
                        // Flee
                        const dx = creep.pos.x - target.pos.x;
                        const dy = creep.pos.y - target.pos.y;
                        const targetX = Math.max(1, Math.min(48, creep.pos.x + dx));
                        const targetY = Math.max(1, Math.min(48, creep.pos.y + dy));
                        const moveDir = creep.pos.getDirectionTo(targetX, targetY);
                        creep.move(moveDir);
                    }

                    if (minRange <= 3) {
                        creep.rangedAttack(target);
                    }
                }

                if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL) > 0) {
                    creep.heal(creep);
                }
            } catch (e) {
                console.error(`[remoteDefender Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
