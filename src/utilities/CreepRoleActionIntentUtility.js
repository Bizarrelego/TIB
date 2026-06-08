const ActionConstants = require('../constants/ActionConstants');

const CreepRoleActionIntentUtility = {
    /**
     * Determines the appropriate action intent for a creep based on its role and assigned target.
     * @param {string} creepRole - The role of the creep.
     * @param {Object} target - The target object.
     * @returns {string} The action intent constant.
     */
    getActionIntent: function(creepRole, target) {
        if (!target) return ActionConstants.ACTION_IDLE;

        const isSource = target.energyCapacity !== undefined;
        const isResource = target.amount !== undefined && target.resourceType !== undefined;
        const isTombstone = target.deathTime !== undefined;
        const isRuin = target.destroyTime !== undefined;
        const isConstructionSite = target.progressTotal !== undefined;
        const isStructure = target.structureType !== undefined && !isConstructionSite;

        switch (creepRole) {
            case 'harvester':
                if (isSource) return ActionConstants.ACTION_HARVEST;
                break;
            case 'hauler':
            case 'scavenger':
                if (isResource) return ActionConstants.ACTION_PICKUP;
                if (isTombstone || isRuin) return ActionConstants.ACTION_WITHDRAW;
                if (isStructure && (target.structureType === 'spawn' || target.structureType === 'extension')) {
                    return ActionConstants.ACTION_TRANSFER;
                }
                break;
            case 'upgrader':
                if (isResource) return ActionConstants.ACTION_PICKUP;
                if (isTombstone || isRuin) return ActionConstants.ACTION_WITHDRAW;
                if (isStructure && target.structureType === 'controller') {
                    return ActionConstants.ACTION_UPGRADE;
                }
                break;
            case 'builder':
                if (isResource) return ActionConstants.ACTION_PICKUP;
                if (isTombstone || isRuin) return ActionConstants.ACTION_WITHDRAW;
                if (isConstructionSite) return ActionConstants.ACTION_BUILD;
                break;
            default:
                return ActionConstants.ACTION_IDLE;
        }

        return ActionConstants.ACTION_IDLE;
    }
};

module.exports = CreepRoleActionIntentUtility;
