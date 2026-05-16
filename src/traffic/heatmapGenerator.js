/**
 * @file heatmapGenerator.js
 * @description Generates CostMatrices with Range 3 penalties applied around hostile creeps.
 */

const HeatmapGenerator = {
    /**
     * Generates a new CostMatrix by applying Range 3 penalty tiles around hostiles.
     * @param {string} roomName - The name of the room.
     * @param {PathFinder.CostMatrix} baseMatrix - The base cost matrix.
     * @param {Creep[]} hostiles - Array of hostile creeps.
     * @returns {PathFinder.CostMatrix} The penalized CostMatrix.
     */
    generate(roomName, baseMatrix, hostiles) {
        const heatmap = baseMatrix.clone();

        for (const hostile of hostiles) {
            let isDangerous = true;
            if (hostile.body) {
                isDangerous = hostile.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK);
            }

            if (isDangerous) {
                const centerX = hostile.pos.x;
                const centerY = hostile.pos.y;

                for (let dx = -3; dx <= 3; dx++) {
                    for (let dy = -3; dy <= 3; dy++) {
                        const x = centerX + dx;
                        const y = centerY + dy;

                        // Ensure we are within room bounds
                        if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                            // Don't overwrite unwalkable terrain/structures if they are already 255
                            const currentCost = heatmap.get(x, y);
                            if (currentCost !== 255) {
                                heatmap.set(x, y, 255); // Apply maximum penalty to avoid this tile
                            }
                        }
                    }
                }
            }
        }

        return heatmap;
    }
};

module.exports = HeatmapGenerator;
