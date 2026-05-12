const { initStructures } = require('./cache/structures');
const { initCreeps } = require('./cache/creeps');

const CacheRegistry = new class {
    constructor() { this.callbacks = new Map([
        ['structures', initStructures],
        ['creeps', initCreeps]
    ]); }
    register(key, fn) { this.callbacks.set(key, fn); }
    runAll() {
        for (const [key, fn] of this.callbacks) {
            try { fn(); } catch (e) { console.log(`[CacheRegistry] ${key} failed: ${e.stack}`); }
        }
    }
};

function cacheInit() {
    try {
        if (!global.Cache) {
            global.Cache = new Map([
                ['structures', new Map()],
                ['creeps', new Map()],
                ['sources', new Map()]
            ]);
        }
    } catch (e) {
        console.log(`[Critical] Cache initialization failed: ${e.stack}`);
    }
}

module.exports = { cacheInit, CacheRegistry };
