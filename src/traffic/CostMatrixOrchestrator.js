/**
 * @module CostMatrixOrchestrator
 * @description Dynamically generates and combines various CostMatrices (swamp avoidance, directional roads, hostile heatmaps) into a single, final CostMatrix for pathfinding.
 */

const swampCostMatrixGenerator = require('./swampCostMatrixGenerator');
const DirectionalCostMatrixGenerator = require('./directionalCostMatrixGenerator');
const HeatmapGenerator = require('./heatmapGenerator');
const defconManager = require('../colonies/defconManager');

/**
 * Generates a dynamic CostMatrix by applying various overlays based on current game conditions.
 *
 * @param {string} roomName - The name of the room.
 * @param {number} [defconLevel] - The current DEFCON level of the room.
 * @param {Iterable<Creep>} [hostilePresence] - An iterable of hostile creeps in the room.
 * @param {Object} [options={}] - Additional options for directional matrix generation.
 * @param {Object} [options.centralPos] - The central position for directional flow.
 * @param {Object} [options.currentPos] - The current position of the creep for directional flow.
 * @param {string} [options.flowDirection='clockwise'] - Direction of flow around the hub.
 * @param {number} [options.radius=1] - Radius for the directional ring.
 * @returns {PathFinder.CostMatrix} The dynamically generated CostMatrix.
 */
function getDynamicCostMatrix(roomName, defconLevel, hostilePresence, options = {}) {
    // Determine defcon if not explicitly provided
    if (defconLevel === undefined || defconLevel === null) {
        defconLevel = defconManager.getDefconLevel(roomName);
    }

    // 1. Initialize base matrix utilizing swamp/structure penalization
    let costMatrix = swampCostMatrixGenerator(roomName);

    // 2. Apply Hostile Heatmap Overlay if defcon > 0 or hostiles are explicitly passed
    let hostilesArray = [];
    if (hostilePresence) {
        // Handle Iterables like Map.values() or Set.values()
        hostilesArray = Array.from(hostilePresence);
    }

    if (hostilesArray.length > 0 || defconLevel > 0) {
        const overlay = HeatmapGenerator.generateOverlay(hostilesArray);
        for (let i = 0; i < overlay.length; i++) {
            const tile = overlay[i];
            const currentCost = costMatrix.get(tile.x, tile.y);
            // Do not overwrite impassable terrain/structures
            if (currentCost !== 255) {
                costMatrix.set(tile.x, tile.y, Math.min(254, currentCost + tile.cost));
            }
        }
    }

    // 3. Apply Directional Flow Overlay if hub positions are provided
    if (options.centralPos && options.currentPos) {
        costMatrix = DirectionalCostMatrixGenerator.generate(
            roomName,
            options.centralPos,
            options.currentPos,
            options.flowDirection || 'clockwise',
            options.radius || 1,
            costMatrix
        );
    }

    return costMatrix;
}

module.exports = {
    getDynamicCostMatrix
};
