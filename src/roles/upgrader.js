/**
 * Upgrader creep role module.
 * Responsible for upgrading the room controller and stationary pickup.
 * Driven strictly by state and intents provided by TaskAssignmentManager.
 * @module roles/upgrader
 */

/**
 * Executes the upgrader role logic for a given creep.
 *
 * @param {Creep} creep - The upgrader creep to execute logic for.
 * @returns {void}
 */
function run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap) return;

    const targetId = creep.heap.targetId;
    const actionIntent = creep.heap.actionIntent;

    if (!targetId || !actionIntent) {
        creep.heap.state = 'idle';
        return;
    }

    const target = Game.getObjectById(targetId);

    if (!target) {
        creep.heap.state = 'idle';
        return;
    }

    if (actionIntent === 'upgrade') {
        const upgradeResult = creep.upgradeController(creep.room.controller);

        let pickupResult = null;
        if (target.resourceType) {
            pickupResult = creep.pickup(target);
        }

        // Logic to determine if state should go back to idle
        if (target.resourceType) {
            // We are picking up and upgrading simultaneously.
            const pickupFailed = pickupResult !== OK && pickupResult !== ERR_FULL && pickupResult !== ERR_BUSY;
            const upgradeFailed = upgradeResult !== OK && upgradeResult !== ERR_NOT_ENOUGH_RESOURCES && upgradeResult !== ERR_BUSY;

            // If the resource is gone and we have no energy left to upgrade
            if ((pickupFailed || target.amount === 0) && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                 creep.heap.state = 'idle';
            } else if (upgradeFailed) {
                 creep.heap.state = 'idle';
            }
        } else {
             // Upgrading controller directly, no drop to pickup
             if (upgradeResult !== OK && upgradeResult !== ERR_BUSY) {
                 creep.heap.state = 'idle';
             }
        }

    } else {
        creep.heap.state = 'idle';
    }
}

module.exports = {
    run
};
