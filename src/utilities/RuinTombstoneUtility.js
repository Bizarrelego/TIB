/**
 * Utility for interacting with Ruins and Tombstones.
 * Strictly reads from the global state without native polling.
 * @module RuinTombstoneUtility
 */

/**
 * Retrieves ruins in the room that contain energy.
 * @param {string} roomName - The name of the room.
 * @returns {StructureRuin[]} Array of ruins containing energy.
 */
function getRuinsWithEnergy(roomName) {
    if (!global.State || !global.State.rooms) return [];
    const roomState = global.State.rooms.get(roomName);
    if (!roomState || !roomState.ruins) return [];

    const validRuins = [];
    for (let i = 0; i < roomState.ruins.length; i++) {
        const ruin = roomState.ruins[i];
        if (ruin && ruin.store && ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            validRuins.push(ruin);
        }
    }
    return validRuins;
}

/**
 * Retrieves tombstones in the room that contain energy.
 * @param {string} roomName - The name of the room.
 * @returns {StructureTombstone[]} Array of tombstones containing energy.
 */
function getTombstonesWithEnergy(roomName) {
    if (!global.State || !global.State.rooms) return [];
    const roomState = global.State.rooms.get(roomName);
    if (!roomState || !roomState.tombstones) return [];

    const validTombstones = [];
    for (let i = 0; i < roomState.tombstones.length; i++) {
        const tombstone = roomState.tombstones[i];
        if (tombstone && tombstone.store && tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            validTombstones.push(tombstone);
        }
    }
    return validTombstones;
}

module.exports = {
    getRuinsWithEnergy,
    getTombstonesWithEnergy
};
