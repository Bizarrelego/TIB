

/* eslint-disable no-redeclare */
/* global Game, PathFinder, TERRAIN_MASK_WALL, STRUCTURE_CONTAINER, STRUCTURE_ROAD, CONTROLLER_STRUCTURES, STRUCTURE_RAMPART, STRUCTURE_FACTORY, STRUCTURE_LAB */
const BucketGatedDT = require('../os/BucketGatedDT');
const rampartPlanner = require('./rampartPlanner');
const { BASE_LAYOUT_STAMP, FAST_FILLER_SPOTS } = require('../constants/baseLayout');
const roomPositionUtils = require('../utils/roomPositionUtils');
const SegmentManager = require('../managers/SegmentManager');

module.exports = {
    run: function(room) {
        try {
            if (Game.time % 100 !== 0) return;
            if (!room.controller || !room.controller.my) return;

            // Bucket-Gated WASM Constraint
            if (room.memory.needsPlanning !== true) return;
            if (Game.cpu.bucket <= 8000) return;

            const sites = global.State.sitesByRoom.get(room.name) || [];
            if (sites.length >= 5) return;

            global.State.roomPlanner = global.State.roomPlanner || new Map();
            if (!global.State.roomPlanner.has(room.name)) {
                global.State.roomPlanner.set(room.name, new Map());
            }
            const plannerState = global.State.roomPlanner.get(room.name);

            // Hardcode coordinate stamp for 5 extensions
            const spawns = global.State.spawnsByRoom.get(room.name) || [];
            if (spawns.length > 0) {
                const spawn = spawns[0];
                // Flower pattern directly adjacent to spawn
                const stamp = [
                    {x: 1, y: 1}, {x: -1, y: 1}, {x: 0, y: 2}, {x: 1, y: 2}, {x: -1, y: 2}
                ];
                let plannedStructures = plannerState.get('plannedStructures');
                if (!plannedStructures) {
                    plannedStructures = new Map();
                    plannerState.set('plannedStructures', plannedStructures);
                }
                for (let i = 0; i < stamp.length && i < 5; i++) {
                    const tx = spawn.pos.x + stamp[i].x;
                    const ty = spawn.pos.y + stamp[i].y;
                    const id = `${STRUCTURE_EXTENSION}-${tx}-${ty}`;
                    if (!plannedStructures.has(id)) {
                        plannedStructures.set(id, {
                            pos: new RoomPosition(tx, ty, room.name),
                            type: STRUCTURE_EXTENSION,
                            id: id
                        });
                    }
                }
                // Central micro-hub fast-filler spot
                plannerState.set('fastFillerPositions', [new RoomPosition(spawn.pos.x, spawn.pos.y + 1, room.name)]);
            }

            // Disable dynamic road and container generation
            if (Game.time) {
                rampartPlanner.run(room, plannerState, plannerState.get('plannedStructures'));
                return;
            }


            if (!plannerState.has('anchor')) {
                const spawns = global.State.spawnsByRoom ? (global.State.spawnsByRoom.get(room.name) || []) : [];
                let bestPos = null;

                if (spawns.length > 0) {
                    bestPos = { x: spawns[0].pos.x + 1, y: spawns[0].pos.y + 1 };
                } else {
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

                    const dt = BucketGatedDT.compute(room.name, cm);
                    if (dt === 'deferred') {
                        return;
                    }

                    let maxVal = 0;
                    for (let y = 8; y < 42; y++) {
                        for (let x = 8; x < 42; x++) {
                            let val = dt.get(x, y);
                            if (val > maxVal) {
                                maxVal = val;
                                bestPos = {x, y};
                            }
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
            if (!anchor) return;

            if (!plannerState.has('fastFillerPositions')) {
                const ffs = [];
                for (let i = 0; i < FAST_FILLER_SPOTS.length; i++) {
                    const pos = roomPositionUtils.getAbsolutePosition(anchor, FAST_FILLER_SPOTS[i][0], FAST_FILLER_SPOTS[i][1], room.name);
                    ffs.push(pos);
                }
                plannerState.set('fastFillerPositions', ffs);
            }

            const rcl = room.controller.level;
            const lastRcl = plannerState.get('lastRcl');

            if (lastRcl !== rcl || !plannerState.has('plannedStructures')) {
                plannerState.set('lastRcl', rcl);

                if (!plannerState.has('plannedStructures')) {
                    plannerState.set('plannedStructures', new Map());
                }
                const plannedStructures = plannerState.get('plannedStructures');

                for (const [structureType, offsets] of BASE_LAYOUT_STAMP.entries()) {
                    let rclLimit = 0;
                    let overrideStructureType = structureType;

                    if (structureType === 'factory') {
                        if (rcl < 7) continue;
                        overrideStructureType = STRUCTURE_FACTORY;
                        rclLimit = 1;
                    } else if (structureType === 'lab') {
                        if (rcl < 6) continue;
                        overrideStructureType = STRUCTURE_LAB;
                        rclLimit = CONTROLLER_STRUCTURES[STRUCTURE_LAB][rcl] || 0;
                    } else if (structureType === STRUCTURE_CONTAINER) {
                        rclLimit = 5;
                    } else if (structureType === STRUCTURE_ROAD) {
                        if (rcl < 3) continue;
                        rclLimit = offsets.length;
                    } else if (CONTROLLER_STRUCTURES[structureType]) {
                        rclLimit = CONTROLLER_STRUCTURES[structureType][rcl] || 0;
                    }

                    if (structureType === STRUCTURE_STORAGE && rcl < 4) {
                        rclLimit = 1;
                        overrideStructureType = STRUCTURE_CONTAINER;
                    }

                    if (rclLimit === 0) continue;

                    for (let j = 0; j < offsets.length; j++) {
                        if (j >= rclLimit) break;

                        const dx = offsets[j][0];
                        const dy = offsets[j][1];

                        const plannedX = anchor.x + dx;
                        const plannedY = anchor.y + dy;
                        if (plannedX < 1 || plannedX > 48 || plannedY < 1 || plannedY > 48) continue;

                        const targetPos = roomPositionUtils.getAbsolutePosition(anchor, dx, dy, room.name);

                        if (roomPositionUtils.isBuildable(room.name, targetPos.x, targetPos.y, overrideStructureType)) {
                            let alreadyExists = false;

                            const structuresByType = global.State.structuresByRoom ? (global.State.structuresByRoom.get(room.name) || new Map()) : new Map();
                            const structsOfSameType = structuresByType.get(overrideStructureType);
                            if (structsOfSameType) {
                                for (const struct of structsOfSameType.values()) {
                                    if (struct.pos.x === targetPos.x && struct.pos.y === targetPos.y) {
                                        alreadyExists = true;
                                        break;
                                    }
                                }
                            }

                            if (!alreadyExists) {
                                const sites = global.State.sitesByRoom ? (global.State.sitesByRoom.get(room.name) || []) : [];
                                for (let i = 0; i < sites.length; i++) {
                                    const site = sites[i];
                                    if (site.pos.x === targetPos.x && site.pos.y === targetPos.y && site.structureType === overrideStructureType) {
                                        alreadyExists = true;
                                        break;
                                    }
                                }
                            }

                            if (!alreadyExists) {
                                const id = `${overrideStructureType}-${plannedX}-${plannedY}`;
                                if (!plannedStructures.has(id)) {
                                    plannedStructures.set(id, {
                                        pos: targetPos,
                                        type: overrideStructureType,
                                        id: id
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Dynamic Logistics Containers
            const plannedStructures = plannerState.get('plannedStructures');
            if (plannedStructures) {
                const sources = global.State.sourcesByRoom ? (global.State.sourcesByRoom.get(room.name) || []) : [];
                for (let i = 0; i < sources.length; i++) {
                    const source = sources[i];
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            const tx = source.pos.x + dx;
                            const ty = source.pos.y + dy;
                            if (roomPositionUtils.isBuildable(room.name, tx, ty, STRUCTURE_CONTAINER)) {
                                const id = `container-source-${source.id}`;
                                if (!plannedStructures.has(id)) {
                                    plannedStructures.set(id, {
                                        pos: new RoomPosition(tx, ty, room.name),
                                        type: STRUCTURE_CONTAINER,
                                        id: id
                                    });
                                }
                                break;
                            }
                        }
                        if (plannedStructures.has(`container-source-${source.id}`)) break;
                    }
                }

                if (room.controller) {
                    const ctrl = room.controller;
                    let found = false;
                    for (let dx = -2; dx <= 2 && !found; dx++) {
                        for (let dy = -2; dy <= 2 && !found; dy++) {
                            if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
                            const tx = ctrl.pos.x + dx;
                            const ty = ctrl.pos.y + dy;
                            if (roomPositionUtils.isBuildable(room.name, tx, ty, STRUCTURE_CONTAINER)) {
                                const id = `container-controller-${ctrl.id}`;
                                if (!plannedStructures.has(id)) {
                                    plannedStructures.set(id, {
                                        pos: new RoomPosition(tx, ty, room.name),
                                        type: STRUCTURE_CONTAINER,
                                        id: id
                                    });
                                }
                                found = true;
                            }
                        }
                    }
                }
            }

            // Integrate road planning
            if (plannedStructures && room.controller && room.controller.level >= 3) {
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

                    const cm = new PathFinder.CostMatrix();
                    for (const struct of plannedStructures.values()) {
                        if (struct.type !== STRUCTURE_ROAD && struct.type !== STRUCTURE_CONTAINER && struct.type !== STRUCTURE_RAMPART) {
                            cm.set(struct.pos.x, struct.pos.y, 255);
                            occupiedCoords.add(`${struct.pos.x},${struct.pos.y}`);
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
                                roomCallback: function() {
                                    return cm;
                                }
                            }
                        );

                        for (let j = 0; j < pathInfo.path.length; j++) {
                            const pos = pathInfo.path[j];

                            if (pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49) continue;

                            const coordKey = `${pos.x},${pos.y}`;
                            if (!occupiedCoords.has(coordKey) && roomPositionUtils.isBuildable(room.name, pos.x, pos.y, STRUCTURE_ROAD)) {
                                const uniqueId = `${STRUCTURE_ROAD}-${pos.x}-${pos.y}`;
                                if (!plannedStructures.has(uniqueId)) {
                                    plannedStructures.set(uniqueId, {
                                        pos: pos,
                                        type: STRUCTURE_ROAD,
                                        id: uniqueId
                                    });

                                }
                            }
                        }
                    }
                }
            }

            // Rampart Planning
            rampartPlanner.run(room, plannerState, plannedStructures);

            // Turn off planning flag once successfully completed
            if (plannerState.get('rampartsPlanned')) {
                room.memory.needsPlanning = false;

                // Cache compressed CostMatrix
                if (plannerState.has('dtMatrix')) {
                    const dtMatrix = plannerState.get('dtMatrix');
                    // simple RLE compression for the costmatrix
                    let compressed = '';
                    let currentVal = -1;
                    let count = 0;
                    for (let x = 0; x < 50; x++) {
                        for (let y = 0; y < 50; y++) {
                            const val = dtMatrix.get(x, y);
                            if (val === currentVal) {
                                count++;
                            } else {
                                if (count > 0) compressed += `${count}:${currentVal},`;
                                currentVal = val;
                                count = 1;
                            }
                        }
                    }
                    if (count > 0) compressed += `${count}:${currentVal}`;

                    // Save to RawMemory segment (e.g. segment 10)
                    SegmentManager.queueWrite(10, compressed);
                    SegmentManager.requestActive(10);
                }
            }

        } catch (e) {
            console.log(`[Planner Error] Room ${room.name}: ${e.stack}`);
        }
    }
};