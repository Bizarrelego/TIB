module.exports = function stateScanner() {
    // Reap global.Cache.creeps
    for (const name of global.Cache.creeps.keys()) {
        if (!Game.creeps[name]) {
            global.Cache.creeps.delete(name);
        }
    }

    // Update global.Cache.creeps
    const creepNames = Object.keys(Game.creeps);
    for (let i = 0; i < creepNames.length; i++) {
        const name = creepNames[i];
        let memory = global.Cache.creeps.get(name);
        if (!memory) {
            memory = {};
            global.Cache.creeps.set(name, memory);
        }
        memory._creep = Game.creeps[name];
    }

    // Reap global.Cache.structures
    for (const id of global.Cache.structures.keys()) {
        if (!Game.structures[id]) {
            global.Cache.structures.delete(id);
        }
    }

    // Update global.Cache.structures
    const structureIds = Object.keys(Game.structures);
    for (let i = 0; i < structureIds.length; i++) {
        const id = structureIds[i];
        let memory = global.Cache.structures.get(id);
        if (!memory) {
            memory = {};
            global.Cache.structures.set(id, memory);
        }
        memory._structure = Game.structures[id];
    }
};
