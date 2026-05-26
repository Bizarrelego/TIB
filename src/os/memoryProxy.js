const objectPool = require('./objectPool');
const CreepMemorySchemaEnforcer = require('../utils/CreepMemorySchemaEnforcer');

Object.defineProperty(Creep.prototype, 'heap', {
    get() {
            const creepsCache = global.Cache ? global.Cache.get('creeps') : undefined;
            let memory = creepsCache ? creepsCache.get(this.name) : undefined;
        if (memory === undefined) {
            memory = objectPool.acquire('object');
                if (creepsCache) creepsCache.set(this.name, memory);
        }
        return memory;
    },
    configurable: true,
    enumerable: false
});

/**
 * Tracks the paths that have been modified.
 * @type {Set<string>}
 */
const modifiedPaths = new Set();

/**
 * Memoizes proxies to prevent double-proxying and garbage collection leaks.
 * @type {WeakMap<object, Proxy>}
 */
const proxyCache = new WeakMap();

/**
 * Creates a recursive proxy to track nested property changes.
 * @param {Object} target - The target object to proxy.
 * @param {string} [basePath=''] - The current base path in the memory tree.
 * @returns {Proxy|Object} The proxied object or original value if not an object.
 */
function createProxy(target, basePath = '') {
    if (typeof target !== 'object' || target === null) return target;
    if (proxyCache.has(target)) return proxyCache.get(target);

    const proxy = new Proxy(target, {
        get(obj, prop) {
            if (prop === '__isProxy') return true;
            const val = obj[prop];
            if (typeof val === 'object' && val !== null) {
                const path = basePath ? `${basePath}.${String(prop)}` : String(prop);
                return createProxy(val, path);
            }
            return val;
        },
        set(obj, prop, value) {
            const path = basePath ? `${basePath}.${String(prop)}` : String(prop);
            modifiedPaths.add(path);
            obj[prop] = value;
            return true;
        },
        deleteProperty(obj, prop) {
            const path = basePath ? `${basePath}.${String(prop)}` : String(prop);
            modifiedPaths.add(path);
            delete obj[prop];
            return true;
        }
    });

    proxyCache.set(target, proxy);
    proxyCache.set(proxy, proxy);
    return proxy;
}

/**
 * Installs the memory proxy on the global Memory object if it doesn't already exist.
 */
function installMemoryProxy() {
    if (typeof Memory !== 'undefined' && !Memory.__isProxy) {
        // We override the global Memory object to be a proxied version of itself
        global.Memory = createProxy(Memory);
    }
}

module.exports = {
    /**
     * Initializes the memory proxy.
     */
    init: installMemoryProxy,

    /**
     * Retrieves the array of paths that have been modified.
     * @returns {string[]} The array of modified paths.
     */
    getModifiedPaths: () => Array.from(modifiedPaths),

    /**
     * Clears the tracked modified paths.
     */
    clearModifiedPaths: () => modifiedPaths.clear(),

    /**
     * Serializes memory and enforces schema validation.
     */
    serialize: function serialize() {
        if (Game.time % 100 === 0) {
            CreepMemorySchemaEnforcer.validateAll();
        }
        if (typeof RawMemory !== 'undefined') {
            RawMemory._parsed = Memory;
        }
    }
};
