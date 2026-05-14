
const DistanceTransform = require('../algorithms/distanceTransform');

const TIGGA_STAMP = new Map([
    [STRUCTURE_SPAWN, [[-1, -1], [1, -1], [0, -2]]],
    [STRUCTURE_EXTENSION, [[0, 1], [-3, 0], [-2, 1], [-1, 2], [0, -3], [0, 3], [1, 2], [2, 1], [3, 0], [-5, 0], [-4, -1], [-4, 1], [-3, -2], [-3, 2], [-2, -3], [-2, 3], [-1, -4], [-1, 4], [0, -5], [0, 5], [1, -4], [1, 4], [2, -3], [2, 3], [3, -2], [3, 2], [4, -1], [4, 1], [5, 0], [-7, 0], [-6, -1], [-6, 1], [-5, -2], [-5, 2], [-4, -3], [-4, 3], [-3, -4], [-3, 4], [-2, -5], [-2, 5], [-1, -6], [-1, 6], [0, -7], [0, 7], [1, -6], [1, 6], [2, -5], [2, 5], [3, -4], [3, 4], [4, -3], [4, 3], [5, -2], [5, 2], [6, -1], [6, 1], [7, 0], [-9, 0], [-8, -1], [-8, 1]]],
    [STRUCTURE_STORAGE, [[0, 0]]],
    [STRUCTURE_TOWER, [[-2, -1], [2, -1], [-1, -2], [1, -2], [-2, 0], [2, 0]]],
    [STRUCTURE_LINK, [[-1, 0]]],
    [STRUCTURE_TERMINAL, [[0, -1]]],
    ['factory', [[1, 0]]],
    [STRUCTURE_ROAD, [[-1, 1], [0, 2], [1, 1], [-4, 0], [-3, -1], [-3, 1], [-2, -2], [-2, 2], [-1, -3], [-1, 3], [0, -4], [0, 4], [1, -3], [1, 3], [2, -2], [2, 2], [3, -1], [3, 1], [4, 0], [-6, 0], [-5, -1], [-5, 1], [-4, -2], [-4, 2], [-3, -3], [-3, 3], [-2, -4], [-2, 4], [-1, -5], [-1, 5], [0, -6], [0, 6], [1, -5], [1, 5], [2, -4], [2, 4], [3, -3], [3, 3], [4, -2], [4, 2], [5, -1], [5, 1], [6, 0], [-8, 0], [-7, -1], [-7, 1], [-6, -2], [-6, 2], [-5, -3], [-5, 3], [-4, -4], [-4, 4], [-3, -5], [-3, 5], [-2, -6], [-2, 6], [-1, -7], [-1, 7], [0, -8], [0, 8], [1, -7], [1, 7], [2, -6], [2, 6], [3, -5], [3, 5], [4, -4], [4, 4], [5, -3], [5, 3], [6, -2], [6, 2], [7, -1], [7, 1], [8, 0], [-7, -2], [-7, 2], [-6, -3], [-6, 3], [-5, -4], [-5, 4], [-4, -5], [-4, 5], [-3, -6], [-3, 6], [-2, -7], [-2, 7], [-1, -8], [-1, 8], [0, -9], [0, 9], [1, -8], [1, 8], [2, -7], [2, 7], [3, -6], [3, 6], [4, -5], [4, 5], [5, -4], [5, 4], [6, -3], [6, 3], [7, -2], [7, 2], [8, -1], [8, 1], [9, 0]]]
]);

// ... replace module.exports run method

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
            const structuresMap = global.State.structuresByRoom.get(room.name) || new Map();
            const terrain = global.State.roomTerrain.get(room.name);

            // Initialize plannedStructures map
            plannerState.set('plannedStructures', new Map());
            const plannedStructures = plannerState.get('plannedStructures');

            const buildOrder = [
                STRUCTURE_SPAWN,
                STRUCTURE_EXTENSION,
                STRUCTURE_STORAGE,
                STRUCTURE_TOWER,
                STRUCTURE_LINK,
                STRUCTURE_TERMINAL,
                'factory',
                STRUCTURE_ROAD
            ];

            const limitMap = new Map([
                [STRUCTURE_SPAWN, CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][rcl]],
                [STRUCTURE_EXTENSION, CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl]],
                [STRUCTURE_STORAGE, CONTROLLER_STRUCTURES[STRUCTURE_STORAGE][rcl]],
                [STRUCTURE_TOWER, CONTROLLER_STRUCTURES[STRUCTURE_TOWER][rcl]],
                [STRUCTURE_LINK, CONTROLLER_STRUCTURES[STRUCTURE_LINK][rcl]],
                [STRUCTURE_TERMINAL, CONTROLLER_STRUCTURES[STRUCTURE_TERMINAL][rcl]],
                ['factory', CONTROLLER_STRUCTURES['factory'][rcl]],
                [STRUCTURE_ROAD, 2500]
            ]);

            for (let i = 0; i < buildOrder.length; i++) {
                const structType = buildOrder[i];
                if (!TIGGA_STAMP.has(structType)) continue;

                let limit = limitMap.get(structType) || 0;
                if (limit === 0) continue;

                const positions = TIGGA_STAMP.get(structType);

                for (let j = 0; j < positions.length; j++) {
                    const posOffset = positions[j];
                    const tx = anchor.x + posOffset[0];
                    const ty = anchor.y + posOffset[1];

                    // Ensure within boundaries
                    if (tx < 2 || tx > 47 || ty < 2 || ty > 47) continue;

                    // Check terrain
                    if (terrain.get(tx, ty) === TERRAIN_MASK_WALL) continue;

                    let blocked = false;
                    let alreadyHasStruct = false;

                    // Replaces room.lookForAt
                    // Iterate over structuresMap
                    for (const [sType, sArray] of structuresMap) {
                        for (let k = 0; k < sArray.length; k++) {
                            const struct = sArray[k];
                            if (struct.pos.x === tx && struct.pos.y === ty) {
                                if (sType === structType) {
                                    alreadyHasStruct = true;
                                    break;
                                }
                                if (sType !== STRUCTURE_ROAD && sType !== STRUCTURE_RAMPART) {
                                    if (structType !== STRUCTURE_ROAD) {
                                        blocked = true;
                                    }
                                }
                            }
                        }
                    }
                    if (alreadyHasStruct) continue;

                    for (let s = 0; s < sites.length; s++) {
                        if (sites[s].pos.x === tx && sites[s].pos.y === ty) {
                            if (sites[s].structureType === structType) {
                                alreadyHasStruct = true;
                            } else {
                                blocked = true;
                            }
                            break;
                        }
                    }

                    if (alreadyHasStruct) continue;

                    if (!blocked) {
                        const posKey = `${tx},${ty}`;
                        // Add to planned structures map, no construction site created yet.
                        plannedStructures.set(posKey, {
                            pos: new RoomPosition(tx, ty, room.name),
                            type: structType
                        });
                    }
                }
            }
        } catch (e) {
            console.log(`[Planner Error] Room ${room.name}: ${e.stack}`);
        }
    }
};