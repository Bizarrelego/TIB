/**
 * Utility module for loading, compiling, and instantiating WebAssembly (.wasm) modules.
 * Ensures WASM instances are correctly loaded, cached, and available across the environment,
 * particularly after a global reset.
 */

const Logger = require('../../utils/logger');

// Global cache to persist compiled instances across ticks
global.WasmCache = global.WasmCache || new Map();

class WasmLoader {
    /**
     * Loads, compiles, and instantiates a WebAssembly module.
     * Caches the instance to avoid re-compilation on subsequent calls.
     *
     * @param {string} moduleName - The unique identifier for the module.
     * @param {string|Buffer|Uint8Array|WebAssembly.Module} pathOrCode - The WASM code, buffer, or module to instantiate.
     * @returns {Promise<WebAssembly.Instance|null>} A promise resolving to the instantiated WASM module, or null if it fails.
     */
    static async loadWasmModule(moduleName, pathOrCode) {
        if (global.WasmCache.has(moduleName)) {
            return global.WasmCache.get(moduleName);
        }

        if (!pathOrCode) {
            Logger.warn(`[WasmLoader] No code provided for module: ${moduleName}`);
            return null;
        }

        try {
            let instance;

            if (pathOrCode instanceof WebAssembly.Module) {
                // If it's already a compiled module
                instance = new WebAssembly.Instance(pathOrCode);
            } else if (pathOrCode instanceof WebAssembly.Instance) {
                // If it's already an instance
                instance = pathOrCode;
            } else {
                // Otherwise compile and instantiate
                const module = new WebAssembly.Module(pathOrCode);
                instance = new WebAssembly.Instance(module);
            }

            global.WasmCache.set(moduleName, instance);
            Logger.debug(`[WasmLoader] Successfully loaded WASM module: ${moduleName}`);
            return instance;
        } catch (error) {
            Logger.error(`[WasmLoader] Failed to load WASM module ${moduleName}: ${error.stack || error}`);
            return null;
        }
    }
}

module.exports = WasmLoader;
