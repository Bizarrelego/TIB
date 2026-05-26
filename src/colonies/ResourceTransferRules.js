/**
 * Module defining global rules and prioritization logic for resource transfers within a colony.
 * Acts as a policy layer above the raw resource transfer ledgers.
 * @module ResourceTransferRules
 */

const ResourceTransferRules = {
    /**
     * Determines if a transfer is valid based on global rules and prioritization logic.
     * Enforces minimum transfer amounts, storage limits, and structure-specific capacity.
     * @param {object} source The source object from which resources are taken.
     * @param {object} target The target object to which resources are transferred.
     * @param {string} resourceType The type of resource being transferred (e.g. RESOURCE_ENERGY).
     * @param {number} amount The amount of the resource being transferred.
     * @returns {boolean} True if the transfer is valid, false otherwise.
     */
    isValidTransfer(source, target, resourceType, amount) {
        if (!source || !target || !resourceType || amount <= 0) {
            return false;
        }

        // Validate source has enough of the resource
        let sourceAmount = 0;
        if (source.store) {
            sourceAmount = source.store.getUsedCapacity(resourceType) || 0;
        } else if (source.amount !== undefined) { // Resource drops
            sourceAmount = source.amount;
        } else if (source.energy !== undefined && resourceType === RESOURCE_ENERGY) { // Source or dropped energy
            sourceAmount = source.energy;
        }

        if (sourceAmount < amount) {
            return false;
        }

        // Validate target has enough capacity for the resource
        let targetCapacity = null;
        let targetUsed = 0;

        if (target.store) {
            targetCapacity = target.store.getCapacity(resourceType);
            targetUsed = target.store.getUsedCapacity(resourceType) || 0;
        } else if (target.energyCapacity !== undefined && resourceType === RESOURCE_ENERGY) {
            targetCapacity = target.energyCapacity;
            targetUsed = target.energy;
        }

        if (targetCapacity === null || targetCapacity === 0) {
            return false;
        }

        if (targetCapacity - targetUsed < amount) {
            return false;
        }

        // Ensure Spawns and Extensions only receive energy
        if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) {
            if (resourceType !== RESOURCE_ENERGY) {
                return false;
            }
        }

        // Ensure controllers only receive energy
        if (target.structureType === STRUCTURE_CONTROLLER) {
            if (resourceType !== RESOURCE_ENERGY) {
                return false;
            }
        }

        return true;
    },

    /**
     * Determines the priority of a transfer based on the source, target, and resource type.
     * Higher numbers indicate higher priority.
     * @param {object} source The source object.
     * @param {object} target The target object.
     * @param {string} resourceType The type of resource.
     * @returns {number} The priority value.
     */
    getTransferPriority(source, target, resourceType) {
        if (!source || !target || !resourceType) {
            return 0;
        }

        let priority = 0;

        // Highest priority: Spawns and Extensions need energy to keep the colony running
        if (resourceType === RESOURCE_ENERGY) {
            if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) {
                priority = 100;
            } else if (target.structureType === STRUCTURE_TOWER) {
                // Towers need energy for defense and repairs
                // Lower priority than spawns but higher than normal storage
                let towerEnergyPercentage = target.store ? target.store.getUsedCapacity(RESOURCE_ENERGY) / target.store.getCapacity(RESOURCE_ENERGY) : 1;
                if (towerEnergyPercentage < 0.5) {
                    priority = 90;
                } else {
                    priority = 50;
                }
            } else if (target.structureType === STRUCTURE_CONTROLLER) {
                priority = 40;
            } else if (target.structureType === STRUCTURE_STORAGE || target.structureType === STRUCTURE_TERMINAL) {
                priority = 20;
            }
        }

        // Priority boost for picking up from decayable/temporary sources
        if (source.structureType === STRUCTURE_RUIN || source.structureType === STRUCTURE_TOMBSTONE) {
            priority += 15;
        } else if (source.resourceType !== undefined && source.amount !== undefined) {
            // Dropped resources (especially high value ones or decaying ones)
            priority += 10;
        }

        // Prioritize non-energy resources to storage/terminal over general energy moving if they are laying around
        if (resourceType !== RESOURCE_ENERGY) {
             if (target.structureType === STRUCTURE_STORAGE || target.structureType === STRUCTURE_TERMINAL) {
                 priority = 30; // slightly higher than base energy storage routing
                 if (source.structureType === STRUCTURE_RUIN || source.structureType === STRUCTURE_TOMBSTONE || (source.resourceType !== undefined && source.amount !== undefined)) {
                     priority += 20;
                 }
             }
        }

        return priority;
    }
};

module.exports = ResourceTransferRules;
