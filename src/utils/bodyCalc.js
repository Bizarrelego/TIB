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
}

module.exports = BodyCalc;
