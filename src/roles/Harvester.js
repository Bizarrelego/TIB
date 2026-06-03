const Harvester = {
    /**
     * Executes the Harvester role.
     * @param {Creep} creep - The creep to execute the role for.
     */
    run(creep) {
        if (creep.fatigue > 0) return;

        if (creep.heap.state === 'sleeping' && Game.time < creep.heap.sleepUntil) {
            return;
        }

        if (creep.heap.actionIntent === 'harvest') {
            const source = Game.getObjectById(creep.heap.targetId);
            if (!source) {
                creep.heap.state = 'idle';
                return;
            }

            const result = creep.harvest(source);

            if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            } else if (result === ERR_NOT_ENOUGH_RESOURCES) {
                creep.heap.sleepUntil = Game.time + source.ticksToRegeneration;
                creep.heap.state = 'sleeping';
            } else if (result === OK) {
                creep.heap.state = 'idle';
            }
        }
    }
};

module.exports = Harvester;