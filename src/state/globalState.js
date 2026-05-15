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
