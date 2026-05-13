/**
 * Calculates a Distance Transform for a given room.
 * This is a fundamental algorithm for assessing spawn-to-source distances,
 * building heatmaps, and feeding into Min-Cut (Ford-Fulkerson).
 */
class DistanceTransform {
    /**
     * Compute a distance transform from a set of target points
     * @param {string} roomName
     * @param {CostMatrix} initialMatrix 255 = unwalkable, 0 = walkable
     * @returns {CostMatrix} The distance transform
     */
    static compute(roomName, initialMatrix) {
        let dt = new PathFinder.CostMatrix();

        // Pass 1: Top-Left to Bottom-Right
        for (let y = 0; y < 50; y++) {
            for (let x = 0; x < 50; x++) {
                if (initialMatrix.get(x, y) === 255) {
                    dt.set(x, y, 0);
                    continue;
                }

                let val = 255;
                if (x > 0) val = Math.min(val, dt.get(x - 1, y) + 1);
                if (y > 0) val = Math.min(val, dt.get(x, y - 1) + 1);
                if (x > 0 && y > 0) val = Math.min(val, dt.get(x - 1, y - 1) + 1);
                if (x < 49 && y > 0) val = Math.min(val, dt.get(x + 1, y - 1) + 1);

                dt.set(x, y, val);
            }
        }

        // Pass 2: Bottom-Right to Top-Left
        for (let y = 49; y >= 0; y--) {
            for (let x = 49; x >= 0; x--) {
                let val = dt.get(x, y);
                if (val === 0) continue; // Unwalkable

                if (x < 49) val = Math.min(val, dt.get(x + 1, y) + 1);
                if (y < 49) val = Math.min(val, dt.get(x, y + 1) + 1);
                if (x < 49 && y < 49) val = Math.min(val, dt.get(x + 1, y + 1) + 1);
                if (x > 0 && y < 49) val = Math.min(val, dt.get(x - 1, y + 1) + 1);

                dt.set(x, y, val);
            }
        }

        return dt;
    }
}

module.exports = DistanceTransform;
