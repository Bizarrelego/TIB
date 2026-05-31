/**
 * Utility for finding the optimal source for a harvester.
 * Resolves Issue 1524.
 */

function getOptimalHarvesterTarget(roomName, sources) {
    if (!sources || sources.length === 0) return null;

    const sourceCounts = new Map();
    sources.forEach(s => sourceCounts.set(s.id, 0));

    // Count currently living harvesters' target assignments
    for (const cName in Game.creeps) {
        const c = Game.creeps[cName];
        if (c.memory.colony === roomName && c.memory.role === 'harvester' && c.heap && c.heap.targetId) {
            if (sourceCounts.has(c.heap.targetId)) {
                sourceCounts.set(c.heap.targetId, sourceCounts.get(c.heap.targetId) + 1);
            }
        }
    }

    // Mathematically distribute by finding the source with the least assignments
    let bestSource = sources[0];
    let minCount = sourceCounts.get(bestSource.id);

    for (let i = 1; i < sources.length; i++) {
        const count = sourceCounts.get(sources[i].id);
        if (count < minCount) {
            minCount = count;
            bestSource = sources[i];
        }
    }

    return bestSource;
}

module.exports = {
    getOptimalHarvesterTarget
};
