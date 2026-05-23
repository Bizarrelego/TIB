/**
 * @file haulerSizing.js
 * @description Calculates the optimal body parts for remote haulers based on the amount of dropped energy, decay rate, and path length.
 */

const BodyCalc = require('../utils/bodyCalc');

/**
 * @class HaulerSizing
 * @description Utilized by RemoteHaulerOptimizer to calculate required carry capacity and dynamically size remote haulers.
 */
class HaulerSizing {
    /**
     * Calculates the required carry parts to transport all energy including currently dropped energy, factoring in decay.
     * @param {number} pathLength The distance from source to storage.
     * @param {number} droppedEnergy The current amount of dropped energy in the room.
     * @param {number} energyPerTick The energy generated per tick in the room.
     * @returns {number} The required number of CARRY parts.
     */
    static getRequiredCarryParts(pathLength, droppedEnergy, energyPerTick) {
        // Distance * 2 is round trip. A hauler will take `pathLength` ticks to arrive.
        const roundTrip = pathLength * 2;

        let projectedEnergy = droppedEnergy;

        // Simulate decay and generation for the duration the hauler takes to arrive (one way)
        for (let i = 0; i < pathLength; i++) {
            if (projectedEnergy > 0) {
                // Energy decays on the ground
                projectedEnergy -= Math.ceil(projectedEnergy / 1000);
            }
            // Energy generated per tick by miners
            projectedEnergy += energyPerTick;
        }

        // The hauler must be able to pick up whatever is there when it arrives,
        // but it ALSO needs to be sized for steady-state round-trip generation.
        const steadyStateGeneration = roundTrip * energyPerTick;
        const totalEnergyToSweep = Math.max(steadyStateGeneration, projectedEnergy);

        return Math.ceil(totalEnergyToSweep / 50);
    }

    /**
     * Calculates the optimal body array for a hauler based on dropped energy, decay rate, and path length.
     * @param {number} energyCapacity Available spawn energy.
     * @param {number} requiredCarry Required number of CARRY parts.
     * @returns {string[]} Optimal body array.
     */
    static calculateBody(energyCapacity, requiredCarry) {
        let carry = 0;
        let move = 0;
        let cost = 0;

        // Containerless mining: We want a 2 CARRY : 1 MOVE ratio on roads, but we must cap at energyCapacity and 50 parts.
        while (carry < requiredCarry) {
            if (carry + move + 3 <= 50 && cost + BODYPART_COST[CARRY] * 2 + BODYPART_COST[MOVE] <= energyCapacity) {
                carry += 2;
                move += 1;
                cost += BODYPART_COST[CARRY] * 2 + BODYPART_COST[MOVE];
            } else if (carry + move + 2 <= 50 && cost + BODYPART_COST[CARRY] + BODYPART_COST[MOVE] <= energyCapacity) {
                carry += 1;
                move += 1;
                cost += BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
            } else {
                break;
            }
        }

        if (carry === 0 && energyCapacity >= BODYPART_COST[CARRY] + BODYPART_COST[MOVE]) {
            carry = 1; move = 1;
        }

        // Return constructed array
        return BodyCalc.buildArray({ [CARRY]: carry, [MOVE]: move });
    }
}

module.exports = HaulerSizing;
