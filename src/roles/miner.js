/**
 * Miner creep role module.
 * Responsible for stationary drop-mining.
 * Driven strictly by state and intents provided by TaskAssignmentManager.
 * @module roles/miner
 */

/**
 * Executes the miner role logic for a given creep.
 *
 * @param {Creep} creep - The miner creep to execute logic for.
 * @returns {void}
 */
function run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap) return;

    // Check CPU sleep
    if (creep.heap.sleepUntil && Game.time < creep.heap.sleepUntil) {
        return;
    }

    const targetId = creep.heap.targetId;
    const actionIntent = creep.heap.actionIntent;

    if (!targetId || actionIntent !== 'harvest') {
        creep.heap.state = 'idle';
        return;
    }

    const target = Game.getObjectById(targetId);

    if (!target) {
        creep.heap.state = 'idle';
        return;
    }

    // Mathematical check to avoid ERR_NOT_IN_RANGE cost
    if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
        return;
    }

    // Once in range, perform harvest
    if (target.energy === 0) {
        creep.heap.sleepUntil = Game.time + target.ticksToRegeneration;
        return; // Halt execution until that tick
    }

    const result = creep.harvest(target);
    if (result !== OK) {
        creep.heap.state = 'idle';
    }
}

module.exports = {
    run
};
