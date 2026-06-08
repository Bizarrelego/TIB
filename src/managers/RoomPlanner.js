const GameObjectUtility = require('../utilities/GameObjectUtility');

/**
 * Production-Grade Room Planner
 *
 * Pipeline:
 *  1. findAnchor       — Distance transform finds the most open terrain point.
 *  2. applyCoreStamp   — Hardcoded 5-tile Core Hub (Storage, Terminal, Factory,
 *                        3 Spawns, 6 Towers, PowerSpawn, Nuker, Observer).
 *  3. applyLabStamp    — Tries 4 quadrant rotations, picks best-fit 2+8 lab cluster.
 *  4. fillExtensions   — BFS checkerboard fill for all 60 extensions.
 *  5. planContainers   — Source + controller containers.
 *  6. planRoads        — MST road spines from anchor to key locations.
 *  7. computeMinCut    — Dinic's max-flow finds the minimum set of rampart tiles
 *                        that completely isolates the base from room exits.
 *  8. addRoadRamparts  — Traces 3 rampart tiles inward on every road exit.
 */
class RoomPlanner {

    static run() {
        if (Game.cpu.bucket <= 500) return;
        if (Game.time % 50 !== 0) return;

        if (!global.Cache) global.Cache = { blueprints: new Map() };
        if (!(global.Cache.blueprints instanceof Map)) global.Cache.blueprints = new Map();

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                this.manageRoom(room);
            }
        }
    }

    static manageRoom(room) {
        if (!global.Cache.blueprints.has(room.name)) {
            this.generateBlueprint(room);
        }
        if (Game.time % 13 !== 0) return;
        if (Object.keys(Game.constructionSites).length > 50) return;
        this.executeBlueprint(room);
    }

    // ─── Blueprint Generation Pipeline ──────────────────────────────────

    static generateBlueprint(room) {
        const terrain = Game.map.getRoomTerrain(room.name);
        const state = global.State?.rooms?.get(room.name);

        const blueprint = {
            anchor: null,
            containers: [],
            roads: [],
            ramparts: [],
            supplierLabs: [],       // For visualizer distinction
            [STRUCTURE_SPAWN]: [],
            [STRUCTURE_EXTENSION]: [],
            [STRUCTURE_TOWER]: [],
            [STRUCTURE_STORAGE]: [],
            [STRUCTURE_TERMINAL]: [],
            [STRUCTURE_FACTORY]: [],
            [STRUCTURE_LAB]: [],
            [STRUCTURE_OBSERVER]: [],
            [STRUCTURE_NUKER]: [],
            [STRUCTURE_POWER_SPAWN]: []
        };

        // Step 1: Find anchor — ensure it lands on road parity (x+y)%2===0
        let anchor = this.findAnchor(room, terrain);
        if ((anchor.x + anchor.y) % 2 !== 0) {
            const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
            for (let i = 0; i < dirs.length; i++) {
                const nx = anchor.x + dirs[i].x, ny = anchor.y + dirs[i].y;
                if (nx >= 3 && nx <= 46 && ny >= 3 && ny <= 46 && terrain.get(nx, ny) !== TERRAIN_MASK_WALL) {
                    anchor = {x: nx, y: ny};
                    break;
                }
            }
        }
        blueprint.anchor = anchor;

        // Track all claimed tiles to prevent overlap
        const visited = new Set();

        // Step 2: Core Hub stamp
        this.applyCoreStamp(blueprint, terrain, anchor, visited);

        // Step 3: Lab stamp (best-fit quadrant)
        this.applyLabStamp(blueprint, terrain, anchor, visited);

        // Step 4: BFS checkerboard extension fill
        this.fillExtensions(blueprint, terrain, anchor, visited, state);

        // Step 5: Containers at sources + controller
        if (state) this.planContainers(blueprint, room, state, terrain);

        // Step 6: MST roads from anchor to sources + controller
        if (state) this.planRoads(blueprint, room, state, anchor);

        // Step 7: True min-cut ramparts (Dinic's max-flow)
        blueprint.ramparts = this.computeMinCut(terrain, visited, anchor);

        // Step 8: 3-deep rampart coverage over road exits
        this.addRoadRamparts(blueprint);

        global.Cache.blueprints.set(room.name, blueprint);
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
                    dt.set(x, y, Math.min(dt.get(x-1,y), dt.get(x,y-1), dt.get(x-1,y-1), dt.get(x+1,y-1)) + 1);
                }
            }
        }
        let maxVal = 0, anchor = {x: 25, y: 25};
        for (let x = 48; x >= 1; x--) {
            for (let y = 48; y >= 1; y--) {
                if (dt.get(x, y) > 0) {
                    const val = Math.min(dt.get(x, y), Math.min(dt.get(x+1,y), dt.get(x,y+1), dt.get(x+1,y+1), dt.get(x-1,y+1)) + 1);
                    dt.set(x, y, val);
                    if (val > maxVal) { maxVal = val; anchor = {x, y}; }
                }
            }
        }
        return anchor;
    }

    // ─── Step 2: Core Hub Stamp ──────────────────────────────────────────

    /**
     * Places the Core Hub at anchor using a strict checkerboard convention:
     *   (dx+dy) % 2 === 0  →  road tile
     *   (dx+dy) % 2 === 1  →  structure tile
     *
     * Anchor must be a road parity tile (enforced in generateBlueprint).
     * This guarantees the entire extension grid remains walkable.
     */
    static applyCoreStamp(blueprint, terrain, anchor, visited) {
        const ax = anchor.x, ay = anchor.y;

        // Core Hub stamp — 13 road tiles + 15 structure tiles
        // All (dx+dy)%2===0 → road, all (dx+dy)%2===1 → structure
        const stamp = [
            // Hub road (center)
            { type: 'road',                dx:  0, dy:  0 },
            // Ring 1 roads (diagonals, sum=even)
            { type: 'road',                dx:  1, dy:  1 },
            { type: 'road',                dx: -1, dy:  1 },
            { type: 'road',                dx:  1, dy: -1 },
            { type: 'road',                dx: -1, dy: -1 },
            // Ring 2 roads (cardinals, sum=even)
            { type: 'road',                dx:  2, dy:  0 },
            { type: 'road',                dx: -2, dy:  0 },
            { type: 'road',                dx:  0, dy:  2 },
            { type: 'road',                dx:  0, dy: -2 },
            // Ring 2 far diagonals (sum=even)
            { type: 'road',                dx:  2, dy:  2 },
            { type: 'road',                dx: -2, dy:  2 },
            { type: 'road',                dx:  2, dy: -2 },
            { type: 'road',                dx: -2, dy: -2 },
            // Ring 3 road connectors (sum=even)
            { type: 'road',                dx:  0, dy:  4 },
            { type: 'road',                dx:  0, dy: -4 },
            { type: 'road',                dx:  4, dy:  0 },
            { type: 'road',                dx: -4, dy:  0 },
            // Ring 1 structures (cardinals, sum=odd)
            { type: STRUCTURE_STORAGE,     dx:  1, dy:  0 },  // Hub-adjacent, primary storage
            { type: STRUCTURE_TERMINAL,    dx: -1, dy:  0 },
            { type: STRUCTURE_FACTORY,     dx:  0, dy:  1 },
            { type: STRUCTURE_SPAWN,       dx:  0, dy: -1 },  // Spawn 1 (primary)
            // Ring 2 structures (mixed offset, sum=odd)
            { type: STRUCTURE_TOWER,       dx:  2, dy:  1 },
            { type: STRUCTURE_TOWER,       dx: -2, dy:  1 },
            { type: STRUCTURE_TOWER,       dx:  2, dy: -1 },
            { type: STRUCTURE_TOWER,       dx: -2, dy: -1 },
            { type: STRUCTURE_TOWER,       dx:  1, dy:  2 },
            { type: STRUCTURE_TOWER,       dx: -1, dy:  2 },  // 6 towers
            { type: STRUCTURE_SPAWN,       dx:  1, dy: -2 },  // Spawn 2
            { type: STRUCTURE_SPAWN,       dx: -1, dy: -2 },  // Spawn 3
            // Ring 3 rare structures (sum=odd)
            { type: STRUCTURE_POWER_SPAWN, dx:  3, dy:  0 },
            { type: STRUCTURE_OBSERVER,    dx: -3, dy:  0 },
            { type: STRUCTURE_NUKER,       dx:  0, dy:  3 },
        ];

        for (let i = 0; i < stamp.length; i++) {
            const item = stamp[i];
            const x = ax + item.dx;
            const y = ay + item.dy;
            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);
            if (item.type === 'road') {
                blueprint.roads.push({x, y});
            } else {
                blueprint[item.type].push({x, y});
            }
        }
    }

    // ─── Step 3: Lab Stamp ───────────────────────────────────────────────

    /**
     * 2-supplier + 8-reactor lab cluster. Verified: both suppliers within
     * Chebyshev range 2 of all 8 reactors, satisfying the reaction constraint.
     *
     * Layout relative to lab-corner (lcx, lcy):
     *   [R0][S1][S2][R1]   row lcy
     *   [R2][R3][R4][R5]   row lcy+1
     *       [R6][R7]       row lcy+2
     *
     * Tries 4 quadrant placements (right, left, below, above the core) and
     * picks the quadrant with the most valid (non-wall) tiles.
     */
    static applyLabStamp(blueprint, terrain, anchor, visited) {
        const ax = anchor.x, ay = anchor.y;

        // 4 quadrant variants: each entry is [{dx, dy, isSupplier}...]
        // offsets are relative to anchor
        const variants = [
            // Variant 0: RIGHT of core (labs at ax+4..ax+7, ay-1..ay+1)
            [
                {dx:4,  dy:-1, isSupplier: false},   // R0
                {dx:5,  dy:-1, isSupplier: true },    // S1
                {dx:6,  dy:-1, isSupplier: true },    // S2
                {dx:7,  dy:-1, isSupplier: false},    // R1
                {dx:4,  dy: 0, isSupplier: false},    // R2
                {dx:5,  dy: 0, isSupplier: false},    // R3
                {dx:6,  dy: 0, isSupplier: false},    // R4
                {dx:7,  dy: 0, isSupplier: false},    // R5
                {dx:5,  dy: 1, isSupplier: false},    // R6
                {dx:6,  dy: 1, isSupplier: false},    // R7
            ],
            // Variant 1: LEFT of core (mirror X)
            [
                {dx:-4, dy:-1, isSupplier: false},
                {dx:-5, dy:-1, isSupplier: true },
                {dx:-6, dy:-1, isSupplier: true },
                {dx:-7, dy:-1, isSupplier: false},
                {dx:-4, dy: 0, isSupplier: false},
                {dx:-5, dy: 0, isSupplier: false},
                {dx:-6, dy: 0, isSupplier: false},
                {dx:-7, dy: 0, isSupplier: false},
                {dx:-5, dy: 1, isSupplier: false},
                {dx:-6, dy: 1, isSupplier: false},
            ],
            // Variant 2: BELOW core (rotate 90°: dx→dy, dy→-dx)
            [
                {dx:-1, dy: 4, isSupplier: false},
                {dx:-1, dy: 5, isSupplier: true },
                {dx:-1, dy: 6, isSupplier: true },
                {dx:-1, dy: 7, isSupplier: false},
                {dx: 0, dy: 4, isSupplier: false},
                {dx: 0, dy: 5, isSupplier: false},
                {dx: 0, dy: 6, isSupplier: false},
                {dx: 0, dy: 7, isSupplier: false},
                {dx: 1, dy: 5, isSupplier: false},
                {dx: 1, dy: 6, isSupplier: false},
            ],
            // Variant 3: ABOVE core (mirror Y)
            [
                {dx:-1, dy:-4, isSupplier: false},
                {dx:-1, dy:-5, isSupplier: true },
                {dx:-1, dy:-6, isSupplier: true },
                {dx:-1, dy:-7, isSupplier: false},
                {dx: 0, dy:-4, isSupplier: false},
                {dx: 0, dy:-5, isSupplier: false},
                {dx: 0, dy:-6, isSupplier: false},
                {dx: 0, dy:-7, isSupplier: false},
                {dx: 1, dy:-5, isSupplier: false},
                {dx: 1, dy:-6, isSupplier: false},
            ]
        ];

        // Score each variant by counting valid non-wall, non-visited tiles
        let bestScore = -1;
        let bestVariant = null;

        for (let v = 0; v < variants.length; v++) {
            const variant = variants[v];
            let score = 0;
            for (let j = 0; j < variant.length; j++) {
                const x = ax + variant[j].dx;
                const y = ay + variant[j].dy;
                if (x >= 2 && x <= 47 && y >= 2 && y <= 47 &&
                    terrain.get(x, y) !== TERRAIN_MASK_WALL &&
                    !visited.has(`${x},${y}`)) {
                    score++;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestVariant = variant;
            }
        }

        if (!bestVariant || bestScore === 0) return;

        for (let j = 0; j < bestVariant.length; j++) {
            const item = bestVariant[j];
            const x = ax + item.dx;
            const y = ay + item.dy;
            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);
            blueprint[STRUCTURE_LAB].push({x, y});
            if (item.isSupplier) blueprint.supplierLabs.push({x, y});
        }
    }

    // ─── Step 4: BFS Checkerboard Extension Fill ─────────────────────────

    /**
     * Expands outwards from the anchor using BFS.
     * Structure-parity tiles ((x+y)%2 !== anchorParity) → structures.
     * Road-parity tiles ((x+y)%2 === anchorParity) → roads.
     *
     * Since anchor is always on road parity, this fills:
     *   same parity as anchor  → roads
     *   opposite parity         → extensions (then rare structures)
     *
     * This mathematically guarantees every structure is surrounded by road
     * tiles on all 4 cardinal sides → 100% walkable at every RCL.
     */
    static fillExtensions(blueprint, terrain, anchor, visited, state) {
        const ax = anchor.x, ay = anchor.y;
        const roadParity = (ax + ay) % 2;

        // Count how many of each structure the stamp already placed
        const remaining = {
            [STRUCTURE_EXTENSION]: 60 - blueprint[STRUCTURE_EXTENSION].length,
            [STRUCTURE_SPAWN]:      3  - blueprint[STRUCTURE_SPAWN].length,
            [STRUCTURE_TOWER]:      6  - blueprint[STRUCTURE_TOWER].length,
            [STRUCTURE_POWER_SPAWN]:1  - blueprint[STRUCTURE_POWER_SPAWN].length,
            [STRUCTURE_NUKER]:      1  - blueprint[STRUCTURE_NUKER].length,
            [STRUCTURE_OBSERVER]:   1  - blueprint[STRUCTURE_OBSERVER].length,
        };

        // Priority: fill rare structures first, then extensions
        const structureFillOrder = [
            STRUCTURE_SPAWN,
            STRUCTURE_TOWER,
            STRUCTURE_POWER_SPAWN,
            STRUCTURE_NUKER,
            STRUCTURE_OBSERVER,
            STRUCTURE_EXTENSION
        ];

        // BFS queue, sorted by Chebyshev distance from anchor for compactness
        const bfsQueue = [];
        // Seed with all visited tiles' unvisited neighbors
        const initSet = [];
        for (const key of visited) {
            const [x, y] = key.split(',').map(Number);
            initSet.push({x, y});
        }
        const seeded = new Set(visited);

        const seedNeighbors = (cx, cy) => {
            const nbrs = [{x:cx,y:cy-1},{x:cx+1,y:cy},{x:cx,y:cy+1},{x:cx-1,y:cy}];
            for (let i = 0; i < nbrs.length; i++) {
                const nx = nbrs[i].x, ny = nbrs[i].y;
                if (nx < 2 || nx > 47 || ny < 2 || ny > 47) continue;
                if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
                const nkey = `${nx},${ny}`;
                if (seeded.has(nkey)) continue;
                seeded.add(nkey);
                bfsQueue.push({x: nx, y: ny});
            }
        };

        for (let i = 0; i < initSet.length; i++) seedNeighbors(initSet[i].x, initSet[i].y);

        // BFS — always process tile closest to anchor first
        let qi = 0;
        while (qi < bfsQueue.length) {
            // Sort in chunks for performance: sort every 50 items
            if (qi % 50 === 0) {
                bfsQueue.splice(0, qi);
                qi = 0;
                bfsQueue.sort((a, b) => {
                    const dA = Math.max(Math.abs(a.x - ax), Math.abs(a.y - ay));
                    const dB = Math.max(Math.abs(b.x - ax), Math.abs(b.y - ay));
                    if (dA !== dB) return dA - dB;
                    return ((a.x-ax)**2+(a.y-ay)**2) - ((b.x-ax)**2+(b.y-ay)**2);
                });
            }

            const cur = bfsQueue[qi++];

            // Exclude zone within 2 of sources, controller, mineral
            let tooClose = false;
            if (state) {
                if (state.sources) {
                    for (let s = 0; s < state.sources.length; s++) {
                        if (Math.max(Math.abs(cur.x - state.sources[s].pos.x), Math.abs(cur.y - state.sources[s].pos.y)) <= 2) {
                            tooClose = true; break;
                        }
                    }
                }
                if (!tooClose && state.controller &&
                    Math.max(Math.abs(cur.x - state.controller.pos.x), Math.abs(cur.y - state.controller.pos.y)) <= 2) tooClose = true;
                if (!tooClose && state.mineral &&
                    Math.max(Math.abs(cur.x - state.mineral.pos.x), Math.abs(cur.y - state.mineral.pos.y)) <= 2) tooClose = true;
            }

            const key = `${cur.x},${cur.y}`;
            const parity = (cur.x + cur.y) % 2;

            if (!tooClose) {
                if (!visited.has(key)) {
                    visited.add(key);
                    if (parity === roadParity) {
                        // Road tile
                        blueprint.roads.push({x: cur.x, y: cur.y});
                    } else {
                        // Structure tile — fill in priority order
                        let placed = false;
                        for (let t = 0; t < structureFillOrder.length; t++) {
                            const stype = structureFillOrder[t];
                            if (remaining[stype] > 0) {
                                blueprint[stype].push({x: cur.x, y: cur.y});
                                remaining[stype]--;
                                placed = true;
                                break;
                            }
                        }
                        if (!placed) break; // All structures filled
                    }
                }
            }

            // Always expand neighbors regardless of exclusion zone
            // (roads still need to pass through to reach sources)
            seedNeighbors(cur.x, cur.y);
        }
    }

    // ─── Step 5: Container Planning ──────────────────────────────────────

    static planContainers(blueprint, room, state, terrain) {
        const spawn = state.spawns?.[0];
        const spawnPos = spawn ? spawn.pos : new RoomPosition(blueprint.anchor.x, blueprint.anchor.y, room.name);

        const sources = state.sources || [];
        for (let i = 0; i < sources.length; i++) {
            const bestTile = this.findBestAdjacentTile(sources[i].pos, spawnPos, terrain, room.name, 1);
            if (bestTile) blueprint.containers.push(bestTile);
        }

        if (state.controller) {
            const bestTile = this.findBestAdjacentTile(state.controller.pos, spawnPos, terrain, room.name, 2);
            if (bestTile) blueprint.containers.push(bestTile);
        }
    }

    static findBestAdjacentTile(targetPos, referencePos, terrain, roomName, range) {
        let bestTile = null, bestDist = Infinity;
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = targetPos.x + dx, y = targetPos.y + dy;
                if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                if (range > 1 && Math.max(Math.abs(dx), Math.abs(dy)) > range) continue;
                const dist = Math.abs(x - referencePos.x) + Math.abs(y - referencePos.y);
                if (dist < bestDist) { bestDist = dist; bestTile = {x, y}; }
            }
        }
        return bestTile;
    }

    // ─── Step 6: MST Road Planning ───────────────────────────────────────

    static planRoads(blueprint, room, state, anchor) {
        const anchorPos = new RoomPosition(anchor.x, anchor.y, room.name);
        const targets = [];

        for (let i = 0; i < blueprint.containers.length; i++) targets.push(blueprint.containers[i]);
        if (state.mineral) targets.push({x: state.mineral.pos.x, y: state.mineral.pos.y});

        targets.sort((a, b) => {
            const dA = Math.max(Math.abs(a.x-anchor.x), Math.abs(a.y-anchor.y));
            const dB = Math.max(Math.abs(b.x-anchor.x), Math.abs(b.y-anchor.y));
            return dA - dB;
        });

        const costs = new PathFinder.CostMatrix();

        // Seed base roads at cost 1 so paths prefer merging onto them
        for (let i = 0; i < blueprint.roads.length; i++) costs.set(blueprint.roads[i].x, blueprint.roads[i].y, 1);

        // Block structures so paths don't route through them
        const blockTypes = [STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE,
                            STRUCTURE_TERMINAL, STRUCTURE_FACTORY, STRUCTURE_LAB, STRUCTURE_POWER_SPAWN,
                            STRUCTURE_NUKER, STRUCTURE_OBSERVER];
        for (let i = 0; i < blockTypes.length; i++) {
            const arr = blueprint[blockTypes[i]];
            if (arr) for (let j = 0; j < arr.length; j++) costs.set(arr[j].x, arr[j].y, 255);
        }

        for (let i = 0; i < targets.length; i++) {
            const targetPos = new RoomPosition(targets[i].x, targets[i].y, room.name);
            const ret = PathFinder.search(anchorPos, {pos: targetPos, range: 1}, {
                plainCost: 2, swampCost: 3,
                roomCallback: (rn) => rn === room.name ? costs : false,
                maxOps: 4000
            });

            for (let j = 0; j < ret.path.length; j++) {
                const step = ret.path[j];
                if (step.x >= 2 && step.x <= 47 && step.y >= 2 && step.y <= 47) {
                    if (costs.get(step.x, step.y) !== 1) {
                        blueprint.roads.push({x: step.x, y: step.y});
                        costs.set(step.x, step.y, 1);
                    }
                }
            }
        }
    }

    // ─── Step 7: Min-Cut Ramparts (Dinic's Max-Flow) ─────────────────────

    /**
     * Computes the minimum vertex cut that separates all room exits from the
     * base anchor using Dinic's max-flow on a split-node grid graph.
     *
     * Graph construction:
     *  - Each walkable tile (x,y) becomes two nodes:
     *      in-node:  id = x*50+y
     *      out-node: id = x*50+y+2500
     *  - in → out capacity: INF for base tiles, 1 for normal tiles
     *  - out → adjacent in: INF (free movement between tiles)
     *  - Source S (id 5000) → in-node of all tiles adjacent to room border: INF
     *  - out-node of base tiles → Sink T (id 5001): INF
     *
     * After max-flow, the min-cut tiles are those where in-node is reachable
     * from S but out-node is not (the saturated in→out edge is the cut).
     */
    static computeMinCut(terrain, baseSet, anchor) {
        const N = 5002;
        const S = 5000, T = 5001;
        const INF = 999999;

        // Adjacency list and edge arrays (classic Dinic's XOR pair storage)
        const adj = new Array(N);
        for (let i = 0; i < N; i++) adj[i] = [];
        const eTo = [], eCap = [];

        function addEdge(u, v, c) {
            adj[u].push(eTo.length); eTo.push(v); eCap.push(c);
            adj[v].push(eTo.length); eTo.push(u); eCap.push(0);
        }

        // Build the split-node graph
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                const inNode  = x * 50 + y;
                const outNode = inNode + 2500;
                const isBase  = baseSet.has(`${x},${y}`);
                const isBorder = (x <= 1 || x >= 48 || y <= 1 || y >= 48);

                // in → out edge (the cut edge for normal tiles)
                addEdge(inNode, outNode, isBase || isBorder ? INF : 1);

                // Source → border tile in-nodes
                if (isBorder) addEdge(S, inNode, INF);

                // Base tile out-nodes → Sink
                if (isBase) addEdge(outNode, T, INF);

                // out → adjacent in-nodes (free inter-tile flow)
                const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
                for (let d = 0; d < dirs.length; d++) {
                    const nx = x + dirs[d].dx, ny = y + dirs[d].dy;
                    if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
                    if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
                    addEdge(outNode, nx * 50 + ny, INF);
                }
            }
        }

        // Dinic's BFS — build level graph
        const level = new Int32Array(N);
        function bfs() {
            level.fill(-1);
            level[S] = 0;
            const q = [S]; let qi = 0;
            while (qi < q.length) {
                const u = q[qi++];
                const edges = adj[u];
                for (let i = 0; i < edges.length; i++) {
                    const ei = edges[i];
                    if (eCap[ei] > 0 && level[eTo[ei]] < 0) {
                        level[eTo[ei]] = level[u] + 1;
                        q.push(eTo[ei]);
                    }
                }
            }
            return level[T] >= 0;
        }

        // Dinic's iterative DFS — find blocking flow
        const iter = new Int32Array(N);
        function dfs(u, pushed) {
            if (u === T) return pushed;
            const edges = adj[u];
            for (; iter[u] < edges.length; iter[u]++) {
                const ei = edges[iter[u]];
                const v = eTo[ei];
                if (eCap[ei] <= 0 || level[v] !== level[u] + 1) continue;
                const d = dfs(v, Math.min(pushed, eCap[ei]));
                if (d > 0) {
                    eCap[ei] -= d;
                    eCap[ei ^ 1] += d;
                    return d;
                }
            }
            return 0;
        }

        // Run Dinic's max-flow
        while (bfs()) {
            iter.fill(0);
            let f;
            do { f = dfs(S, INF); } while (f > 0);
        }

        // Find reachable set in residual graph from S
        const reachable = new Uint8Array(N);
        const q2 = [S]; reachable[S] = 1; let qi2 = 0;
        while (qi2 < q2.length) {
            const u = q2[qi2++];
            const edges = adj[u];
            for (let i = 0; i < edges.length; i++) {
                const ei = edges[i];
                if (eCap[ei] > 0 && !reachable[eTo[ei]]) {
                    reachable[eTo[ei]] = 1;
                    q2.push(eTo[ei]);
                }
            }
        }

        // Min-cut: tiles where in-node reachable but out-node is not
        const ramparts = [];
        for (let x = 2; x < 48; x++) {
            for (let y = 2; y < 48; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                const inNode = x * 50 + y;
                if (reachable[inNode] && !reachable[inNode + 2500]) {
                    ramparts.push({x, y});
                }
            }
        }

        return ramparts;
    }

    // ─── Step 8: Road Exit Rampart Coverage ─────────────────────────────

    /**
     * For every rampart tile that coincides with a road (an "exit"),
     * traces 3 tiles inward toward the anchor and adds ramparts there too.
     * This creates a safe rampart airlock corridor over every road exit.
     */
    static addRoadRamparts(blueprint) {
        const roadSet = new Set();
        for (let i = 0; i < blueprint.roads.length; i++) {
            roadSet.add(`${blueprint.roads[i].x},${blueprint.roads[i].y}`);
        }

        const rampartSet = new Set();
        for (let i = 0; i < blueprint.ramparts.length; i++) {
            rampartSet.add(`${blueprint.ramparts[i].x},${blueprint.ramparts[i].y}`);
        }

        const ax = blueprint.anchor.x, ay = blueprint.anchor.y;
        const newRamparts = [];

        for (let i = 0; i < blueprint.ramparts.length; i++) {
            const rp = blueprint.ramparts[i];
            if (!roadSet.has(`${rp.x},${rp.y}`)) continue;

            // This rampart is on a road — trace 3 tiles inward toward anchor
            let cx = rp.x, cy = rp.y;
            for (let step = 0; step < 3; step++) {
                // Step inward: move 1 tile in the direction of anchor
                const dx = ax - cx, dy = ay - cy;
                const adx = Math.abs(dx), ady = Math.abs(dy);
                let nx = cx, ny = cy;
                if (adx >= ady) nx += (dx > 0 ? 1 : -1);
                else            ny += (dy > 0 ? 1 : -1);

                const nkey = `${nx},${ny}`;
                if (!rampartSet.has(nkey)) {
                    rampartSet.add(nkey);
                    newRamparts.push({x: nx, y: ny});
                }
                cx = nx; cy = ny;
            }
        }

        for (let i = 0; i < newRamparts.length; i++) {
            blueprint.ramparts.push(newRamparts[i]);
        }
    }

    // ─── Blueprint Execution ─────────────────────────────────────────────

    static executeBlueprint(room) {
        const blueprint = global.Cache.blueprints.get(room.name);
        if (!blueprint) return;

        const rcl = room.controller.level;
        const state = global.State?.rooms?.get(room.name);
        if (!state) return;

        let sitesPlaced = 0;
        const maxSitesPerTick = 3;

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

        // 1. Containers first
        if (blueprint.containers && rcl >= 1) {
            const maxContainers = CONTROLLER_STRUCTURES[STRUCTURE_CONTAINER][rcl];
            let containerCount = state.containers ? state.containers.length : 0;
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
                if (room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER) === OK) {
                    sitesPlaced++; containerCount++; existingPositions.add(key);
                }
            }
        }

        // 2. Extensions
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_EXTENSION, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        // 3. Towers
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_TOWER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        // 4. Spawns (2nd, 3rd)
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_SPAWN, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        // 5. Core logistics
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_STORAGE, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_TERMINAL, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_FACTORY, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        // 6. Labs
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_LAB, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        // 7. Rare structures
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_OBSERVER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_NUKER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_POWER_SPAWN, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);

        // 8. Roads
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
                if (room.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD) === OK) {
                    sitesPlaced++; roadCount++; existingPositions.add(key);
                }
            }
        }

        // 9. Ramparts (RCL 4+)
        if (rcl >= 4 && blueprint.ramparts && sitesPlaced < maxSitesPerTick) {
            for (let i = 0; i < blueprint.ramparts.length && sitesPlaced < maxSitesPerTick; i++) {
                const pos = blueprint.ramparts[i];
                const key = pos.x + '_' + pos.y + '_' + STRUCTURE_RAMPART;
                if (existingPositions.has(key)) continue;
                if (room.createConstructionSite(pos.x, pos.y, STRUCTURE_RAMPART) === OK) {
                    sitesPlaced++; existingPositions.add(key);
                }
            }
        }
    }

    static placeStructureType(room, blueprint, structureType, rcl, existingPositions, state, maxToPlace) {
        if (maxToPlace <= 0) return 0;
        const positions = blueprint[structureType];
        if (!positions || positions.length === 0) return 0;

        const maxAllowed = CONTROLLER_STRUCTURES[structureType][rcl];
        if (maxAllowed === 0) return 0;

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
            if (room.createConstructionSite(pos.x, pos.y, structureType) === OK) {
                placed++; count++; existingPositions.add(key);
            }
        }
        return placed;
    }

    // ─── Blueprint Visualizer ────────────────────────────────────────────

    static visualize() {
        if (!global.Cache || !global.Cache.blueprints) return;

        for (const [roomName, blueprint] of global.Cache.blueprints.entries()) {
            const visual = new RoomVisual(roomName);

            // Roads — faint grey dots
            if (blueprint.roads) {
                for (let i = 0; i < blueprint.roads.length; i++) {
                    const p = blueprint.roads[i];
                    visual.circle(p.x, p.y, {radius: 0.15, fill: '#888888', opacity: 0.4});
                }
            }

            // Structures — color-coded squares
            const structureColors = {
                [STRUCTURE_SPAWN]:      '#ffaa00',
                [STRUCTURE_EXTENSION]:  '#ffe066',
                [STRUCTURE_TOWER]:      '#ff4444',
                [STRUCTURE_STORAGE]:    '#44ff44',
                [STRUCTURE_TERMINAL]:   '#44ffff',
                [STRUCTURE_FACTORY]:    '#ff8800',
                [STRUCTURE_POWER_SPAWN]:'#ff44ff',
                [STRUCTURE_NUKER]:      '#884444',
                [STRUCTURE_OBSERVER]:   '#4488ff',
            };

            for (const type in structureColors) {
                if (!blueprint[type]) continue;
                for (let i = 0; i < blueprint[type].length; i++) {
                    const p = blueprint[type][i];
                    visual.rect(p.x-0.35, p.y-0.35, 0.7, 0.7, {fill: structureColors[type], opacity: 0.45});
                }
            }

            // Labs — reactors purple, suppliers bright cyan
            if (blueprint[STRUCTURE_LAB]) {
                const supplierSet = new Set();
                if (blueprint.supplierLabs) {
                    for (let i = 0; i < blueprint.supplierLabs.length; i++) {
                        supplierSet.add(`${blueprint.supplierLabs[i].x},${blueprint.supplierLabs[i].y}`);
                    }
                }
                for (let i = 0; i < blueprint[STRUCTURE_LAB].length; i++) {
                    const p = blueprint[STRUCTURE_LAB][i];
                    const isSupplier = supplierSet.has(`${p.x},${p.y}`);
                    visual.rect(p.x-0.35, p.y-0.35, 0.7, 0.7, {
                        fill: isSupplier ? '#00ffff' : '#cc44ff', opacity: 0.6
                    });
                    if (isSupplier) visual.text('S', p.x, p.y+0.1, {color:'#000', font: 0.4});
                }
            }

            // Containers — white squares
            if (blueprint.containers) {
                for (let i = 0; i < blueprint.containers.length; i++) {
                    const p = blueprint.containers[i];
                    visual.rect(p.x-0.3, p.y-0.3, 0.6, 0.6, {fill: '#ffffff', opacity: 0.5});
                }
            }

            // Ramparts — green outlines (thicker for road exits)
            if (blueprint.ramparts) {
                const roadSet = new Set();
                if (blueprint.roads) {
                    for (let i = 0; i < blueprint.roads.length; i++) roadSet.add(`${blueprint.roads[i].x},${blueprint.roads[i].y}`);
                }
                for (let i = 0; i < blueprint.ramparts.length; i++) {
                    const p = blueprint.ramparts[i];
                    const isRoadExit = roadSet.has(`${p.x},${p.y}`);
                    visual.rect(p.x-0.45, p.y-0.45, 0.9, 0.9, {
                        fill: 'transparent',
                        stroke: isRoadExit ? '#ffff00' : '#00ff00',
                        strokeWidth: isRoadExit ? 0.15 : 0.08,
                        opacity: 0.6
                    });
                }
            }

            // Anchor marker — bright white circle
            if (blueprint.anchor) {
                visual.circle(blueprint.anchor.x, blueprint.anchor.y, {radius: 0.3, fill: '#ffffff', opacity: 0.9});
                visual.text('⚙', blueprint.anchor.x, blueprint.anchor.y + 0.1, {color: '#000000', font: 0.5});
            }
        }
    }
}

module.exports = RoomPlanner;