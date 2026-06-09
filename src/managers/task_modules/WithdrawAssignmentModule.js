const ActionConstants = require('../../constants/ActionConstants');

function findClosestEnergy(creep, roomState) {
    let bestTarget = null;
    let bestDist = Infinity;
    let bestIntent = null;

    // Check dropped energy
    if (roomState.droppedEnergy) {
        for (let i = 0; i < roomState.droppedEnergy.length; i++) {
            const drop = roomState.droppedEnergy[i];
            if (drop.amount < 30) continue;
            const claimed = drop.__gatherClaimed || 0;
            if (drop.amount - claimed < 30) continue;
            const dx = Math.abs(creep.pos.x - drop.pos.x);
            const dy = Math.abs(creep.pos.y - drop.pos.y);
            const dist = Math.max(dx, dy);
            if (dist < bestDist) {
                bestDist = dist;
                bestTarget = drop;
                bestIntent = ActionConstants.ACTION_PICKUP;
            }
        }
    }

    // Check spawn — only if spawn has enough to not starve spawning (300+)
    if (roomState.spawns) {
        for (let i = 0; i < roomState.spawns.length; i++) {
            const spawn = roomState.spawns[i];
            if (spawn.store.getUsedCapacity(RESOURCE_ENERGY) < 300) continue;
            const dx = Math.abs(creep.pos.x - spawn.pos.x);
            const dy = Math.abs(creep.pos.y - spawn.pos.y);
            const dist = Math.max(dx, dy);
            if (dist < bestDist) {
                bestDist = dist;
                bestTarget = spawn;
                bestIntent = ActionConstants.ACTION_WITHDRAW;
            }
        }
    }

    if (bestTarget) {
        bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
        return { id: bestTarget.id, actionIntent: bestIntent };
    }
    return null;
}

module.exports = { findClosestEnergy };
