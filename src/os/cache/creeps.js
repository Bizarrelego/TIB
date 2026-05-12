function initCreeps() {
    if (global.State && global.State.getSegment) {
        try {
            const data = global.State.getSegment(1); // Use abstraction layer
            const creepMap = new Map();
            for (const id in data) {
                creepMap.set(id, data[id]);
            }
            global.Cache.set('creeps', creepMap);
        } catch (e) {
            console.log(`[CacheRegistry] Failed to load creeps from segment 1: ${e.stack}`);
        }
    }
}
module.exports = { initCreeps };
