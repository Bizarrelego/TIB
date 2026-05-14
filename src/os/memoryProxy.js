/**
 * @typedef {Object} GlobalState
 * @property {Readonly<Object<string, Room>>} rooms Read-only proxy of Game.rooms
 * @property {Readonly<Object<string, Creep>>} creeps Read-only proxy of Game.creeps
 * @property {Readonly<Object<string, Structure>>} structures Read-only proxy of Game.structures
 * @property {function(): void} rehydrate Hydrates heap cache from RawMemory segments
 */

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

/**
 * Creates a read-only proxy for a Game object.
 * @param {Object} targetObj
 * @returns {Proxy}
 */
function createReadOnlyProxy(targetObj) {
    return new Proxy(targetObj, {
        get(target, prop) {
            return Reflect.get(target, prop);
        },
        set(target, prop, value) {
            console.log(`[MemoryProxy] Attempted to set read-only property ${prop}`);
            return false;
        },
        deleteProperty(target, prop) {
            console.log(`[MemoryProxy] Attempted to delete read-only property ${prop}`);
            return false;
        }
    });
}

module.exports = function installMemoryProxy() {
    if (!global.State) {
        global.State = {};
    }

    if (!global.State.rooms) {
        global.State.rooms = createReadOnlyProxy(Game.rooms);
    }
    if (!global.State.creeps) {
        global.State.creeps = createReadOnlyProxy(Game.creeps);
    }
    if (!global.State.structures) {
        global.State.structures = createReadOnlyProxy(Game.structures);
    }

    if (!global.State.rehydrate) {
        global.State.rehydrate = function() {
            if (RawMemory.segments && RawMemory.segments[0]) {
                try {
                    const parsed = JSON.parse(RawMemory.segments[0]);
                    if (parsed.creeps) {
                        for (const key of Object.keys(parsed.creeps)) {
                            global.Cache.creeps.set(key, parsed.creeps[key]);
                        }
                    }
                    if (parsed.rooms) {
                        for (const key of Object.keys(parsed.rooms)) {
                            global.Cache.rooms.set(key, parsed.rooms[key]);
                        }
                    }
                } catch (e) {
                    console.log(`[MemoryProxy] Failed to rehydrate from RawMemory: ${e.message}`);
                }
            }
        };
    }
};
