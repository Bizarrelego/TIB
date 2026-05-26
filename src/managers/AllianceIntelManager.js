const AllianceIntelShare = require('../utils/AllianceIntelShare');
const SegmentManager = require('./SegmentManager');

/**
 * @file AllianceIntelManager.js
 * @description Manages the serialization and sharing of intel data across alliance members using RawMemory segments.
 */

class AllianceIntelManager {
    constructor() {
        /**
         * Local intel to be shared with the alliance.
         * @type {Map<string, any>}
         */
        this.localIntel = new Map();

        /**
         * Foreign intel read from other alliance members.
         * @type {Map<string, any>}
         */
        this.foreignIntel = new Map();
    }

    /**
     * Initializes the manager for the tick.
     */
    init() {
        this.processForeignSegment();
    }

    /**
     * Main execution loop for the manager.
     */
    run() {
        // Implementation can extend this for ticking logic
    }

    /**
     * Pushes intel data to be shared with the alliance.
     * @param {string} key - The key for the intel data.
     * @param {any} data - The intel data to share.
     */
    pushIntel(key, data) {
        this.localIntel.set(key, data);
    }

    /**
     * Pulls intel data received from the alliance.
     * @param {string} key - The key for the intel data.
     * @returns {any} The intel data, or undefined if not found.
     */
    pullIntel(key) {
        return this.foreignIntel.get(key);
    }

    /**
     * Writes local intel to a RawMemory segment.
     * @param {number} segmentId - The ID of the segment to write to.
     */
    writeSegment(segmentId) {
        const intelObj = Object.fromEntries(this.localIntel);
        SegmentManager.queueWrite(segmentId, intelObj);
    }

    /**
     * Requests a foreign segment to be read on the next tick.
     * @param {string} username - The username of the alliance member.
     * @param {number} [segmentId] - The segment ID to request.
     */
    requestForeignSegment(username, segmentId) {
        if (typeof RawMemory !== 'undefined' && RawMemory.setActiveForeignSegment) {
            RawMemory.setActiveForeignSegment(username, segmentId);
        }
    }

    /**
     * Processes any foreign segment data loaded on the current tick.
     */
    processForeignSegment() {
        const intelObj = AllianceIntelShare.retrieveIntel();
        if (intelObj) {
            for (const [key, value] of Object.entries(intelObj)) {
                this.foreignIntel.set(key, value);
            }
        }
    }
}

module.exports = new AllianceIntelManager();
