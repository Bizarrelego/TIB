const RepairTargetUtility = require('../utilities/RepairTargetUtility');

class Builder {
    static assignTask(creep, roomState) {
        if (creep.heap.state === 'gather') {
            if (roomState.spawns && roomState.spawns.length > 0 && roomState.spawns[0].store.getUsedCapacity(RESOURCE_ENERGY) > 100) {
                creep.heap.targetId = roomState.spawns[0].id;
                creep.heap.actionIntent = 'withdraw';
                return;
            }
            
            if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
                let maxDrop = roomState.droppedEnergy[0];
                for (let i = 1; i < roomState.droppedEnergy.length; i++) {
                    if (roomState.droppedEnergy[i].amount > maxDrop.amount) maxDrop = roomState.droppedEnergy[i];
                }
                creep.heap.targetId = maxDrop.id;
                creep.heap.actionIntent = 'pickup';
                return;
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.state = 'work';
                Builder.assignBuilderWork(creep, roomState);
            }

        } else {
            Builder.assignBuilderWork(creep, roomState);
        }
    }

    static assignBuilderWork(creep, roomState) {
        const repairTargets = roomState.repairTargets;
        if (repairTargets && repairTargets.length > 0) {
            let closest = null;
            let minRange = Infinity;

            for (let i = 0; i < repairTargets.length; i++) {
                const target = repairTargets[i];
                const range = creep.pos.getRangeTo(target);
                if (range < minRange) {
                    minRange = range;
                    closest = target;
                }
            }

            if (closest) {
                creep.heap.targetId = closest.id;
                creep.heap.actionIntent = 'repair';
                return;
            }
        }

        const sites = roomState.constructionSites;
        if (sites && sites.length > 0) {
            let closestSite = null;
            let minRangeSite = Infinity;

            for (let i = 0; i < sites.length; i++) {
                const site = sites[i];
                const range = creep.pos.getRangeTo(site);
                if (range < minRangeSite) {
                    minRangeSite = range;
                    closestSite = site;
                }
            }

            if (closestSite) {
                creep.heap.targetId = closestSite.id;
                creep.heap.actionIntent = 'build';
                return;
            }
        }

        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = 'upgrade';
        }
    }
}

module.exports = Builder;