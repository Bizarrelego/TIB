const CreepBodies = require('../config/CreepBodies');

class CreepBodyUtility {
    static getBody(role, energyCapacity) {
        return CreepBodies.getBody(role, energyCapacity);
    }
}
module.exports = CreepBodyUtility;
