module.exports = {
    getBuildPower: function(roomName) {
        let buildPower = 0;
        const roomCreeps = global.State.creepsByRoom.get(roomName);
        if (roomCreeps) {
            const workers = roomCreeps.get('worker');
            if (workers) {
                for (let w = 0; w < workers.length; w++) {
                    const worker = workers[w];
                    if (worker.body) {
                        for (let b = 0; b < worker.body.length; b++) {
                            if (worker.body[b].type === WORK) {
                                buildPower += BUILD_POWER;
                            }
                        }
                    }
                }
            }
        }
        if (buildPower === 0) buildPower = BUILD_POWER; // Default
        return buildPower;
    },

    run: function(room) {
        try {
            if (Game.time % 100 !== 0) return;
            if (!room.controller || room.controller.level < 2) return;

            // Single-Site Construction rule
            const sites = global.State.sitesByRoom.get(room.name);
            if (sites && sites.length > 0) return;

            const spawns = global.State.spawnsByRoom.get(room.name);
            if (!spawns || spawns.length === 0) return;

            const spawn = spawns[0];

            // Priority: RCL 3 Tower Defense
            if (room.controller.level >= 3) {
                const structuresMap = global.State.structuresByRoom.get(room.name);
                const towers = structuresMap ? (structuresMap.get(STRUCTURE_TOWER) || []) : [];

                if (towers.length === 0) {
                    const targetX = spawn.pos.x;
                    const targetY = spawn.pos.y - 2;

                    const structures = room.lookForAt(LOOK_STRUCTURES, targetX, targetY);
                    if (!structures || structures.length === 0) {
                        const createResult = room.createConstructionSite(targetX, targetY, STRUCTURE_TOWER);
                        if (createResult === OK) {
                            return; // Single-Site Construction rule
                        }
                    }
                }
            }

            const EXT_STAMP = [
                {x: 1, y: 1},
                {x: -1, y: -1},
                {x: 1, y: -1},
                {x: -1, y: 1},
                {x: 0, y: 2}
            ];

            for (let i = 0; i < EXT_STAMP.length; i++) {
                const offset = EXT_STAMP[i];
                const targetX = spawn.pos.x + offset.x;
                const targetY = spawn.pos.y + offset.y;

                const structures = room.lookForAt(LOOK_STRUCTURES, targetX, targetY);
                if (structures && structures.length > 0) continue;

                const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, targetX, targetY);
                if (sites && sites.length > 0) continue;

                room.createConstructionSite(targetX, targetY, STRUCTURE_EXTENSION);
            }
        } catch (e) {
            console.log(`[Planner Error] Room ${room.name}: ${e.stack}`);
        }
    }
};