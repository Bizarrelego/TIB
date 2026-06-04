const RepairTargetUtility = require('../utilities/RepairTargetUtility');

class Hauler {
    static assignTask(creep, roomState) {
        if (creep.heap.state === 'gather') {
            let bestTarget = null;
            let bestScore = -1;
            let intent = '';

            const evaluateTarget = (target, amount, actionIntent) => {
                const claimed = global.Tick.gatherClaims.get(target.id) || 0;
                const remaining = amount - claimed;
                
                if (remaining >= Math.min(50, creep.store.getFreeCapacity(RESOURCE_ENERGY))) {
                    const distance = creep.pos.getRangeTo(target) || 1;
                    const score = remaining / distance;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestTarget = target;
                        intent = actionIntent;
                    }
                }
            };

            if (roomState.tombstones) {
                for (let i = 0; i < roomState.tombstones.length; i++) {
                    evaluateTarget(roomState.tombstones[i], roomState.tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY), 'withdraw');
                }
            }
            if (roomState.ruins) {
                for (let i = 0; i < roomState.ruins.length; i++) {
                    evaluateTarget(roomState.ruins[i], roomState.ruins[i].store.getUsedCapacity(RESOURCE_ENERGY), 'withdraw');
                }
            }
            if (roomState.sourceContainers) {
                for (let i = 0; i < roomState.sourceContainers.length; i++) {
                    evaluateTarget(roomState.sourceContainers[i], roomState.sourceContainers[i].store.getUsedCapacity(RESOURCE_ENERGY), 'withdraw');
                }
            }
            if (roomState.droppedEnergy) {
                for (let i = 0; i < roomState.droppedEnergy.length; i++) {
                    evaluateTarget(roomState.droppedEnergy[i], roomState.droppedEnergy[i].amount, 'pickup');
                }
            }

            if (bestTarget) {
                global.Tick.gatherClaims.set(bestTarget.id, (global.Tick.gatherClaims.get(bestTarget.id) || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY));
                creep.heap.targetId = bestTarget.id;
                creep.heap.actionIntent = intent;
                return;
            }

            // Force transition to work state if no energy exists to gather but we are partially full
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.state = 'work';
                Hauler.assignHaulerWork(creep, roomState);
            }

        } else {
            Hauler.assignHaulerWork(creep, roomState);
        }
    }

    static assignHaulerWork(creep, roomState) {
        if (TaskAssignmentManager.routeToStorage(creep, roomState)) return;

        if (roomState.controller) {
            if (roomState.controllerContainers && roomState.controllerContainers.length > 0) {
                const target = roomState.controllerContainers[0];
                const claimed = global.Tick.deliveryClaims.get(target.id) || 0;
                const remainingSpace = target.store.getFreeCapacity(RESOURCE_ENERGY) - claimed;
                
                if (remainingSpace > 0) {
                    global.Tick.deliveryClaims.set(target.id, claimed + creep.store.getUsedCapacity(RESOURCE_ENERGY));
                    creep.heap.targetId = target.id;
                    creep.heap.actionIntent = 'transfer';
                    return;
                }
            }

            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = 'drop';
        }
    }
}

module.exports = Hauler;