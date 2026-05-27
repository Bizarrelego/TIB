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

const SourceManager = require('../managers/SourceManager');
const SystemScheduler = require('../os/SystemScheduler');

/**
 * Automatically places container construction sites at optimal mining spots when RCL 2 is reached.
 * @param {Room} room
 */
function planSourceContainers(room) {
    // REJECTED BY TIB MATRIX. Containers are not allowed at RCL 2.
}

function hasSiteOrStructureAt(roomName, x, y) {
    if (global.State && global.State.structuresByRoom) {
        const structures = global.State.structuresByRoom.get(roomName);
        if (structures) {
            for (const typeMap of structures.values()) {
                for (const structure of typeMap.values()) {
                    if (structure.pos.x === x && structure.pos.y === y) {
                        return true;
                    }
                }
            }
        }
    }
    if (global.State && global.State.sitesByRoom) {
        const sitesMap = global.State.sitesByRoom.get(roomName);
        const sites = sitesMap ? (sitesMap instanceof Map ? Array.from(sitesMap.values()) : sitesMap) : [];
        for (const site of sites) {
            if (site.pos.x === x && site.pos.y === y) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Automatically places a container construction site near the controller.
 * @param {Room} room
 */
function planControllerContainer(room) {
    // REJECTED BY TIB MATRIX. Containers are not allowed at RCL 2.
}

/**
 * Runs the early game construction planner logic for a room.
 * Should be called until RCL 3.
 * @param {Room} room
 */
function run(room) {
    if (!room.controller || !room.controller.my || room.controller.level >= 3) return;

    if (room.controller.level === 2) {
        planSourceContainers(room);
        planControllerContainer(room);
    }
}

// SystemScheduler wrapper setup could be called from OS initialization or here
SystemScheduler.register('earlyGameConstructionPlanner', 100, () => {
    if (global.State && global.State.rooms) {
        for (const roomName of global.State.rooms.keys()) {
            const room = Game.rooms[roomName];
            if (room) {
                run(room);
            }
        }
    }
});

module.exports = {
    getRCL2ExtensionPositions,
    planSourceContainers,
    planControllerContainer,
    run
};
