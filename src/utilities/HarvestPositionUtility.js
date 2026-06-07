const GameObjectUtility = require('./GameObjectUtility');
const harvestPositionCache = new Map();
const allHarvestPositionsCache = new Map();

class HarvestPositionUtility {
    static getOptimalHarvestPosition(sourceId) {
        if (harvestPositionCache.has(sourceId)) {
            return harvestPositionCache.get(sourceId);
        }

        const source = GameObjectUtility.getById(sourceId);
        if (!source) {
            return null;
        }

        const terrain = Game.map.getRoomTerrain(source.room.name);
        const sourcePos = source.pos;

        let optimalPos = null;

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;

                const x = sourcePos.x + dx;
                const y = sourcePos.y + dy;

                if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                    if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                        optimalPos = new RoomPosition(x, y, source.room.name);
                        break;
                    }
                }
            }
            if (optimalPos) break;
        }

        if (optimalPos) {
            harvestPositionCache.set(sourceId, optimalPos);
        }

        return optimalPos;
    }

    /**
     * Gets all valid harvest positions around a given source.
     * @param {string} sourceId
     * @returns {RoomPosition[]}
     */
    static getAllHarvestPositions(sourceId) {
        if (allHarvestPositionsCache.has(sourceId)) {
            return allHarvestPositionsCache.get(sourceId);
        }

        const source = GameObjectUtility.getById(sourceId);
        if (!source) {
            return [];
        }

        const terrain = Game.map.getRoomTerrain(source.room.name);
        const sourcePos = source.pos;
        const validPositions = [];

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;

                const x = sourcePos.x + dx;
                const y = sourcePos.y + dy;

                if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
                    if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                        validPositions.push(new RoomPosition(x, y, source.room.name));
                    }
                }
            }
        }

        allHarvestPositionsCache.set(sourceId, validPositions);
        return validPositions;
    }
}

module.exports = HarvestPositionUtility;
