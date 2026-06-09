const ActionConstants = require('../constants/ActionConstants');

const BuilderRole = {
    /**
     * Executes the builder role behavior.
     * @param {Creep} creep
     */
    run(creep) {
        if (creep.fatigue > 0) return;

        const targetId = creep.heap.targetId;
        const actionIntent = creep.heap.actionIntent;

        if (actionIntent === ActionConstants.ACTION_BUILD) {
            const target = Game.getObjectById(targetId);

            if (!target) {
                creep.heap.state = 'idle';
                return;
            }

            const result = creep.build(target);

            // We do not check for ERR_NOT_IN_RANGE to path here.
            // As per architecture constraints, muscles (roles) do not path.
            // They just execute the intent. The pathing/traffic manager will have moved them.
            // Or if they are out of range, the action fails.

            if (result === OK) {
                // Determine if we finished the job or are out of energy
                if (target.progress >= target.progressTotal) {
                    creep.heap.state = 'idle';
                } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                    creep.heap.state = 'idle';
                }
            } else {
                // If it failed for any reason (e.g. out of range, not enough resources, target missing)
                creep.heap.state = 'idle';
            }
        }
    }
};

module.exports = BuilderRole;
