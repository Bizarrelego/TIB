/**
 * Defines memory segments used for RawMemory.
 * @module memorySegments
 */

module.exports = {
    INTEL: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    COST_MATRICES: 11,
    INTER_SHARD: {
        INTEL: { frequency: 10 },
        MARKET: { frequency: 50 },
        COORDINATION: { frequency: 5 }
    }
};
