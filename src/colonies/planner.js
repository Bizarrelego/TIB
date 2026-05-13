
const DistanceTransform = require('../algorithms/distanceTransform');

const TIGGA_STAMP = {
    storage: [[0, 0]],
    terminal: [[0, -1]],
    link: [[-1, 0]],
    factory: [[1, 0]],
    spawn: [[-1, -1], [1, -1], [0, -2]],
    tower: [[-2, -1], [2, -1], [-1, -2], [1, -2], [-2, 0], [2, 0]],
    road: [[-1, 1], [0, 2], [1, 1], [-4, 0], [-3, -1], [-3, 1], [-2, -2], [-2, 2], [-1, -3], [-1, 3], [0, -4], [0, 4], [1, -3], [1, 3], [2, -2], [2, 2], [3, -1], [3, 1], [4, 0], [-6, 0], [-5, -1], [-5, 1], [-4, -2], [-4, 2], [-3, -3], [-3, 3], [-2, -4], [-2, 4], [-1, -5], [-1, 5], [0, -6], [0, 6], [1, -5], [1, 5], [2, -4], [2, 4], [3, -3], [3, 3], [4, -2], [4, 2], [5, -1], [5, 1], [6, 0], [-8, 0], [-7, -1], [-7, 1], [-6, -2], [-6, 2], [-5, -3], [-5, 3], [-4, -4], [-4, 4], [-3, -5], [-3, 5], [-2, -6], [-2, 6], [-1, -7], [-1, 7], [0, -8], [0, 8], [1, -7], [1, 7], [2, -6], [2, 6], [3, -5], [3, 5], [4, -4], [4, 4], [5, -3], [5, 3], [6, -2], [6, 2], [7, -1], [7, 1], [8, 0], [-7, -2], [-7, 2], [-6, -3], [-6, 3], [-5, -4], [-5, 4], [-4, -5], [-4, 5], [-3, -6], [-3, 6], [-2, -7], [-2, 7], [-1, -8], [-1, 8], [0, -9], [0, 9], [1, -8], [1, 8], [2, -7], [2, 7], [3, -6], [3, 6], [4, -5], [4, 5], [5, -4], [5, 4], [6, -3], [6, 3], [7, -2], [7, 2], [8, -1], [8, 1], [9, 0]],
    extension: [[0, 1], [-3, 0], [-2, 1], [-1, 2], [0, -3], [0, 3], [1, 2], [2, 1], [3, 0], [-5, 0], [-4, -1], [-4, 1], [-3, -2], [-3, 2], [-2, -3], [-2, 3], [-1, -4], [-1, 4], [0, -5], [0, 5], [1, -4], [1, 4], [2, -3], [2, 3], [3, -2], [3, 2], [4, -1], [4, 1], [5, 0], [-7, 0], [-6, -1], [-6, 1], [-5, -2], [-5, 2], [-4, -3], [-4, 3], [-3, -4], [-3, 4], [-2, -5], [-2, 5], [-1, -6], [-1, 6], [0, -7], [0, 7], [1, -6], [1, 6], [2, -5], [2, 5], [3, -4], [3, 4], [4, -3], [4, 3], [5, -2], [5, 2], [6, -1], [6, 1], [7, 0], [-9, 0], [-8, -1], [-8, 1]]
};

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

            // Batched Construction rule: max 5
            const sites = global.State.sitesByRoom.get(room.name) || [];
            if (sites.length >= 5) return;

            // Initialize room planner state if needed
            global.State.roomPlanner = global.State.roomPlanner || {};
            if (!global.State.roomPlanner[room.name]) {
                global.State.roomPlanner[room.name] = {};
            }
            const plannerState = global.State.roomPlanner[room.name];

            // 1. Calculate or retrieve anchor
            if (!plannerState.anchor) {
                // Determine anchor using DistanceTransform
                const terrain = global.State.roomTerrain.get(room.name);
                const cm = new PathFinder.CostMatrix();
                // We add walls and source/controller safety zones
                for (let y = 0; y < 50; y++) {
                    for (let x = 0; x < 50; x++) {
                        if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                            cm.set(x, y, 255);
                        }
                    }
                }

                // Keep some distance from controller and sources if possible
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
                // Search for the most open space
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
                    plannerState.anchor = bestPos;
                } else {
                    return; // Cannot find a suitable place
                }
            }

            const anchor = plannerState.anchor;
            let activeSites = sites.length;
            const rcl = room.controller.level;
            const structuresMap = global.State.structuresByRoom.get(room.name) || new Map();

            // 2. Iterate over the stamp layout
            const buildOrder = [
                STRUCTURE_SPAWN,
                STRUCTURE_EXTENSION,
                STRUCTURE_STORAGE,
                STRUCTURE_TOWER,
                STRUCTURE_LINK,
                STRUCTURE_TERMINAL,
                STRUCTURE_FACTORY,
                STRUCTURE_ROAD
            ];

            // Mapping from CONTROLLER_STRUCTURES array index or property based on level
            const limitMap = {
                [STRUCTURE_SPAWN]: CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][rcl],
                [STRUCTURE_EXTENSION]: CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl],
                [STRUCTURE_STORAGE]: CONTROLLER_STRUCTURES[STRUCTURE_STORAGE][rcl],
                [STRUCTURE_TOWER]: CONTROLLER_STRUCTURES[STRUCTURE_TOWER][rcl],
                [STRUCTURE_LINK]: CONTROLLER_STRUCTURES[STRUCTURE_LINK][rcl],
                [STRUCTURE_TERMINAL]: CONTROLLER_STRUCTURES[STRUCTURE_TERMINAL][rcl],
                [STRUCTURE_FACTORY]: CONTROLLER_STRUCTURES[STRUCTURE_FACTORY][rcl],
                [STRUCTURE_ROAD]: 2500 // Arbitrary large limit
            };

            for (let i = 0; i < buildOrder.length; i++) {
                const structType = buildOrder[i];
                if (!TIGGA_STAMP[structType]) continue; // E.g., extractor might not be in stamp

                let limit = limitMap[structType] || 0;
                if (limit === 0) continue;

                const positions = TIGGA_STAMP[structType];

                let existingCount = 0;
                const existingStructs = structuresMap.get(structType) || [];
                existingCount += existingStructs.length;

                // Count construction sites for this type
                for(let s=0; s<sites.length; s++) {
                    if(sites[s].structureType === structType) {
                        existingCount++;
                    }
                }

                if (existingCount >= limit && structType !== STRUCTURE_ROAD) continue;

                for (let j = 0; j < positions.length; j++) {
                    if (activeSites >= 5) return; // Batched Construction rule limit

                    // Re-calculate existing count in case we reach the limit during loop
                    let currentCount = (structuresMap.get(structType) || []).length;
                    for(let s=0; s<sites.length; s++) {
                        if(sites[s].structureType === structType) currentCount++;
                    }
                    if (currentCount >= limit && structType !== STRUCTURE_ROAD) break;

                    const posOffset = positions[j];
                    const tx = anchor.x + posOffset[0];
                    const ty = anchor.y + posOffset[1];

                    if (tx < 2 || tx > 47 || ty < 2 || ty > 47) continue;

                    // Check if there is already a structure or site here
                    const lookStructs = room.lookForAt(LOOK_STRUCTURES, tx, ty);
                    let blocked = false;
                    let alreadyHasStruct = false;
                    for (let k = 0; k < lookStructs.length; k++) {
                        if (lookStructs[k].structureType === structType) {
                            alreadyHasStruct = true;
                            break;
                        }
                        if (lookStructs[k].structureType !== STRUCTURE_ROAD && lookStructs[k].structureType !== STRUCTURE_RAMPART) {
                            if (structType !== STRUCTURE_ROAD) {
                                blocked = true;
                            }
                        }
                    }
                    if (alreadyHasStruct) continue;

                    const lookSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, tx, ty);
                    if (lookSites.length > 0) {
                        blocked = true;
                    }

                    if (!blocked) {
                        // Place construction site
                        const res = room.createConstructionSite(tx, ty, structType);
                        if (res === OK) {
                            activeSites++;
                            // We wait for game state to update sites next tick but we manually increment local activeSites.
                            // To prevent placing multiple of the same exceeding limit, we rely on the loop condition.
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`[Planner Error] Room ${room.name}: ${e.stack}`);
        }
    }
};