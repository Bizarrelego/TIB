// IMPROVEMENT: Replaces CPU-heavy lookAt loops with one-time CostMatrix Distance Transforms.
// IMPROVEMENT: Caches the entire room blueprint to eliminate tick-by-tick planning CPU overhead.
// IMPROVEMENT: Uses a bounding flood-fill to dynamically generate rampart chokepoints.

class RoomPlanner {
    static run() {
        if (Game.cpu.bucket <= 500) return;
        if (Game.time % 100 !== 0) return;

        if (!global.Cache) global.Cache = { blueprints: new Map() };
        if (!(global.Cache.blueprints instanceof Map)) global.Cache.blueprints = new Map();

        const visibleRooms = Object.keys(Game.rooms);
        for (let i = 0; i < visibleRooms.length; i++) {
            const room = Game.rooms[visibleRooms[i]];
            if (room.controller && room.controller.my) {
                this.manageRoom(room);
            }
        }
    }

    static manageRoom(room) {
        // 1. Generate Blueprint if it doesn't exist
        if (!global.Cache.blueprints.has(room.name)) {
            this.generateTerrainBlueprint(room);
        }

        // 2. Throttle construction to save CPU and global site limits
        if (Game.time % 13 !== 0) return; 
        if (Object.keys(Game.constructionSites).length > 50) return;

        // 3. Execute Blueprint based on current RCL
        this.executeBlueprint(room);
    }

    static generateTerrainBlueprint(room) {
        const terrain = Game.map.getRoomTerrain(room.name);
        const dt = new PathFinder.CostMatrix();

        // Pass 1: Initialize DT
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                    dt.set(x, y, 0);
                } else {
                    // Edges count as walls for base planning to prevent border exposure
                    if (x === 0 || y === 0 || x === 49 || y === 49) dt.set(x, y, 0);
                    else dt.set(x, y, 255);
                }
            }
        }

        // Pass 2: Top-Left to Bottom-Right
        for (let x = 1; x < 49; x++) {
            for (let y = 1; y < 49; y++) {
                if (dt.get(x, y) > 0) {
                    const min = Math.min(dt.get(x - 1, y), dt.get(x, y - 1), dt.get(x - 1, y - 1), dt.get(x + 1, y - 1));
                    dt.set(x, y, min + 1);
                }
            }
        }

        // Pass 3: Bottom-Right to Top-Left
        let maxVal = 0;
        let anchor = { x: 25, y: 25 };

        for (let x = 48; x >= 1; x--) {
            for (let y = 48; y >= 1; y--) {
                if (dt.get(x, y) > 0) {
                    const min = Math.min(dt.get(x + 1, y), dt.get(x, y + 1), dt.get(x + 1, y + 1), dt.get(x - 1, y + 1));
                    const val = Math.min(dt.get(x, y), min + 1);
                    dt.set(x, y, val);

                    if (val > maxVal) {
                        maxVal = val;
                        anchor = { x, y };
                    }
                }
            }
        }

        // Generate Blueprint object based on the optimal anchor
        const blueprint = this.applyStamp(anchor);
        blueprint.ramparts = this.calculateChokepoints(terrain, anchor);
        
        global.Cache.blueprints.set(room.name, blueprint);
    }

    static applyStamp(anchor) {
        // High-efficiency bunker/cross stamp design. 
        // dx/dy offsets from anchor.
        const layout = {
            [STRUCTURE_SPAWN]: [{dx: 0, dy: -1}],
            [STRUCTURE_STORAGE]: [{dx: 0, dy: 1}],
            [STRUCTURE_TOWER]: [{dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -2}],
            [STRUCTURE_EXTENSION]: [
                {dx: -1, dy: -1}, {dx: 1, dy: -1}, {dx: -1, dy: 1}, {dx: 1, dy: 1},
                {dx: -2, dy: -2}, {dx: 2, dy: -2}, {dx: -2, dy: 2}, {dx: 2, dy: 2},
                {dx: -2, dy: -1}, {dx: 2, dy: -1}, {dx: -2, dy: 1}, {dx: 2, dy: 1},
                {dx: -1, dy: -2}, {dx: 1, dy: -2}, {dx: -1, dy: 2}, {dx: 1, dy: 2}
                // Add more as needed for RCL 8 (up to 60)
            ]
        };

        const parsedBlueprint = {};
        for (const [structureType, offsets] of Object.entries(layout)) {
            parsedBlueprint[structureType] = offsets.map(pos => ({
                x: anchor.x + pos.dx,
                y: anchor.y + pos.dy
            }));
        }
        return parsedBlueprint;
    }

    static calculateChokepoints(terrain, anchor) {
        // Flood-fill outward to radius 6 to find perimeter walls
        const radius = 6;
        const ramparts = [];
        const visited = new Uint8Array(2500); // Flat array 50x50 cache
        const queue = [{x: anchor.x, y: anchor.y, dist: 0}];
        
        visited[anchor.x * 50 + anchor.y] = 1;

        while (queue.length > 0) {
            const current = queue.shift();

            // If we hit the boundary distance, it's a perimeter tile. 
            // If it's not a wall, it needs a rampart.
            if (current.dist === radius) {
                if (terrain.get(current.x, current.y) !== TERRAIN_MASK_WALL) {
                    ramparts.push({x: current.x, y: current.y});
                }
                continue;
            }

            const neighbors = [
                {x: current.x, y: current.y - 1}, {x: current.x + 1, y: current.y},
                {x: current.x, y: current.y + 1}, {x: current.x - 1, y: current.y}
            ];

            for (let i = 0; i < neighbors.length; i++) {
                const nx = neighbors[i].x;
                const ny = neighbors[i].y;

                if (nx <= 2 || nx >= 47 || ny <= 2 || ny >= 47) continue; // Keep away from exits
                
                const idx = nx * 50 + ny;
                if (!visited[idx]) {
                    visited[idx] = 1;
                    if (terrain.get(nx, ny) !== TERRAIN_MASK_WALL) {
                        queue.push({x: nx, y: ny, dist: current.dist + 1});
                    }
                }
            }
        }
        return ramparts;
    }

    static executeBlueprint(room) {
        const blueprint = global.Cache.blueprints.get(room.name);
        const rcl = room.controller.level;

        // Order of construction priority
        const buildOrder = [STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_ROAD];
        
        // Place structures
        for (let i = 0; i < buildOrder.length; i++) {
            const type = buildOrder[i];
            const maxAllowed = CONTROLLER_STRUCTURES[type][rcl];
            const plannedPositions = blueprint[type] || [];

            let currentBuiltOrPlanned = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === type }).length +
                                        room.find(FIND_MY_CONSTRUCTION_SITES, { filter: s => s.structureType === type }).length;

            for (let j = 0; j < plannedPositions.length; j++) {
                if (currentBuiltOrPlanned >= maxAllowed) break;

                const pos = plannedPositions[j];
                const code = room.createConstructionSite(pos.x, pos.y, type);
                
                if (code === OK) {
                    currentBuiltOrPlanned++;
                    return; // Throttle to 1 site placed per tick
                }
            }
        }

        // Place Ramparts (RCL 4+)
        if (rcl >= 4 && blueprint.ramparts) {
            for (let i = 0; i < blueprint.ramparts.length; i++) {
                const pos = blueprint.ramparts[i];
                const code = room.createConstructionSite(pos.x, pos.y, STRUCTURE_RAMPART);
                if (code === OK) return;
            }
        }
    }
}
module.exports = RoomPlanner;