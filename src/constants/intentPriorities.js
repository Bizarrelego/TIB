/**
 * @file intentPriorities.js
 * @description Defines the priorities for different creep intents to maximize actions per tick.
 */

/**
 * Valid pipeline types for intent locking.
 * @enum {string}
 */
const PIPELINES = {
    MOVEMENT: 'MOVEMENT',
    MELEE: 'MELEE',
    RANGED: 'RANGED',
    UTILITY: 'UTILITY',
    LOGISTICS: 'LOGISTICS'
};

/**
 * Priorities for different creep intents. Higher values have higher priority.
 * @constant {Map<string, number>}
 */
const INTENT_PRIORITIES = new Map([
    ['move', 100],
    ['moveTo', 100],
    ['moveByPath', 100],
    ['attack', 90],
    ['dismantle', 90],
    ['rangedAttack', 90],
    ['rangedHeal', 90],
    ['rangedMassAttack', 90],
    ['heal', 80],
    ['build', 80],
    ['repair', 80],
    ['upgradeController', 80],
    ['harvest', 80],
    ['transfer', 80],
    ['withdraw', 80],
    ['pickup', 80],
    ['drop', 80],
    ['claimController', 80],
    ['reserveController', 80],
    ['attackController', 80],
    ['generateSafeMode', 80]
]);

module.exports = {
    INTENT_PRIORITIES,
    PIPELINES
};
