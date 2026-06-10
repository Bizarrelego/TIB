const ActionConstants = require('../../constants/ActionConstants');

function routeToCoreStructures(creep, roomState) {
    let bestTarget = null;
    let bestScore = -1;

    const evaluateTarget = (target) => {
        if (!target || !target.store) return;
        if (target.isActive !== undefined && !target.isActive()) return;

        const freeCapacity = target.store.getFreeCapacity(RESOURCE_ENERGY);
        if (freeCapacity === 0) return;

        const claimed = target.__deliveryClaimed || 0;
        const remainingSpace = freeCapacity - claimed;
        if (remainingSpace <= 0) return;

        const dx = creep.pos.x - target.pos.x;
        const dy = creep.pos.y - target.pos.y;
        const distance = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
        // Weight by remaining space so haulers prefer emptier targets
        const score = remainingSpace * 100 / distance;

        if (score > bestScore) {
            bestScore = score;
            bestTarget = target;
        }
    };

    roomState.spawns?.forEach(evaluateTarget);
    roomState.extensions?.forEach(evaluateTarget);
    roomState.towers?.forEach(t => {
        // Only fill towers if they are missing > 200 energy
        if (t.store.getFreeCapacity(RESOURCE_ENERGY) >= 200) evaluateTarget(t);
    });

    if (bestTarget) {
        bestTarget.__deliveryClaimed = (bestTarget.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
        creep.heap.targetId = bestTarget.id;
        creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
        return true;
    }

    return false;
}

module.exports = { routeToCoreStructures };
