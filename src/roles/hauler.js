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
    if (creep.spawning) return;
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

    if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
        return;
    }

    switch (actionIntent) {
        case 'pickup':
            creep.pickup(target);
            break;
        case 'withdraw':
            creep.withdraw(target, RESOURCE_ENERGY);
            break;
        case 'transfer':
            creep.transfer(target, RESOURCE_ENERGY);
            break;
        default:
            creep.heap.state = 'idle';
            return;
    }

    creep.heap.state = 'idle';
}

module.exports = {
    run
};
