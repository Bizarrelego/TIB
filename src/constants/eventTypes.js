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

const EVENT_HOSTILE_ATTACK = 'HOSTILE_ATTACK';
const EVENT_CONSTRUCTION_STARTED = 'CONSTRUCTION_STARTED';
const EVENT_INVALIDATE_COSTMATRIX = 'INVALIDATE_COSTMATRIX';
const EVENT_STRUCTURE_DECAY = 'STRUCTURE_DECAY';
const EVENT_CREEP_DEATH = 'CREEP_DEATH';
const EVENT_ROOM_HARVEST = 'ROOM_EVENT_HARVEST';
const EVENT_ROOM_REPAIR = 'ROOM_EVENT_REPAIR';
const EVENT_ROOM_TRANSFER = 'ROOM_EVENT_TRANSFER';

module.exports = {
    EVENT_HOSTILE_SPOTTED,
    EVENT_STRUCTURE_DAMAGED,
    EVENT_CREEP_SPAWNED,
    EVENT_HOSTILE_ATTACK,
    EVENT_CONSTRUCTION_STARTED,
    EVENT_INVALIDATE_COSTMATRIX,
    EVENT_STRUCTURE_DECAY,
    EVENT_CREEP_DEATH,
    EVENT_ROOM_HARVEST,
    EVENT_ROOM_REPAIR,
    EVENT_ROOM_TRANSFER
};
