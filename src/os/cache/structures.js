function initStructures() {
    if (RawMemory.segments && RawMemory.segments[0]) {
        try {
            const data = JSON.parse(RawMemory.segments[0]);
            const structuresMap = new Map();
            for (const [key, value] of Object.entries(data)) {
                structuresMap.set(key, value);
            }
            global.Cache.set('structures', structuresMap);
        } catch (e) {
            console.log(`[CacheRegistry] Failed to parse structures from segment 0: ${e.stack}`);
        }
    }
}
module.exports = { initStructures };
