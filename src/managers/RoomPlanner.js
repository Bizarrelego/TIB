const GameObjectUtility = require('../utilities/GameObjectUtility');

/**
 * Dynamic Room Planner
 * Generates terrain-aware blueprints with container, extension, tower, road,
 * and rampart placement for RCL 1-8 progression.
 */
class RoomPlanner {
    static run() {
        if (Game.cpu.bucket <= 500) return;
        if (Game.time % 50 !== 0) return;

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
        // Generate blueprint if it doesn't exist
        if (!global.Cache.blueprints.has(room.name)) {
            this.generateBlueprint(room);
        }

        // Throttle construction to save CPU and global site limits
        if (Game.time % 13 !== 0) return;
        if (Object.keys(Game.constructionSites).length > 50) return;

        this.executeBlueprint(room);
    }

    // ─── Blueprint Generation ───────────────────────────────────────────

    static generateBlueprint(room) {
        const terrain = Game.map.getRoomTerrain(room.name);
        const anchor = this.findAnchor(room, terrain);
        const state = global.State?.rooms?.get(room.name);

        const blueprint = {
            anchor: anchor,
            containers: [],
            roads: []
        };

        // 1. Stamp core structures (spawn, extensions, towers, storage, etc.)
        const stamp = this.applyStamp(anchor, terrain);
        for (const type in stamp) {
            blueprint[type] = stamp[type];
        }

        // 2. Plan containers at sources and controller
        if (state) {
            this.planContainers(blueprint, room, state, terrain);
        }

        // 3. Plan road spines from anchor to key locations
        if (state) {
            this.planRoads(blueprint, room, state, anchor);
        }

        // 4. Calculate rampart perimeter
        blueprint.ramparts = this.calculateChokepoints(terrain, anchor);

        global.Cache.blueprints.set(room.name, blueprint);
    }

    /**
     * Distance Transform to find the most open position in the room.
     * Used as the anchor point for the base stamp.
     */
    static findAnchor(room, terrain) {
        const dt = new PathFinder.CostMatrix();

        // Pass 1: Initialize
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL || x <= 2 || y <= 2 || x >= 47 || y >= 47) {
                    dt.set(x, y, 0);
                } else {
                    dt.set(x, y, 255);
                }
            }
        }

        // Pass 2: Top-Left to Bottom-Right
        for (let x = 1; x < 49; x++) {
            for (let y = 1; y < 49; y++) {
                if (dt.get(x, y) > 0) {
                    const min = Math.min(
                        dt.get(x - 1, y), dt.get(x, y - 1),
                        dt.get(x - 1, y - 1), dt.get(x + 1, y - 1)
                    );
                    dt.set(x, y, min + 1);
                }
            }
        }

        // Pass 3: Bottom-Right to Top-Left — find maximum
        let maxVal = 0;
        let anchor = { x: 25, y: 25 };

        for (let x = 48; x >= 1; x--) {
            for (let y = 48; y >= 1; y--) {
                if (dt.get(x, y) > 0) {
                    const min = Math.min(
                        dt.get(x + 1, y), dt.get(x, y + 1),
                        dt.get(x + 1, y + 1), dt.get(x - 1, y + 1)
                    );
                    const val = Math.min(dt.get(x, y), min + 1);
                    dt.set(x, y, val);

                    if (val > maxVal) {
                        maxVal = val;
                        anchor = { x, y };
                    }
                }
            }
        }

        return anchor;
    }

    /**
     * Applies a full RCL 1-8 stamp centered on anchor.
     * All positions are validated against terrain — walls are skipped.
     * Returns an object keyed by structure type with arrays of {x, y}.
     */
    static applyStamp(anchor, terrain) {
        const ax = anchor.x;
        const ay = anchor.y;

        // Full stamp layout — offsets from anchor
        const layout = {
            [STRUCTURE_SPAWN]: [
                {dx: 0, dy: -1},
                {dx: -3, dy: 0},
                {dx: 3, dy: 0}
            ],
            [STRUCTURE_STORAGE]: [{dx: 0, dy: 1}],
            [STRUCTURE_TOWER]: [
                {dx: -1, dy: 0}, {dx: 1, dy: 0},
                {dx: 0, dy: -2}, {dx: 0, dy: 2},
                {dx: -2, dy: -2}, {dx: 2, dy: -2}
            ],
            [STRUCTURE_TERMINAL]: [{dx: -1, dy: 1}],
            [STRUCTURE_FACTORY]: [{dx: 1, dy: 1}],
            [STRUCTURE_EXTENSION]: [
                // Inner ring (range 1-2) — 8 positions
                {dx: -1, dy: -1}, {dx: 1, dy: -1},
                {dx: -1, dy: -2}, {dx: 1, dy: -2},
                {dx: -2, dy: 0}, {dx: 2, dy: 0},
                {dx: -1, dy: 2}, {dx: 1, dy: 2},
                // Middle ring (range 2-3) — 12 positions
                {dx: -2, dy: -1}, {dx: 2, dy: -1},
                {dx: -2, dy: 1}, {dx: 2, dy: 1},
                {dx: -2, dy: -3}, {dx: 2, dy: -3},
                {dx: -3, dy: -1}, {dx: 3, dy: -1},
                {dx: -3, dy: 1}, {dx: 3, dy: 1},
                {dx: -2, dy: 2}, {dx: 2, dy: 2},
                // Outer ring (range 3-4) — 20 positions
                {dx: -3, dy: -2}, {dx: 3, dy: -2},
                {dx: -3, dy: 2}, {dx: 3, dy: 2},
                {dx: -4, dy: -1}, {dx: 4, dy: -1},
                {dx: -4, dy: 0}, {dx: 4, dy: 0},
                {dx: -4, dy: 1}, {dx: 4, dy: 1},
                {dx: -3, dy: -3}, {dx: 3, dy: -3},
                {dx: -3, dy: 3}, {dx: 3, dy: 3},
                {dx: -1, dy: 3}, {dx: 1, dy: 3},
                {dx: -2, dy: 3}, {dx: 2, dy: 3},
                {dx: 0, dy: 3}, {dx: 0, dy: -3},
                // Far ring (range 4-5) — 20 positions
                {dx: -4, dy: -2}, {dx: 4, dy: -2},
                {dx: -4, dy: 2}, {dx: 4, dy: 2},
                {dx: -4, dy: -3}, {dx: 4, dy: -3},
                {dx: -4, dy: 3}, {dx: 4, dy: 3},
                {dx: -5, dy: -1}, {dx: 5, dy: -1},
                {dx: -5, dy: 0}, {dx: 5, dy: 0},
                {dx: -5, dy: 1}, {dx: 5, dy: 1},
                {dx: -1, dy: 4}, {dx: 1, dy: 4},
                {dx: -2, dy: 4}, {dx: 2, dy: 4},
                {dx: 0, dy: 4}, {dx: 0, dy: -4}
            ],
            [STRUCTURE_LAB]: [
                {dx: -1, dy: -3}, {dx: 1, dy: -3},
                {dx: -2, dy: -2}, {dx: 2, dy: -2},
                {dx: -1, dy: -4}, {dx: 1, dy: -4},
                {dx: -2, dy: -4}, {dx: 2, dy: -4},
                {dx: 0, dy: -4}, {dx: 0, dy: -5}
            ]
        };

        const result = {};
        for (const structureType in layout) {
            const positions = [];
            const offsets = layout[structureType];
            for (let i = 0; i < offsets.length; i++) {
                const x = ax + offsets[i].dx;
                const y = ay + offsets[i].dy;
                // Validate: in bounds, not on wall, not on border
                if (x >= 2 && x <= 47 && y >= 2 && y <= 47) {
                    if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                        positions.push({ x, y });
                    }
                }
            }
            result[structureType] = positions;
        }

        return result;
    }

    // ─── Container Planning ─────────────────────────────────────────────

    /**
     * Plans container positions at each source and near the controller.
     * Source container: walkable tile adjacent to source, closest to spawn.
     * Controller container: walkable tile at range 3 from controller, closest to spawn.
     */
    static planContainers(blueprint, room, state, terrain) {
        const spawn = state.spawns?.[0];
        const spawnPos = spawn ? spawn.pos : new RoomPosition(blueprint.anchor.x, blueprint.anchor.y, room.name);

        // Source containers
        const sources = state.sources || [];
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            const bestTile = this.findBestAdjacentTile(source.pos, spawnPos, terrain, room.name, 1);
            if (bestTile) {
                blueprint.containers.push(bestTile);
            }
        }

        // Controller container
        if (state.controller) {
            const bestTile = this.findBestAdjacentTile(state.controller.pos, spawnPos, terrain, room.name, 3);
            if (bestTile) {
                blueprint.containers.push(bestTile);
            }
        }
    }

    /**
     * Finds the walkable tile within `range` of `targetPos` that is closest to `referencePos`.
     */
    static findBestAdjacentTile(targetPos, referencePos, terrain, roomName, range) {
        let bestTile = null;
        let bestDist = Infinity;

        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = targetPos.x + dx;
                const y = targetPos.y + dy;

                if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                // For range > 1, ensure tile is exactly at `range` Chebyshev distance
                const chebyshev = Math.max(Math.abs(dx), Math.abs(dy));
                if (range > 1 && chebyshev > range) continue;

                const dist = Math.abs(x - referencePos.x) + Math.abs(y - referencePos.y);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestTile = { x, y };
                }
            }
        }

        return bestTile;
    }

    // ─── Road Planning ──────────────────────────────────────────────────

    /**
     * Plans road spines from anchor to source containers and controller container.
     * Uses the engine's findPath for one-time pathfinding, cached in the blueprint.
     */
    static planRoads(blueprint, room, state, anchor) {
        const anchorPos = new RoomPosition(anchor.x, anchor.y, room.name);
        const targets = [];

        // Roads to each source container position
        for (let i = 0; i < blueprint.containers.length; i++) {
            targets.push(blueprint.containers[i]);
        }

        // Roads to controller if no container planned
        if (state.controller && blueprint.containers.length <= (state.sources?.length || 0)) {
            targets.push({ x: state.controller.pos.x, y: state.controller.pos.y });
        }

        for (let i = 0; i < targets.length; i++) {
            const targetPos = new RoomPosition(targets[i].x, targets[i].y, room.name);
            const path = room.findPath(anchorPos, targetPos, {
                ignoreCreeps: true,
                ignoreDestructibleStructures: true,
                swampCost: 2,
                maxOps: 2000
            });

            for (let j = 0; j < path.length; j++) {
                const step = path[j];
                // Don't place roads on border tiles
                if (step.x >= 2 && step.x <= 47 && step.y >= 2 && step.y <= 47) {
                    // Avoid duplicates
                    const exists = blueprint.roads.some(r => r.x === step.x && r.y === step.y);
                    if (!exists) {
                        blueprint.roads.push({ x: step.x, y: step.y });
                    }
                }
            }
        }
    }

    // ─── Rampart Chokepoints ────────────────────────────────────────────

    static calculateChokepoints(terrain, anchor) {
        const radius = 6;
        const ramparts = [];
        const visited = new Uint8Array(2500);
        const queue = [{x: anchor.x, y: anchor.y, dist: 0}];

        visited[anchor.x * 50 + anchor.y] = 1;

        while (queue.length > 0) {
            const current = queue.shift();

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

                if (nx <= 2 || nx >= 47 || ny <= 2 || ny >= 47) continue;

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

    // ─── Blueprint Execution ────────────────────────────────────────────

    /**
     * Places construction sites based on the blueprint and current RCL.
     * Build order: containers → extensions → towers → roads → spawns → ramparts.
     * Uses state scanner data instead of room.find() with filters.
     * Places up to 3 sites per tick for faster progression.
     */
    static executeBlueprint(room) {
        const blueprint = global.Cache.blueprints.get(room.name);
        if (!blueprint) return;

        const rcl = room.controller.level;
        const state = global.State?.rooms?.get(room.name);
        if (!state) return;

        let sitesPlaced = 0;
        const maxSitesPerTick = 3;

        // Build existing structures set for O(1) lookup
        const existingPositions = new Set();
        if (state.structureIds) {
            for (let i = 0; i < state.structureIds.length; i++) {
                const s = GameObjectUtility.getById(state.structureIds[i]);
                if (s) existingPositions.add(s.pos.x + '_' + s.pos.y + '_' + s.structureType);
            }
        }
        if (state.constructionSites) {
            for (let i = 0; i < state.constructionSites.length; i++) {
                const s = state.constructionSites[i];
                existingPositions.add(s.pos.x + '_' + s.pos.y + '_' + s.structureType);
            }
        }

        // 1. Containers first — critical for progression
        if (blueprint.containers && rcl >= 1) {
            const maxContainers = CONTROLLER_STRUCTURES[STRUCTURE_CONTAINER][rcl];
            let containerCount = state.containers ? state.containers.length : 0;
            // Count construction sites for containers
            if (state.constructionSites) {
                for (let i = 0; i < state.constructionSites.length; i++) {
                    if (state.constructionSites[i].structureType === STRUCTURE_CONTAINER) containerCount++;
                }
            }

            for (let i = 0; i < blueprint.containers.length && sitesPlaced < maxSitesPerTick; i++) {
                if (containerCount >= maxContainers) break;
                const pos = blueprint.containers[i];
                const key = pos.x + '_' + pos.y + '_' + STRUCTURE_CONTAINER;
                if (existingPositions.has(key)) continue;

                const code = room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
                if (code === OK) {
                    sitesPlaced++;
                    containerCount++;
                    existingPositions.add(key);
                }
            }
        }

        // 2. Extensions — unlock energy capacity
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_EXTENSION, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);

        // 3. Towers — defense
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_TOWER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);

        // 4. Spawns (2nd and 3rd)
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_SPAWN, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);

        // 5. Storage, Terminal, Factory
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_STORAGE, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_TERMINAL, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_FACTORY, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);

        // 6. Labs
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_LAB, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);

        // 7. Roads — quality of life
        if (blueprint.roads && rcl >= 2 && sitesPlaced < maxSitesPerTick) {
            let roadCount = 0;
            if (state.structureIds) {
                for (let i = 0; i < state.structureIds.length; i++) {
                    const s = GameObjectUtility.getById(state.structureIds[i]);
                    if (s && s.structureType === STRUCTURE_ROAD) roadCount++;
                }
            }
            if (state.constructionSites) {
                for (let i = 0; i < state.constructionSites.length; i++) {
                    if (state.constructionSites[i].structureType === STRUCTURE_ROAD) roadCount++;
                }
            }
            const maxRoads = CONTROLLER_STRUCTURES[STRUCTURE_ROAD][rcl];

            for (let i = 0; i < blueprint.roads.length && sitesPlaced < maxSitesPerTick; i++) {
                if (roadCount >= maxRoads) break;
                const pos = blueprint.roads[i];
                const key = pos.x + '_' + pos.y + '_' + STRUCTURE_ROAD;
                if (existingPositions.has(key)) continue;

                const code = room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD);
                if (code === OK) {
                    sitesPlaced++;
                    roadCount++;
                    existingPositions.add(key);
                }
            }
        }

        // 8. Ramparts (RCL 4+)
        if (rcl >= 4 && blueprint.ramparts && sitesPlaced < maxSitesPerTick) {
            for (let i = 0; i < blueprint.ramparts.length && sitesPlaced < maxSitesPerTick; i++) {
                const pos = blueprint.ramparts[i];
                const key = pos.x + '_' + pos.y + '_' + STRUCTURE_RAMPART;
                if (existingPositions.has(key)) continue;

                const code = room.createConstructionSite(pos.x, pos.y, STRUCTURE_RAMPART);
                if (code === OK) {
                    sitesPlaced++;
                    existingPositions.add(key);
                }
            }
        }
    }

    /**
     * Generic structure placement helper.
     * Returns the number of sites placed.
     */
    static placeStructureType(room, blueprint, structureType, rcl, existingPositions, state, maxToPlace) {
        if (maxToPlace <= 0) return 0;
        const positions = blueprint[structureType];
        if (!positions || positions.length === 0) return 0;

        const maxAllowed = CONTROLLER_STRUCTURES[structureType][rcl];
        if (maxAllowed === 0) return 0;

        // Count existing + planned
        let count = 0;
        if (state.structureIds) {
            for (let i = 0; i < state.structureIds.length; i++) {
                const s = GameObjectUtility.getById(state.structureIds[i]);
                if (s && s.structureType === structureType) count++;
            }
        }
        if (state.constructionSites) {
            for (let i = 0; i < state.constructionSites.length; i++) {
                if (state.constructionSites[i].structureType === structureType) count++;
            }
        }

        let placed = 0;
        for (let i = 0; i < positions.length && placed < maxToPlace; i++) {
            if (count >= maxAllowed) break;
            const pos = positions[i];
            const key = pos.x + '_' + pos.y + '_' + structureType;
            if (existingPositions.has(key)) continue;

            const code = room.createConstructionSite(pos.x, pos.y, structureType);
            if (code === OK) {
                placed++;
                count++;
                existingPositions.add(key);
            }
        }
        return placed;
    }
}

module.exports = RoomPlanner;