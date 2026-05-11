module.exports = {
    run: function(room) {
        if (Game.time % 100 !== 0) return;
        if (!room.controller || room.controller.level < 2) return;

        const spawns = global.State.spawnsByRoom.get(room.name);
        if (!spawns || spawns.length === 0) return;

        const spawn = spawns[0];

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
    }
};