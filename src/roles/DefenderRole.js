const DefenderRole = {
    /**
     * Executes the defender role logic.
     * @param {Creep} creep - The creep executing the role.
     */
    run: function(creep) {
        if (creep.fatigue > 0) return;

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

        let result;
        if (actionIntent === 'attack') {
            result = creep.attack(target);
        } else if (actionIntent === 'rangedAttack') {
            result = creep.rangedAttack(target);
        } else if (actionIntent === 'heal') {
            result = creep.heal(target);
        } else {
            creep.heap.state = 'idle';
            return;
        }

        if (result === OK) {
            if (actionIntent === 'heal') {
                if (target.hits >= target.hitsMax) {
                    creep.heap.state = 'idle';
                }
            } else {
                if (target.hits <= 0) {
                    creep.heap.state = 'idle';
                }
            }
        } else {
            // Set to idle for ALL errors including ERR_NOT_IN_RANGE so the Brain can assign movement
            creep.heap.state = 'idle';
        }
    }
};

module.exports = DefenderRole;
