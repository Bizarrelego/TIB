function initStructures() {
    if (global.State && global.State.getSegment) {
        try {
            const data = global.State.getSegment(0); // Use abstraction layer
            const structMap = new Map();
            for (const id in data) {
                structMap.set(id, data[id]);
            }
            global.Cache.set('structures', structMap);
        } catch (e) {
            console.log(`[CacheRegistry] Failed to load structures from segment 0: ${e.stack}`);
        }
    }
}
module.exports = { initStructures };
