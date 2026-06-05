const CreepBodies = require('../config/CreepBodies');

class CreepBodyUtility {
    static getBody(role) {
        return CreepBodies.get(role);
    }
}
module.exports = CreepBodyUtility;
