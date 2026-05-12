class CacheRegistryClass {
    constructor() {
        this.callbacks = new Map();
    }

    register(key, rehydrationFn) {
        this.callbacks.set(key, rehydrationFn);
    }

    runAll() {
        for (const [key, fn] of this.callbacks) {
            try {
                fn();
            } catch (e) {
                console.log(`[CacheRegistry Error] Failed to rehydrate ${key}: ${e.stack}`);
            }
        }
    }
}

const CacheRegistry = new CacheRegistryClass();

function cacheInit() {
    if (!global.Cache) {
        // Enforcing Map() for all dictionaries
        global.Cache = new Map();
        global.Cache.set('structures', new Map());
        global.Cache.set('creeps', new Map());
        global.Cache.set('sources', new Map());
    }

    if (!global.MemoryParsed) {
        global.MemoryParsed = new Map();
    } else {
        RawMemory._parsed = global.MemoryParsed;
    }
}

module.exports = {
    cacheInit,
    CacheRegistry
};
