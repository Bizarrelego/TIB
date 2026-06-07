class CreepActionExecutionUtility {
    /**
     * Executes the harvest action.
     * @param {Creep} creep
     * @param {Source|Mineral|Deposit} source
     * @returns {number} The native API execution result
     */
    static executeHarvest(creep, source) {
        const result = creep.harvest(source);
        if (result !== ERR_NOT_IN_RANGE) {
            creep.heap.state = 'idle';
        }
        return result;
    }

    /**
     * Executes the upgradeController action.
     * @param {Creep} creep
     * @param {StructureController} controller
     * @returns {number} The native API execution result
     */
    static executeUpgradeController(creep, controller) {
        const result = creep.upgradeController(controller);
        if (result !== ERR_NOT_IN_RANGE) {
            creep.heap.state = 'idle';
        }
        return result;
    }

    /**
     * Executes the build action.
     * @param {Creep} creep
     * @param {ConstructionSite} site
     * @returns {number} The native API execution result
     */
    static executeBuild(creep, site) {
        const result = creep.build(site);
        if (result !== ERR_NOT_IN_RANGE) {
            creep.heap.state = 'idle';
        }
        return result;
    }

    /**
     * Executes the repair action.
     * @param {Creep} creep
     * @param {Structure} structure
     * @returns {number} The native API execution result
     */
    static executeRepair(creep, structure) {
        const result = creep.repair(structure);
        if (result !== ERR_NOT_IN_RANGE) {
            creep.heap.state = 'idle';
        }
        return result;
    }

    /**
     * Executes the pickup action.
     * @param {Creep} creep
     * @param {Resource} resource
     * @returns {number} The native API execution result
     */
    static executePickup(creep, resource) {
        const result = creep.pickup(resource);
        if (result !== ERR_NOT_IN_RANGE) {
            creep.heap.state = 'idle';
        }
        return result;
    }

    /**
     * Executes the transfer action.
     * @param {Creep} creep
     * @param {AnyCreep|Structure} target
     * @param {number} [amount]
     * @returns {number} The native API execution result
     */
    static executeTransfer(creep, target, amount) {
        const result = amount !== undefined
            ? creep.transfer(target, RESOURCE_ENERGY, amount)
            : creep.transfer(target, RESOURCE_ENERGY);

        if (result !== ERR_NOT_IN_RANGE) {
            creep.heap.state = 'idle';
        }
        return result;
    }

    /**
     * Executes the withdraw action.
     * @param {Creep} creep
     * @param {Structure|Tombstone|Ruin} target
     * @param {number} [amount]
     * @returns {number} The native API execution result
     */
    static executeWithdraw(creep, target, amount) {
        const result = amount !== undefined
            ? creep.withdraw(target, RESOURCE_ENERGY, amount)
            : creep.withdraw(target, RESOURCE_ENERGY);

        if (result !== ERR_NOT_IN_RANGE) {
            creep.heap.state = 'idle';
        }
        return result;
    }
}

module.exports = CreepActionExecutionUtility;
