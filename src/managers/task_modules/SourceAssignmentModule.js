const ActionConstants = require('../../constants/ActionConstants');

function assignHarvester(creep, roomState) {
    const sources = roomState.sources;
    if (!sources || sources.length === 0) return;

    // Lock source permanently to prevent target thrashing
    if (!creep.memory.targetId) {
        const counts = new Map();
        for (const name in Game.creeps) {
            const c = Game.creeps[name];
            if (c.memory.role === 'harvester' && c.memory.colony === creep.memory.colony && c.memory.targetId) {
                counts.set(c.memory.targetId, (counts.get(c.memory.targetId) || 0) + 1);
            }
        }

        let bestSource = sources[0];
        let minCount = Infinity;
        for (let i = 0; i < sources.length; i++) {
            const count = counts.get(sources[i].id) || 0;
            if (count < minCount) {
                minCount = count;
                bestSource = sources[i];
            }
        }
        creep.memory.targetId = bestSource.id;
    }

    creep.heap.targetId = creep.memory.targetId;
    creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;

    const source = Game.getObjectById(creep.memory.targetId);
    if (!source) return;

    if (roomState.sourceContainers) {
        for (let i = 0; i < roomState.sourceContainers.length; i++) {
            const c = roomState.sourceContainers[i];
            if (c.pos.getRangeTo(source) <= 2) {
                creep.heap.sitTargetId = c.id;
                break;
            }
        }
    }
}

module.exports = { assignHarvester };
