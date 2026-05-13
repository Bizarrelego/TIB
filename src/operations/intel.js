/**
 * @file intel.js
 * @description Manages cross-room intel, heatmaps, and RawMemory mapping.
 */

function buildHeatmaps() {
    // Scaffold: Generate range 3 penalty tiles around hostiles
    // Maps to CostMatrices to facilitate auto-kiting for remote defenders
    if (!global.State) return;

    global.State.heatmaps = global.State.heatmaps || new Map();

    for (const roomName of global.State.scannedRooms || []) {
        const hostiles = global.State.hostilesByRoom.get(roomName);
        if (hostiles && hostiles.size > 0) {
            let cm = new PathFinder.CostMatrix();
            for (const h of hostiles.values()) {
                // Apply penalty 255 to range 3
                for (let dx = -3; dx <= 3; dx++) {
                    for (let dy = -3; dy <= 3; dy++) {
                        const nx = h.pos.x + dx;
                        const ny = h.pos.y + dy;
                        if (nx >= 0 && nx <= 49 && ny >= 0 && ny <= 49) {
                            cm.set(nx, ny, 255);
                        }
                    }
                }
            }
            global.State.heatmaps.set(roomName, cm);
        } else {
            global.State.heatmaps.delete(roomName);
        }
    }
}

function mapToRawMemory() {
    // Scaffold: Serialize Intel and Heatmap CostMatrices
    // Segment 0-10: Intel
    // Segment 11-20: Distance Transforms & Heatmaps
    if (!global.State) return;

    try {
        if (global.State.heatmaps) {
            let hmData = {};
            for (const [roomName, cm] of global.State.heatmaps.entries()) {
                hmData[roomName] = cm.serialize();
            }

            // RawMemory access is expensive, do it minimally
            if (Object.keys(hmData).length > 0) {
                // Segment 11 for heatmaps
                RawMemory.segments[11] = JSON.stringify(hmData);
                RawMemory.setActiveSegments([11]);
            }
        }
    } catch (e) {
        console.error(`[IntelManager Serialize Error] ${e.stack}`);
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
