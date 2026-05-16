/**
 * @typedef {Object} RoomPosition
 * @property {number} x
 * @property {number} y
 * @property {string} roomName
 */

/**
 * Generates a CostMatrix that enforces directional flow around a central hub.
 */
class DirectionalCostMatrixGenerator {
    /**
     * Generates a directional CostMatrix dynamically based on a creep's current position.
     * By blocking the "backward" tile in a circular ring, it forces movement in the specified direction.
     *
     * @param {string} roomName - The name of the room.
     * @param {RoomPosition} centralPos - The center of the hub.
     * @param {RoomPosition} currentPos - The current position of the creep.
     * @param {string} [flowDirection='clockwise'] - 'clockwise' or 'counter-clockwise'.
     * @param {number} [radius=1] - The radius of the circular path around the central point.
     * @param {PathFinder.CostMatrix} [baseMatrix] - An optional base CostMatrix to clone and modify.
     * @returns {PathFinder.CostMatrix} The dynamically adjusted CostMatrix.
     */
    static generate(roomName, centralPos, currentPos, flowDirection = 'clockwise', radius = 1, baseMatrix = undefined) {
        let costMatrix;
        if (baseMatrix) {
            costMatrix = baseMatrix.clone();
        } else {
            costMatrix = new PathFinder.CostMatrix();
        }

        // Calculate the square ring of tiles around the central hub.
        const ringTiles = this.getRingTiles(centralPos, radius);

        // Find if the current position is on this ring.
        const currentIndex = ringTiles.findIndex(t => t.x === currentPos.x && t.y === currentPos.y);

        if (currentIndex !== -1) {
            // Find the "backward" tile relative to the flow direction to block it.
            let backwardIndex;
            if (flowDirection === 'clockwise') {
                backwardIndex = (currentIndex - 1 + ringTiles.length) % ringTiles.length;
            } else {
                backwardIndex = (currentIndex + 1) % ringTiles.length;
            }

            const backwardTile = ringTiles[backwardIndex];
            costMatrix.set(backwardTile.x, backwardTile.y, 255);
        }

        return costMatrix;
    }

    /**
     * Computes the tiles forming a square ring around a central point.
     * Ordered clockwise starting from the top-left corner.
     *
     * @param {RoomPosition} centralPos - The central position.
     * @param {number} radius - The radius of the ring.
     * @returns {Array<{x: number, y: number}>} Array of coordinates in clockwise order.
     */
    static getRingTiles(centralPos, radius) {
        const tiles = [];
        const top = centralPos.y - radius;
        const bottom = centralPos.y + radius;
        const left = centralPos.x - radius;
        const right = centralPos.x + radius;

        // Top edge (left to right)
        if (this.isValid(top)) {
            for (let x = left; x <= right; x++) {
                if (this.isValid(x)) tiles.push({ x, y: top });
            }
        }

        // Right edge (top+1 to bottom)
        if (this.isValid(right)) {
            for (let y = top + 1; y <= bottom; y++) {
                if (this.isValid(y)) tiles.push({ x: right, y });
            }
        }

        // Bottom edge (right-1 to left)
        if (this.isValid(bottom)) {
            for (let x = right - 1; x >= left; x--) {
                if (this.isValid(x)) tiles.push({ x, y: bottom });
            }
        }

        // Left edge (bottom-1 to top+1)
        if (this.isValid(left)) {
            for (let y = bottom - 1; y > top; y--) {
                if (this.isValid(y)) tiles.push({ x: left, y });
            }
        }

        return tiles;
    }

    /**
     * Validates that a coordinate is within the 0-49 room bounds.
     *
     * @param {number} coord - The coordinate to check.
     * @returns {boolean} True if the coordinate is strictly within bounds.
     */
    static isValid(coord) {
        return coord >= 0 && coord <= 49;
    }
}

module.exports = DirectionalCostMatrixGenerator;
