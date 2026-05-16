class GlobalStateManager {
    constructor() {
        this.heapCache = new Map();
        this.isRehydrated = false;
        this.managers = new Map();
    }

    registerManager(name, instance) {
        this.managers.set(name, instance);
    }

    getManager(name) {
        return this.managers.get(name);
    }

    rehydrate() {
        if (this.isRehydrated) return;

        if (typeof RawMemory !== 'undefined' && RawMemory.segments) {
            for (const segmentId in RawMemory.segments) {
                const segmentData = RawMemory.segments[segmentId];
                if (segmentData) {
                    try {
                        const parsed = JSON.parse(segmentData);
                        if (typeof parsed === 'object' && parsed !== null) {
                            for (const key in parsed) {
                                this.heapCache.set(key, parsed[key]);
                            }
                        }
                    } catch (e) {
                        this.heapCache.set(`segment_${segmentId}`, segmentData);
                    }
                }
            }
        }

        // IMPROVEMENT: Guarantee heap object initialization via proxy for all creeps.
        // Reason: Prevents undefined reading in DeadlockEngine and TrafficManager if a creep's heap hasn't been accessed yet this tick.
        if (typeof Game !== 'undefined' && Game.creeps) {
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep) {
                    // Just accessing the property triggers the getter in memoryProxy.js
                    // which sets up the object in the cache registry if it doesn't exist.
                    // eslint-disable-next-line no-unused-expressions
                    creep.heap;
                }
            }
        }

        this.isRehydrated = true;
    }

    read(key) {
        return this.heapCache.get(key);
    }

    write(key, data) {
        this.heapCache.set(key, data);
    }
}

module.exports = new GlobalStateManager();
