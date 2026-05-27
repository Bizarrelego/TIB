/**
 * Calculates the exact positions for the initial 5 extensions at RCL 2,
 * using hardcoded offsets relative to the main spawn.
 *
 * @param {RoomPosition} spawnPos - The position of the room's main spawn.
 * @param {string} roomName - The name of the room.
 * @returns {RoomPosition[]} An array of up to 5 valid RoomPositions for early extensions.
 */
function getRCL2ExtensionPositions(spawnPos, roomName) {
    if (!spawnPos || !roomName) return [];

    const offsets = [[-2, 1], [-1, 2], [1, 2], [2, -1], [2, 1]];
    const positions = [];

    for (let i = 0; i < offsets.length; i++) {
        const dx = offsets[i][0];
        const dy = offsets[i][1];

        const x = spawnPos.x + dx;
        const y = spawnPos.y + dy;

        // Basic boundary check
        if (x >= 1 && x <= 48 && y >= 1 && y <= 48) {
            positions.push(new RoomPosition(x, y, roomName));
        }
    }

    return positions;
}

module.exports = {
    getRCL2ExtensionPositions
};
