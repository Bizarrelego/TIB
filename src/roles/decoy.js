/**
 * @file decoy.js
 * @description Parks on enemy sites to block builds. Kites defenders to waste CPU.
 */

const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for decoy role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const decoys = roomCreeps.get('decoy');
        if (!decoys || decoys.length === 0) return;

        for (const creep of decoys) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                creep.heap = creep.heap || {};

                // If not in a target room, try to move there.
                // Assuming memory has a targetRoom.
                if (creep.memory.targetRoom && creep.pos.roomName !== creep.memory.targetRoom) {
                    movement.moveTo(creep, new RoomPosition(25, 25, creep.memory.targetRoom));
                    continue;
                }

                // Find enemy construction sites
                let sites = [];
                const roomSites = global.State.sitesByRoom.get(room.name);
                if (roomSites) {
                    if (Array.isArray(roomSites)) {
                        sites = roomSites.filter(s => !s.my);
                    } else if (roomSites instanceof Map) {
                        for (const site of roomSites.values()) {
                            if (!site.my) sites.push(site);
                        }
                    }
                }

                if (sites.length > 0) {
                    const target = creep.pos.findClosestByPath(sites);
                    if (target) {
                        if (creep.pos.isEqualTo(target.pos)) {
                            // Parked on site
                            creep.heap.parked = true;
                        } else {
                            movement.moveTo(creep, target.pos);
                        }
                    }
                } else {
                    // Just kite defenders if no sites
                    const hostiles = global.State.hostilesByRoom.get(room.name);
                    if (hostiles && hostiles.size > 0) {
                        let closestHostile = null;
                        let minRange = Infinity;
                        for (const h of hostiles.values()) {
                            const range = creep.pos.getRangeTo(h);
                            if (range < minRange) {
                                minRange = range;
                                closestHostile = h;
                            }
                        }
                        if (closestHostile && minRange < 4) {
                            // Flee (very basic, movement helper might not have a flee)
                            // A proper flee would check cost matrix
                            const dx = creep.pos.x - closestHostile.pos.x;
                            const dy = creep.pos.y - closestHostile.pos.y;
                            const moveDir = creep.pos.getDirectionTo(creep.pos.x + dx, creep.pos.y + dy);
                            creep.move(moveDir);
                        }
                    }
                }
            } catch (e) {
                console.error(`[decoy Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
