/**
 * @file intel.js
 * @description Manages cross-room intel, heatmaps, and RawMemory mapping.
 */

function buildHeatmaps() {
    // Scaffold: Generate range 3 penalty tiles around hostiles
    // Maps to CostMatrices to facilitate auto-kiting for remote defenders
    if (!global.State) return;
    if (!global.State.heatmaps) global.State.heatmaps = new Map();

    const hostilesByRoom = global.State.hostilesByRoom;
    if (!hostilesByRoom) return;

    for (const [roomName, hostiles] of hostilesByRoom.entries()) {
        if (!hostiles || hostiles.length === 0) continue;

        let cm = new PathFinder.CostMatrix();

        for (const hostile of hostiles) {
            // Apply range 3 penalty
            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    const x = hostile.pos.x + dx;
                    const y = hostile.pos.y + dy;
                    if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                        // Max penalty inside this range
                        cm.set(x, y, 255);
                    }
                }
            }
        }

        global.State.heatmaps.set(roomName, cm);
    }
}

function mapToRawMemory() {
    // Scaffold: Serialize Intel and Heatmap CostMatrices
    // Segment 0-10: Intel
    // Segment 11-20: Distance Transforms & Heatmaps
    if (!global.State || !global.State.intel) return;

    // Convert map to object for serialization
    const intelObj = {};
    for (const [roomName, data] of global.State.intel.entries()) {
        intelObj[roomName] = data;
    }

    const serialized = JSON.stringify(intelObj);

    // Basic serialization to segment 0
    RawMemory.setActiveSegments([0]);

    // We can only write if the segment is active this tick.
    // Usually it takes 1 tick to become active after setting.
    if (Object.keys(RawMemory.segments).includes('0')) {
        RawMemory.segments[0] = serialized;
    }
}

module.exports = function intelManager() {
    try {
        if (Game.time % 10 === 0) {
            buildHeatmaps();
            mapToRawMemory();
        }
    } catch (e) {
        console.error(`[IntelManager Error] ${e.stack}`);
    }
};
