/**
 * Hauler creep role module.
 * Responsible for transporting energy from sources to spawns or upgraders.
 * Driven strictly by state and intents provided by TaskAssignmentManager.
 * @module roles/hauler
 */

/**
 * Executes the hauler role logic for a given creep.
 *
 * @param {Creep} creep - The hauler creep to execute logic for.
 * @returns {void}
 */
function run(creep) {
    if (creep.fatigue > 0) return;

    if (!creep.heap) return;

    const targetId = creep.heap.targetId;
    const actionIntent = creep.heap.actionIntent;

    if (!targetId || !actionIntent) return;

    const target = Game.getObjectById(targetId);

    if (!target) {
        creep.heap.state = 'idle';
        return;
    }

    let actionResult;

    switch (actionIntent) {
        case 'pickup':
            actionResult = creep.pickup(target);
            break;
        case 'withdraw':
            actionResult = creep.withdraw(target, RESOURCE_ENERGY);
            break;
        case 'transfer':
            actionResult = creep.transfer(target, RESOURCE_ENERGY);
            break;
        default:
            creep.heap.state = 'idle';
            return;
    }

    if (actionResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
    } else {
        creep.heap.state = 'idle';
    }
}

module.exports = {
    run
};
