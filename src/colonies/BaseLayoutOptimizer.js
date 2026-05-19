/**
 * @file BaseLayoutOptimizer.js
 * @description Generates optimal base layouts using Distance Transforms and Min-Cut.
 */

const DistanceTransform = require('../algorithms/distanceTransform');
const MinCut = require('../algorithms/minCut');

/**
 * Module responsible for generating optimal base layouts.
 */
class BaseLayoutOptimizer {
    /**
     * Finds valid positions spiraling out from an anchor.
     * @param {string} roomName The name of the room.
     * @param {RoomPosition} anchor The central point to search around.
     * @param {number} count The number of positions to find.
     * @param {PathFinder.CostMatrix} costMatrix The matrix tracking occupied/unbuildable space.
     * @param {Room.Terrain} terrain The room terrain.
     * @param {boolean} [leavePaths=true] Whether to leave checkerboard gaps for paths.
     * @returns {RoomPosition[]} An array of valid RoomPositions.
     */
    static findValidPositions(roomName, anchor, count, costMatrix, terrain, leavePaths = true) {
        const positions = [];
        let radius = 1;

        while (positions.length < count && radius < 25) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only process the perimeter of the current radius
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

                    const x = anchor.x + dx;
                    const y = anchor.y + dy;

                    if (x <= 1 || x >= 48 || y <= 1 || y >= 48) continue;

                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                    if (costMatrix.get(x, y) === 255) continue;

                    // Optional: enforce checkerboard pattern for paths
                    if (leavePaths && (Math.abs(dx) + Math.abs(dy)) % 2 !== 0) continue;

                    positions.push(new RoomPosition(x, y, roomName));
                    costMatrix.set(x, y, 255); // Mark as occupied

                    if (positions.length >= count) return positions;
                }
            }
            radius++;
        }

        return positions;
    }

    /**
     * Generates a proposed layout for all standard structures based on room terrain and RCL.
     * @param {string} roomName The name of the room.
     * @param {number} rcl The Room Controller Level.
     * @returns {Map<string, RoomPosition[]>} A Map containing arrays of RoomPositions grouped by structure type.
     */
    static generateLayout(roomName, rcl) {
        const layout = new Map([
            ['spawn', []],
            ['extension', []],
            ['link', []],
            ['storage', []],
            ['terminal', []],
            ['lab', []],
            ['tower', []],
            ['factory', []],
            ['powerSpawn', []],
            ['nuker', []],
            ['observer', []],
            ['rampart', []],
            ['road', []]
        ]);

        const terrain = new Room.Terrain(roomName);
        const cm = new PathFinder.CostMatrix();

        // 1. Initial CM setup from terrain
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                    cm.set(x, y, 255);
                }
            }
        }

        // 2. Compute Distance Transform to find the most open central area
        const dt = DistanceTransform.compute(roomName, cm);

        let maxDtVal = 0;
        let centerPos = null;

        for (let x = 2; x < 48; x++) {
            for (let y = 2; y < 48; y++) {
                const val = dt.get(x, y);
                if (val > maxDtVal) {
                    maxDtVal = val;
                    centerPos = new RoomPosition(x, y, roomName);
                }
            }
        }

        if (!centerPos) return layout; // Fallback for fully walled rooms

        // 3. Plan Core Hub (Storage, Terminal, Factory, Hub Link) around center
        cm.set(centerPos.x, centerPos.y, 255); // Mark center itself occupied (maybe storage)
        layout.get('storage').push(centerPos);

        if (rcl >= 6) {
            const hubSpots = BaseLayoutOptimizer.findValidPositions(roomName, centerPos, 2, cm, terrain, false);
            if (hubSpots.length > 0) layout.get('terminal').push(hubSpots[0]);
            if (hubSpots.length > 1) layout.get('link').push(hubSpots[1]);
        }
        if (rcl >= 7) {
            const facSpots = BaseLayoutOptimizer.findValidPositions(roomName, centerPos, 1, cm, terrain, false);
            if (facSpots.length > 0) layout.get('factory').push(facSpots[0]);
        }

        // 4. Determine Structure Counts based on RCL
        const counts = new Map([
            ['spawn', rcl >= 8 ? 3 : (rcl >= 7 ? 2 : (rcl >= 1 ? 1 : 0))],
            ['extension', rcl >= 8 ? 60 : (rcl >= 7 ? 50 : (rcl >= 6 ? 40 : (rcl >= 5 ? 30 : (rcl >= 4 ? 20 : (rcl >= 3 ? 10 : (rcl >= 2 ? 5 : 0))))))],
            ['tower', rcl >= 8 ? 6 : (rcl >= 7 ? 3 : (rcl >= 5 ? 2 : (rcl >= 3 ? 1 : 0)))],
            ['lab', rcl >= 8 ? 10 : (rcl >= 7 ? 6 : (rcl >= 6 ? 3 : 0))],
            ['link', rcl >= 8 ? 6 : (rcl >= 7 ? 4 : (rcl >= 6 ? 3 : (rcl >= 5 ? 2 : 0)))], // Includes hub link
            ['observer', rcl >= 8 ? 1 : 0],
            ['nuker', rcl >= 8 ? 1 : 0],
            ['powerSpawn', rcl >= 8 ? 1 : 0]
        ]);

        // Adjust link count since hub link was placed
        let remainingLinks = counts.get('link') - layout.get('link').length;

        // 5. Place Structures
        layout.set('spawn', BaseLayoutOptimizer.findValidPositions(roomName, centerPos, counts.get('spawn'), cm, terrain));
        layout.set('extension', BaseLayoutOptimizer.findValidPositions(roomName, centerPos, counts.get('extension'), cm, terrain));
        layout.set('tower', BaseLayoutOptimizer.findValidPositions(roomName, centerPos, counts.get('tower'), cm, terrain, false));

        // Group labs
        if (counts.get('lab') > 0) {
            // Find an anchor for labs slightly away from center
            const labAnchorSpots = BaseLayoutOptimizer.findValidPositions(roomName, centerPos, 1, cm, terrain, false);
            if (labAnchorSpots.length > 0) {
                const labAnchor = labAnchorSpots[0];
                layout.set('lab', BaseLayoutOptimizer.findValidPositions(roomName, labAnchor, counts.get('lab'), cm, terrain, false));
            }
        }

        if (remainingLinks > 0) {
           layout.get('link').push(...BaseLayoutOptimizer.findValidPositions(roomName, centerPos, remainingLinks, cm, terrain, false));
        }

        if (counts.get('observer') > 0) layout.set('observer', BaseLayoutOptimizer.findValidPositions(roomName, centerPos, counts.get('observer'), cm, terrain, false));
        if (counts.get('nuker') > 0) layout.set('nuker', BaseLayoutOptimizer.findValidPositions(roomName, centerPos, counts.get('nuker'), cm, terrain, false));
        if (counts.get('powerSpawn') > 0) layout.set('powerSpawn', BaseLayoutOptimizer.findValidPositions(roomName, centerPos, counts.get('powerSpawn'), cm, terrain, false));

        // 6. Min-Cut Defense (Ramparts)
        const minCutBounds = new PathFinder.CostMatrix();
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                    minCutBounds.set(x, y, 255);
                }
            }
        }

        // Min-Cut protects the 'SOURCE' from the 'SINK' (which are map boundaries in minCut.js).
        // Therefore, we pass our core base structures as 'sources' to protect them from boundaries.
        const protectedSources = [];
        const allStructures = [...layout.get('spawn'), ...layout.get('storage'), ...layout.get('terminal'), ...layout.get('tower'), ...layout.get('factory')];
        if (allStructures.length > 0) {
            let minX = 50, minY = 50, maxX = 0, maxY = 0;
            for (const pos of allStructures) {
                if (pos.x < minX) minX = pos.x;
                if (pos.y < minY) minY = pos.y;
                if (pos.x > maxX) maxX = pos.x;
                if (pos.y > maxY) maxY = pos.y;
            }
            // Add some padding to protect the core
            minX = Math.max(2, minX - 3);
            minY = Math.max(2, minY - 3);
            maxX = Math.min(47, maxX + 3);
            maxY = Math.min(47, maxY + 3);
            protectedSources.push({x1: minX, y1: minY, x2: maxX, y2: maxY});

            layout.set('rampart', MinCut.getCutTiles(roomName, protectedSources, minCutBounds));
        }

        return layout;
    }
}

module.exports = BaseLayoutOptimizer;
