/**
 * @file routePlanner.js
 * @description Dedicated module for generating cross-room paths avoiding hostile rooms and prioritizing highways.
 */

/**
 * Checks if a room is a highway room.
 * Highway rooms either end in a multiple of 10 or contain 'X' (e.g., mock/special highway segments).
 *
 * @param {string} roomName - The name of the room.
 * @returns {boolean} True if the room is a highway, false otherwise.
 */
function isHighway(roomName) {
    if (roomName.includes('X')) return true;

    const parsed = /^[EW](\d+)[NS](\d+)$/.exec(roomName);
    if (parsed) {
        const x = parseInt(parsed[1], 10);
        const y = parseInt(parsed[2], 10);
        return x % 10 === 0 || y % 10 === 0;
    }
    return false;
}

/**
 * Finds a safe and efficient cross-room path.
 *
 * @param {string} fromRoom - The starting room name.
 * @param {string} toRoom - The destination room name.
 * @returns {Array|number} The path array returned by Game.map.findRoute, or ERR_NO_PATH.
 */
function findRoute(fromRoom, toRoom) {
    if (fromRoom === toRoom) return [];

    return Game.map.findRoute(fromRoom, toRoom, {
        routeCallback(roomName, _fromRoomName) {
            // Avoid hostile rooms
            if (global.State && global.State.hostilesByRoom) {
                const hostiles = global.State.hostilesByRoom.get(roomName);
                if (hostiles && hostiles.length > 0) {
                    return Infinity;
                }
            }

            // Prefer highways
            if (isHighway(roomName)) {
                return 1;
            }

            return 2.5; // Regular rooms have higher cost
        }
    });
}

module.exports = {
    isHighway,
    findRoute
};
