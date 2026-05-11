Object.defineProperty(Creep.prototype, 'heap', {
    get() {
        let memory = global.Cache.creeps.get(this.name);
        if (memory === undefined) {
            memory = {};
            global.Cache.creeps.set(this.name, memory);
        }
        return memory;
    },
    configurable: true,
    enumerable: false
});

module.exports = function installMemoryProxy() {
    // Initialization/Installation happens during require/execution.
};
