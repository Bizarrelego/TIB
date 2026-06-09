/**
 * Production-Grade Room Planner v5 — Diamond Bunker
 *
 * Pipeline:
 *  1. findAnchor        — Distance transform; anchor nudged to road parity.
 *  2. applyCoreStamp    — Hardcoded Core Hub (storage, terminal, factory,
 *                         3 spawns, 6 towers, power spawn, observer, nuker).
 *  3. applyLabStamp     — 2+8 lab cluster (4-quadrant, contiguous only).
 *  4. fillBaseDiamond   — BFS outward from anchor in Manhattan-distance order.
 *                         Checkerboard parity rule: road-parity tiles → road,
 *                         extension-parity tiles → extension. Stops at 60 exts.
 *                         Produces a compact, dense diamond — identical in
 *                         style to the classic Screeps bunker layout.
 *  5. planContainers    — Source + controller containers.
 *  6. planRoads         — Checkerboard is already the internal road grid;
 *                         PathFinder only routes to external resources.
 *  7. computeMinCut     — Dinic’s max-flow for true min-cut. Filters out
 *                         natural terrain walls (free, permanent defense)
 *                         so ramparts only cover open-terrain gaps.
 *  8. addRoadRamparts   — 3-deep road exit airlocks.
 *  9. addOutpostRamparts— Tight rampart rings for external resources.
 */

class RoomPlanner {

    static run() {
        if (Game.cpu.bucket <= 500) return;
        // if (Game.time % 50 !== 0) return; // Temporarily disabled for debugging
        if (!global.Cache) global.Cache = { blueprints: new Map() };
        if (!(global.Cache.blueprints instanceof Map)) global.Cache.blueprints = new Map();
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) this.manageRoom(room);
        }
    }

    static manageRoom(room) {
        if (!global.Cache) global.Cache = { blueprints: new Map() };
        if (!(global.Cache.blueprints instanceof Map)) global.Cache.blueprints = new Map();

        if (!global.Cache.blueprints.has(room.name) || room.memory.plannedRcl !== room.controller.level) {
            this.generateBlueprint(room);
            room.memory.plannedRcl = room.controller.level;
        }
    }

    // ─── Pipeline ────────────────────────────────────────────────────────

    static generateBlueprint(room) {
        const terrain = Game.map.getRoomTerrain(room.name);
        const state = global.State?.rooms?.get(room.name);

        const blueprint = {
            anchor: null,
            containers: [],
            roads: [],
            ramparts: [],
            outpostRamparts: [],
            supplierLabs: [],
            [STRUCTURE_SPAWN]: [],
            [STRUCTURE_EXTENSION]: [],
            [STRUCTURE_TOWER]: [],
            [STRUCTURE_STORAGE]: [],
            [STRUCTURE_TERMINAL]: [],
            [STRUCTURE_FACTORY]: [],
            [STRUCTURE_LAB]: [],
            [STRUCTURE_OBSERVER]: [],
            [STRUCTURE_NUKER]: [],
            [STRUCTURE_POWER_SPAWN]: [],
            [STRUCTURE_LINK]: []
        };

        // Step 1: Anchor
        let anchor = this.findAnchor(room, terrain);
        blueprint.anchor = anchor;

        const visited = new Uint8Array(2500);
        const fragmentCenters = [];

        console.log(`[RoomPlanner] Generating new blueprint for room ${room.name}...`);

        // Step 2: Fast Filler Stamp
        this.applyFastFillerStamp(blueprint, terrain, anchor, visited);
        fragmentCenters.push({ x: anchor.x, y: anchor.y });
        console.log(`[RoomPlanner] Fast Filler packed at anchor: ${anchor.x}, ${anchor.y}`);

        // Step 3: Core Hub Stamp
        const coreCenter = this.applyCoreStamp(blueprint, terrain, anchor, visited);
        if (coreCenter) {
            fragmentCenters.push(coreCenter);
            console.log(`[RoomPlanner] Core Hub packed at: ${coreCenter.x}, ${coreCenter.y}`);
        } else console.log(`[RoomPlanner] WARNING: Failed to find space for Core Hub!`);

        // Step 4: Tower Stamp
        const towerCenter = this.applyTowerStamp(blueprint, terrain, anchor, visited);
        if (towerCenter) {
            fragmentCenters.push(towerCenter);
            console.log(`[RoomPlanner] Tower Array packed at: ${towerCenter.x}, ${towerCenter.y}`);
        } else console.log(`[RoomPlanner] WARNING: Failed to find space for Tower Array!`);

        // Step 5: Lab cluster
        const labCenter = this.applyLabStamp(blueprint, terrain, anchor, visited);
        if (labCenter) {
            fragmentCenters.push(labCenter);
            console.log(`[RoomPlanner] Lab Cluster packed at: ${labCenter.x}, ${labCenter.y}`);
        } else console.log(`[RoomPlanner] WARNING: Failed to find space for Lab Cluster!`);

        // Step 6: Extension Clusters (Plus-sign grids)
        const extensionCenters = this.applyExtensionClusters(blueprint, terrain, anchor, visited);
        for (let i = 0; i < extensionCenters.length; i++) fragmentCenters.push(extensionCenters[i]);
        console.log(`[RoomPlanner] Packed ${extensionCenters.length} extension clusters.`);

        // Step 5: Source + controller containers
        if (state) this.planContainers(blueprint, room, state, terrain);

        // Step 6: External road routes and fragment connections
        if (state) this.planRoads(blueprint, room, state, anchor, fragmentCenters);

        // Step 7: Min-Cut Ramparts
        blueprint.ramparts = this.computeMinCut(terrain, visited);

        // Step 8: Road exit airlocks (3-deep)
        this.addRoadRamparts(blueprint);

        // Step 9: Outpost ramparts for external resources
        if (state) this.addOutpostRamparts(blueprint, terrain, state);

        // Step 10: Rampart roads for defender mobility
        this.addRampartRoads(blueprint);

        // Step 11: Extractor
        if (state && state.mineral) {
            blueprint[STRUCTURE_EXTRACTOR] = blueprint[STRUCTURE_EXTRACTOR] || [];
            blueprint[STRUCTURE_EXTRACTOR].push({ x: state.mineral.pos.x, y: state.mineral.pos.y });
        }

        // Step 12: Precompile Sets for Visualizer
        const supplierSet = new Uint8Array(2500);
        for (let i = 0; i < blueprint.supplierLabs.length; i++) supplierSet[blueprint.supplierLabs[i].x * 50 + blueprint.supplierLabs[i].y] = 1;
        blueprint.supplierSet = supplierSet;

        const roadSet = new Uint8Array(2500);
        for (let i = 0; i < blueprint.roads.length; i++) roadSet[blueprint.roads[i].x * 50 + blueprint.roads[i].y] = 1;
        blueprint.roadSet = roadSet;

        const outpostSet = new Uint8Array(2500);
        for (let i = 0; i < blueprint.outpostRamparts.length; i++) outpostSet[blueprint.outpostRamparts[i].x * 50 + blueprint.outpostRamparts[i].y] = 1;
        blueprint.outpostSet = outpostSet;

        global.Cache.blueprints.set(room.name, blueprint);
        console.log(`[RoomPlanner] Successfully generated and cached blueprint for ${room.name}!`);
    }

    // ─── Step 1: Anchor Finding ──────────────────────────────────────────

    static findAnchor(room, terrain) {
        const dt = new PathFinder.CostMatrix();
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                dt.set(x, y, (terrain.get(x, y) === TERRAIN_MASK_WALL || x <= 2 || y <= 2 || x >= 47 || y >= 47) ? 0 : 255);
            }
        }
        for (let x = 1; x < 49; x++) {
            for (let y = 1; y < 49; y++) {
                if (dt.get(x, y) > 0) {
                    dt.set(x, y, Math.min(dt.get(x - 1, y), dt.get(x, y - 1), dt.get(x - 1, y - 1), dt.get(x + 1, y - 1)) + 1);
                }
            }
        }
        let maxVal = 0, anchor = { x: 25, y: 25 };
        for (let x = 48; x >= 1; x--) {
            for (let y = 48; y >= 1; y--) {
                if (dt.get(x, y) > 0) {
                    const val = Math.min(dt.get(x, y), Math.min(dt.get(x + 1, y), dt.get(x, y + 1), dt.get(x + 1, y + 1), dt.get(x - 1, y + 1)) + 1);
                    dt.set(x, y, val);
                    if (val > maxVal) { maxVal = val; anchor = { x, y }; }
                }
            }
        }
        return anchor;
    }

    // ─── Tigga Modular Stamps ──────────────────────────────────────────

    static applyFastFillerStamp(blueprint, terrain, anchor, visited) {
        const ax = anchor.x, ay = anchor.y;
        const stamp = [
            { type: STRUCTURE_LINK, dx: 0, dy: 0 },
            { type: STRUCTURE_SPAWN, dx: -1, dy: 0 },
            { type: STRUCTURE_SPAWN, dx: 1, dy: 0 },
            { type: STRUCTURE_SPAWN, dx: 0, dy: -2 },
            { type: 'container', dx: 0, dy: -1 },
            { type: 'container', dx: 0, dy: 1 },
            { type: 'road', dx: -1, dy: -1 },
            { type: 'road', dx: 1, dy: -1 },
            { type: 'road', dx: -1, dy: 1 },
            { type: 'road', dx: 1, dy: 1 },
            { type: 'road', dx: 0, dy: -3 },
            { type: 'road', dx: -2, dy: 0 },
            { type: 'road', dx: 2, dy: 0 },
            { type: 'road', dx: 0, dy: 2 }
        ];

        for (let i = 0; i < stamp.length; i++) {
            const { type, dx, dy } = stamp[i];
            const x = ax + dx, y = ay + dy;
            if (x < 2 || x > 47 || y < 2 || y > 47 || terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            
            const key = x * 50 + y;
            if (visited[key]) continue;
            visited[key] = 1;
            
            if (type === 'road') blueprint.roads.push({ x, y });
            else if (type === 'container') blueprint.containers.push({ x, y });
            else blueprint[type].push({ x, y });
        }
    }

    static findCompactPlacement(stampRotations, terrain, anchor, visited) {
        const variants = Array.isArray(stampRotations[0]) ? stampRotations : [stampRotations];
        const queue = [{ x: anchor.x, y: anchor.y }];
        const seen = new Uint8Array(2500);
        seen[anchor.x * 50 + anchor.y] = 1;
        let head = 0;
        
        while (head < queue.length) {
            const { x, y } = queue[head++];
            
            for (let v = 0; v < variants.length; v++) {
                const stamp = variants[v];
                let valid = true;
                for (let j = 0; j < stamp.length; j++) {
                    const nx = x + stamp[j].dx, ny = y + stamp[j].dy;
                    if (nx < 2 || nx > 47 || ny < 2 || ny > 47 || terrain.get(nx, ny) === TERRAIN_MASK_WALL || visited[nx * 50 + ny]) {
                        valid = false; break;
                    }
                }
                if (valid) return { cx: x, cy: y, stamp };
            }
            
            const dirs = [{dx:0,dy:-1}, {dx:0,dy:1}, {dx:-1,dy:0}, {dx:1,dy:0}];
            for (let d = 0; d < dirs.length; d++) {
                const nx = x + dirs[d].dx, ny = y + dirs[d].dy;
                if (nx >= 2 && nx <= 47 && ny >= 2 && ny <= 47) {
                    const key = nx * 50 + ny;
                    if (!seen[key]) {
                        seen[key] = 1;
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
        }
        return null;
    }

    static applyCoreStamp(blueprint, terrain, anchor, visited) {
        const stamp = [
            { type: 'road', dx: 0, dy: 0 },
            { type: STRUCTURE_STORAGE, dx: -1, dy: 0 },
            { type: STRUCTURE_TERMINAL, dx: 1, dy: 0 },
            { type: STRUCTURE_FACTORY, dx: 0, dy: -1 },
            { type: STRUCTURE_LINK, dx: 0, dy: 1 },
            { type: STRUCTURE_NUKER, dx: -1, dy: -1 },
            { type: STRUCTURE_POWER_SPAWN, dx: 1, dy: -1 },
            { type: STRUCTURE_OBSERVER, dx: 1, dy: 1 },
            { type: 'road', dx: -2, dy: 0 }, { type: 'road', dx: 2, dy: 0 },
            { type: 'road', dx: 0, dy: -2 }, { type: 'road', dx: 0, dy: 2 },
            { type: 'road', dx: -1, dy: 1 }, { type: 'road', dx: -1, dy: -2 }, { type: 'road', dx: 1, dy: -2 }
        ];

        const placement = this.findCompactPlacement(stamp, terrain, anchor, visited);
        if (placement) {
            const { cx, cy, stamp: chosenStamp } = placement;
            for (let i = 0; i < chosenStamp.length; i++) {
                const { type, dx, dy } = chosenStamp[i];
                const x = cx + dx, y = cy + dy;
                visited[x * 50 + y] = 1;
                if (type === 'road') blueprint.roads.push({ x, y });
                else blueprint[type].push({ x, y });
            }
            return { x: cx, y: cy };
        }
        return null;
    }

    static applyTowerStamp(blueprint, terrain, anchor, visited) {
        const stamp = [
            { type: STRUCTURE_TOWER, dx: 0, dy: 0 }, { type: STRUCTURE_TOWER, dx: 1, dy: 0 }, { type: STRUCTURE_TOWER, dx: -1, dy: 0 },
            { type: STRUCTURE_TOWER, dx: 0, dy: 1 }, { type: STRUCTURE_TOWER, dx: 1, dy: 1 }, { type: STRUCTURE_TOWER, dx: -1, dy: 1 },
            { type: 'road', dx: 0, dy: -1 }, { type: 'road', dx: 1, dy: -1 }, { type: 'road', dx: -1, dy: -1 },
            { type: 'road', dx: 0, dy: 2 }, { type: 'road', dx: 1, dy: 2 }, { type: 'road', dx: -1, dy: 2 },
            { type: 'road', dx: -2, dy: 0 }, { type: 'road', dx: -2, dy: 1 },
            { type: 'road', dx: 2, dy: 0 }, { type: 'road', dx: 2, dy: 1 }
        ];

        const placement = this.findCompactPlacement(stamp, terrain, anchor, visited);
        if (placement) {
            const { cx, cy, stamp: chosenStamp } = placement;
            for (let i = 0; i < chosenStamp.length; i++) {
                const { type, dx, dy } = chosenStamp[i];
                const x = cx + dx, y = cy + dy;
                visited[x * 50 + y] = 1;
                if (type === 'road') blueprint.roads.push({ x, y });
                else blueprint[type].push({ x, y });
            }
            return { x: cx, y: cy };
        }
        return null;
    }

    static applyLabStamp(blueprint, terrain, anchor, visited) {
        const variants = [
            [
                { dx: -1, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: -1, s: true, type: STRUCTURE_LAB }, { dx: 1, dy: -1, s: true, type: STRUCTURE_LAB }, { dx: 2, dy: -1, s: false, type: STRUCTURE_LAB },
                { dx: -1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 2, dy: 0, s: false, type: STRUCTURE_LAB },
                { dx: 0, dy: 1, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 1, s: false, type: STRUCTURE_LAB },
            ],
            [
                { dx: -1, dy: 1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 1, s: true, type: STRUCTURE_LAB }, { dx: 1, dy: 1, s: true, type: STRUCTURE_LAB }, { dx: 2, dy: 1, s: false, type: STRUCTURE_LAB },
                { dx: -1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 2, dy: 0, s: false, type: STRUCTURE_LAB },
                { dx: 0, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: -1, s: false, type: STRUCTURE_LAB },
            ],
            [
                { dx: 1, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 0, s: true, type: STRUCTURE_LAB }, { dx: 1, dy: 1, s: true, type: STRUCTURE_LAB }, { dx: 1, dy: 2, s: false, type: STRUCTURE_LAB },
                { dx: 0, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 2, s: false, type: STRUCTURE_LAB },
                { dx: -1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: -1, dy: 1, s: false, type: STRUCTURE_LAB },
            ],
            [
                { dx: -1, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: -1, dy: 0, s: true, type: STRUCTURE_LAB }, { dx: -1, dy: 1, s: true, type: STRUCTURE_LAB }, { dx: -1, dy: 2, s: false, type: STRUCTURE_LAB },
                { dx: 0, dy: -1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 1, s: false, type: STRUCTURE_LAB }, { dx: 0, dy: 2, s: false, type: STRUCTURE_LAB },
                { dx: 1, dy: 0, s: false, type: STRUCTURE_LAB }, { dx: 1, dy: 1, s: false, type: STRUCTURE_LAB },
            ]
        ];

        const placement = this.findCompactPlacement(variants, terrain, anchor, visited);
        if (placement) {
            const { cx, cy, stamp: chosenStamp } = placement;
            for (let i = 0; i < chosenStamp.length; i++) {
                const { dx, dy, s } = chosenStamp[i];
                const x = cx + dx, y = cy + dy;
                visited[x * 50 + y] = 1;
                blueprint[STRUCTURE_LAB].push({ x, y });
                if (s) blueprint.supplierLabs.push({ x, y });
            }
            return { x: cx, y: cy };
        }
        return null;
    }

    static applyExtensionClusters(blueprint, terrain, anchor, visited) {
        const queue = [{ x: anchor.x, y: anchor.y }];
        const seen = new Uint8Array(2500);
        seen[anchor.x * 50 + anchor.y] = 1;
        
        let head = 0;
        let extensionsPlaced = blueprint[STRUCTURE_EXTENSION].length;
        const centers = [];

        const clusterOffsets = [
            { dx: 0, dy: 0, type: STRUCTURE_EXTENSION },
            { dx: 0, dy: -1, type: STRUCTURE_EXTENSION },
            { dx: 0, dy: 1, type: STRUCTURE_EXTENSION },
            { dx: -1, dy: 0, type: STRUCTURE_EXTENSION },
            { dx: 1, dy: 0, type: STRUCTURE_EXTENSION },
            { dx: -1, dy: -1, type: 'road' },
            { dx: 1, dy: -1, type: 'road' },
            { dx: -1, dy: 1, type: 'road' },
            { dx: 1, dy: 1, type: 'road' }
        ];

        while (head < queue.length && extensionsPlaced < 60) {
            const { x, y } = queue[head++];

            let validCluster = true;
            for (let i = 0; i < clusterOffsets.length; i++) {
                const nx = x + clusterOffsets[i].dx, ny = y + clusterOffsets[i].dy;
                if (nx < 2 || nx > 47 || ny < 2 || ny > 47 || terrain.get(nx, ny) === TERRAIN_MASK_WALL || visited[nx * 50 + ny]) {
                    validCluster = false; break;
                }
            }

            if (validCluster) {
                for (let i = 0; i < clusterOffsets.length; i++) {
                    const nx = x + clusterOffsets[i].dx, ny = y + clusterOffsets[i].dy;
                    visited[nx * 50 + ny] = 1;
                    if (clusterOffsets[i].type === 'road') {
                        blueprint.roads.push({ x: nx, y: ny });
                    } else {
                        blueprint[STRUCTURE_EXTENSION].push({ x: nx, y: ny });
                    }
                }
                extensionsPlaced += 5;
                centers.push({ x, y });
            }

            const dirs = [{ dx: 3, dy: 0 }, { dx: -3, dy: 0 }, { dx: 0, dy: 3 }, { dx: 0, dy: -3 }];
            for (let d = 0; d < dirs.length; d++) {
                const nx = x + dirs[d].dx, ny = y + dirs[d].dy;
                if (nx >= 2 && nx <= 47 && ny >= 2 && ny <= 47) {
                    const nkey = nx * 50 + ny;
                    if (!seen[nkey]) {
                        seen[nkey] = 1;
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
        }
        return centers;
    }


    // ─── Step 5: Container Planning ──────────────────────────────────────

    static planContainers(blueprint, room, state, terrain) {
        const spawn = state.spawns?.[0];
        const ref = spawn ? spawn.pos : new RoomPosition(blueprint.anchor.x, blueprint.anchor.y, room.name);
        const sources = state.sources || [];
        for (let i = 0; i < sources.length; i++) {
            const tile = this.findBestAdjacentTile(sources[i].pos, ref, terrain, room.name, 1);
            if (tile) blueprint.containers.push(tile);
        }
        if (state.controller) {
            const tile = this.findBestAdjacentTile(state.controller.pos, ref, terrain, room.name, 2);
            if (tile) blueprint.containers.push(tile);
        }
        if (state.mineral) {
            const tile = this.findBestAdjacentTile(state.mineral.pos, ref, terrain, room.name, 1);
            if (tile) blueprint.containers.push(tile);
        }
    }

    static findBestAdjacentTile(targetPos, referencePos, terrain, roomName, range) {
        let best = null, bestDist = Infinity;
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = targetPos.x + dx, y = targetPos.y + dy;
                if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                if (range > 1 && Math.max(Math.abs(dx), Math.abs(dy)) > range) continue;
                const dist = Math.abs(x - referencePos.x) + Math.abs(y - referencePos.y);
                if (dist < bestDist) { bestDist = dist; best = { x, y }; }
            }
        }
        return best;
    }

    // ─── Step 6: External Road Routes ────────────────────────────────────

    /**
     * The checkerboard diamond is already the internal road grid.
     * This step only uses PathFinder to route roads from anchor to:
     *   - Source/controller containers (hauler + upgrader routes)
     *   - Mineral (future remote mining)
     *
     * Existing checkerboard roads are seeded at cost 1 so external paths
     * merge onto them naturally rather than cutting parallel new roads.
     */
    static planRoads(blueprint, room, state, anchor, fragmentCenters) {
        const anchorPos = new RoomPosition(anchor.x, anchor.y, room.name);

        const targets = [];
        for (let i = 0; i < blueprint.containers.length; i++) targets.push(blueprint.containers[i]);
        if (state.mineral) targets.push({ x: state.mineral.pos.x, y: state.mineral.pos.y });
        if (fragmentCenters) {
            for (let i = 0; i < fragmentCenters.length; i++) targets.push(fragmentCenters[i]);
        }

        targets.sort((a, b) => {
            const dA = Math.max(Math.abs(a.x - anchor.x), Math.abs(a.y - anchor.y));
            const dB = Math.max(Math.abs(b.x - anchor.x), Math.abs(b.y - anchor.y));
            return dA - dB;
        });

        const costs = new PathFinder.CostMatrix();
        // Seed all existing roads at cost 1 (MST trunk-merging)
        for (let i = 0; i < blueprint.roads.length; i++) costs.set(blueprint.roads[i].x, blueprint.roads[i].y, 1);

        // Block all structures
        const blockTypes = [
            STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE,
            STRUCTURE_TERMINAL, STRUCTURE_FACTORY, STRUCTURE_LAB,
            STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER, STRUCTURE_OBSERVER
        ];
        for (let i = 0; i < blockTypes.length; i++) {
            const arr = blueprint[blockTypes[i]];
            if (arr) for (let j = 0; j < arr.length; j++) costs.set(arr[j].x, arr[j].y, 255);
        }

        for (let i = 0; i < targets.length; i++) {
            const targetPos = new RoomPosition(targets[i].x, targets[i].y, room.name);
            const ret = PathFinder.search(anchorPos, { pos: targetPos, range: 1 }, {
                plainCost: 2,
                swampCost: 5,  // Strongly penalize swamp — prefer extra plains tiles
                roomCallback: (rn) => rn === room.name ? costs : false,
                maxOps: 4000
            });

            for (let j = 0; j < ret.path.length; j++) {
                const step = ret.path[j];
                if (step.x >= 2 && step.x <= 47 && step.y >= 2 && step.y <= 47 && costs.get(step.x, step.y) !== 1) {
                    blueprint.roads.push({ x: step.x, y: step.y });
                    costs.set(step.x, step.y, 1);
                }
            }
        }
    }

    // ─── Step 7: Min-Cut Ramparts (Dinic's Max-Flow) ─────────────────────

    /**
     * Minimum vertex cut separating all room exits from the base.
     * Each tile is split into in-node and out-node (classic vertex-cut construction).
     * Base tiles get INF capacity (cannot be cut).
     * The cut identifies the minimum rampart positions.
     */
    static computeMinCut(terrain, baseSetArray) {
        const N = 5002, S = 5000, T = 5001, INF = 999999;
        const maxEdges = 100000;
        const head = new Int32Array(N).fill(-1);
        const next = new Int32Array(maxEdges);
        const eTo = new Int32Array(maxEdges);
        const eCap = new Int32Array(maxEdges);
        let edgeCount = 0;

        function addEdge(u, v, c) {
            eTo[edgeCount] = v; eCap[edgeCount] = c; next[edgeCount] = head[u]; head[u] = edgeCount++;
            eTo[edgeCount] = u; eCap[edgeCount] = 0; next[edgeCount] = head[v]; head[v] = edgeCount++;
        }

        // Dilate baseSet by 2 tiles for standoff distance against Ranged Attackers
        const dilatedBaseSet = new Uint8Array(2500);
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (baseSetArray[x * 50 + y]) {
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            const nx = x + dx, ny = y + dy;
                            if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50) {
                                dilatedBaseSet[nx * 50 + ny] = 1;
                            }
                        }
                    }
                }
            }
        }

        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                const inNode = x * 50 + y, outNode = inNode + 2500;
                const isBase = dilatedBaseSet[inNode];
                const isExit = (x === 0 || x === 49 || y === 0 || y === 49);

                addEdge(inNode, outNode, isBase || isExit ? INF : 1);
                if (isExit) addEdge(S, inNode, INF);
                if (isBase) addEdge(outNode, T, INF);
                const dirs = [
                    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
                    { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }
                ];
                for (let d = 0; d < dirs.length; d++) {
                    const nx = x + dirs[d].dx, ny = y + dirs[d].dy;
                    if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
                    if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
                    addEdge(outNode, nx * 50 + ny, INF);
                }
            }
        }

        // Dinic's BFS level graph
        const level = new Int32Array(N);
        function bfs() {
            level.fill(-1); level[S] = 0;
            const q = [S]; let qi = 0;
            while (qi < q.length) {
                const u = q[qi++];
                for (let ei = head[u]; ei !== -1; ei = next[ei]) {
                    if (eCap[ei] > 0 && level[eTo[ei]] < 0) { level[eTo[ei]] = level[u] + 1; q.push(eTo[ei]); }
                }
            }
            return level[T] >= 0;
        }

        // Dinic's DFS blocking flow
        const iter = new Int32Array(N);
        function dfs(u, pushed) {
            if (u === T) return pushed;
            for (; iter[u] !== -1; iter[u] = next[iter[u]]) {
                const ei = iter[u], v = eTo[ei];
                if (eCap[ei] <= 0 || level[v] !== level[u] + 1) continue;
                const d = dfs(v, Math.min(pushed, eCap[ei]));
                if (d > 0) { eCap[ei] -= d; eCap[ei ^ 1] += d; return d; }
            }
            return 0;
        }

        while (bfs()) {
            for (let i = 0; i < N; i++) iter[i] = head[i];
            let f;
            do { f = dfs(S, INF); } while (f > 0);
        }

        // BFS in residual graph from S to find reachable set
        const reachable = new Uint8Array(N);
        const q2 = [S]; reachable[S] = 1; let qi2 = 0;
        while (qi2 < q2.length) {
            const u = q2[qi2++];
            for (let ei = head[u]; ei !== -1; ei = next[ei]) {
                if (eCap[ei] > 0 && !reachable[eTo[ei]]) { reachable[eTo[ei]] = 1; q2.push(eTo[ei]); }
            }
        }

        // Cut tiles: in-node reachable, out-node NOT reachable from S.
        // WALL-AWARE: natural terrain walls are already impassable (permanent, free).
        // Only place ramparts on open-terrain tiles in the cut — these are the gaps
        // that actually need a structure to block passage.
        const ramparts = [];
        for (let x = 1; x < 49; x++) {
            for (let y = 1; y < 49; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;  // free perimeter tile
                const id = x * 50 + y;
                if (reachable[id] && !reachable[id + 2500]) {
                    ramparts.push({ x, y });
                }
            }
        }

        return ramparts;
    }

    // ─── Step 8: Road Exit Airlocks ──────────────────────────────────────

    /**
     * For every rampart that sits on a road (a "road exit"),
     * traces 2 tiles inward along the road to create a protected airlock.
     * Uses a strict single-path trace to prevent clump fan-outs.
     */
    static addRoadRamparts(blueprint) {
        const roadSet = new Uint8Array(2500);
        for (let i = 0; i < blueprint.roads.length; i++) roadSet[blueprint.roads[i].x * 50 + blueprint.roads[i].y] = 1;
        
        const rampartSet = new Uint8Array(2500);
        for (let i = 0; i < blueprint.ramparts.length; i++) rampartSet[blueprint.ramparts[i].x * 50 + blueprint.ramparts[i].y] = 1;
        
        const ax = blueprint.anchor.x, ay = blueprint.anchor.y;
        const newRamparts = [];

        for (let i = 0; i < blueprint.ramparts.length; i++) {
            const rp = blueprint.ramparts[i];
            if (!roadSet[rp.x * 50 + rp.y]) continue;

            let current = rp;
            for (let step = 0; step < 3; step++) {
                let bestNext = null;
                const cx = current.x, cy = current.y;
                const cDist = Math.max(Math.abs(cx - ax), Math.abs(cy - ay));

                const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }];
                for (let d = 0; d < dirs.length; d++) {
                    const nx = cx + dirs[d].x, ny = cy + dirs[d].y;
                    const nDist = Math.max(Math.abs(nx - ax), Math.abs(ny - ay));
                    const nkey = nx * 50 + ny;
                    if (nDist < cDist && roadSet[nkey] && !rampartSet[nkey]) {
                        bestNext = { x: nx, y: ny };
                        break; // Take the first valid inward road tile
                    }
                }

                if (bestNext) {
                    rampartSet[bestNext.x * 50 + bestNext.y] = 1;
                    newRamparts.push(bestNext);
                    current = bestNext;
                } else {
                    break;
                }
            }
        }
        for (let i = 0; i < newRamparts.length; i++) blueprint.ramparts.push(newRamparts[i]);
    }

    // ─── Step 8.5: Rampart Roads ──────────────────────────────────────────

    /**
     * Overlays STRUCTURE_ROAD on every placed rampart tile to give defenders
     * zero-fatigue mobility along the walls.
     */
    static addRampartRoads(blueprint) {
        const roadSet = new Uint8Array(2500);
        for (let i = 0; i < blueprint.roads.length; i++) roadSet[blueprint.roads[i].x * 50 + blueprint.roads[i].y] = 1;
        
        const newRoads = [];
        for (let i = 0; i < blueprint.ramparts.length; i++) {
            const rp = blueprint.ramparts[i];
            const rkey = rp.x * 50 + rp.y;
            if (!roadSet[rkey]) {
                newRoads.push({ x: rp.x, y: rp.y });
                roadSet[rkey] = 1;
            }
        }
        for (let i = 0; i < newRoads.length; i++) blueprint.roads.push(newRoads[i]);
    }

    // ─── Step 9: Outpost Ramparts ────────────────────────────────────────

    /**
     * BFS inward from anchor (ramparts are boundaries).
     * Any source/controller/mineral NOT reachable from anchor = outside perimeter.
     * For each external resource, places a Chebyshev-range-1 rampart ring.
     */
    static addOutpostRamparts(blueprint, terrain, state) {
        // BFS from anchor, ramparts act as walls
        const rampartSet = new Uint8Array(2500);
        for (let i = 0; i < blueprint.ramparts.length; i++) rampartSet[blueprint.ramparts[i].x * 50 + blueprint.ramparts[i].y] = 1;
        
        const inside = new Uint8Array(2500);
        const start = blueprint.anchor;
        inside[start.x * 50 + start.y] = 1;
        const q = [{ x: start.x, y: start.y }]; let qi = 0;
        while (qi < q.length) {
            const cur = q[qi++];
            const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
            for (let i = 0; i < dirs.length; i++) {
                const nx = cur.x + dirs[i].x, ny = cur.y + dirs[i].y;
                if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
                if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
                const key = nx * 50 + ny;
                if (inside[key] || rampartSet[key]) continue;
                inside[key] = 1; q.push({ x: nx, y: ny });
            }
        }

        // Collect resource positions to check
        const resourcePositions = [];
        if (state.sources) for (let i = 0; i < state.sources.length; i++) resourcePositions.push(state.sources[i].pos);
        if (state.controller) resourcePositions.push(state.controller.pos);
        if (state.mineral) resourcePositions.push(state.mineral.pos);

        const outpostRamparts = [];
        for (let r = 0; r < resourcePositions.length; r++) {
            const pos = resourcePositions[r];
            if (inside[pos.x * 50 + pos.y]) continue;  // Already inside main perimeter

            // Place tight rampart ring (range 1) around external resource
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const rx = pos.x + dx, ry = pos.y + dy;
                    if (rx < 2 || rx > 47 || ry < 2 || ry > 47) continue;
                    if (terrain.get(rx, ry) === TERRAIN_MASK_WALL) continue;
                    const key = rx * 50 + ry;
                    if (!rampartSet[key]) {
                        rampartSet[key] = 1;
                        outpostRamparts.push({ x: rx, y: ry });
                    }
                }
            }
        }

        blueprint.outpostRamparts = outpostRamparts;
        for (let i = 0; i < outpostRamparts.length; i++) blueprint.ramparts.push(outpostRamparts[i]);
    }
    // ─── Visualizer ──────────────────────────────────────────────────────

    /**
     * Renders the full blueprint each tick.
     * Color legend:
     *   Roads          — grey dots along the cardinal spine arms
     *   Extensions     — yellow squares (teeth off the spine)
     *   Spawns         — orange  |  Storage — green  |  Terminal — cyan
     *   Factory        — amber   |  Towers  — red
     *   Supplier labs  — bright cyan + 'S'  |  Reactor labs — purple
     *   PowerSpawn     — magenta |  Nuker   — dark red
     *   Ramparts       — green outline
     *   Road-exit ramp — yellow outline (thicker, airlock corridors)
     *   Outpost ramp   — orange outline (external resource protection)
     *   Anchor         — white circle + gear icon
     */
    static visualize() {
        if (!global.Cache || !global.Cache.blueprints) return;

        for (const [roomName, blueprint] of global.Cache.blueprints.entries()) {
            const visual = new RoomVisual(roomName);

            // Roads
            if (blueprint.roads) {
                for (let i = 0; i < blueprint.roads.length; i++) {
                    const p = blueprint.roads[i];
                    visual.circle(p.x, p.y, { radius: 0.15, fill: '#888888', opacity: 0.35 });
                }
            }

            // Structures
            const structureColors = {
                [STRUCTURE_SPAWN]: '#ffaa00',
                [STRUCTURE_EXTENSION]: '#ffe066',
                [STRUCTURE_TOWER]: '#ff4444',
                [STRUCTURE_STORAGE]: '#44ff44',
                [STRUCTURE_TERMINAL]: '#44ffff',
                [STRUCTURE_FACTORY]: '#ff8800',
                [STRUCTURE_POWER_SPAWN]: '#ff44ff',
                [STRUCTURE_NUKER]: '#884444',
                [STRUCTURE_OBSERVER]: '#4488ff',
            };
            for (const type in structureColors) {
                if (!blueprint[type]) continue;
                for (let i = 0; i < blueprint[type].length; i++) {
                    const p = blueprint[type][i];
                    visual.rect(p.x - 0.35, p.y - 0.35, 0.7, 0.7, { fill: structureColors[type], opacity: 0.45 });
                }
            }

            // Labs (supplier = cyan + label, reactor = purple)
            if (blueprint[STRUCTURE_LAB]) {
                for (let i = 0; i < blueprint[STRUCTURE_LAB].length; i++) {
                    const p = blueprint[STRUCTURE_LAB][i];
                    const isSup = blueprint.supplierSet ? blueprint.supplierSet[p.x * 50 + p.y] : false;
                    visual.rect(p.x - 0.35, p.y - 0.35, 0.7, 0.7, { fill: isSup ? '#00ffff' : '#cc44ff', opacity: 0.6 });
                    if (isSup) visual.text('S', p.x, p.y + 0.1, { color: '#000', font: 0.4 });
                }
            }

            // Containers
            if (blueprint.containers) {
                for (let i = 0; i < blueprint.containers.length; i++) {
                    const p = blueprint.containers[i];
                    visual.rect(p.x - 0.3, p.y - 0.3, 0.6, 0.6, { fill: '#ffffff', opacity: 0.5 });
                }
            }

            // Ramparts
            if (blueprint.ramparts) {
                for (let i = 0; i < blueprint.ramparts.length; i++) {
                    const p = blueprint.ramparts[i];
                    const key = p.x * 50 + p.y;
                    const isOutpost = blueprint.outpostSet ? blueprint.outpostSet[key] : false;
                    const isRoadExit = !isOutpost && blueprint.roadSet ? blueprint.roadSet[key] : false;
                    visual.rect(p.x - 0.45, p.y - 0.45, 0.9, 0.9, {
                        fill: 'transparent',
                        stroke: isOutpost ? '#ff8800' : isRoadExit ? '#ffff00' : '#00ff00',
                        strokeWidth: isOutpost ? 0.14 : isRoadExit ? 0.12 : 0.07,
                        opacity: 0.7
                    });
                }
            }

            // Anchor marker
            if (blueprint.anchor) {
                visual.circle(blueprint.anchor.x, blueprint.anchor.y, { radius: 0.28, fill: '#ffffff', opacity: 0.9 });
                visual.text('⚙', blueprint.anchor.x, blueprint.anchor.y + 0.1, { color: '#000000', font: 0.45 });
            }
        }
    }
}

module.exports = RoomPlanner;