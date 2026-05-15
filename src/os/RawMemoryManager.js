const MEMORY_SEGMENTS = require('../constants/memorySegments');

/**
 * Manages storage and retrieval of data in RawMemory segments.
 */
class RawMemoryManager {
    constructor() {
        /** @type {Set<number>} */
        this.activeSegments = new Set();
        /** @type {Object|null} */
        this.intelCache = null;
        /** @type {Map<number, string>} */
        this.intelBuffer = new Map();
        /** @type {Map<number, string>} */
        this.saveQueue = new Map();

        /** @type {number[]} */
        this.intelSegmentIds = Array.isArray(MEMORY_SEGMENTS.INTEL)
            ? MEMORY_SEGMENTS.INTEL
            : [MEMORY_SEGMENTS.INTEL];

        this.readPage = 0;
        this.currentReadVersion = null;
    }

    /**
     * Initializes the RawMemory segments for the current tick.
     * Processes save queues or reads paginated intel data.
     */
    init() {
        if (typeof RawMemory === 'undefined' || !RawMemory.setActiveSegments) return;

        const maxTotalActive = 10;
        const requiredAlways = [MEMORY_SEGMENTS.COST_MATRICES];
        const segmentsToActivate = new Set(requiredAlways);

        // 1. Write phase (process save queue)
        // Check if we have writes pending
        if (this.saveQueue.size > 0 && RawMemory.segments) {
            let segmentsWritten = 0;
            const maxWrites = maxTotalActive - requiredAlways.length;

            for (const [id, chunk] of this.saveQueue.entries()) {
                if (segmentsWritten >= maxWrites) break;

                // Can only write if segment was requested last tick and is available
                if (RawMemory.segments[id] !== undefined) {
                    RawMemory.segments[id] = chunk;
                    segmentsToActivate.add(id);
                    this.saveQueue.delete(id);
                    segmentsWritten++;
                } else {
                    // Request for next tick, keep in queue
                    if (segmentsToActivate.size < maxTotalActive) {
                        segmentsToActivate.add(id);
                    }
                }
            }
        } else if (RawMemory.segments) {
            // 2. Read phase (process active segments from LAST tick)
            let processedReads = false;

            // Check version in segment 0 to prevent torn reads
            const rootSegmentId = this.intelSegmentIds[0];
            if (RawMemory.segments[rootSegmentId] !== undefined) {
                const rootData = RawMemory.segments[rootSegmentId];
                if (rootData && rootData.includes('|')) {
                    const version = rootData.split('|')[0];
                    if (version !== this.currentReadVersion) {
                        this.currentReadVersion = version;
                        this.intelBuffer.clear(); // Reset buffer for new version
                    }
                }
            }

            for (const id of this.intelSegmentIds) {
                if (RawMemory.segments[id] !== undefined) {
                    const data = RawMemory.segments[id];
                    this.intelBuffer.set(id, data);
                    processedReads = true;
                }
            }

            if (processedReads) {
                // Check if we have all chunks to reconstruct intel
                if (this.intelBuffer.size === this.intelSegmentIds.length) {
                    let fullData = '';
                    for (const id of this.intelSegmentIds) {
                        const chunk = this.intelBuffer.get(id);
                        if (chunk) fullData += chunk;
                    }
                    if (fullData && fullData.includes('|')) {
                        try {
                            // Strip timestamp prefix
                            const jsonStr = fullData.substring(fullData.indexOf('|') + 1);
                            if (jsonStr) {
                                this.intelCache = JSON.parse(jsonStr);
                            }
                        } catch (e) {
                            console.log(`[RawMemoryManager] Failed to parse intel data: ${e.message}`);
                        }
                    }
                }
            }

            // Request next read page
            const maxReads = maxTotalActive - requiredAlways.length;
            const startIdx = this.readPage * maxReads;

            // Loop back if we exceed array bounds
            if (startIdx >= this.intelSegmentIds.length) {
                this.readPage = 0;
            }

            const pageIds = this.intelSegmentIds.slice(this.readPage * maxReads, (this.readPage * maxReads) + maxReads);

            for (const id of pageIds) {
                segmentsToActivate.add(id);
            }

            this.readPage++;
        }

        // Apply active overrides
        for (const seg of this.activeSegments) {
            if (segmentsToActivate.size < maxTotalActive) {
                segmentsToActivate.add(seg);
            }
        }

        RawMemory.setActiveSegments(Array.from(segmentsToActivate));
    }

    /**
     * Loads intel data from the internal cache.
     * @returns {Object|null} The cached intel data.
     */
    loadIntel() {
        return this.intelCache;
    }

    /**
     * Queues intel data to be saved across multiple segments.
     * @param {Object} data - The intel data to save.
     */
    saveIntel(data) {
        // Prepend versioning timestamp to prevent torn reads
        const stringifiedData = `${Game.time}|${JSON.stringify(data)}`;
        const MAX_SEGMENT_SIZE = 100 * 1024; // 100KB

        this.saveQueue.clear();
        this.intelBuffer.clear(); // Clear reads to ensure we don't mix writes with stale reads

        let offset = 0;
        let segmentIndex = 0;

        // Queue chunks
        while (offset < stringifiedData.length && segmentIndex < this.intelSegmentIds.length) {
            const chunk = stringifiedData.substring(offset, offset + MAX_SEGMENT_SIZE);
            const segmentId = this.intelSegmentIds[segmentIndex];
            this.saveQueue.set(segmentId, chunk);

            offset += MAX_SEGMENT_SIZE;
            segmentIndex++;
        }

        // Queue empty strings for remaining segments to clear old data
        while (segmentIndex < this.intelSegmentIds.length) {
            const segmentId = this.intelSegmentIds[segmentIndex];
            this.saveQueue.set(segmentId, '');
            segmentIndex++;
        }

        if (offset < stringifiedData.length) {
            console.warn(`[RawMemoryManager] Intel data exceeds allocated segments! Lost ${stringifiedData.length - offset} characters.`);
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
