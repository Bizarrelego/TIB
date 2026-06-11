const CacheLib = require('../lib/CacheLib');

/**
 * Decouples blueprint generation from execution, ensuring high-priority structures 
 * are built sequentially without overflowing site limits.
 */
class ConstructionManager {
    static run() {
        if (Game.time % 51 !== 0) return;
        if (Object.keys(Game.constructionSites).length >= 100) return;

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;

            const state = global.State?.rooms?.get(roomName);
            if (!state) continue;

            let siteCount = 0;
            if (state.constructionSiteCount !== undefined) {
                siteCount = state.constructionSiteCount;
            } else if (state.constructionSites) {
                siteCount = Object.keys(state.constructionSites).length;
            }
            if (siteCount >= 5) continue;

            const blueprint = global.Cache?.blueprints?.get(roomName);
            if (!blueprint) continue;

            ConstructionManager.executeRoomBlueprint(room, blueprint, state, 5 - siteCount);
        }
    }

    static executeRoomBlueprint(room, blueprint, state, maxToPlace) {
        const rcl = room.controller.level;
        const priorityArray = [
            STRUCTURE_SPAWN,
            STRUCTURE_TOWER,
            STRUCTURE_EXTENSION,
            STRUCTURE_STORAGE,
            STRUCTURE_TERMINAL,
            STRUCTURE_CONTAINER,
            STRUCTURE_LINK,
            STRUCTURE_EXTRACTOR,
            STRUCTURE_LAB,
            STRUCTURE_FACTORY,
            STRUCTURE_ROAD,
            STRUCTURE_RAMPART
        ];

        const existingPositions = new Map();
        if (state.structureIds) {
            for (let i = 0; i < state.structureIds.length; i++) {
                const s = CacheLib.getById(state.structureIds[i]);
                if (s) {
                    const packed = (s.pos.y * 50) + s.pos.x;
                    let arr = existingPositions.get(packed);
                    if (!arr) { arr = []; existingPositions.set(packed, arr); }
                    arr.push(s.structureType);
                }
            }
        }
        if (state.constructionSites) {
            const sites = Object.values(state.constructionSites);
            for (let i = 0; i < sites.length; i++) {
                const s = sites[i];
                const packed = (s.pos.y * 50) + s.pos.x;
                let arr = existingPositions.get(packed);
                if (!arr) { arr = []; existingPositions.set(packed, arr); }
                arr.push(s.structureType);
            }
        }

        let placed = 0;

        for (let p = 0; p < priorityArray.length && placed < maxToPlace; p++) {
            const structureType = priorityArray[p];
            let positions = [];

            if (structureType === STRUCTURE_CONTAINER) {
                const rawPositions = blueprint.containers || [];
                positions = [];
                for (let i = 0; i < rawPositions.length; i++) {
                    const pos = rawPositions[i];
                    // Core (fast filler) containers are gated until RCL 4
                    if (pos.intent === 'core' && rcl < 4) continue;
                    // Source containers are gated until RCL 3
                    if (pos.intent === 'source' && rcl < 3) continue;
                    // Mineral containers are gated until RCL 6
                    if (pos.intent === 'mineral' && rcl < 6) continue;
                    positions.push(pos);
                }
            } else if (structureType === STRUCTURE_ROAD) {
                const rawRoads = blueprint.roads || [];
                positions = [];
                
                let maxExtDist = 0;
                if (blueprint.anchor && state.structureIds) {
                    for (let i = 0; i < state.structureIds.length; i++) {
                        const s = CacheLib.getById(state.structureIds[i]);
                        if (s && s.structureType === STRUCTURE_EXTENSION) {
                            const d = Math.max(Math.abs(s.pos.x - blueprint.anchor.x), Math.abs(s.pos.y - blueprint.anchor.y));
                            if (d > maxExtDist) maxExtDist = d;
                        }
                    }
                }
                
                // Buffer ensures roads are placed slightly ahead of the next extension ring
                const allowedDist = maxExtDist + 2;
                
                for (let i = 0; i < rawRoads.length; i++) {
                    const road = rawRoads[i];
                    if (road.isExternal) {
                        if (rcl >= 3) positions.push(road);
                    } else if (road.dist !== undefined) {
                        if (road.dist <= allowedDist) positions.push(road);
                    } else {
                        positions.push(road);
                    }
                }
            } else if (structureType === STRUCTURE_RAMPART) {
                positions = blueprint.ramparts || [];
            } else {
                positions = blueprint[structureType] || [];
            }

            if (!positions || positions.length === 0) continue;

            const maxAllowed = CONTROLLER_STRUCTURES[structureType] ? CONTROLLER_STRUCTURES[structureType][rcl] : 0;
            // Note: maxAllowed for containers is always 5 (even at RCL 1) in the engine, but we want our custom RCL logic to govern them
            if (maxAllowed === 0 && structureType !== STRUCTURE_CONTAINER) continue;

            let count = 0;
            if (state.structureIds) {
                for (let i = 0; i < state.structureIds.length; i++) {
                    const s = CacheLib.getById(state.structureIds[i]);
                    if (s && s.structureType === structureType) count++;
                }
            }
            if (state.constructionSites) {
                const sites = Object.values(state.constructionSites);
                for (let i = 0; i < sites.length; i++) {
                    if (sites[i].structureType === structureType) count++;
                }
            }

            for (let i = 0; i < positions.length && placed < maxToPlace; i++) {
                if (count >= maxAllowed) break;
                const pos = positions[i];
                const packed = (pos.y * 50) + pos.x;
                const arr = existingPositions.get(packed);
                if (arr && arr.includes(structureType)) continue;

                if (room.createConstructionSite(pos.x, pos.y, structureType) === OK) {
                    placed++;
                    count++;
                    if (!arr) {
                        existingPositions.set(packed, [structureType]);
                    } else {
                        arr.push(structureType);
                    }
                }
            }
        }
    }
}

module.exports = ConstructionManager;
