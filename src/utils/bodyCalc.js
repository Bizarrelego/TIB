/* eslint-disable no-redeclare */
/* global BODYPART_COST, CARRY, MOVE, WORK, BUILD_POWER */

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
        // Generate creeps that cost exactly what is necessary to fully exploit the source and no more
        const isReserved = sourceCapacity === 3000;
        const energyPerTick = isReserved ? 10 : 5;
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
    static calculateEarlyGameHarvester(energyCapacity) {
        let work = 0;
        let move = 0;
        let cost = 0;

        while (work < 3 && cost + BODYPART_COST[WORK] + BODYPART_COST[MOVE] <= energyCapacity) {
            work++;
            move++;
            cost += BODYPART_COST[WORK] + BODYPART_COST[MOVE];
        }

        return this.buildArray({ [WORK]: work, [MOVE]: move });
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

        while (cost + BODYPART_COST[CARRY] + BODYPART_COST[MOVE] <= energyCapacity && carry + move + 2 <= 50) {
            carry++;
            move++;
            cost += BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
        }

        if (carry === 0 && energyCapacity >= 100) {
            carry = 1; move = 1;
        }

        return this.buildArray({ [CARRY]: carry, [MOVE]: move });
    }

    /**
     * Calculates the optimal static upgrader body
     * Prioritizes WORK parts, 1 CARRY part minimum, and sufficient MOVE parts (1 per 2 other parts).
     * @param {number} energyCapacity Available spawn energy
     * @returns {string[]} Optimal body array
     */
    static calculateUpgrader(energyCapacity) {
        let work = 0;
        let carry = 1;
        let move = 1;
        let cost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
        let totalParts = 2; // CARRY and MOVE

        const partCost = BODYPART_COST[WORK];
        const moveRatio = 2; // 1 MOVE per 2 WORK/CARRY parts

        // Fill with WORK parts and add MOVE parts to maintain the ratio
        while (cost + partCost <= energyCapacity && totalParts < 50) {
            // Check if adding one WORK part requires adding another MOVE part
            const neededMove = Math.ceil((work + carry + 1) / moveRatio);
            let addedCost = partCost;
            let partsToAdd = 1; // 1 WORK

            if (neededMove > move) {
                addedCost += BODYPART_COST[MOVE];
                partsToAdd += 1; // 1 MOVE
            }

            if (cost + addedCost <= energyCapacity && totalParts + partsToAdd <= 50 && work < 15) { // Cap WORK to 15 (max 15 energy upgraded per tick without boosts usually suffices for general upgrading unless RCL 8 where we limit to 15 anyway, wait, up to capacity)
                // Let's cap WORK to say, 15 for a single upgrader to not overkill unless it's the only one. 15 WORK * 2 energy = 30 energy per tick, very high.
                work++;
                if (neededMove > move) {
                    move++;
                }
                cost += addedCost;
                totalParts += partsToAdd;
            } else {
                break;
            }
        }

        // Ensure at least 1 WORK part if somehow capacity is extremely low but above 300
        if (work === 0 && energyCapacity >= 300) {
            work = 1;
            carry = 1;
            move = 1;
        }

        return this.buildArray({ [WORK]: work, [CARRY]: carry, [MOVE]: move });
    }

    /**
     * Calculates the total build power of all workers in a room.
     * @param {string} roomName
     * @returns {number} Total build power
     */

    /**
     * Calculates optimal body for powerHauler based on capacity and distance.
     * @param {number} energyCapacity
     * @param {number} distance
     * @param {number} powerAmount
     * @returns {string[]}
     */
    static calculatePowerHauler(energyCapacity, distance, powerAmount) {
        const carryNeeded = Math.ceil(powerAmount / 50);
        let carry = 0;
        let move = 0;
        let cost = 0;

        while (carry < carryNeeded && carry + move < 50) {
            if (cost + BODYPART_COST[CARRY] + BODYPART_COST[MOVE] <= energyCapacity) {
                carry++;
                move++;
                cost += BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
            } else {
                break;
            }
        }

        if (carry === 0 && energyCapacity >= 100) {
            carry = 1; move = 1;
        }

        return this.buildArray({ [CARRY]: carry, [MOVE]: move });
    }

    static getBuildPower(roomName) {
        let buildPower = 0;
        const roomCreeps = global.State.creepsByRoom.get(roomName);
        if (roomCreeps) {
            const workers = roomCreeps.get('worker');
            if (workers) {
                for (let w = 0; w < workers.length; w++) {
                    const worker = workers[w];
                    if (worker.body) {
                        for (let b = 0; b < worker.body.length; b++) {
                            if (worker.body[b].type === WORK) {
                                buildPower += BUILD_POWER;
                            }
                        }
                    }
                }
            }
        }
        if (buildPower === 0) buildPower = BUILD_POWER; // Default
        return buildPower;
    }

}

module.exports = BodyCalc;
