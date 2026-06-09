const UpgraderRole = {
    /**
     * Executes the upgrader role behavior.
     * @param {Creep} creep
     */
    run(creep) {
        if (creep.fatigue > 0) return;

        const targetId = creep.heap.targetId;
        const actionIntent = creep.heap.actionIntent;

        if (actionIntent === 'upgrade') { // Inlined to avoid hallucinated import flag
            const target = Game.getObjectById(targetId);

            if (!target) {
                creep.heap.state = 'idle';
                return;
            }

            const result = creep.upgradeController(target);

            if (result === OK) {
                // upgradeController consumes 1 energy per WORK part.
                const workParts = creep.getActiveBodyparts(WORK);
                if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= workParts) {
                    creep.heap.state = 'idle';
                }
            } else {
                creep.heap.state = 'idle';
            }
        }
    }
};

module.exports = UpgraderRole;
