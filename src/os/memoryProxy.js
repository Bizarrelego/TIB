Object.defineProperty(Creep.prototype, 'heap', {
    get() {
            const creepsCache = global.Cache ? global.Cache.get('creeps') : undefined;
            let memory = creepsCache ? creepsCache.get(this.name) : undefined;
        if (memory === undefined) {
            memory = {};
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
