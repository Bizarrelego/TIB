/**
 * @file soloDismantler.js
 * @description HVT Dijkstra pathing to weakest wall segments. Ignores enemy creeps.
 */

const movement = require('../utils/movement');
const Dijkstra = require('../algorithms/dijkstra');

module.exports = {
    /**
     * Executes logic for soloDismantler role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const soloDismantlers = roomCreeps.get('soloDismantler');
        if (!soloDismantlers || soloDismantlers.length === 0) return;

        const roomStructures = global.State.structuresByRoom.get(room.name) || new Map();

        // Flatten all structures from global state for fast filtering
        let allStructures = [];
        for (const [, structures] of roomStructures) {
            allStructures = allStructures.concat(structures);
        }

        for (const creep of soloDismantlers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                const targetRoomName = creep.memory.targetRoom || creep.heap.targetRoom;

                if (targetRoomName && creep.room.name !== targetRoomName) {
                    movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                    continue;
                }

                // HVT Target selection assigned by Manager (e.g. Storage, Spawn)
                const targetId = creep.heap.targetId;
                if (!targetId) continue;

                const target = Game.getObjectById(targetId);

                if (target) {
                    if (creep.pos.isNearTo(target)) {
                        creep.dismantle(target);
                    } else {
                        // Check if a path is cached
                        if (!creep.heap.penetrationPath) {
                            creep.heap.penetrationPath = Dijkstra.findPath(creep.pos, [target.pos], null, null);
                        }

                        // Use custom Dijkstra path or fallback to standard movement
                        if (creep.heap.penetrationPath && creep.heap.penetrationPath.length > 0) {
                            const nextPos = creep.heap.penetrationPath[0];

                            // Replace lookFor with global state check
                            let blocking = null;
                            for (let i = 0; i < allStructures.length; i++) {
                                const s = allStructures[i];
                                if (s.pos.x === nextPos.x &&
                                    s.pos.y === nextPos.y &&
                                    s.structureType !== STRUCTURE_ROAD &&
                                    s.structureType !== STRUCTURE_CONTAINER) {
                                    blocking = s;
                                    break;
                                }
                            }

                            if (blocking) {
                                creep.dismantle(blocking);
                            } else {
                                creep.move(creep.pos.getDirectionTo(nextPos));
                                creep.heap.penetrationPath.shift(); // Remove step
                            }
                        } else {
                            movement.moveTo(creep, target);
                        }
                    }
                } else {
                    creep.heap.targetId = null;
                }

            } catch (e) {
                console.log(`[soloDismantler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
