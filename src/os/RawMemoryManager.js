const MEMORY_SEGMENTS = require('../constants/memorySegments');

/**
 * Manages storage and retrieval of data in RawMemory segments.
 */
class RawMemoryManager {
    constructor() {
        /**
         * @type {Set<number>}
         */
        this.activeSegments = new Set([MEMORY_SEGMENTS.INTEL, MEMORY_SEGMENTS.COST_MATRICES]);
    }

    /**
     * Initializes the RawMemory segments for the current tick.
     * Activates the required segments for the next tick.
     */
    init() {
        if (typeof RawMemory !== 'undefined' && RawMemory.setActiveSegments) {
            RawMemory.setActiveSegments(Array.from(this.activeSegments));
        }
    }

    /**
     * Retrieves data from a specific RawMemory segment.
     * @param {number} id - The ID of the segment.
     * @returns {string|undefined} The string data from the segment, or undefined if the segment is not loaded.
     */
    getSegment(id) {
        if (typeof RawMemory !== 'undefined' && RawMemory.segments) {
            return RawMemory.segments[id];
        }
        return undefined;
    }

    /**
     * Stores data in a specific RawMemory segment.
     * Also marks the segment to be active in the next tick.
     * @param {number} id - The ID of the segment.
     * @param {string} data - The string data to store.
     */
    setSegment(id, data) {
        if (typeof RawMemory !== 'undefined' && RawMemory.segments) {
            RawMemory.segments[id] = data;
        }
        if (!this.activeSegments.has(id)) {
            this.activeSegments.add(id);
            // If we added a new segment, we might want to ensure it gets activated next tick.
            // init() will be called next tick, or is already called this tick.
            // Calling setActiveSegments multiple times in a tick overwrites previous calls,
            // so we should ideally call it again or ensure init() handles it.
        }
    }
}

// Export as a singleton
module.exports = new RawMemoryManager();
