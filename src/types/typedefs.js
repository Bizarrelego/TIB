/**
 * @typedef {Object} CreepMemory
 * @property {string} role - The role of the creep (e.g., 'harvester', 'upgrader').
 * @property {string} [room] - The primary room the creep belongs to.
 * @property {string} [targetId] - ID of the current target structure/creep/source.
 * @property {boolean} [working] - State flag indicating if the creep is working/full.
 */

/**
 * @typedef {Object} RoomState
 * @property {string} name - Name of the room.
 * @property {Map<string, Structure>} structures - Map of structure IDs to Structure objects.
 * @property {Map<string, Creep>} creeps - Map of creep IDs to Creep objects.
 * @property {Map<string, Source>} sources - Map of source IDs to Source objects.
 */

/**
 * @typedef {Object} Intent
 * @property {string} action - The action to perform (e.g., 'move', 'harvest', 'transfer').
 * @property {string} targetId - The ID of the target object for the action.
 * @property {number} priority - The priority of the intent (higher is more important).
 * @property {Object} [data] - Additional data needed for the intent.
 */

/**
 * @typedef {Object} EventObject
 * @property {number} event - The event code (e.g., EVENT_ATTACK, EVENT_OBJECT_DESTROYED).
 * @property {string} objectId - The ID of the object that caused the event.
 * @property {Object} data - Event-specific data payload.
 */

/**
 * @typedef {Object} CostMatrixCacheEntry
 * @property {CostMatrix} matrix - The cached CostMatrix.
 * @property {number} time - The Game.time when the matrix was generated.
 * @property {string} hash - The hash of the room state used to generate this matrix.
 */
