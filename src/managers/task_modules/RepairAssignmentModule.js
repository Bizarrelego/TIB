const ActionConstants = require('../../constants/ActionConstants');

function assignRepairman(creep, homeState) {
    if (creep.heap.state === 'gather') {
        // Priority 1: Scavenge dropped energy
        const drops = homeState.droppedEnergy || [];
        let bestDrop = null;
        let bestAmount = 0;
        for (let i = 0; i < drops.length; i++) {
            const d = drops[i];
            const claimed = d.__gatherClaimed || 0;
            const available = d.amount - claimed;
            if (available > bestAmount) {
                bestAmount = available;
                bestDrop = d;
            }
        }
        if (bestDrop && bestAmount >= 25) {
            bestDrop.__gatherClaimed = (bestDrop.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
            creep.heap.targetId = bestDrop.id;
            creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
            return;
        }

        // Priority 2: Harvest from source
        const sources = homeState.sources || [];
        if (sources.length > 0) {
            creep.heap.targetId = sources[0].id;
            creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
            return;
        }

        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
    } else {
        // Work phase: find repair targets in home and outposts
        let bestTarget = null;
        let lowestHealthRatio = 1.0;
        let targetRoom = creep.memory.colony;

        // Check home room
        if (homeState.repairTargets) {
            for (let i = 0; i < homeState.repairTargets.length; i++) {
                const t = homeState.repairTargets[i];
                const ratio = t.hits / t.hitsMax;
                if (ratio < lowestHealthRatio && ratio < 0.8) {
                    lowestHealthRatio = ratio;
                    bestTarget = t;
                    targetRoom = creep.memory.colony;
                }
            }
        }

        // Check outposts
        const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
        for (let o = 0; o < outposts.length; o++) {
            const outpostState = global.State.rooms.get(outposts[o]);
            if (outpostState && outpostState.repairTargets) {
                for (let i = 0; i < outpostState.repairTargets.length; i++) {
                    const t = outpostState.repairTargets[i];
                    const ratio = t.hits / t.hitsMax;
                    if (ratio < lowestHealthRatio && ratio < 0.8) {
                        lowestHealthRatio = ratio;
                        bestTarget = t;
                        targetRoom = outposts[o];
                    }
                }
            }
        }

        if (bestTarget) {
            if (creep.room.name !== targetRoom) {
                creep.memory.targetRoom = targetRoom;
                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
            } else {
                creep.heap.targetId = bestTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
            }
        } else {
            // No repair targets — park at a safe idle position near spawn
            if (homeState.spawns && homeState.spawns.length > 0) {
                const spawn = homeState.spawns[0];
                creep.heap.waypointPos = { x: spawn.pos.x + 4, y: spawn.pos.y + 2, roomName: creep.memory.colony };
            }
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }
}

module.exports = { assignRepairman };
