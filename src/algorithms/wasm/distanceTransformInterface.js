/**
 * Wasm Interface for Distance Transform
 */

let wasmModule = null;

try {
    // Attempt to load the Wasm module if it's available in the environment
    const wasmCode = require('./distanceTransform.wasm');
    if (wasmCode) {
        const wasmInstance = new WebAssembly.Instance(new WebAssembly.Module(wasmCode));
        wasmModule = wasmInstance.exports;
    }
} catch (e) {
    // Wasm not available or failed to load, handled gracefully
}

class DistanceTransformInterface {
    /**
     * Compute a distance transform from a set of target points using Wasm.
     * The Wasm module should be able to process a raw terrain array or a boolean occupancy grid.
     *
     * @param {string} roomName
     * @param {CostMatrix} initialMatrix 255 = unwalkable, 0 = walkable
     * @returns {CostMatrix|null} The distance transform or null if Wasm is unavailable
     */
    static computeWasm(roomName, initialMatrix) {
        if (!wasmModule || !wasmModule.compute) {
            return null; // Fallback to JS implementation
        }

        // Future integration point for passing arrays/matrices to Wasm memory
        // and retrieving the resulting distance transform matrix.

        try {
            return wasmModule.compute(roomName, initialMatrix);
        } catch (e) {
            // Ignore error
            return null;
        }
    }
}

module.exports = DistanceTransformInterface;
