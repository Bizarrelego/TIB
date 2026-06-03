/**
 * Utility for interacting with dropped resources.
 * Strictly reads from the global state without native polling.
 * @module DroppedResourceUtility
 */

/**
 * Retrieves dropped energy in the room that has an amount > 0.
 * @param {string} roomName - The name of the room.
 * @returns {Resource[]} Array of dropped energy resources.
 */
function getDroppedEnergy(roomName) {
    if (!global.State || !global.State.rooms) return [];
    const roomState = global.State.rooms.get(roomName);
    if (!roomState || !roomState.droppedEnergy) return [];

    const validDrops = [];
    for (let i = 0; i < roomState.droppedEnergy.length; i++) {
        const drop = roomState.droppedEnergy[i];
        if (drop && drop.amount > 0) {
            validDrops.push(drop);
        }
    }
    return validDrops;
}

module.exports = {
    getDroppedEnergy
};
