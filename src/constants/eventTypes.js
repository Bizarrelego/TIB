/**
 * @file eventTypes.js
 * @description Defines constants for standard event types used in the EventBus system.
 * Centralizing these constants prevents typos and improves maintainability across the bot's event-driven architecture.
 */

/**
 * Event fired when a hostile creep is spotted in a monitored room.
 * @constant
 * @type {string}
 */
const EVENT_HOSTILE_SPOTTED = 'HOSTILE_SPOTTED';

/**
 * Event fired when a structure (e.g., wall, rampart, extension) takes damage.
 * @constant
 * @type {string}
 */
const EVENT_STRUCTURE_DAMAGED = 'STRUCTURE_DAMAGED';

/**
 * Event fired when a new creep is successfully spawned.
 * @constant
 * @type {string}
 */
const EVENT_CREEP_SPAWNED = 'CREEP_SPAWNED';

module.exports = {
    EVENT_HOSTILE_SPOTTED,
    EVENT_STRUCTURE_DAMAGED,
    EVENT_CREEP_SPAWNED
};
