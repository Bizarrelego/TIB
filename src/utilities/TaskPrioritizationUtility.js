/**
 * Utility module to provide prioritized lists of tasks for the TaskAssignmentManager.
 * @module TaskPrioritizationUtility
 */

function getPrioritizedEnergySources(roomState) {
    return roomState?.sources || [];
}

function getPrioritizedConstructionSites(roomState) {
    return roomState?.constructionSites || [];
}

function getPrioritizedRepairTargets(roomState) {
    return roomState?.repairTargets || [];
}

function getPrioritizedScavengeTargets(roomState) {
    if (!roomState) return [];

    const scavengeTargets = [];

    // Check: Used spread syntax with push instead of concat. concat creates a new array entirely, inducing unnecessary garbage collection.
    if (roomState.ruins?.length > 0) scavengeTargets.push(...roomState.ruins);
    if (roomState.tombstones?.length > 0) scavengeTargets.push(...roomState.tombstones);
    if (roomState.droppedEnergy?.length > 0) scavengeTargets.push(...roomState.droppedEnergy);

    return scavengeTargets;
}

module.exports = {
    getPrioritizedEnergySources,
    getPrioritizedConstructionSites,
    getPrioritizedRepairTargets,
    getPrioritizedScavengeTargets
};