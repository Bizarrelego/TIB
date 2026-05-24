/**
 * @fileoverview Defines the expected structure of temporary, tick-specific data stored in `creep.heap`.
 * These JSDoc definitions act as a schema for `CreepOperationalDataManager` and `creepHeapData.js`
 * to ensure consistency and prevent data-related bugs while adhering to the Heap Exclusivity principle.
 * This file contains strictly JSDoc comments and zero runtime logic.
 */

/**
 * @typedef {Object} CreepMovementData
 * @property {number} lastMoveTime - The Game.time of the last successful move.
 * @property {string} [destination] - Serialized RoomPosition (e.g., '25_25_W1N1') of the final destination.
 * @property {string} [path] - Serialized path string for cached movement.
 * @property {number} [stuckCount] - Number of consecutive ticks the creep has been stuck at the same position.
 */

/**
 * @typedef {Object} CreepTargetData
 * @property {string} id - The current active target ID (e.g., a Source, Structure, or hostile Creep).
 * @property {string} type - The type of target (e.g., 'source', 'structure', 'hostile').
 * @property {number} assignedTime - The Game.time when this target was assigned.
 */

/**
 * @typedef {Object} CreepHarvestData
 * @property {boolean} atOptimalSpot - Flag indicating if the stationary harvester has reached its zero-pathing calculated spot.
 * @property {number} [ticksToRegeneration] - Cached ticks until the target source regenerates.
 */

/**
 * @typedef {Object} CreepCombatData
 * @property {string} [squadId] - Optional ID for Quad or Squad formations.
 * @property {string} [fleeTarget] - ID of the hostile creep being fled from.
 * @property {number} [lastAttackTime] - The Game.time of the last attack.
 */

/**
 * @typedef {Map<string, CreepMovementData | CreepTargetData | CreepHarvestData | CreepCombatData | any>} CreepHeapMap
 * Represents the `creep.heap` Map structure, mapping specific operational data keys to their respective objects.
 */
