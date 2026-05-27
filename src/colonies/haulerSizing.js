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

    /**
     * Executes hauler sizing logic per room, mainly to handle early game native RCL 1-2 integration.
     * @param {Room} room
     */
    static run(room) {
        if (!room.controller || room.controller.level >= 3) return;

        // Check if any containers exist
        let hasContainers = false;
        if (global.State && global.State.structuresByRoom) {
            const structures = global.State.structuresByRoom.get(room.name);
            if (structures && structures.has(STRUCTURE_CONTAINER) && structures.get(STRUCTURE_CONTAINER).size > 0) {
                hasContainers = true;
            }
        }

        if (!hasContainers && global.State) {
            const SourceManager = require('../managers/SourceManager');
            const CachedPathing = require('../utils/CachedPathing');
            const roomDropped = global.State.droppedByRoom ? (global.State.droppedByRoom.get(room.name) || []) : [];
            const sources = global.State.sourcesByRoom ? (global.State.sourcesByRoom.get(room.name) || []) : [];

            let totalDomesticCarryRequired = 0;

            const spawnObj = global.State.structuresByRoom && global.State.structuresByRoom.get(room.name) && global.State.structuresByRoom.get(room.name).get(STRUCTURE_SPAWN);
            const firstSpawn = spawnObj && spawnObj.size > 0 ? spawnObj.values().next().value : null;

            for (const source of sources) {
                const optimalSpot = SourceManager.getOptimalMiningSpot(source.id);
                if (optimalSpot) {
                    // Check dropped energy at this spot
                    let spotEnergy = 0;
                    for (const dropped of roomDropped) {
                        if (dropped.pos.x === optimalSpot.x && dropped.pos.y === optimalSpot.y && dropped.resourceType === RESOURCE_ENERGY) {
                            spotEnergy += dropped.amount;
                        }
                    }

                    if (spotEnergy > 0) {
                        let pathLength = 10; // Default
                        if (firstSpawn) {
                            const endPos = new RoomPosition(optimalSpot.x, optimalSpot.y, room.name);
                            pathLength = CachedPathing.getPathLength(firstSpawn.pos, endPos) || 10;
                        }

                        const energyPerTick = source.energyCapacity / ENERGY_REGEN_TIME; // e.g. 1500/300 = 5, or 3000/300 = 10
                        totalDomesticCarryRequired += HaulerSizing.getRequiredCarryParts(pathLength, spotEnergy, energyPerTick);
                    }
                }
            }

            // Write to room ledger or state to quantify infrastructure vacuum
            if (totalDomesticCarryRequired > 0) {
                if (!global.State.roomLedgers) global.State.roomLedgers = new Map();
                if (!global.State.roomLedgers.has(room.name)) global.State.roomLedgers.set(room.name, new Map());
                const ledger = global.State.roomLedgers.get(room.name);
                ledger.set('infrastructureVacuum', totalDomesticCarryRequired);
            }
        }
    }

}

module.exports = HaulerSizing;
