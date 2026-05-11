function run(room) {
    // Throttle execution: run only once every 100 ticks
    if (Game.time % 100 !== 0) return;

    try {
        // Enforce Single-Site Construction rule
        if (!global.State || !global.State.sitesByRoom) return;
        const existingSites = global.State.sitesByRoom.get(room.name) || [];
        if (existingSites.length > 0) return;

        if (!global.State.spawnsByRoom) return;
        const spawns = global.State.spawnsByRoom.get(room.name) || [];
        if (spawns.length === 0) return;
        const spawn = spawns[0];

        const destinations = [];

        // Add Sources to destinations
        const sources = global.State.sourcesByRoom ? (global.State.sourcesByRoom.get(room.name) || []) : [];
        for (let i = 0; i < sources.length; i++) {
            destinations.push(sources[i]);
        }

        // Add Controller to destinations
        if (room.controller) {
            destinations.push(room.controller);
        }

        // Add Minerals to destinations
        const minerals = global.State.mineralsByRoom ? (global.State.mineralsByRoom.get(room.name) || []) : [];
        for (let i = 0; i < minerals.length; i++) {
            destinations.push(minerals[i]);
        }

        // Calculate paths and attempt to place a road site
        for (let i = 0; i < destinations.length; i++) {
            const dest = destinations[i];
            const pathInfo = PathFinder.search(
                spawn.pos,
                { pos: dest.pos, range: 1 },
                {
                    plainCost: 2,
                    swampCost: 2, // Prefer roads or open plains equally for road planning
                    roomCallback: function() {
                        return new PathFinder.CostMatrix(); // Very basic matrix for now
                    }
                }
            );

            for (let j = 0; j < pathInfo.path.length; j++) {
                const pos = pathInfo.path[j];

                // Do not place roads on room boundaries (can cause issues)
                if (pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49) continue;

                const structures = room.lookForAt(LOOK_STRUCTURES, pos);
                let hasRoad = false;
                for (let k = 0; k < structures.length; k++) {
                    if (structures[k].structureType === STRUCTURE_ROAD) {
                        hasRoad = true;
                        break;
                    }
                }

                if (!hasRoad) {
                    const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos);
                    let hasSite = false;
                    for (let k = 0; k < sites.length; k++) {
                        if (sites[k].structureType === STRUCTURE_ROAD) {
                            hasSite = true;
                            break;
                        }
                    }

                    if (!hasSite) {
                        const result = room.createConstructionSite(pos, STRUCTURE_ROAD);
                        if (result === OK) {
                            // Successfully placed exactly one site; break out to enforce Single-Site Construction
                            return;
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.log(`[RoadManager Error] Room ${room.name}: ${e.stack}`);
    }
}

module.exports = { run };