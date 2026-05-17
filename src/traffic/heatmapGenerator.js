/**
 * @file heatmapGenerator.js
 * @description Generates dynamic CostMatrices with penalty tiles around hostile creeps for auto-kiting.
 */

const CostMatrixCache = require('./costMatrixCache');

const HeatmapGenerator = {
    /**
     * Generates a CostMatrix by applying a penalty around hostile creeps.
     * @param {string} roomName - The name of the room.
     * @param {Iterable<Creep>} hostiles - An iterable of hostile creeps in the room.
     * @returns {PathFinder.CostMatrix} The dynamically adjusted CostMatrix.
     */
    generate: (roomName, hostiles) => {
        const baseMatrix = CostMatrixCache.get(roomName);
        if (!baseMatrix) return new PathFinder.CostMatrix();

        const costMatrix = baseMatrix.clone();

        for (const hostile of hostiles) {
            const hx = hostile.pos.x;
            const hy = hostile.pos.y;

            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    const x = hx + dx;
                    const y = hy + dy;

                    if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                        const currentCost = costMatrix.get(x, y);
                        // Do not overwrite impassable terrain/structures
                        if (currentCost !== 255) {
                            // Apply a penalty (e.g., +50 cost) to avoid being close to hostiles
                            costMatrix.set(x, y, Math.min(254, currentCost + 50));
                        }
                    }
                }
            }
        }

        return costMatrix;
    }
};

module.exports = HeatmapGenerator;
