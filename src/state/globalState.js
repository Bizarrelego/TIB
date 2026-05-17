class GlobalStateManager {
    constructor() {
        this.heapCache = new Map();
        this.isRehydrated = false;
        this.managers = new Map();
        this.creepsByRole = new Map();
        this.creepsByRoom = new Map();
        this.structuresByRoom = new Map();
        this.hostilesByRoom = new Map();
        this.logisticsByRoom = new Map();
        this.creepLookup = new Map();
        this.sourcesByRoom = new Map();
        this.spawnsByRoom = new Map();
        this.controllersByRoom = new Map();
        this.sitesByRoom = new Map();
        this.mineralsByRoom = new Map();
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

    get(key) {
        return this.heapCache.get(key);
    }

    set(key, value) {
        this.heapCache.set(key, value);
    }

    has(key) {
        return this.heapCache.has(key);
    }

    delete(key) {
        this.heapCache.delete(key);
    }

    scan() {
        // Tick slicing state scanner entry point
    }
}

module.exports = new GlobalStateManager();
