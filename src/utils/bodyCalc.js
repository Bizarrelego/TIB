/**
 * Dynamic Body Calculus
 * Mathematically generates exact body arrays based on path distance and target energy limits.
 */

class BodyCalc {
    /**
     * Build an array of body parts from an object format
     * @param {Object} counts Example: { [WORK]: 2, [CARRY]: 1, [MOVE]: 1 }
     * @returns {string[]} Example: ['work', 'work', 'carry', 'move']
     */
    static buildArray(counts) {
        let body = [];
        for (const [part, count] of Object.entries(counts)) {
            for (let i = 0; i < count; i++) {
                body.push(part);
            }
        }
        return body;
    }

    /**
     * Calculate cost of an array of body parts
     * @param {string[]} body
     * @returns {number}
     */
    static getCost(body) {
        return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
    }

    /**
     * Calculates the optimal mining body for a remote source based on distance and capacity.
     * Containerless mining pattern: scale WORK to max out source, max 1 CARRY, and sufficient MOVE.
     * @param {number} energyCapacity Available spawn energy
     * @param {number} sourceCapacity Max energy in source (3000 normally)
     * @returns {string[]} Optimal body array
     */
    static calculateRemoteMiner(energyCapacity, sourceCapacity = 3000) {
        const energyPerTick = sourceCapacity / 300;
        const workNeeded = Math.ceil(energyPerTick / 2); // 2 energy per work per tick

        let work = 0;
        let move = 0;
        let carry = 1; // Need 1 carry to prevent dropping 0-energy packages

        let cost = BODYPART_COST[CARRY];

        while (work < workNeeded && cost + BODYPART_COST[WORK] + BODYPART_COST[MOVE] <= energyCapacity) {
            work++;
            move++; // 1 MOVE per 1 WORK for unroaded terrain
            cost += BODYPART_COST[WORK] + BODYPART_COST[MOVE];
        }

        return this.buildArray({ [WORK]: work, [CARRY]: carry, [MOVE]: move });
    }

    /**
     * Dynamically sizes a hauler to sweep dropped energy before decay
     * @param {number} energyCapacity Available spawn energy
     * @param {number} distance Path distance from source to storage
     * @param {number} energyPerTick Rate of energy generation (e.g. 10)
     * @returns {string[]} Optimal body array
     */
    static calculateHauler(energyCapacity, distance, energyPerTick) {
        // Time for round trip
        const roundTrip = distance * 2;
        // Total energy accumulated during trip
        const energyAccumulated = roundTrip * energyPerTick;

        // Needed CARRY parts (50 capacity each)
        const carryNeeded = Math.ceil(energyAccumulated / 50);

        let carry = 0;
        let move = 0;
        let cost = 0;

        // Train Hauling ratio (2 CARRY : 1 MOVE for roaded)
        // Adjusting to 1:1 for off-road fallback if needed, but standard is 2:1 on roads
        while (carry < carryNeeded && carry + move < 50) {
            if (cost + BODYPART_COST[CARRY] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE] <= energyCapacity) {
                carry += 2;
                move += 1;
                cost += BODYPART_COST[CARRY] * 2 + BODYPART_COST[MOVE];
            } else if (cost + BODYPART_COST[CARRY] + BODYPART_COST[MOVE] <= energyCapacity) {
                carry += 1;
                move += 1;
                cost += BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
                break;
            } else {
                break;
            }
        }

        return this.buildArray({ [CARRY]: carry, [MOVE]: move });
    }

    /**
     * Calculates the optimal body for an early-game harvester based on capacity.
     * Prioritizes WORK and MOVE, with at least 1 CARRY.
     * @param {number} energyCapacity Available spawn energy
     * @returns {string[]} Optimal body array
     */
    static calculateHarvester(energyCapacity) {
        let work = 1;
        let carry = 1;
        let move = 1;
        let cost = BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE];

        // Try to add a 2nd WORK part if we can afford it along with its MOVE
        if (cost + BODYPART_COST[WORK] + BODYPART_COST[MOVE] <= energyCapacity) {
            work++;
            move++;
            cost += BODYPART_COST[WORK] + BODYPART_COST[MOVE];
        }

        // Further optimization could be to scale to max energy source (5-7 WORK)
        // But for early game RCL 1/2 we just cap it based on what's affordable.
        while (work < 5 && cost + BODYPART_COST[WORK] <= energyCapacity) {
            work++;
            cost += BODYPART_COST[WORK];
        }

        return this.buildArray({ [WORK]: work, [CARRY]: carry, [MOVE]: move });
    }

    /**
     * Calculates the optimal body for an early-game multi-purpose worker.
     * Aims for a balanced 1 WORK : 1 CARRY : 1 MOVE ratio.
     * @param {number} energyCapacity Available spawn energy
     * @returns {string[]} Optimal body array
     */
    static calculateWorker(energyCapacity) {
        let work = 0;
        let carry = 0;
        let move = 0;
        let cost = 0;
        const groupCost = BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE];

        while (cost + groupCost <= energyCapacity && work + carry + move < 50) {
            work++;
            carry++;
            move++;
            cost += groupCost;
        }

        // Make sure it has at least 1 of each if capacity is super low somehow (though minimum is 200e)
        if (work === 0 && energyCapacity >= 200) {
             work = 1; carry = 1; move = 1;
        }

        return this.buildArray({ [WORK]: work, [CARRY]: carry, [MOVE]: move });
    }

    /**
     * Calculates the optimal body for an early-game domestic hauler.
     * Aims for a 2 CARRY : 1 MOVE ratio where possible, or 1:1 if low on capacity.
     * @param {number} energyCapacity Available spawn energy
     * @returns {string[]} Optimal body array
     */
    static calculateDomesticHauler(energyCapacity) {
        let carry = 0;
        let move = 0;
        let cost = 0;

        // Try 2:1 ratio first
        const twoToOneCost = BODYPART_COST[CARRY] * 2 + BODYPART_COST[MOVE];
        const oneToOneCost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE];

        while (cost + twoToOneCost <= energyCapacity && carry + move + 3 <= 50) {
            carry += 2;
            move += 1;
            cost += twoToOneCost;
        }

        // If we can't afford a full 2:1 block, try adding a 1:1 block to fill capacity
        if (cost + oneToOneCost <= energyCapacity && carry + move + 2 <= 50) {
            carry += 1;
            move += 1;
            cost += oneToOneCost;
        }

        // Fallback for very low capacity
        if (carry === 0 && energyCapacity >= 100) {
            carry = 1; move = 1;
        }

        return this.buildArray({ [CARRY]: carry, [MOVE]: move });
    }

}

module.exports = BodyCalc;
