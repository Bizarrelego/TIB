const CacheLib = require('../lib/CacheLib');

/**
 * Decouples blueprint generation from execution, ensuring high-priority structures 
 * are built sequentially without overflowing site limits.
 */
class ConstructionManager {
    static run() {
        if (Game.time % 13 !== 0) return;
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
            if (siteCount >= 3) continue;

            const blueprint = global.Cache?.blueprints?.get(roomName);
            if (!blueprint) continue;

            ConstructionManager.executeRoomBlueprint(room, blueprint, state, 3 - siteCount);
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

        const existingPositions = new Set();
        if (state.structureIds) {
            for (let i = 0; i < state.structureIds.length; i++) {
                const s = CacheLib.getById(state.structureIds[i]);
                if (s) existingPositions.add(`${s.pos.x}_${s.pos.y}_${s.structureType}`);
            }
        }
        if (state.constructionSites) {
            const sites = Object.values(state.constructionSites);
            for (let i = 0; i < sites.length; i++) {
                const s = sites[i];
                existingPositions.add(`${s.pos.x}_${s.pos.y}_${s.structureType}`);
            }
        }

        let placed = 0;

        for (let p = 0; p < priorityArray.length && placed < maxToPlace; p++) {
            const structureType = priorityArray[p];
            let positions = [];

            if (structureType === STRUCTURE_CONTAINER) {
                positions = blueprint.containers || [];
            } else if (structureType === STRUCTURE_ROAD) {
                positions = blueprint.roads || [];
            } else if (structureType === STRUCTURE_RAMPART) {
                positions = blueprint.ramparts || [];
            } else {
                positions = blueprint[structureType] || [];
            }

            if (!positions || positions.length === 0) continue;

            const maxAllowed = CONTROLLER_STRUCTURES[structureType] ? CONTROLLER_STRUCTURES[structureType][rcl] : 0;
            if (maxAllowed === 0) continue;

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
                const key = `${pos.x}_${pos.y}_${structureType}`;
                if (existingPositions.has(key)) continue;

                if (room.createConstructionSite(pos.x, pos.y, structureType) === OK) {
                    placed++;
                    count++;
                    existingPositions.add(key);
                }
            }
        }
    }
}

module.exports = ConstructionManager;
