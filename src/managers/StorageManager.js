module.exports = {
    run: function(room, spawnLedger) {
        try {
            // Throttling: Check only every 100 ticks to save CPU
            if (Game.time % 100 !== 0) return;

            // Requires RCL 4 for Storage
            if (!room.controller || room.controller.level < 4) return;

            // Single-Site Construction Rule
            const sites = global.State.sitesByRoom.get(room.name);
            if (sites && sites.length > 0) return;

            const spawns = global.State.spawnsByRoom.get(room.name);
            if (!spawns || spawns.length === 0) return;

            const spawn = spawns[0];

            // Only attempt to build if we have some baseline energy available
            // (Just a basic check to prevent spamming sites when completely starved, though sites don't cost energy to place, the prompt mentions verifying energy availability)
            if (!spawnLedger.canSpawn(300)) return;

            const structuresMap = global.State.structuresByRoom.get(room.name);
            const storages = structuresMap ? (structuresMap.get(STRUCTURE_STORAGE) || []) : [];

            // If we already have a storage, nothing to do
            if (storages.length > 0) return;

            // Hardcoded offset for Storage relative to first spawn. Let's say (0, -2)
            // But wait, Tower might be at 0, -2. Let's look at Planner: Tower is at (0, -2).
            // Let's put Storage at (0, 2) instead. Planner puts extensions at (0, 2)?
            // EXT_STAMP in planner: [ {x: 1, y: 1}, {x: -1, y: -1}, {x: 1, y: -1}, {x: -1, y: 1}, {x: 0, y: 2} ]
            // Let's use (0, -3) or (2, 0) for storage. Let's use (2, 0).
            const targetX = spawn.pos.x + 2;
            const targetY = spawn.pos.y;

            // Verify coordinates with lookForAt to avoid blind placement
            const structures = room.lookForAt(LOOK_STRUCTURES, targetX, targetY);
            // Filter out walkable structures like roads and ramparts
            const blockingStructures = structures.filter(s => s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_RAMPART);
            if (blockingStructures.length > 0) return; // Something blocking is already here

            const existingSites = room.lookForAt(LOOK_CONSTRUCTION_SITES, targetX, targetY);
            if (existingSites && existingSites.length > 0) return;

            room.createConstructionSite(targetX, targetY, STRUCTURE_STORAGE);
        } catch (e) {
            console.log(`[StorageManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
};
