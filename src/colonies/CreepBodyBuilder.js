/**
 * @file CreepBodyBuilder.js
 * @description Dynamically generates optimal creep body arrays based on desired role, available energy, and current RCL.
 */

const BodyCalc = require('../utils/bodyCalc');

/**
 * Class responsible for building optimal creep body arrays.
 */
class CreepBodyBuilder {
    /**
     * Builds a creep body array based on the requested parameters.
     *
     * @param {string} role The desired role for the creep.
     * @param {number} energy The available energy to spawn the creep.
     * @param {number} rcl The current Room Control Level.
     * @param {Object} [options={}] Additional options (e.g. sourceCapacity).
     * @returns {string[]} The calculated optimal body array.
     */
    static build(role, energy, rcl, options = {}) {
        // Enforce AGENTS.md early-game constraints
        if (rcl === 1) {
            if (role === 'harvester') {
                return [WORK, WORK, MOVE];
            } else if (role === 'domesticHauler') {
                return [CARRY, MOVE];
            }
        }

        switch (role) {
            case 'worker':
                return BodyCalc.calculateWorker(energy);

            case 'harvester':
                return BodyCalc.calculateEarlyGameHarvester(energy);

            case 'domesticHauler':
                return BodyCalc.calculateDomesticHauler(energy);

            case 'upgrader':
                return BodyCalc.calculateUpgrader(energy);

            case 'remoteHarvester':
                return BodyCalc.calculateRemoteMiner(energy, options.sourceCapacity || 3000);

            case 'hubManager':
                return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE];

            case 'fastFiller': {
                let body = [];
                let cost = 0;
                const pairCost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
                while (cost + pairCost <= energy && body.length < 50) {
                    body.push(CARRY, MOVE);
                    cost += pairCost;
                }
                return body;
            }

            case 'reserver':
                return [CLAIM, MOVE];

            case 'scout':
                return [MOVE];

            default:
                // Fallback basic worker
                return BodyCalc.calculateWorker(energy);
        }
    }

    /**
     * Calculates the total energy cost of a proposed creep body.
     *
     * @param {string[]} body The array of body parts.
     * @returns {number} The total cost.
     */
    static getCost(body) {
        return BodyCalc.getCost(body);
    }
}

module.exports = CreepBodyBuilder;
