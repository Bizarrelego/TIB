/**
 * Wasm Interface for Min-Cut
 */

const WasmLoader = require('./WasmLoader');

let wasmModule = null;

class MinCutInterface {
    /**
     * Initializes the WASM module.
     * @returns {Promise<void>}
     */
    static async init() {
        if (wasmModule) return;

        let wasmCode;
        try {
            wasmCode = require('./minCut.wasm');
        } catch (e) {
            // Wasm not available
            return;
        }

        const instance = await WasmLoader.loadWasmModule('minCut', wasmCode);
        if (instance) {
            wasmModule = instance.exports;
        }
    }

    /**
     * @param {string} roomName
     * @param {Object[]} sources
     * @param {CostMatrix} bounds
     * @returns {RoomPosition[]|null}
     */
    static getCutTilesWasm(roomName, sources, bounds) {
        if (!wasmModule || !wasmModule.getCutTiles) {
            return null; // Fallback to JS implementation
        }

        // Future integration point for passing arrays/matrices to Wasm memory
        // and retrieving the resulting cut tiles.

        try {
            return wasmModule.getCutTiles(roomName, sources, bounds);
        } catch (e) {
            // Ignore error
            return null;
        }
    }
}

module.exports = MinCutInterface;
