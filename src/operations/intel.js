const Profiler = require('../utils/profiler');
/**
 * @file intel.js
 * @description Manages cross-room intel, heatmaps, and RawMemory mapping.
 */

/**
 * Builds cost matrices (heatmaps) around hostiles for auto-kiting.
 * Penalty tiles range up to 3 tiles outward.
 * @returns {void}
 */
function buildHeatmaps() {
    if (!global.State.scannedRooms) return;
    if (!global.State.heatmapsByRoom) global.State.heatmapsByRoom = new Map();

    for (const roomName of global.State.scannedRooms) {
        const hostiles = global.State.hostilesByRoom?.get(roomName) || [];
        if (hostiles.length > 0) {
            const costMatrix = new PathFinder.CostMatrix();
            for (const hostile of hostiles) {
                // Exact tile penalty
                costMatrix.set(hostile.pos.x, hostile.pos.y, 255);

                // Radius 3 penalty
                for (let dx = -3; dx <= 3; dx++) {
                    for (let dy = -3; dy <= 3; dy++) {
                        if (dx === 0 && dy === 0) continue; // Skip exact tile, already set to 255
                        const x = hostile.pos.x + dx;
                        const y = hostile.pos.y + dy;
                        if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                            const currentCost = costMatrix.get(x, y);
                            // Set to 50 if it's less than 50
                            if (currentCost < 50) {
                                costMatrix.set(x, y, 50);
                            }
                        }
                    }
                }
            }
            global.State.heatmapsByRoom.set(roomName, costMatrix);
        } else {
            // Option to clear if no hostiles, or let it age. Prompt says "generate" if hostiles exist.
            // A safe approach is to clear it if no hostiles are present.
            if (global.State.heatmapsByRoom.has(roomName)) {
                global.State.heatmapsByRoom.delete(roomName);
            }
        }
    }
}

/**
 * Serializes and maps intel and heatmaps to RawMemory segments (0 and 1).
 * @returns {void}
 */
function mapToRawMemory() {
    // Request segments
    RawMemory.setActiveSegments([0, 1]);

    // Segment 0: Intel
    if (global.State.intel) {
        const intelObj = Object.fromEntries(global.State.intel);
        RawMemory.segments[0] = JSON.stringify(intelObj);
    }

    // Segment 1: Heatmaps
    if (global.State.heatmapsByRoom) {
        const heatmapsObj = {};
        for (const [roomName, costMatrix] of global.State.heatmapsByRoom.entries()) {
            heatmapsObj[roomName] = costMatrix.serialize();
        }
        RawMemory.segments[1] = JSON.stringify(heatmapsObj);
    }
}

/**
 * Main intel loop to generate heatmaps and serialize to memory.
 * @returns {void}
 */
module.exports = Profiler.wrap('intelManager', function intelManager() {
    try {
        if (Game.time % 10 === 0) {
            buildHeatmaps();
            mapToRawMemory();
        }
    } catch (e) {
        console.error(`[IntelManager Error] ${e.stack}`);
    }
});
