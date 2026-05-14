/**
 * @file pathing.js
 * @description Advanced inter-room pathfinding utilities leveraging intel and heatmaps.
 */

/**
 * Finds a path from an origin to a target room, avoiding hostile rooms and using heatmaps.
 * @param {RoomPosition|{pos: RoomPosition}} originPos - The starting position.
 * @param {string} targetRoomName - The name of the destination room.
 * @param {Object} [opts={}] - Additional options for PathFinder.search.
 * @returns {Object} The result from PathFinder.search {path, cost, ops, incomplete}.
 */
function findPathToRoom(originPos, targetRoomName, opts = {}) {
    const origin = originPos.pos || originPos;

    const searchOpts = {
        plainCost: 2,
        swampCost: 10,
        ...opts,
        roomCallback: function(roomName) {
            // Check if room is hostile
            if (global.State && global.State.intel && global.State.intel.has(roomName)) {
                const roomIntel = global.State.intel.get(roomName);
                if (roomIntel.hostile === true) {
                    return false; // Prevent pathing through hostile rooms
                }
            }

            // Check if we have a heatmap for the room
            if (global.State && global.State.heatmapsByRoom && global.State.heatmapsByRoom.has(roomName)) {
                return global.State.heatmapsByRoom.get(roomName);
            }

            // Use custom roomCallback if provided in opts, otherwise return default/undefined
            if (opts.roomCallback) {
                return opts.roomCallback(roomName);
            }

            return undefined;
        }
    };

    // Use a dummy position in the center of the target room
    const target = new RoomPosition(25, 25, targetRoomName);

    return PathFinder.search(origin, { pos: target, range: 20 }, searchOpts);
}

module.exports = {
    findPathToRoom
};
