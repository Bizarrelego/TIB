const objectPool = require('./objectPool');

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

module.exports = function installMemoryProxy() {
    // Initialization/Installation happens during require/execution.
};

module.exports.serialize = function serialize() {
    if (typeof RawMemory !== 'undefined') {
        RawMemory._parsed = Memory;
    }
};
