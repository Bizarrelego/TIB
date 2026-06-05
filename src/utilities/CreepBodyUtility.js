const CreepBodies = require('../config/CreepBodies');

class CreepBodyUtility {
    static getBody(role) {
        const key = `${role.toUpperCase()}_BODY`;
        return CreepBodies[key];
    }
}
module.exports = CreepBodyUtility;
