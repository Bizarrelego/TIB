/**
 * @file SegmentManager.js
 * @description Centralized queue to throttle RawMemory segment writes and active flags.
 * Enforces the Screeps engine limit of maximum 10 segments active per tick.
 */

class SegmentManager {
    constructor() {
        /**
         * Pending segment writes to be executed at the end of the tick.
         * @type {Map<number, string|object>}
         */
        this.writeQueue = new Map();

        /**
         * Segments requested to be active for reading next tick.
         * @type {Set<number>}
         */
        this.activeSegments = new Set();
    }

    /**
     * Queues a segment write intent.
     * @param {number} segmentId - The ID of the segment (0-99).
     * @param {string|object} data - Payload to serialize and save.
     */
    queueWrite(segmentId, data) {
        this.writeQueue.set(segmentId, data);
    }

    /**
     * Requests a segment be kept active for the following tick.
     * @param {number} segmentId - The ID of the segment (0-99).
     */
    requestActive(segmentId) {
        this.activeSegments.add(segmentId);
    }

    /**
     * Executes the queue and restricts active segments.
     * Run this during Phase 6: Intents & Sleep.
     */
    run() {
        let activeWriteCount = 0;
        const activeIds = [];

        // Execute queued writes first
        for (const [segmentId, data] of this.writeQueue.entries()) {
            if (activeWriteCount >= 10) {
                console.warn(`[SegmentManager] 10 segment limit reached. Deferring write to segment ${segmentId}`);
                break;
            }
            
            RawMemory.segments[segmentId] = typeof data === 'string' ? data : JSON.stringify(data);
            activeIds.push(segmentId);
            this.writeQueue.delete(segmentId);
            activeWriteCount++;
        }

        // Fill remaining allowance with read requests
        for (const segmentId of this.activeSegments) {
            if (activeWriteCount >= 10) break;
            
            if (!activeIds.includes(segmentId)) {
                activeIds.push(segmentId);
                activeWriteCount++;
            }
        }
        
        this.activeSegments.clear();

        if (activeIds.length > 0) {
            RawMemory.setActiveSegments(activeIds);
        }
    }
}

module.exports = new SegmentManager();