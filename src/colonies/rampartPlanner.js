const MinCut = require('../algorithms/minCut');
const DistanceTransform = require('../algorithms/distanceTransform');

module.exports = {
    /**
     * Automatically determines optimal rampart placement.
     * Internally calls DistanceTransform.compute to identify open areas
     * and MinCut.getCutTiles to find choke points.
     * @param {string} roomName
     * @param {Map} plannedStructures
     * @returns {RoomPosition[]}
     */
    planRamparts: function(roomName, plannedStructures) {
        if (!plannedStructures) return [];

        let minX = 50, minY = 50, maxX = 0, maxY = 0;
        let hasCoreStructures = false;

        // Find bounding box of core base structures
        for (const struct of plannedStructures.values()) {
            if (struct.type !== STRUCTURE_ROAD && struct.type !== STRUCTURE_CONTAINER && struct.type !== STRUCTURE_RAMPART) {
                hasCoreStructures = true;
                if (struct.pos.x < minX) minX = struct.pos.x;
                if (struct.pos.y < minY) minY = struct.pos.y;
                if (struct.pos.x > maxX) maxX = struct.pos.x;
                if (struct.pos.y > maxY) maxY = struct.pos.y;
            }
        }

        if (!hasCoreStructures) return [];

        // Expand bounding box by 2 tiles to safely encapsulate the base
        minX = Math.max(2, minX - 2);
        minY = Math.max(2, minY - 2);
        maxX = Math.min(47, maxX + 2);
        maxY = Math.min(47, maxY + 2);

        const sources = [{ x1: minX, y1: minY, x2: maxX, y2: maxY }];

        // Rebuild CostMatrix specifically for minCut (needs walls marked)
        const cm = new PathFinder.CostMatrix();
        const terrain = global.State.roomTerrain.get(roomName);
        for (let y = 0; y < 50; y++) {
            for (let x = 0; x < 50; x++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                    cm.set(x, y, 255);
                }
            }
        }

        // Call DistanceTransform to identify open areas
        DistanceTransform.compute(roomName, cm);

        return MinCut.getCutTiles(roomName, sources, cm) || [];
    },

    /**
     * @param {Room} room
     * @param {Map} plannerState
     * @param {Map} plannedStructures
     */
    run: function(room, plannerState, plannedStructures) {
        if (plannedStructures && !plannerState.has('rampartsPlanned')) {
            const cutTiles = this.planRamparts(room.name, plannedStructures);

            if (cutTiles && cutTiles.length > 0) {
                for (let i = 0; i < cutTiles.length; i++) {
                    const pos = cutTiles[i];
                    const uniqueId = `${STRUCTURE_RAMPART}-${pos.x}-${pos.y}`;
                    if (!plannedStructures.has(uniqueId)) {
                        plannedStructures.set(uniqueId, {
                            pos: pos,
                            type: STRUCTURE_RAMPART,
                            id: uniqueId
                        });
                    }
                }
            }
            plannerState.set('rampartsPlanned', true);
        }
    }
};
