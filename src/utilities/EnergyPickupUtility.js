/**
 * Utility for providing prioritized energy sources for pickup/withdrawal.
 * @module EnergyPickupUtility
 */

const DroppedResourceUtility = require('./DroppedResourceUtility');
const RuinTombstoneUtility = require('./RuinTombstoneUtility');

/**
 * Returns an array of prioritized energy sources for a given room.
 * Prioritizes Ruins and Tombstones over standard Dropped Energy.
 *
 * @param {string} roomName - The name of the room.
 * @returns {Array<StructureRuin|StructureTombstone|Resource>} Prioritized array of targets.
 */
function getPrioritizedEnergySources(roomName) {
    const ruins = RuinTombstoneUtility.getRuinsWithEnergy(roomName);
    const tombstones = RuinTombstoneUtility.getTombstonesWithEnergy(roomName);
    const droppedEnergy = DroppedResourceUtility.getDroppedEnergy(roomName);

    // Prioritize ruins and tombstones first, then standard drops
    return [...ruins, ...tombstones, ...droppedEnergy];
}

module.exports = {
    getPrioritizedEnergySources
};
