/**
 * Dijkstra Pathing Algorithm for HVT (High-Value Target) Penetration
 * Calculates the cheapest path through rampart segments by evaluating
 * structure hitpoints as path weight.
 */
class Dijkstra {
    /**
     * @param {RoomPosition} startPos
     * @param {RoomPosition[]} targetPositions
     * @param {CostMatrix} costMatrix Basic walkability map
     * @param {Function} costCallback Function(x, y) returning hitpoint weight
     * @returns {RoomPosition[]} Array of positions representing the path
     */
    static findPath(startPos, targetPositions, costMatrix, costCallback) {
        // Priority Queue implementation for Dijkstra is needed here, using array fallback for basic structure
        let queue = [{ pos: startPos, cost: 0, path: [startPos] }];
        let visited = new Map();
        visited.set(`${startPos.x},${startPos.y}`, 0);

        let targetSet = new Set(targetPositions.map(p => `${p.x},${p.y}`));

        while (queue.length > 0) {
            // Very naive extract-min (in production use a proper MinHeap)
            queue.sort((a, b) => a.cost - b.cost);
            let current = queue.shift();
            let posKey = `${current.pos.x},${current.pos.y}`;

            if (targetSet.has(posKey)) {
                return current.path;
            }

            const dx = [-1, 0, 1, -1, 1, -1, 0, 1];
            const dy = [-1, -1, -1, 0, 0, 1, 1, 1];

            for (let i = 0; i < 8; i++) {
                let nx = current.pos.x + dx[i];
                let ny = current.pos.y + dy[i];

                if (nx < 0 || nx > 49 || ny < 0 || ny > 49) continue;

                let matrixCost = costMatrix ? costMatrix.get(nx, ny) : 0;
                if (matrixCost === 255) continue; // Unwalkable terrain

                let hpCost = costCallback ? costCallback(nx, ny) : 0;
                let newCost = current.cost + matrixCost + hpCost + 1; // +1 for base move
                let nKey = `${nx},${ny}`;

                if (!visited.has(nKey) || newCost < visited.get(nKey)) {
                    visited.set(nKey, newCost);
                    let newPos = new RoomPosition(nx, ny, startPos.roomName);
                    queue.push({
                        pos: newPos,
                        cost: newCost,
                        path: [...current.path, newPos]
                    });
                }
            }
        }

        return []; // No path found
    }
}

module.exports = Dijkstra;
