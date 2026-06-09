const RepairerRole = {
    /**
     * Executes the repairer role logic.
     * @param {Creep} creep - The creep executing the role.
     */
    run: function(creep) {
        if (creep.fatigue > 0) return;

        const targetId = creep.heap.targetId;
        if (!targetId) {
            creep.heap.state = 'idle';
            return;
        }

        const target = Game.getObjectById(targetId);
        if (!target) {
            creep.heap.state = 'idle';
            return;
        }

        const result = creep.repair(target);

        if (result === OK) {
            const projectedConsumption = creep.getActiveBodyparts(WORK);
            if (target.hits >= target.hitsMax || creep.store.getUsedCapacity(RESOURCE_ENERGY) <= projectedConsumption) {
                creep.heap.state = 'idle';
            }
        } else {
            // Set to idle for ALL errors including ERR_NOT_IN_RANGE so the Brain can assign movement
            creep.heap.state = 'idle';
        }
    }
};

module.exports = RepairerRole;
