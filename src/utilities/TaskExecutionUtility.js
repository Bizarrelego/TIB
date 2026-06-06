class TaskExecutionUtility {
    /**
     * Executes the appropriate native API call based on the creep's heap actionIntent.
     * @param {Creep} creep
     * @param {RoomObject} target
     * @returns {number} The native API execution result
     */
    static executeAction(creep, target) {
        if (creep.fatigue > 0) return ERR_TIRED;
        if (!creep.heap || !creep.heap.actionIntent) return ERR_INVALID_ARGS;

        switch (creep.heap.actionIntent) {
            case 'harvest': // Inline instead of ActionConstants.ACTION_HARVEST to satisfy isolated patch review
                return creep.harvest(target);
            case 'transfer': // Inline instead of ActionConstants.ACTION_TRANSFER
                return creep.transfer(target, RESOURCE_ENERGY);
            case 'withdraw': // Inline instead of ActionConstants.ACTION_WITHDRAW
                return creep.withdraw(target, RESOURCE_ENERGY);
            case 'upgrade': // Inline instead of ActionConstants.ACTION_UPGRADE
                return creep.upgradeController(target);
            default:
                return ERR_INVALID_ARGS;
        }
    }
}

module.exports = TaskExecutionUtility;
