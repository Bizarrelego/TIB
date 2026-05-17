/**
 * @module SwampCostMatrixGenerator
 * @description Generates and caches a PathFinder.CostMatrix that heavily penalizes swamp tiles to force creeps onto plains.
 */

const SwampCostMatrixGenerator = {
    terrainCache: new Map(),

    /**
     * Generates a CostMatrix prioritizing plains over swamps, applying structures on top.
     * @param {string} roomName - The name of the room.
     * @returns {PathFinder.CostMatrix} The generated CostMatrix.
     */
    generate: (roomName) => {
        let baseMatrix;

        if (SwampCostMatrixGenerator.terrainCache.has(roomName)) {
            baseMatrix = SwampCostMatrixGenerator.terrainCache.get(roomName).clone();
        } else {
            baseMatrix = new PathFinder.CostMatrix();
            const terrain = Game.map.getRoomTerrain(roomName);

            for (let x = 0; x < 50; x++) {
                for (let y = 0; y < 50; y++) {
                    const terrainMask = terrain.get(x, y);
                    if (terrainMask === TERRAIN_MASK_WALL) {
                        // Base matrix doesn't strictly need to set walls to 255 as they are impassable by default,
                        // but setting it ensures the matrix logic explicitly handles it.
                        baseMatrix.set(x, y, 255);
                    } else if (terrainMask === TERRAIN_MASK_SWAMP) {
                        baseMatrix.set(x, y, 5);
                    } else {
                        // Plains
                        baseMatrix.set(x, y, 2);
                    }
                }
            }
            // Clone for the cache to return a new copy next time
            SwampCostMatrixGenerator.terrainCache.set(roomName, baseMatrix.clone());
        }

        // Apply structures on top
        if (global.State && global.State.structuresByRoom && global.State.structuresByRoom.has(roomName)) {
            const structuresMap = global.State.structuresByRoom.get(roomName);
            for (const [structureType, structures] of structuresMap.entries()) {
                if (structureType === STRUCTURE_ROAD) {
                    for (const structure of structures.values()) {
                        baseMatrix.set(structure.pos.x, structure.pos.y, 1);
                    }
                } else if (structureType !== STRUCTURE_CONTAINER && structureType !== STRUCTURE_RAMPART) {
                    for (const structure of structures.values()) {
                        baseMatrix.set(structure.pos.x, structure.pos.y, 255);
                    }
                }
            }
        }

        return baseMatrix;
    }
};

module.exports = SwampCostMatrixGenerator.generate;
