/**
 * @file haulerSizing.js
 * @description Calculates the optimal body parts for remote haulers based on the amount of dropped energy, decay rate, and path length.
 */

const BodyCalc = require('../utils/bodyCalc');

/**
 * @class HaulerSizing
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
        // Distance * 2 is round trip
        const roundTrip = pathLength * 2;
        const generatedEnergy = roundTrip * energyPerTick;
        // Energy decays at Math.ceil(amount / 1000) per tick. We need to grab it before decay destroys too much.
        // We size the hauler to grab the total generated + whatever is dropped right now.
        const totalEnergyToSweep = generatedEnergy + droppedEnergy;
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
