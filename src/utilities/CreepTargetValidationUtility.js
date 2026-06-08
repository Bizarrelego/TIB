class CreepTargetValidationUtility {
    /**
     * Validates if a creep's assigned targetId is still a valid and actionable target for its current actionIntent.
     * @param {Creep} creep The creep performing the action.
     * @param {string} targetId The ID of the target object.
     * @param {string} actionIntent The action the creep intends to perform.
     * @returns {boolean} True if the target is valid for the action, false otherwise.
     */
    static isValidTarget(creep, targetId, actionIntent) {
        if (!targetId || !actionIntent) return false;

        const target = Game.getObjectById(targetId);
        if (!target) return false;

        // Reachability check (basic check: same room)
        if (target.pos && creep.pos && target.pos.roomName !== creep.pos.roomName) {
            return false;
        }

        switch (actionIntent) {
            case 'harvest':
                if (target.energy !== undefined) return target.energy > 0;
                if (target.mineralAmount !== undefined) return target.mineralAmount > 0;
                if (target.depositAmount !== undefined) return target.depositAmount > 0;
                return true;

            case 'withdraw':
                if (target.store) {
                    return target.store.getUsedCapacity(RESOURCE_ENERGY) > 0;
                }
                return false;

            case 'pickup':
                if (target.amount !== undefined) {
                    return target.amount > 0;
                }
                return false;

            case 'transfer':
                if (target.store) {
                    return target.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
                return false;

            case 'build':
                return target instanceof ConstructionSite;

            case 'repair':
                return target.hits !== undefined && target.hitsMax !== undefined && target.hits < target.hitsMax;

            case 'upgrade':
                return target instanceof StructureController;

            case 'drop':
                return true; // Dropping energy just needs a valid room position, target is usually the room position/creep itself

            default:
                return true; // For actions that don't need strict target resource checks or fallbacks
        }
    }
}

module.exports = CreepTargetValidationUtility;
