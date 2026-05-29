const eventBus = require('./eventBus');
const {
    EVENT_STRUCTURE_DAMAGED,
    EVENT_ROOM_REPAIR,
    EVENT_ROOM_BUILD,
    EVENT_STRUCTURE_DECAY
} = require('../constants/eventTypes');

/**
 * @typedef {Object} StructureState
 * @property {number} hits - Current hits of the structure
 * @property {number} hitsMax - Maximum hits of the structure
 * @property {number} progress - Current construction progress
 * @property {number} progressTotal - Total construction progress required
 */

class StructureStateTracker {
    constructor() {
        this.init();
    }

    init() {
        // Subscribe to relevant events
        eventBus.subscribe(EVENT_STRUCTURE_DAMAGED, this.handleStructureDamaged.bind(this));
        eventBus.subscribe(EVENT_ROOM_REPAIR, this.handleStructureRepaired.bind(this));
        eventBus.subscribe(EVENT_ROOM_BUILD, this.handleStructureBuilt.bind(this));
        eventBus.subscribe(EVENT_STRUCTURE_DECAY, this.handleStructureDecay.bind(this));
    }

    /**
     * @param {string} targetId
     * @returns {StructureState|null}
     */
    getState(targetId) {
        if (!global.State) return null;
        if (!global.State.structureStates) {
            global.State.structureStates = new Map();
        }

        if (global.State.structureStates.has(targetId)) {
            return global.State.structureStates.get(targetId);
        }

        // Initialize state if not found (fast O(1) fallback)
        if (typeof Game === 'undefined') return null;

        const obj = Game.getObjectById(targetId);
        // Ensure it is a structure or construction site, not a creep.
        if (!obj || (!obj.structureType && !obj.progressTotal)) return null;

        const state = {
            hits: obj.hits || 0,
            hitsMax: obj.hitsMax || 0,
            progress: obj.progress || 0,
            progressTotal: obj.progressTotal || 0
        };

        global.State.structureStates.set(targetId, state);
        return state;
    }

    handleStructureDamaged(payload) {
        const { targetId, damage } = payload;
        if (!targetId) return;

        const state = this.getState(targetId);
        if (state) {
            state.hits = Math.max(0, state.hits - damage);
        }
    }

    handleStructureRepaired(payload) {
        // From EVENT_REPAIR log
        // payload = { roomName, event }
        const { event } = payload;
        const targetId = event.data.targetId;
        const amount = event.data.amount;

        if (!targetId) return;

        const state = this.getState(targetId);
        if (state) {
            state.hits = Math.min(state.hitsMax, state.hits + amount);
        }
    }

    handleStructureBuilt(payload) {
        // From EVENT_BUILD log
        const { event } = payload;
        const targetId = event.data.targetId;
        const amount = event.data.amount;

        if (!targetId) return;

        const state = this.getState(targetId);
        if (state) {
            state.progress = Math.min(state.progressTotal, state.progress + amount);
        }
    }

    handleStructureDecay(payload) {
        // From EVENT_OBJECT_DESTROYED log if it was structure decay...
        // Or wait, decay usually happens without EVENT_OBJECT_DESTROYED unless it hits 0.
        // Actually, in Screeps, roads/containers decaying don't produce an event log unless destroyed?
        // Let's handle it if it drops hits or is destroyed.
        // The eventLog for EVENT_OBJECT_DESTROYED just has `type` (not creep)
        const { event } = payload;
        const objectId = event.objectId;

        if (!objectId) return;

        if (global.State && global.State.structureStates) {
            global.State.structureStates.delete(objectId);
        }
    }
}

const tracker = new StructureStateTracker();
module.exports = tracker;
