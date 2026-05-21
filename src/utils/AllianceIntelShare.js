const RawMemoryManager = require('../os/RawMemoryManager');

/**
 * @file AllianceIntelShare.js
 * @description Utility class for sharing intel across alliance members via RawMemory segments.
 */

/**
 * Schema for shared room intel data.
 * @typedef {Object} RoomIntelSchema
 * @property {number} [rcl] - The room controller level.
 * @property {string} [owner] - The owner of the room.
 * @property {string} [reservation] - The reservation owner of the room.
 * @property {boolean} [hostile] - Whether the room has hostiles.
 * @property {number} [lastUpdated] - Tick when the intel was last updated.
 * @property {Array<{x: number, y: number, cost: number}>} [heatmap] - Serialized heatmap of the room.
 */

/**
 * Schema for the overall shared intel object.
 * @typedef {Object<string, RoomIntelSchema>} SharedIntelSchema
 * Keys are room names, values are RoomIntelSchema.
 */

class AllianceIntelShare {
    /**
     * Publishes intel data to a RawMemory segment.
     * @param {SharedIntelSchema} data - The intel data to share.
     * @param {number} segmentId - The ID of the segment to write to.
     */
    publishIntel(data, segmentId) {
        const stringified = JSON.stringify(data);
        const compressed = this.compress(stringified);

        if (RawMemoryManager && typeof RawMemoryManager.setSegment === 'function') {
            RawMemoryManager.setSegment(segmentId, compressed);
        } else if (typeof RawMemory !== 'undefined' && RawMemory.segments) {
            RawMemory.segments[segmentId] = compressed;
        }
    }

    /**
     * Retrieves and parses intel data from a foreign segment.
     * @returns {SharedIntelSchema|null} The parsed intel data, or null if unreadable.
     */
    retrieveIntel() {
        if (typeof RawMemory === 'undefined' || !RawMemory.foreignSegment) return null;

        const compressed = RawMemory.foreignSegment.data;
        if (!compressed) return null;

        try {
            const decompressed = this.decompress(compressed);
            if (!decompressed) return null;

            const intelObj = JSON.parse(decompressed);
            return intelObj;
        } catch (e) {
            console.error(`[AllianceIntelShare] Error reading foreign segment: ${e.message}`);
            return null;
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
     * @returns {string|null} The decompressed string.
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

module.exports = new AllianceIntelShare();
