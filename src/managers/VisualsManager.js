/**
 * @file VisualsManager.js
 * @description Manager for handling room visuals (e.g., debug drawings, metrics).
 */
const CostMatrixVisualizer = require('../utils/CostMatrixVisualizer');
const CostMatrixCache = require('../traffic/costMatrixCache');

class VisualsManager {
    /**
     * Executes the room visuals logic.
     */
    static run() {
        // Implementation for rendering room visuals

        // Toggle CostMatrix visualization based on a memory flag
        if (Memory.visuals && Memory.visuals.costMatrix) {
            for (const roomName in Game.rooms) {
                // Visualize base matrix
                const costMatrix = CostMatrixCache.get(roomName);
                if (costMatrix) {
                    CostMatrixVisualizer.drawCostMatrix(roomName, costMatrix);
                }

                // Note: We could also visualize dynamic overlays here if needed
                // e.g. CostMatrixCache.getDynamic(roomName, costMatrix)
            }
        }
    }
}

module.exports = VisualsManager;
