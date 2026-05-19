const CostMatrixCache = require('../traffic/costMatrixCache');
const InterRoomRouter = require('../traffic/InterRoomRouter');

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
        if (creep.heap.needsDetour) {
            delete creep.heap._path;
            delete creep.heap.path;
            creep.heap.needsDetour = false;
        }
        // Anti-clustering / Stuck-detection logic
        const currentPos = creep.pos;
        if (creep.heap.lastPos) {
            if (currentPos.x === creep.heap.lastPos.x &&
                currentPos.y === creep.heap.lastPos.y &&
                currentPos.roomName === creep.heap.lastPos.roomName) {
                if (creep.fatigue === 0) {
                    creep.heap.stuckTicks = (creep.heap.stuckTicks || 0) + 1;
                }
            } else {
                creep.heap.stuckTicks = 0;
            }
        } else {
            creep.heap.stuckTicks = 0;
        }
        creep.heap.lastPos = { x: currentPos.x, y: currentPos.y, roomName: currentPos.roomName };

        // Default pathing opts
        const pathingOpts = { reusePath: 20, ignoreCreeps: true, ...opts };

        if (creep.heap.stuckTicks > 2) {
            pathingOpts.reusePath = 0;
            pathingOpts.ignoreCreeps = false;
            creep.heap.stuckTicks = 0; // Reset stuckTicks after forcing recalculation
            delete creep.heap.path; // Force repath
        }

        const targetPos = target.pos || target;
        const isCrossRoom = targetPos.roomName !== currentPos.roomName;

        // Two-Tier Pathing: Inter-Room Route Management
        if (isCrossRoom) {
            if (!creep.heap.route || creep.heap.routeTarget !== targetPos.roomName) {
                creep.heap.route = InterRoomRouter.getRoute(currentPos.roomName, targetPos.roomName);
                creep.heap.routeTarget = targetPos.roomName;
                delete creep.heap.path; // Invalidate local path
            }

            if (creep.heap.route && creep.heap.route.length > 0 && creep.heap.route[0] === currentPos.roomName) {
                creep.heap.route.shift();
                delete creep.heap.path;
            }
        } else if (creep.heap.route) {
            delete creep.heap.route;
            delete creep.heap.routeTarget;
        }

        // IMPROVEMENT: Eliminate native moveTo. Route all moves through TrafficManager.
        // Reason: Enforces atomic lockstep execution and prevents native pathing from bypassing the swap/deadlock registry.
        if (!creep.heap.path || creep.heap.path.length === 0) {
            let searchTarget = targetPos;
            let searchOpts = { ...pathingOpts };

            // Task 3: Range-1 Source Pathing
            // If target is a Source, Mineral, or StructureController, enforce range: 1
            if (target && (
                target.structureType === STRUCTURE_CONTROLLER ||
                target instanceof Source ||
                target instanceof Mineral ||
                (target.id && Game.getObjectById(target.id) instanceof Source) ||
                (target.id && Game.getObjectById(target.id) instanceof Mineral) ||
                (target.id && Game.getObjectById(target.id) && Game.getObjectById(target.id).structureType === STRUCTURE_CONTROLLER)
            )) {
                searchTarget = { pos: targetPos, range: 1 };
            }

            if (isCrossRoom && creep.heap.route && creep.heap.route.length > 0) {
                const nextRoom = creep.heap.route[0];
                const exitDir = Game.map.findExit(currentPos.roomName, nextRoom);
                if (exitDir > 0) {
                    let exits = [];
                    if (global.State && global.State.roomExits && global.State.roomExits.has(currentPos.roomName)) {
                        const roomExitsMap = global.State.roomExits.get(currentPos.roomName);
                        if (roomExitsMap.has(exitDir)) {
                            exits = roomExitsMap.get(exitDir);
                        }
                    } else {
                        exits = creep.room.find(exitDir);
                    }

                    if (exits && exits.length > 0) {
                        searchTarget = exits.map(e => ({ pos: e, range: 0 }));
                        searchOpts.maxRooms = 1; // Strictly local pathing
                    }
                }
            } else if (!isCrossRoom) {
                searchOpts.maxRooms = 1; // Strictly local pathing
            }

            // Inject DirectionalCostMatrix for hub routing
            const DirectionalCostMatrixGenerator = require('../traffic/directionalCostMatrixGenerator');
            const SwampCostMatrixGenerator = require('../traffic/swampCostMatrixGenerator');
            const originalRoomCallback = searchOpts.roomCallback;
            searchOpts.roomCallback = function(roomName) {
                let matrix;
                if (originalRoomCallback) {
                    matrix = originalRoomCallback(roomName);
                } else {
                    const rcl = Game.rooms[roomName] && Game.rooms[roomName].controller ? Game.rooms[roomName].controller.level : 0;
                    if (rcl < 3) {
                        matrix = SwampCostMatrixGenerator(roomName);
                    } else {
                        matrix = CostMatrixCache.get(roomName);
                    }
                }

                let returnMatrix = matrix;

                // Let's regenerate it properly using the base matrix.
                if (global.State && global.State.roomPlanner) {
                    const planner = global.State.roomPlanner.get(roomName);
                    if (planner) {
                        const anchor = planner.get('anchor');
                        if (anchor && creep && creep.pos.inRangeTo(anchor, 5)) {
                            returnMatrix = DirectionalCostMatrixGenerator.generate(roomName, anchor, creep.pos, 'clockwise', 1, matrix);
                        }
                    }
                }

                // Implement Dynamic Obstacle Avoidance
                if (global.State) {
                    // Static Creeps as unwalkable obstacles
                    if (global.State.staticCreeps) {
                        for (const [creepName, pos] of global.State.staticCreeps.entries()) {
                            if (creepName !== creep.name && pos.roomName === roomName) {
                                if (returnMatrix === matrix) returnMatrix = returnMatrix.clone();
                                returnMatrix.set(pos.x, pos.y, 255);
                            }
                        }
                    }

                    if (global.State && global.State.creepsByRoom) {
                        const roomCreeps = global.State.creepsByRoom.get(roomName);
                        if (roomCreeps) {
                            // Ensure array conversion per "V8 Map Optimization Constraint" memory entry
                            const roleGroups = Array.from(roomCreeps.values());
                            for (let r = 0; r < roleGroups.length; r++) {
                                const roleCreeps = roleGroups[r];
                                if (Array.isArray(roleCreeps)) {
                                    for (let i = 0; i < roleCreeps.length; i++) {
                                        const c = roleCreeps[i];
                                        if (c && c.heap && c.heap.isStatic === true) {
                                            if (returnMatrix === matrix) returnMatrix = returnMatrix.clone();
                                            returnMatrix.set(c.pos.x, c.pos.y, 255);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (creep.heap.blockerPos && creep.heap.blockerPos.roomName === roomName) {
                        if (returnMatrix === matrix) returnMatrix = returnMatrix.clone();
                        returnMatrix.set(creep.heap.blockerPos.x, creep.heap.blockerPos.y, 255);
                    }

                    if (global.State.currentPositions) {
                        const roomPositions = global.State.currentPositions.get(roomName);
                        if (roomPositions) {
                            // Clone the matrix before making creep-specific modifications to prevent shared reference mutation
                            if (returnMatrix === matrix) returnMatrix = returnMatrix.clone();
                            for (const [posKey, creepName] of roomPositions.entries()) {
                                if (creepName === creep.name) continue; // Skip self

                                if (global.State.trafficIntents && !global.State.trafficIntents.has(creepName)) {
                                    const cx = posKey >> 6;
                                    const cy = posKey & 0x3F;
                                    returnMatrix.set(cx, cy, 255);
                                }
                            }
                        }
                    }
                }

                return returnMatrix;
            };

            const pathInfo = PathFinder.search(creep.pos, searchTarget, searchOpts);
            if (pathInfo.path.length > 0) creep.heap.path = pathInfo.path;
        }

        if (creep.heap.path && creep.heap.path.length > 0) {
            if (creep.pos.x === creep.heap.path[0].x &&
                creep.pos.y === creep.heap.path[0].y &&
                creep.pos.roomName === creep.heap.path[0].roomName) {
                creep.heap.path.shift(); // Advance path
            }
            if (creep.heap.path.length > 0) {
                if (!global.State) global.State = new Map();
                if (!(global.State.trafficIntents instanceof Map)) global.State.trafficIntents = new Map();

                global.State.trafficIntents.set(creep.name, {
                    creep: creep,
                    targetPos: creep.heap.path[0],
                    opts: pathingOpts,
                    originalPos: creep.pos
                });
            }
        }
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

            // O(1) Spatial Check
            const cm = CostMatrixCache.get(creep.pos.roomName);
            if (cm && cm.get(nextX, nextY) === 255) {
                blocked = true;
                break;
            }

            intents.push({ creep, targetPos: nextPos, opts });
        }

        if (blocked) return;

        // 3. Synchronize intents
        if (!global.State) global.State = new Map();
        if (!(global.State.trafficIntents instanceof Map)) global.State.trafficIntents = new Map();

        for (const intent of intents) {
            const creepToMove = intent.creep;
            const lock = global.State.pipelineLedger ? global.State.pipelineLedger.get(creepToMove.id) : null;
            if (!creepToMove || creepToMove.fatigue > 0 || (lock && lock.creepName)) continue;

            global.State.trafficIntents.set(creepToMove.name, { 
                creep: creepToMove, 
                targetPos: intent.targetPos, 
                opts: intent.opts,
                originalPos: creepToMove.pos,
                direction: direction, 
                priority: creepToMove.heap.priority || 0 
            });
        }
    }
};
