class RoleActionUtility {
    static harvestEnergy(creep, source) {
        const result = creep.harvest(source);
        if (result === OK || result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_INVALID_TARGET) {
            if (creep.heap) creep.heap.state = 'idle';
        }
        return result;
    }

    static transferEnergy(creep, target) {
        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === OK || result === ERR_FULL || result === ERR_INVALID_TARGET) {
            if (creep.heap) creep.heap.state = 'idle';
        }
        return result;
    }

    static upgradeController(creep, controller) {
        const result = creep.upgradeController(controller);
        if (result === OK || result === ERR_NOT_ENOUGH_RESOURCES) {
            if (creep.heap) creep.heap.state = 'idle';
        }
        return result;
    }

    static pickupResource(creep, resource) {
        const result = creep.pickup(resource);
        if (result === OK || result === ERR_INVALID_TARGET) {
            if (creep.heap) creep.heap.state = 'idle';
        }
        return result;
    }
}

module.exports = RoleActionUtility;
