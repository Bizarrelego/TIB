/**
 * Utility module to provide prioritized lists of tasks for the TaskAssignmentManager.
 * @module TaskPrioritizationUtility
 */

const DroppedResourceUtility = require('./DroppedResourceUtility');
const RuinTombstoneUtility = require('./RuinTombstoneUtility');
const ConstructionSiteUtility = require('./ConstructionSiteUtility');
const RepairTargetUtility = require('./RepairTargetUtility');

/**
 * Returns prioritized energy sources from the room state.
 * @param {object} roomState - The room state object from GlobalStateScanner.
 * @returns {Array} List of prioritized energy sources.
 */
function getPrioritizedEnergySources(roomState) {
    if (!roomState || !roomState.sources) return [];
    return roomState.sources;
}

/**
 * Returns prioritized construction sites from the room state.
 * @param {object} roomState - The room state object from GlobalStateScanner.
 * @returns {Array} List of prioritized construction sites.
 */
function getPrioritizedConstructionSites(roomState) {
    if (!roomState || !roomState.constructionSites) return [];
    return roomState.constructionSites;
}

/**
 * Returns prioritized repair targets from the room state.
 * @param {object} roomState - The room state object from GlobalStateScanner.
 * @returns {Array} List of prioritized repair targets.
 */
function getPrioritizedRepairTargets(roomState) {
    if (!roomState || !roomState.repairTargets) return [];
    return roomState.repairTargets;
}

/**
 * Returns prioritized scavenge targets (Ruins, Tombstones, Dropped Energy) from the room state.
 * Priority: Ruin -> Tombstone -> DroppedEnergy.
 * @param {object} roomState - The room state object from GlobalStateScanner.
 * @returns {Array} List of prioritized scavenge targets.
 */
function getPrioritizedScavengeTargets(roomState) {
    if (!roomState) return [];

    let scavengeTargets = [];

    if (roomState.ruins && roomState.ruins.length > 0) {
        scavengeTargets = scavengeTargets.concat(roomState.ruins);
    }

    if (roomState.tombstones && roomState.tombstones.length > 0) {
        scavengeTargets = scavengeTargets.concat(roomState.tombstones);
    }

    if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
        scavengeTargets = scavengeTargets.concat(roomState.droppedEnergy);
    }

    return scavengeTargets;
}

module.exports = {
    getPrioritizedEnergySources,
    getPrioritizedConstructionSites,
    getPrioritizedRepairTargets,
    getPrioritizedScavengeTargets
};
