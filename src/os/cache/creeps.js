function initCreeps() {
    if (RawMemory.segments && RawMemory.segments[1]) {
        try {
            const data = JSON.parse(RawMemory.segments[1]);
            const creepsMap = new Map();
            for (const [key, value] of Object.entries(data)) {
                creepsMap.set(key, value);
            }
            global.Cache.set('creeps', creepsMap);
        } catch (e) {
            console.log(`[CacheRegistry] Failed to parse creeps from segment 1: ${e.stack}`);
        }
    }
}
module.exports = { initCreeps };
