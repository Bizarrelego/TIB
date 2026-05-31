/**
 * Utility for finding scavenging targets.
 * Resolves Issue 1526.
 */
const { getHash } = require('./HashUtility');

function getScavengingTarget(roomState, creepName) {
    const validRuins = (roomState.ruins || []).filter(r => r.store && r.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
    const validTombstones = (roomState.tombstones || []).filter(t => t.store && t.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
    const validDrops = (roomState.droppedEnergy || []).filter(d => d.amount > 0);

    if (validRuins.length > 0) {
        const index = getHash(creepName, validRuins.length);
        return { target: validRuins[index], intent: 'withdraw' };
    }

    if (validTombstones.length > 0) {
        const index = getHash(creepName, validTombstones.length);
        return { target: validTombstones[index], intent: 'withdraw' };
    }

    if (validDrops.length > 0) {
        const index = getHash(creepName, validDrops.length);
        return { target: validDrops[index], intent: 'pickup' };
    }

    return { target: null, intent: null };
}

module.exports = {
    getScavengingTarget
};
