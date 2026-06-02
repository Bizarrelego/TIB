/**
 * Utility module to identify structures that need repairing.
 * @module RepairTargetUtility
 */

/**
 * Returns an array of Structure objects that are damaged and need repair.
 * Excludes walls and ramparts.
 * @param {string} roomName - The name of the room to check.
 * @param {number} threshold - The maximum hits percentage (e.g., 0.8 for 80% health).
 * @returns {Structure[]} Array of structures needing repair.
 */
function getRepairTargets(roomName, threshold) {
    let structureIds = null;

    // Handle both the acceptance criteria's expected global.state.rooms[roomName]
    // and the actual application's global.State.rooms.get(roomName)
    if (global.state && global.state.rooms && global.state.rooms[roomName]) {
        structureIds = global.state.rooms[roomName].structureIds;
    } else if (global.State && global.State.rooms && typeof global.State.rooms.get === 'function') {
        const roomState = global.State.rooms.get(roomName);
        if (roomState) {
            structureIds = roomState.structureIds;
        }
    }

    if (!structureIds) return [];

    const repairTargets = [];

    for (let i = 0; i < structureIds.length; i++) {
        const structure = Game.getObjectById(structureIds[i]);
        if (!structure) continue;

        if (structure.structureType === STRUCTURE_WALL || structure.structureType === STRUCTURE_RAMPART) {
            continue;
        }

        if (structure.hits < structure.hitsMax * threshold) {
            repairTargets.push(structure);
        }
    }

    return repairTargets;
}

module.exports = {
    getRepairTargets
};
