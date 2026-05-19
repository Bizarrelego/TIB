const RawMemoryManager = require('../os/RawMemoryManager');
const Profiler = require('../utils/profiler');

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
        const stringified = JSON.stringify(intelObj);
        const compressed = this.compress(stringified);

        if (RawMemoryManager && typeof RawMemoryManager.setSegment === 'function') {
            RawMemoryManager.setSegment(segmentId, compressed);
        } else if (typeof RawMemory !== 'undefined' && RawMemory.segments) {
            RawMemory.segments[segmentId] = compressed;
        }
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
        if (typeof RawMemory === 'undefined' || !RawMemory.foreignSegment) return;

        const compressed = RawMemory.foreignSegment.data;
        if (!compressed) return;

        try {
            const decompressed = this.decompress(compressed);
            const intelObj = JSON.parse(decompressed);

            for (const [key, value] of Object.entries(intelObj)) {
                this.foreignIntel.set(key, value);
            }
        } catch (e) {
            console.error(`[AllianceIntelManager] Error reading foreign segment: ${e.message}`);
        }
    }

    /**
     * Compresses a string using LZW compression.
     * @param {string} uncompressed - The string to compress.
     * @returns {string} The compressed string.
     */
    compress(uncompressed) {
        let i;
        const dictionary = new Map();
        for (i = 0; i < 256; i++) {
            dictionary.set(String.fromCharCode(i), i);
        }

        let c;
        let wc;
        let w = "";
        const result = [];
        let dictSize = 256;
        for (i = 0; i < uncompressed.length; i += 1) {
            c = uncompressed.charAt(i);
            wc = w + c;
            if (dictionary.has(wc)) {
                w = wc;
            } else {
                result.push(dictionary.get(w));
                // Add wc to the dictionary, up to max size
                if (dictSize < 65535) {
                    dictionary.set(wc, dictSize++);
                }
                w = String(c);
            }
        }

        if (w !== "") {
            result.push(dictionary.get(w));
        }

        let compressedStr = "";
        for (i = 0; i < result.length; i++) {
            compressedStr += String.fromCharCode(result[i]);
        }
        return compressedStr;
    }

    /**
     * Decompresses a string compressed with LZW.
     * @param {string} compressed - The compressed string.
     * @returns {string} The decompressed string.
     */
    decompress(compressed) {
        let i;
        const dictionary = new Map();
        for (i = 0; i < 256; i++) {
            dictionary.set(i, String.fromCharCode(i));
        }

        const compressedCodes = [];
        for (i = 0; i < compressed.length; i++) {
            compressedCodes.push(compressed.charCodeAt(i));
        }

        if (compressedCodes.length === 0) return "";

        let w = String.fromCharCode(compressedCodes[0]);
        let result = w;
        let entry = "";
        let dictSize = 256;
        for (i = 1; i < compressedCodes.length; i += 1) {
            const k = compressedCodes[i];
            if (dictionary.has(k)) {
                entry = dictionary.get(k);
            } else if (k === dictSize) {
                entry = w + w.charAt(0);
            } else {
                return null;
            }

            result += entry;

            // Add w+entry[0] to the dictionary, up to max size
            if (dictSize < 65535) {
                dictionary.set(dictSize++, w + entry.charAt(0));
            }

            w = entry;
        }
        return result;
    }
}

module.exports = Profiler.wrap('AllianceIntelManager', new AllianceIntelManager());
