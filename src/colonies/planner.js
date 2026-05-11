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
            if (!room.controller || room.controller.level < 2) return;

            // Single-Site Construction rule
            const sites = global.State.sitesByRoom.get(room.name);
            if (sites && sites.length > 0) return;

            const spawns = global.State.spawnsByRoom.get(room.name);
            if (!spawns || spawns.length === 0) return;

            const spawn = spawns[0];

            // Priority: RCL 5 Links
            if (room.controller.level >= 5) {
                const structuresMap = global.State.structuresByRoom.get(room.name);
                const links = structuresMap ? (structuresMap.get(STRUCTURE_LINK) || []) : [];

                // How many links do we need? Hub link + 1 per source
                const sources = global.State.sourcesByRoom.get(room.name) || [];
                const targetLinkCount = 1 + sources.length;

                if (links.length < targetLinkCount) {
                    // 1. Ensure Hub Link is placed first near Storage
                    const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
                    const storage = storages.length > 0 ? storages[0] : null;

                    let hubLinkFound = false;
                    if (storage) {
                        // Check if hub link exists
                        for (let i = 0; i < links.length; i++) {
                            if (links[i].pos.isNearTo(storage)) {
                                hubLinkFound = true;
                                break;
                            }
                        }

                        // Check if construction site for hub link exists
                        if (!hubLinkFound && sites) {
                            for (let i = 0; i < sites.length; i++) {
                                if (sites[i].structureType === STRUCTURE_LINK && sites[i].pos.isNearTo(storage)) {
                                    hubLinkFound = true;
                                    break;
                                }
                            }
                        }

                        if (!hubLinkFound) {
                            // Find a spot near storage
                            let placed = false;
                            const terrain = Game.map.getRoomTerrain(room.name);
                            for (let dx = -1; dx <= 1; dx++) {
                                for (let dy = -1; dy <= 1; dy++) {
                                    if (dx === 0 && dy === 0) continue;
                                    const tx = storage.pos.x + dx;
                                    const ty = storage.pos.y + dy;

                                    if (terrain.get(tx, ty) === TERRAIN_MASK_WALL) continue;

                                    let isBlocked = false;
                                    if (structuresMap) {
                                        for (const structs of structuresMap.values()) {
                                            for (let i = 0; i < structs.length; i++) {
                                                const struct = structs[i];
                                                if (struct.pos.x === tx && struct.pos.y === ty && struct.structureType !== STRUCTURE_ROAD && struct.structureType !== STRUCTURE_RAMPART) {
                                                    isBlocked = true;
                                                    break;
                                                }
                                            }
                                            if (isBlocked) break;
                                        }
                                    }
                                    if (!isBlocked && sites) {
                                        for (let i = 0; i < sites.length; i++) {
                                            if (sites[i].pos.x === tx && sites[i].pos.y === ty) {
                                                isBlocked = true;
                                                break;
                                            }
                                        }
                                    }

                                    if (!isBlocked) {
                                        const createResult = room.createConstructionSite(tx, ty, STRUCTURE_LINK);
                                        if (createResult === OK) return; // Single-Site Construction
                                        placed = true;
                                        break; // In case createResult was err
                                    }
                                }
                                if (placed) break;
                            }
                            if (placed) return; // Wait until hub link is built/placed
                        }
                    }

                    // 2. Ensure Source Links are placed
                    for (let s = 0; s < sources.length; s++) {
                        const source = sources[s];
                        let sourceLinkFound = false;

                        for (let i = 0; i < links.length; i++) {
                            if (links[i].pos.inRangeTo(source, 2)) {
                                sourceLinkFound = true;
                                break;
                            }
                        }
                        if (!sourceLinkFound && sites) {
                            for (let i = 0; i < sites.length; i++) {
                                if (sites[i].structureType === STRUCTURE_LINK && sites[i].pos.inRangeTo(source, 2)) {
                                    sourceLinkFound = true;
                                    break;
                                }
                            }
                        }

                        if (!sourceLinkFound) {
                            let placed = false;
                            const terrain = Game.map.getRoomTerrain(room.name);
                            for (let dx = -2; dx <= 2; dx++) {
                                for (let dy = -2; dy <= 2; dy++) {
                                    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue; // Leave immediate tiles for miner

                                    const tx = source.pos.x + dx;
                                    const ty = source.pos.y + dy;

                                    if (terrain.get(tx, ty) === TERRAIN_MASK_WALL) continue;

                                    let isBlocked = false;
                                    if (structuresMap) {
                                        for (const structs of structuresMap.values()) {
                                            for (let i = 0; i < structs.length; i++) {
                                                const struct = structs[i];
                                                if (struct.pos.x === tx && struct.pos.y === ty && struct.structureType !== STRUCTURE_ROAD && struct.structureType !== STRUCTURE_RAMPART) {
                                                    isBlocked = true;
                                                    break;
                                                }
                                            }
                                            if (isBlocked) break;
                                        }
                                    }
                                    if (!isBlocked && sites) {
                                        for (let i = 0; i < sites.length; i++) {
                                            if (sites[i].pos.x === tx && sites[i].pos.y === ty) {
                                                isBlocked = true;
                                                break;
                                            }
                                        }
                                    }

                                    if (!isBlocked) {
                                        const createResult = room.createConstructionSite(tx, ty, STRUCTURE_LINK);
                                        if (createResult === OK) return; // Single-Site Construction
                                        placed = true;
                                        break;
                                    }
                                }
                                if (placed) break;
                            }
                        }
                    }
                }
            }

            // Priority: RCL 3 Tower Defense
            if (room.controller.level >= 3) {
                const structuresMap = global.State.structuresByRoom.get(room.name);
                const towers = structuresMap ? (structuresMap.get(STRUCTURE_TOWER) || []) : [];

                if (towers.length === 0) {
                    const targetX = spawn.pos.x;
                    const targetY = spawn.pos.y - 2;

                    const structures = room.lookForAt(LOOK_STRUCTURES, targetX, targetY);
                    if (!structures || structures.length === 0) {
                        const createResult = room.createConstructionSite(targetX, targetY, STRUCTURE_TOWER);
                        if (createResult === OK) {
                            return; // Single-Site Construction rule
                        }
                    }
                }
            }

            const EXT_STAMP = [
                {x: 1, y: 1},
                {x: -1, y: -1},
                {x: 1, y: -1},
                {x: -1, y: 1},
                {x: 0, y: 2}
            ];

            for (let i = 0; i < EXT_STAMP.length; i++) {
                const offset = EXT_STAMP[i];
                const targetX = spawn.pos.x + offset.x;
                const targetY = spawn.pos.y + offset.y;

                const structures = room.lookForAt(LOOK_STRUCTURES, targetX, targetY);
                if (structures && structures.length > 0) continue;

                const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, targetX, targetY);
                if (sites && sites.length > 0) continue;

                room.createConstructionSite(targetX, targetY, STRUCTURE_EXTENSION);
            }
        } catch (e) {
            console.log(`[Planner Error] Room ${room.name}: ${e.stack}`);
        }
    }
};