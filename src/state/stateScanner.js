module.exports = function stateScanner() {
    // Clear dynamic maps each tick
    global.Cache.creeps.clear();
    global.Cache.structures.clear();

    // Iterate Game.creeps once
    const creepNames = Object.keys(Game.creeps);
    for (let i = 0; i < creepNames.length; i++) {
        const creep = Game.creeps[creepNames[i]];
        // Assuming we categorize by role or some other state later, for now just store by name
        global.Cache.creeps.set(creep.name, creep);
    }

    // Iterate Game.structures once
    const structureIds = Object.keys(Game.structures);
    for (let i = 0; i < structureIds.length; i++) {
        const structure = Game.structures[structureIds[i]];
        global.Cache.structures.set(structure.id, structure);

        // Example: grouping by room could be done here as well
        /*
        if (!global.Cache.rooms.has(structure.room.name)) {
            global.Cache.rooms.set(structure.room.name, { structures: new Map() });
        }
        global.Cache.rooms.get(structure.room.name).structures.set(structure.id, structure);
        */
    }
};
