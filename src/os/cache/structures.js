function initStructures() {
    if (RawMemory.segments && RawMemory.segments[0]) {
        try {
            const data = JSON.parse(RawMemory.segments[0]);
            global.Cache.set('structures', new Map(Object.entries(data)));
        } catch (e) {
            console.log(`[CacheRegistry] Failed to parse structures from segment 0: ${e.stack}`);
        }
    }
}
module.exports = { initStructures };
