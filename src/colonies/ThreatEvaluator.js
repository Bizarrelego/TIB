/**
 * @file ThreatEvaluator.js
 * @description Evaluates threats for a colony based on the DEFCON state.
 */

const { determineDefcon } = require('../constants/defcon');

/**
 * @typedef {Object} ThreatProfile
 * @property {number} defconLevel - The current DEFCON level of the room.
 */

class ThreatEvaluator {
    /**
     * Evaluates the current threat profile for a given room.
     * @param {string} roomName - The name of the room to evaluate.
     * @returns {ThreatProfile} An object containing the evaluated threat metrics.
     */
    static evaluateThreat(roomName) {
        const defconLevel = determineDefcon(roomName);

        return {
            defconLevel
        };
    }
}

module.exports = ThreatEvaluator;
