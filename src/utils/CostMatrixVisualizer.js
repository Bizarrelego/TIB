/**
 * @file CostMatrixVisualizer.js
 * @description Module for rendering CostMatrices onto room visuals for debugging spatial routing.
 */

class CostMatrixVisualizer {
    /**
     * Renders a CostMatrix onto the specified room's visuals.
     * @param {string} roomName - The name of the room.
     * @param {PathFinder.CostMatrix} costMatrix - The CostMatrix to render.
     * @param {string} [color='#ff0000'] - The base color for rendering the visualization.
     */
    static drawCostMatrix(roomName, costMatrix, color = '#ff0000') {
        if (!roomName || !costMatrix) return;

        const visual = new RoomVisual(roomName);

        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                const cost = costMatrix.get(x, y);
                if (cost > 0) {
                    if (cost === 255) {
                        visual.rect(x - 0.5, y - 0.5, 1, 1, { fill: color, opacity: 0.5 });
                    } else {
                        // Intermediate cost
                        visual.rect(x - 0.5, y - 0.5, 1, 1, { fill: color, opacity: (cost / 255) * 0.5 });
                        visual.text(cost.toString(), x, y + 0.2, { color: '#ffffff', font: 0.5 });
                    }
                }
            }
        }
    }
}

module.exports = CostMatrixVisualizer;
