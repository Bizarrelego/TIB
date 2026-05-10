module.exports = function cacheInit() {
    // Initialize global.Cache if it doesn't exist
    if (!global.Cache) {
        global.Cache = {
            structures: new Map(),
            distances: new Map(),
            creeps: new Map(),
            rooms: new Map()
        };
    }

    // Hijack RawMemory._parsed to persist object references across ticks
    // This avoids JSON.parse overhead when memory hasn't changed.
    if (!global.MemoryParsed) {
        if (RawMemory._parsed) {
            global.MemoryParsed = RawMemory._parsed;
        } else {
            global.MemoryParsed = JSON.parse(RawMemory.get() || "{}");
            RawMemory._parsed = global.MemoryParsed;
        }
    } else {
        RawMemory._parsed = global.MemoryParsed;
    }
};
