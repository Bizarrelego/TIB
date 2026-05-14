

const DistanceTransform = require('../algorithms/distanceTransform');
const { BASE_LAYOUT_STAMP } = require('../constants/baseLayout');
const roomPositionUtils = require('../utils/roomPositionUtils');


module.exports = {
    getBuildPower: function(roomName) {
        let buildPower = 0;
        const roomCreeps = global.State.creepsByRoom.get(roomName);
        if (roomCreeps) {
            const workers = roomCreeps.get('worker');
            if (workers) {
                for (let w = 0; w < workers.length; w++) {
                    const worker = workers[w];
                    if (worker.body) {
                        for (let b = 0; b < worker.body.length; b++) {
                            if (worker.body[b].type === WORK) {
                                buildPower += BUILD_POWER;
                            }
                        }
                    }
                }
            }
        }
        if (buildPower === 0) buildPower = BUILD_POWER; // Default
        return buildPower;
    },

    run: function(room) {
        try {
            if (Game.time % 100 !== 0) return;
            if (!room.controller || !room.controller.my) return;

            const sites = global.State.sitesByRoom.get(room.name) || [];
            if (sites.length >= 5) return;

            global.State.roomPlanner = global.State.roomPlanner || new Map();
            if (!global.State.roomPlanner.has(room.name)) {
                global.State.roomPlanner.set(room.name, new Map());
            }
            const plannerState = global.State.roomPlanner.get(room.name);

            if (!plannerState.has('anchor')) {
                const terrain = global.State.roomTerrain.get(room.name);
                const cm = new PathFinder.CostMatrix();
                for (let y = 0; y < 50; y++) {
                    for (let x = 0; x < 50; x++) {
                        if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                            cm.set(x, y, 255);
                        }
                    }
                }

                if (room.controller) {
                    for(let dx=-2; dx<=2; dx++) {
                        for(let dy=-2; dy<=2; dy++) {
                            const tx = room.controller.pos.x + dx;
                            const ty = room.controller.pos.y + dy;
                            if(tx >= 0 && tx <= 49 && ty >= 0 && ty <= 49) {
                                cm.set(tx, ty, 255);
                            }
                        }
                    }
                }

                const sources = global.State.sourcesByRoom.get(room.name) || [];
                for(let s=0; s<sources.length; s++) {
                    for(let dx=-2; dx<=2; dx++) {
                        for(let dy=-2; dy<=2; dy++) {
                            const tx = sources[s].pos.x + dx;
                            const ty = sources[s].pos.y + dy;
                            if(tx >= 0 && tx <= 49 && ty >= 0 && ty <= 49) {
                                cm.set(tx, ty, 255);
                            }
                        }
                    }
                }

                const dt = DistanceTransform.compute(room.name, cm);

                let maxVal = 0;
                let bestPos = null;
                for (let y = 8; y < 42; y++) {
                    for (let x = 8; x < 42; x++) {
                        let val = dt.get(x, y);
                        if (val > maxVal) {
                            maxVal = val;
                            bestPos = {x, y};
                        }
                    }
                }

                if (bestPos) {
                    plannerState.set('anchor', bestPos);
                } else {
                    return;
                }
            }

            const anchor = plannerState.get('anchor');
            const rcl = room.controller.level;

            const lastRcl = plannerState.get('lastRcl');
            if (lastRcl !== rcl || !plannerState.has('plannedStructures')) {
                plannerState.set('lastRcl', rcl);

                const plannedStructures = new Map();

                for (const [structureType, offsets] of BASE_LAYOUT_STAMP.entries()) {
                    let rclLimit = 0;
                    if (structureType === STRUCTURE_CONTAINER) {
                        rclLimit = 5;
                    } else if (structureType === STRUCTURE_ROAD) {
                        rclLimit = 2500;
                    } else if (CONTROLLER_STRUCTURES[structureType]) {
                        rclLimit = CONTROLLER_STRUCTURES[structureType][rcl] || 0;
                    }

                    if (rclLimit === 0) continue;

                    for (let j = 0; j < offsets.length; j++) {
                        if (structureType !== STRUCTURE_ROAD && j >= rclLimit) break;

                        const dx = offsets[j][0];
                        const dy = offsets[j][1];

                        const plannedX = anchor.x + dx;
                        const plannedY = anchor.y + dy;
                        if (plannedX < 1 || plannedX > 48 || plannedY < 1 || plannedY > 48) continue;

                        const plannedPos = roomPositionUtils.getAbsolutePosition(anchor, dx, dy, room.name);

                        if (roomPositionUtils.isBuildable(room.name, plannedPos.x, plannedPos.y, structureType)) {
                            const uniqueId = `${structureType}-${plannedPos.x}-${plannedPos.y}`;
                            plannedStructures.set(uniqueId, {
                                pos: plannedPos,
                                type: structureType
                            });
                        }
                    }
                }

                plannerState.set('plannedStructures', plannedStructures);
            }

            // Integrate road planning
            const plannedStructures = plannerState.get('plannedStructures');
            if (plannedStructures) {
                const spawns = global.State.spawnsByRoom ? (global.State.spawnsByRoom.get(room.name) || []) : [];
                if (spawns.length > 0) {
                    const spawn = spawns[0];
                    const destinations = [];

                    const sources = global.State.sourcesByRoom ? (global.State.sourcesByRoom.get(room.name) || []) : [];
                    for (let i = 0; i < sources.length; i++) {
                        destinations.push(sources[i]);
                    }

                    if (room.controller) {
                        destinations.push(room.controller);
                    }

                    const minerals = global.State.mineralsByRoom ? (global.State.mineralsByRoom.get(room.name) || []) : [];
                    for (let i = 0; i < minerals.length; i++) {
                        destinations.push(minerals[i]);
                    }

                    const occupiedCoords = new Set();
                    let roadCount = 0;

                    const cm = new PathFinder.CostMatrix();
                    for (const struct of plannedStructures.values()) {
                        if (struct.type !== STRUCTURE_ROAD && struct.type !== STRUCTURE_CONTAINER && struct.type !== STRUCTURE_RAMPART) {
                            cm.set(struct.pos.x, struct.pos.y, 255);
                            occupiedCoords.add(`${struct.pos.x},${struct.pos.y}`);
                        } else if (struct.type === STRUCTURE_ROAD) {
                            roadCount++;
                        }
                    }

                    for (let i = 0; i < destinations.length; i++) {
                        const dest = destinations[i];
                        const pathInfo = PathFinder.search(
                            spawn.pos,
                            { pos: dest.pos, range: 1 },
                            {
                                plainCost: 2,
                                swampCost: 2,
                                roomCallback: function(roomName) {
                                    return cm;
                                }
                            }
                        );

                        for (let j = 0; j < pathInfo.path.length; j++) {
                            if (roadCount >= 2500) break;
                            const pos = pathInfo.path[j];

                            if (pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49) continue;

                            const coordKey = `${pos.x},${pos.y}`;
                            if (!occupiedCoords.has(coordKey) && roomPositionUtils.isBuildable(room.name, pos.x, pos.y, STRUCTURE_ROAD)) {
                                const uniqueId = `${STRUCTURE_ROAD}-${pos.x}-${pos.y}`;
                                if (!plannedStructures.has(uniqueId)) {
                                    plannedStructures.set(uniqueId, {
                                        pos: pos,
                                        type: STRUCTURE_ROAD
                                    });
                                    roadCount++;
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`[Planner Error] Room ${room.name}: ${e.stack}`);
        }
    }
};