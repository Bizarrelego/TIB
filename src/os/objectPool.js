/**
 * V8 Object Pooling Mechanism for GC Mitigation
 * Reuses frequently created short-lived objects.
 */
class ObjectPool {
    constructor() {
        this.types = new Map();

        // Register default pools
        this.register('array', () => [], (arr) => {
            arr.length = 0;
            return arr;
        });

        this.register('intent', () => ({}), (obj) => {
            for (const key in obj) {
                delete obj[key];
            }
            return obj;
        });

        this.register('object', () => ({}), (obj) => {
            for (const key in obj) {
                delete obj[key];
            }
            return obj;
        });
    }

    /**
     * Gets or initializes the pool storage from global.Cache
     * @returns {Map} The objectPools map
     */
    getPoolStorage() {
        if (!global.Cache) {
            // Fallback for isolated tests or early execution
            if (!this._fallbackCache) this._fallbackCache = new Map();
            return this._fallbackCache;
        }
        let pools = global.Cache.get('objectPools');
        if (!pools) {
            pools = new Map();
            global.Cache.set('objectPools', pools);
        }
        return pools;
    }

    /**
     * Registers a new type of object for pooling
     * @param {string} type - Identifier for the pool
     * @param {Function} factory - Function that creates a new instance
     * @param {Function} reset - Function that resets an instance for reuse
     */
    register(type, factory, reset) {
        this.types.set(type, { factory, reset });
        const pools = this.getPoolStorage();
        if (!pools.has(type)) {
            pools.set(type, []);
        }
    }

    /**
     * Acquires an object from the pool or creates a new one
     * @param {string} type - The type of object to acquire
     * @returns {any} The acquired object
     */
    acquire(type) {
        const typeInfo = this.types.get(type);
        if (!typeInfo) {
            throw new Error(`Unregistered object pool type: ${type}`);
        }

        const pools = this.getPoolStorage();
        let pool = pools.get(type);
        if (!pool) {
            pool = [];
            pools.set(type, pool);
        }

        if (pool.length > 0) {
            return pool.pop();
        }

        return typeInfo.factory();
    }

    /**
     * Releases an object back to the pool
     * @param {string} type - The type of object to release
     * @param {any} obj - The object to release
     */
    release(type, obj) {
        const typeInfo = this.types.get(type);
        if (!typeInfo) {
            throw new Error(`Unregistered object pool type: ${type}`);
        }

        const pools = this.getPoolStorage();
        let pool = pools.get(type);
        if (!pool) {
            pool = [];
            pools.set(type, pool);
        }

        pool.push(typeInfo.reset(obj));
    }
}

const objectPool = new ObjectPool();
module.exports = objectPool;
