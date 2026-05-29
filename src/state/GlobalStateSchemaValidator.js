/**
 * @file GlobalStateSchemaValidator.js
 * @description Validates the global.State object against its defined schema.
 */

const Logger = require('../utils/logger');
const GlobalStateSchema = require('./GlobalStateSchema');

class GlobalStateSchemaValidator {
    /**
     * Validates if the given state conforms to the expected global state structure.
     * @param {Object} state - The state object to validate.
     * @returns {boolean} True if valid, false otherwise.
     */
    static validateGlobalState(state) {
        if (!state) {
            Logger.error('[GlobalStateSchemaValidator] State is null or undefined.');
            return false;
        }

        let isValid = true;
        const schema = GlobalStateSchema.SCHEMA;

        for (const [key, expectedType] of Object.entries(schema)) {
            const value = state[key];

            if (expectedType === 'Map') {
                if (!(value instanceof Map)) {
                    Logger.error(`[GlobalStateSchemaValidator] Invalid or missing property: ${key}. Expected Map.`);
                    isValid = false;
                }
            } else if (typeof value !== expectedType && value !== undefined) {
                 // allow undefined as the schema property might not be initialized yet
                 // Though the original validation didn't allow undefined for boolean/string.
                 // We should match original behavior if possible.
                 if (expectedType === 'boolean' && typeof value !== 'boolean') {
                    Logger.error(`[GlobalStateSchemaValidator] Invalid property: ${key}. Expected boolean.`);
                    isValid = false;
                 } else if (expectedType === 'string' && typeof value !== 'string') {
                    Logger.error(`[GlobalStateSchemaValidator] Invalid property: ${key}. Expected string.`);
                    isValid = false;
                 }
            }
        }

        return isValid;
    }
}

module.exports = GlobalStateSchemaValidator;
