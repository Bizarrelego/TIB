/**
 * @file CreepMemorySchemaEnforcer.js
 * @description Utility module to validate creep.memory against a predefined schema. Ensures it only contains persistent data and enforces the "Heap Exclusivity" principle.
 */

const Logger = require('./logger');

const ALLOWED_PROPERTIES = new Set(['role', 'colony', 'room', 'targetRoom', 'homeRoom', 'remoteRoom', 'claimFlag']);

class CreepMemorySchemaEnforcer {
    /**
     * Validates a single creep's memory.
     * @param {Object} creepMemory - The memory object of the creep.
     * @param {string} creepName - The name of the creep (for logging).
     */
    static validateCreepMemory(creepMemory, creepName) {
        if (!creepMemory || typeof creepMemory !== 'object') {
            return;
        }

        for (const key of Object.keys(creepMemory)) {
            if (!ALLOWED_PROPERTIES.has(key)) {
                Logger.warn(`CreepMemorySchemaEnforcer: Creep '${creepName}' has non-compliant property '${key}' in memory. Stripping.`);
                delete creepMemory[key];
            }
        }
    }

    /**
     * Iterates over Memory.creeps and validates each creep's memory.
     */
    static validateAll() {
        if (typeof Memory === 'undefined' || !Memory.creeps) {
            return;
        }

        for (const creepName in Memory.creeps) {
            this.validateCreepMemory(Memory.creeps[creepName], creepName);
        }
    }
}

module.exports = CreepMemorySchemaEnforcer;
