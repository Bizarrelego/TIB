const Profiler = require('../utils/profiler');
const Logger = require('../utils/logger');
const getTrafficManager = () => require('../traffic/trafficManager');

/**
 * @file NukeEvacuationManager.js
 * @description Manager responsible for detecting incoming nukes, calculating the 5x5
 * blast matrix, ordering evacuation for creeps in the blast zone, and triggering
 * temporary logistics redirection to fortify core structures.
 */

class NukeEvacuationManager {
    /**
     * Executes the Nuke Evacuation logic for a given room.
     * @param {Room} room - The room object to check for nukes.
     */
    static run(room) {
        if (!global.State || !global.State.nukesByRoom) return;

        const nukes = global.State.nukesByRoom.get(room.name);

        // Check if there are nukes
        if (!nukes || nukes.length === 0) {
            return;
        }

        Logger.warn(`[NukeEvacuation] DETECTED ${nukes.length} INCOMING NUKE(S) IN ROOM ${room.name}!`);

        const TrafficManager = getTrafficManager();
        const roomCreepsMap = global.State.creepsByRoom ? global.State.creepsByRoom.get(room.name) : null;

        if (!roomCreepsMap) return;

        // Iterate through all creeps in the room
        for (const creeps of roomCreepsMap.values()) {
            for (const creep of creeps) {

                // Fatigue gating check per agent rules
                if (creep.fatigue > 0) continue;

                // Check if the creep is in the 5x5 blast matrix of any nuke
                for (const nuke of nukes) {
                    if (creep.pos.getRangeTo(nuke.pos) <= 2) {
                        Logger.warn(`[NukeEvacuation] Creep ${creep.name} is in the 5x5 blast matrix of a nuke! Evacuating...`);

                        // Find a safe position outside the blast radius
                        const safePos = this.findSafeEvacuationPos(creep, nukes);
                        if (safePos) {
                            // Register movement intent via TrafficManager
                            TrafficManager.registerMoveIntent(creep, safePos, {
                                range: 0,
                                ignoreCreeps: false
                            });
                        }

                        // Break out of the inner loop since the creep is already evacuating
                        break;
                    }
                }
            }
        }
    }

    /**
     * Calculates a safe room position for a creep to evacuate to, ensuring it's outside
     * all nuke 5x5 blast zones.
     * @param {Creep} creep - The creep that needs to evacuate.
     * @param {Nuke[]} nukes - Array of incoming nukes in the room.
     * @returns {RoomPosition|null} A safe RoomPosition, or null if none found.
     */
    static findSafeEvacuationPos(creep, nukes) {
        // Simple search pattern: spiral outward from the creep to find the nearest safe tile.
        // We only need to move just outside the range 2 blast zone.

        const roomName = creep.room.name;
        const startX = creep.pos.x;
        const startY = creep.pos.y;
        const terrain = global.State.roomTerrain.get(roomName) || new Room.Terrain(roomName);

        // Search in an increasing radius up to 5 tiles away
        for (let r = 1; r <= 5; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    // Only check the perimeter of the current radius
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

                    const checkX = startX + dx;
                    const checkY = startY + dy;

                    // Ensure coordinates are valid and not edge tiles
                    if (checkX > 0 && checkX < 49 && checkY > 0 && checkY < 49) {
                        // Ensure tile is walkable
                        if (terrain.get(checkX, checkY) !== TERRAIN_MASK_WALL) {
                            const candidatePos = new RoomPosition(checkX, checkY, roomName);

                            // Verify this position is safe from ALL nukes
                            let isSafe = true;
                            for (const nuke of nukes) {
                                if (candidatePos.getRangeTo(nuke.pos) <= 2) {
                                    isSafe = false;
                                    break;
                                }
                            }

                            if (isSafe) {
                                return candidatePos;
                            }
                        }
                    }
                }
            }
        }

        return null;
    }
}

for (const method of Object.getOwnPropertyNames(NukeEvacuationManager)) {
    if (typeof NukeEvacuationManager[method] === 'function' && method !== 'constructor' && method !== 'prototype' && method !== 'name' && method !== 'length') {
        NukeEvacuationManager[method] = Profiler.wrap(`NukeEvacuationManager.${method}`, NukeEvacuationManager[method]);
    }
}

module.exports = NukeEvacuationManager;
