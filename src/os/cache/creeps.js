function initCreeps() {
    if (RawMemory.segments && RawMemory.segments[1]) {
        try {
            const data = JSON.parse(RawMemory.segments[1]);
            // Use Map constructor with entry mapping for speed
            global.Cache.set('creeps', new Map(Object.entries(data)));
        } catch (e) {
            console.log(`[CacheRegistry] Failed to parse creeps from segment 1: ${e.stack}`);
        }
    }
}
module.exports = { initCreeps };
