module.exports = {
    /**
     * Checks if a creep is fatigued.
     * @param {Creep} creep - The creep to check.
     * @returns {boolean} True if the creep's fatigue is > 0, otherwise false.
     */
    checkFatigue: function(creep) {
        if (!creep) return false;
        return creep.fatigue > 0;
    },

    moveTo: function(creep, target, opts = {}) {
        if (!creep.heap.path || !Array.isArray(creep.heap.path)) {
            const targetPos = target.pos || target;
            const pathInfo = PathFinder.search(creep.pos, targetPos, opts);
            if (pathInfo && pathInfo.path) {
                creep.heap.path = pathInfo.path;
            } else {
                creep.heap.path = null;
            }
        }

        if (creep.heap.path && creep.heap.path.length > 0) {
            const result = creep.moveByPath(creep.heap.path);

            if (result === ERR_NOT_FOUND || result === ERR_INVALID_ARGS) {
                creep.heap.path = null;
            }

            return result;
        }

        return ERR_NOT_FOUND;
    },

    /**
     * Executes atomic lockstep movement for a quad formation.
     * @param {Creep[]} quad - The array of creeps in the quad formation.
     * @param {RoomPosition|number} target - The destination position or direction to move.
     * @param {Object} [opts={}] - Movement options.
     */
    atomicQuadMove: function(quad, target, opts = {}) {
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
        const TrafficManager = require('../traffic/trafficManager');
        for (const intent of intents) {
            TrafficManager.registerMove(intent.creep, direction);
        }
    }
};
