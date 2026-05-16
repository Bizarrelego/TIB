const Profiler = require('../utils/profiler');
const TrafficManager = require('../traffic/trafficManager');

/**
 * @file QuadSquadManager.js
 * @description Standalone Quad Squad Manager to handle atomic movement and rotation of 4-creep formations.
 */

class QuadSquadManager {
    /**
     * Executes atomic lockstep movement for a quad formation.
     * @param {Creep[]} quad - The array of creeps in the quad formation.
     * @param {RoomPosition|number} target - The destination position or direction to move.
     * @param {Object} [opts={}] - Movement options.
     */
    static atomicQuadMove(quad, target, opts = {}) {
        if (!quad || quad.length === 0) return;

        // 1. Wait-if-blocked logic: Check if any member has fatigue
        const anyFatigued = quad.some(creep => creep.fatigue > 0);
        if (anyFatigued) return; // Formation halts

        const leader = quad[0];
        let direction = null;

        if (typeof target === 'number') {
            direction = target;
        } else {
            let targetPos = target.pos || target;

            if (!leader.heap.path || !Array.isArray(leader.heap.path) || leader.heap.path.length === 0) {
                // Ensure the pathing accommodates a 2x2 squad by setting appropriate room callback in opts if possible.
                // For simplicity, generate path for leader.
                const pathInfo = PathFinder.search(leader.pos, targetPos, opts);
                if (pathInfo && pathInfo.path && pathInfo.path.length > 0) {
                    leader.heap.path = pathInfo.path;
                } else {
                    return;
                }
            }

            if (leader.heap.path && leader.heap.path.length > 0) {
                // If leader is already on the first path tile, shift it
                if (leader.pos.x === leader.heap.path[0].x && leader.pos.y === leader.heap.path[0].y && leader.pos.roomName === leader.heap.path[0].roomName) {
                    leader.heap.path.shift();
                }

                if (leader.heap.path.length > 0) {
                    const nextPos = leader.heap.path[0];
                    direction = leader.pos.getDirectionTo(nextPos);
                } else {
                    return;
                }
            } else {
                return;
            }
        }

        if (!direction) return;

        // Calculate dx and dy
        let dx = 0; let dy = 0;
        switch(direction) {
            case TOP: dy = -1; break;
            case TOP_RIGHT: dy = -1; dx = 1; break;
            case RIGHT: dx = 1; break;
            case BOTTOM_RIGHT: dy = 1; dx = 1; break;
            case BOTTOM: dy = 1; break;
            case BOTTOM_LEFT: dy = 1; dx = -1; break;
            case LEFT: dx = -1; break;
            case TOP_LEFT: dy = -1; dx = -1; break;
        }

        let blocked = false;
        const intents = [];

        for (const creep of quad) {
            const nextX = creep.pos.x + dx;
            const nextY = creep.pos.y + dy;

            if (nextX < 0 || nextX > 49 || nextY < 0 || nextY > 49) {
                blocked = true;
                break;
            }

            const nextPos = new RoomPosition(nextX, nextY, creep.pos.roomName);
            const terrain = Game.map.getRoomTerrain(creep.pos.roomName);
            if (terrain.get(nextX, nextY) === TERRAIN_MASK_WALL) {
                blocked = true;
                break;
            }

            if (global.State && global.State.structuresByRoom) {
                const roomStructures = global.State.structuresByRoom.get(creep.pos.roomName);
                if (roomStructures) {
                    let structureBlocked = false;
                    for (const [structType, structs] of roomStructures.entries()) {
                        if (typeof OBSTACLE_OBJECT_TYPES !== "undefined" && OBSTACLE_OBJECT_TYPES.includes(structType)) {
                            for (const struct of structs.values()) {
                                if (struct.pos.x === nextX && struct.pos.y === nextY) {
                                    structureBlocked = true;
                                    break;
                                }
                            }
                        }
                        if (structureBlocked) break;
                    }
                    if (structureBlocked) {
                        blocked = true;
                        break;
                    }
                }
            }

            intents.push({ creep, targetPos: nextPos, opts });
        }

        if (blocked) return;

        // 3. Synchronize intents
        for (const intent of intents) {
            TrafficManager.registerMove(intent.creep, direction);
        }
    }

    /**
     * Rotates a 4-creep quad formation clockwise.
     * @param {Creep[]} quad - The array of exactly 4 creeps.
     */
    static rotateClockwise(quad) {
        if (!quad || quad.length !== 4) return;

        const anyFatigued = quad.some(creep => creep.fatigue > 0);
        if (anyFatigued) return;

        let totalX = 0;
        let totalY = 0;
        for (const creep of quad) {
            totalX += creep.pos.x;
            totalY += creep.pos.y;
        }
        const centroidX = totalX / 4;
        const centroidY = totalY / 4;

        for (const creep of quad) {
            const x = creep.pos.x;
            const y = creep.pos.y;
            let direction = null;

            if (x < centroidX && y < centroidY) {
                // Top-left
                direction = RIGHT;
            } else if (x > centroidX && y < centroidY) {
                // Top-right
                direction = BOTTOM;
            } else if (x > centroidX && y > centroidY) {
                // Bottom-right
                direction = LEFT;
            } else if (x < centroidX && y > centroidY) {
                // Bottom-left
                direction = TOP;
            }

            if (direction) {
                TrafficManager.registerMove(creep, direction);
            }
        }
    }

    /**
     * Room-level iteration orchestrator hook.
     * @param {Room} room
     */
    static run(room) {
        return;
    }
}

for (const method of Object.getOwnPropertyNames(QuadSquadManager)) {
    if (typeof QuadSquadManager[method] === 'function' && method !== 'constructor' && method !== 'prototype' && method !== 'name' && method !== 'length') {
        QuadSquadManager[method] = Profiler.wrap(`QuadSquadManager.${method}`, QuadSquadManager[method]);
    }
}

module.exports = QuadSquadManager;
