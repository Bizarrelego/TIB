const { DEFCON, DEFCON_BEHAVIOR } = require('../constants/defcon');

/**
 * @file DefconPolicyEnforcer.js
 * @description Enforces the specific operational policies and restrictions associated with each DEFCON level.
 */

/**
 * Takes the current DEFCON level and applies corresponding actions across various colony systems via memory flags.
 * @param {Room} room - The room object.
 * @param {number} defconLevel - The current DEFCON level of the room.
 */
function enforceDefconPolicies(room, defconLevel) {
    if (!room || !room.memory) return;

    if (DEFCON_BEHAVIOR[defconLevel]) {
        const behaviors = DEFCON_BEHAVIOR[defconLevel];
        room.memory.haltUpgrades = behaviors.haltUpgrades;
        room.memory.emergencyFortify = behaviors.emergencyFortify;
        room.memory.restrictStorageOutflow = behaviors.restrictStorageOutflow;
    }

    // Determine prioritizeDefenseSpawns policy based on high threat
    if (defconLevel === DEFCON.CRITICAL || defconLevel === DEFCON.EMERGENCY) {
        room.memory.prioritizeDefenseSpawns = true;
    } else {
        room.memory.prioritizeDefenseSpawns = false;
    }
}

module.exports = enforceDefconPolicies;
