/**
 * @file heatmapGenerator.js
 * @description Generates dynamic CostMatrices with penalty tiles around hostile creeps for auto-kiting.
 */

const HeatmapGenerator = {
    /**
     * Generates a list of penalty tiles around hostile creeps.
     * @param {Iterable<Creep>} hostiles - An iterable of hostile creeps in the room.
     * @param {number} [penalty=50] - The penalty cost to add.
     * @returns {Array<{x: number, y: number, cost: number}>} The array of penalty tiles.
     */
    generateOverlay: (hostiles, penalty = 50) => {
        const overlay = [];
        if (!hostiles) return overlay;

        for (const hostile of hostiles) {
            const hx = hostile.pos.x;
            const hy = hostile.pos.y;

            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    const x = hx + dx;
                    const y = hy + dy;

                    if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                        overlay.push({ x, y, cost: penalty });
                    }
                }
            }
        }
        return overlay;
    },

    /**
     * Applies a penalty overlay to a base CostMatrix.
     * @param {PathFinder.CostMatrix} baseMatrix - Base matrix to clone and apply to.
     * @param {Array<{x: number, y: number, cost: number}>} overlay - The overlay tiles.
     * @returns {PathFinder.CostMatrix} The dynamically adjusted CostMatrix.
     */
    applyOverlay: (baseMatrix, overlay) => {
        const costMatrix = baseMatrix ? baseMatrix.clone() : new PathFinder.CostMatrix();

        for (let i = 0; i < overlay.length; i++) {
            const tile = overlay[i];
            const currentCost = costMatrix.get(tile.x, tile.y);
            // Do not overwrite impassable terrain/structures
            if (currentCost !== 255) {
                costMatrix.set(tile.x, tile.y, Math.min(254, currentCost + tile.cost));
            }
        }
        return costMatrix;
    },

    /**
     * Legacy wrapper to generate a CostMatrix by applying a penalty around hostile creeps.
     * @param {string} roomName - The name of the room.
     * @param {Iterable<Creep>} hostiles - An iterable of hostile creeps in the room.
     * @param {PathFinder.CostMatrix} [baseMatrix] - Optional base matrix to clone.
     * @param {number} [penalty=50] - The penalty cost to add.
     * @returns {PathFinder.CostMatrix} The dynamically adjusted CostMatrix.
     */
    generate: (roomName, hostiles, baseMatrix, penalty = 50) => {
        const overlay = HeatmapGenerator.generateOverlay(hostiles, penalty);
        return HeatmapGenerator.applyOverlay(baseMatrix, overlay);
    }
};

module.exports = HeatmapGenerator;
