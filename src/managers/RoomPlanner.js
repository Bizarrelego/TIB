const GameObjectUtility = require('../utilities/GameObjectUtility');

/**
 * Production-Grade Room Planner v3
 *
 * Pipeline:
 *  1. findAnchor          — Distance transform; anchor nudged to road parity.
 *  2. applyCoreStamp      — Hardcoded 5-tile Core Hub.
 *  3. applyLabStamp       — 2+8 lab cluster (4-quadrant, contiguous only).
 *  4. placeExtensionPods  — 8 dense 3×3 pods (1 road + 8 extensions each).
 *  5. planContainers      — Source + controller containers.
 *  6. planRoads           — MST spine: anchor → pods → resources.
 *  7. computeMinCut       — Dinic's max-flow for true min-cut ramparts.
 *  8. addRoadRamparts     — 3-deep road exit airlocks.
 *  9. addOutpostRamparts  — Tight rampart rings for external resources.
 */
class RoomPlanner {

    static run() {
        if (Game.cpu.bucket <= 500) return;
        if (Game.time % 50 !== 0) return;
        if (!global.Cache) global.Cache = { blueprints: new Map() };
        if (!(global.Cache.blueprints instanceof Map)) global.Cache.blueprints = new Map();
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) this.manageRoom(room);
        }
    }

    static manageRoom(room) {
        if (!global.Cache.blueprints.has(room.name)) this.generateBlueprint(room);
        if (Game.time % 13 !== 0) return;
        if (Object.keys(Game.constructionSites).length > 50) return;
        this.executeBlueprint(room);
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
            podCenters: [],
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

        // Step 1: Anchor — must land on road parity (ax+ay)%2===0
        let anchor = this.findAnchor(room, terrain);
        if ((anchor.x + anchor.y) % 2 !== 0) {
            const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
            for (let i = 0; i < dirs.length; i++) {
                const nx = anchor.x + dirs[i].x, ny = anchor.y + dirs[i].y;
                if (nx >= 3 && nx <= 46 && ny >= 3 && ny <= 46 && terrain.get(nx, ny) !== TERRAIN_MASK_WALL) {
                    anchor = {x: nx, y: ny}; break;
                }
            }
        }
        blueprint.anchor = anchor;

        const visited = new Set();

        // Step 2: Core Hub stamp
        this.applyCoreStamp(blueprint, terrain, anchor, visited);

        // Step 3: Lab cluster (best-fit quadrant, contiguous only)
        this.applyLabStamp(blueprint, terrain, anchor, visited);

        // Step 4: Extension pods (8 dense 3×3 pods around core+lab)
        this.placeExtensionPods(blueprint, terrain, anchor, visited);

        // Step 5: Source + controller containers
        if (state) this.planContainers(blueprint, room, state, terrain);

        // Step 6: MST roads (pod spine + resource routes)
        if (state) this.planRoads(blueprint, room, state, anchor);

        // Step 7: Min-cut ramparts
        blueprint.ramparts = this.computeMinCut(terrain, visited, anchor);

        // Step 8: Road exit airlocks (3-deep)
        this.addRoadRamparts(blueprint);

        // Step 9: Outpost ramparts for external resources
        if (state) this.addOutpostRamparts(blueprint, terrain, state);

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
     * Hardcoded Core Hub stamp.
     * Convention: (dx+dy)%2===0 → road, (dx+dy)%2===1 → structure.
     * Anchor is always nudged to road parity before this runs.
     */
    static applyCoreStamp(blueprint, terrain, anchor, visited) {
        const ax = anchor.x, ay = anchor.y;
        const stamp = [
            // Roads (dx+dy even)
            { type: 'road', dx:  0, dy:  0 },  // Hub Manager standing tile
            { type: 'road', dx:  1, dy:  1 }, { type: 'road', dx: -1, dy:  1 },
            { type: 'road', dx:  1, dy: -1 }, { type: 'road', dx: -1, dy: -1 },
            { type: 'road', dx:  2, dy:  0 }, { type: 'road', dx: -2, dy:  0 },
            { type: 'road', dx:  0, dy:  2 }, { type: 'road', dx:  0, dy: -2 },
            { type: 'road', dx:  2, dy:  2 }, { type: 'road', dx: -2, dy:  2 },
            { type: 'road', dx:  2, dy: -2 }, { type: 'road', dx: -2, dy: -2 },
            // Structures (dx+dy odd)
            { type: STRUCTURE_STORAGE,     dx:  1, dy:  0 },
            { type: STRUCTURE_TERMINAL,    dx: -1, dy:  0 },
            { type: STRUCTURE_FACTORY,     dx:  0, dy:  1 },
            { type: STRUCTURE_SPAWN,       dx:  0, dy: -1 },   // Spawn 1 (primary)
            { type: STRUCTURE_TOWER,       dx:  2, dy:  1 }, { type: STRUCTURE_TOWER, dx: -2, dy:  1 },
            { type: STRUCTURE_TOWER,       dx:  2, dy: -1 }, { type: STRUCTURE_TOWER, dx: -2, dy: -1 },
            { type: STRUCTURE_TOWER,       dx:  1, dy:  2 }, { type: STRUCTURE_TOWER, dx: -1, dy:  2 },
            { type: STRUCTURE_SPAWN,       dx:  1, dy: -2 },   // Spawn 2
            { type: STRUCTURE_SPAWN,       dx: -1, dy: -2 },   // Spawn 3
            { type: STRUCTURE_POWER_SPAWN, dx:  3, dy:  0 },
            { type: STRUCTURE_OBSERVER,    dx: -3, dy:  0 },
            { type: STRUCTURE_NUKER,       dx:  0, dy:  3 },
        ];

        for (let i = 0; i < stamp.length; i++) {
            const { type, dx, dy } = stamp[i];
            const x = ax + dx, y = ay + dy;
            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);
            if (type === 'road') blueprint.roads.push({x, y});
            else blueprint[type].push({x, y});
        }
    }

    // ─── Step 3: Lab Stamp ───────────────────────────────────────────────

    /**
     * Places the 2-supplier + 8-reactor lab cluster as a guaranteed contiguous block.
     * Tries 4 quadrant variants; picks the one with the most valid tiles.
     * If a quadrant scores < 10, that variant is still chosen (partial placement
     * is better than scattering), but labs are NEVER placed individually via BFS.
     *
     * Verified: both S1 and S2 are within Chebyshev range 2 of all 8 reactors.
     * Layout: [R0][S1][S2][R1] / [R2][R3][R4][R5] / ····[R6][R7]
     */
    static applyLabStamp(blueprint, terrain, anchor, visited) {
        const ax = anchor.x, ay = anchor.y;

        const variants = [
            // RIGHT of core (dx 4–7)
            [
                {dx:4,dy:-1,s:false},{dx:5,dy:-1,s:true},{dx:6,dy:-1,s:true},{dx:7,dy:-1,s:false},
                {dx:4,dy: 0,s:false},{dx:5,dy: 0,s:false},{dx:6,dy: 0,s:false},{dx:7,dy: 0,s:false},
                {dx:5,dy: 1,s:false},{dx:6,dy: 1,s:false},
            ],
            // LEFT of core (dx -4 to -7)
            [
                {dx:-4,dy:-1,s:false},{dx:-5,dy:-1,s:true},{dx:-6,dy:-1,s:true},{dx:-7,dy:-1,s:false},
                {dx:-4,dy: 0,s:false},{dx:-5,dy: 0,s:false},{dx:-6,dy: 0,s:false},{dx:-7,dy: 0,s:false},
                {dx:-5,dy: 1,s:false},{dx:-6,dy: 1,s:false},
            ],
            // BELOW core (dy 4–7)
            [
                {dx:-1,dy:4,s:false},{dx:-1,dy:5,s:true},{dx:-1,dy:6,s:true},{dx:-1,dy:7,s:false},
                {dx: 0,dy:4,s:false},{dx: 0,dy:5,s:false},{dx: 0,dy:6,s:false},{dx: 0,dy:7,s:false},
                {dx: 1,dy:5,s:false},{dx: 1,dy:6,s:false},
            ],
            // ABOVE core (dy -4 to -7)
            [
                {dx:-1,dy:-4,s:false},{dx:-1,dy:-5,s:true},{dx:-1,dy:-6,s:true},{dx:-1,dy:-7,s:false},
                {dx: 0,dy:-4,s:false},{dx: 0,dy:-5,s:false},{dx: 0,dy:-6,s:false},{dx: 0,dy:-7,s:false},
                {dx: 1,dy:-5,s:false},{dx: 1,dy:-6,s:false},
            ]
        ];

        let bestScore = -1, bestVariant = null;
        for (let v = 0; v < variants.length; v++) {
            let score = 0;
            for (let j = 0; j < variants[v].length; j++) {
                const x = ax + variants[v][j].dx, y = ay + variants[v][j].dy;
                if (x >= 2 && x <= 47 && y >= 2 && y <= 47 &&
                    terrain.get(x, y) !== TERRAIN_MASK_WALL && !visited.has(`${x},${y}`)) score++;
            }
            if (score > bestScore) { bestScore = score; bestVariant = variants[v]; }
        }

        if (!bestVariant || bestScore === 0) return;

        for (let j = 0; j < bestVariant.length; j++) {
            const { dx, dy, s } = bestVariant[j];
            const x = ax + dx, y = ay + dy;
            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
            if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);
            blueprint[STRUCTURE_LAB].push({x, y});
            if (s) blueprint.supplierLabs.push({x, y});
        }
    }

    // ─── Step 4: Extension Pods ──────────────────────────────────────────

    /**
     * Places up to 8 dense 3×3 extension pods around the core+lab.
     *
     * Pod layout:
     *   [E][E][E]
     *   [E][R][E]   ← Road at center. Filler creep stands here.
     *   [E][E][E]       Transfer range 1 includes diagonals → fills all 8 in 1 tick.
     *
     * Candidates: 12 symmetric positions around the core.
     * Selection: scored by number of valid (non-wall, non-visited) tiles in 3×3 area.
     * Top 8 are chosen. Total extensions capped at 60.
     */
    static placeExtensionPods(blueprint, terrain, anchor, visited) {
        const ax = anchor.x, ay = anchor.y;

        // 12 symmetric candidate pod center offsets from anchor
        const candidates = [
            {dx: -6, dy: -3}, {dx: -6, dy:  0}, {dx: -6, dy:  3},
            {dx:  6, dy: -3}, {dx:  6, dy:  0}, {dx:  6, dy:  3},
            {dx: -3, dy: -6}, {dx:  0, dy: -6}, {dx:  3, dy: -6},
            {dx: -3, dy:  6}, {dx:  0, dy:  6}, {dx:  3, dy:  6},
        ];

        // Score each candidate
        const scored = candidates.map(c => {
            const pcx = ax + c.dx, pcy = ay + c.dy;
            if (pcx < 3 || pcx > 46 || pcy < 3 || pcy > 46) return {dx: c.dx, dy: c.dy, score: 0};
            if (terrain.get(pcx, pcy) === TERRAIN_MASK_WALL || visited.has(`${pcx},${pcy}`)) return {dx: c.dx, dy: c.dy, score: 0};
            let score = 0;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const x = pcx + dx, y = pcy + dy;
                    if (x >= 2 && x <= 47 && y >= 2 && y <= 47 &&
                        terrain.get(x, y) !== TERRAIN_MASK_WALL && !visited.has(`${x},${y}`)) score++;
                }
            }
            return {dx: c.dx, dy: c.dy, score};
        });

        // Pick top 8 by score
        scored.sort((a, b) => b.score - a.score);
        const topPods = scored.slice(0, 8);

        let extensionsPlaced = blueprint[STRUCTURE_EXTENSION].length;
        const extOffsets = [
            {dx:-1,dy:-1},{dx:0,dy:-1},{dx:1,dy:-1},
            {dx:-1,dy: 0},              {dx:1,dy: 0},
            {dx:-1,dy: 1},{dx:0,dy: 1},{dx:1,dy: 1},
        ];

        for (let p = 0; p < topPods.length && extensionsPlaced < 60; p++) {
            if (topPods[p].score === 0) continue;

            const pcx = ax + topPods[p].dx;
            const pcy = ay + topPods[p].dy;

            // Place road at pod center
            const ckey = `${pcx},${pcy}`;
            if (!visited.has(ckey) && terrain.get(pcx, pcy) !== TERRAIN_MASK_WALL) {
                visited.add(ckey);
                blueprint.roads.push({x: pcx, y: pcy});
                blueprint.podCenters.push({x: pcx, y: pcy});
            }

            // Place extensions in the 8 surrounding tiles
            for (let e = 0; e < extOffsets.length && extensionsPlaced < 60; e++) {
                const x = pcx + extOffsets[e].dx;
                const y = pcy + extOffsets[e].dy;
                if (x < 2 || x > 47 || y < 2 || y > 47) continue;
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                const key = `${x},${y}`;
                if (visited.has(key)) continue;
                visited.add(key);
                blueprint[STRUCTURE_EXTENSION].push({x, y});
                extensionsPlaced++;
            }
        }
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
                if (dist < bestDist) { bestDist = dist; best = {x, y}; }
            }
        }
        return best;
    }

    // ─── Step 6: MST Road Spine ──────────────────────────────────────────

    /**
     * Routes MST roads from anchor to:
     *   - Each pod center (internal spine)
     *   - Each source/controller container (hauler/upgrader routes)
     *   - Mineral (future remote mining)
     *
     * Roads merge naturally because pod roads are seeded in the CostMatrix at
     * cost 1, causing PathFinder to route through them preferentially.
     */
    static planRoads(blueprint, room, state, anchor) {
        const anchorPos = new RoomPosition(anchor.x, anchor.y, room.name);

        // Build target list: pods first (short), then external resources
        const targets = [];
        for (let i = 0; i < blueprint.podCenters.length; i++) targets.push(blueprint.podCenters[i]);
        for (let i = 0; i < blueprint.containers.length; i++) targets.push(blueprint.containers[i]);
        if (state.mineral) targets.push({x: state.mineral.pos.x, y: state.mineral.pos.y});

        targets.sort((a, b) => {
            const dA = Math.max(Math.abs(a.x-anchor.x), Math.abs(a.y-anchor.y));
            const dB = Math.max(Math.abs(b.x-anchor.x), Math.abs(b.y-anchor.y));
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
            const ret = PathFinder.search(anchorPos, {pos: targetPos, range: 1}, {
                plainCost: 2,
                swampCost: 5,  // Strongly penalize swamp — prefer extra plains tiles
                roomCallback: (rn) => rn === room.name ? costs : false,
                maxOps: 4000
            });

            for (let j = 0; j < ret.path.length; j++) {
                const step = ret.path[j];
                if (step.x >= 2 && step.x <= 47 && step.y >= 2 && step.y <= 47 && costs.get(step.x, step.y) !== 1) {
                    blueprint.roads.push({x: step.x, y: step.y});
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
    static computeMinCut(terrain, baseSet, anchor) {
        const N = 5002, S = 5000, T = 5001, INF = 999999;
        const adj = new Array(N);
        for (let i = 0; i < N; i++) adj[i] = [];
        const eTo = [], eCap = [];

        function addEdge(u, v, c) {
            adj[u].push(eTo.length); eTo.push(v); eCap.push(c);
            adj[v].push(eTo.length); eTo.push(u); eCap.push(0);
        }

        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                const inNode = x*50+y, outNode = inNode+2500;
                const isBase = baseSet.has(`${x},${y}`);
                const isBorder = x <= 1 || x >= 48 || y <= 1 || y >= 48;
                addEdge(inNode, outNode, isBase || isBorder ? INF : 1);
                if (isBorder) addEdge(S, inNode, INF);
                if (isBase) addEdge(outNode, T, INF);
                const dirs = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
                for (let d = 0; d < dirs.length; d++) {
                    const nx = x+dirs[d].dx, ny = y+dirs[d].dy;
                    if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
                    if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
                    addEdge(outNode, nx*50+ny, INF);
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
                for (let i = 0; i < adj[u].length; i++) {
                    const ei = adj[u][i];
                    if (eCap[ei] > 0 && level[eTo[ei]] < 0) { level[eTo[ei]] = level[u]+1; q.push(eTo[ei]); }
                }
            }
            return level[T] >= 0;
        }

        // Dinic's DFS blocking flow
        const iter = new Int32Array(N);
        function dfs(u, pushed) {
            if (u === T) return pushed;
            for (; iter[u] < adj[u].length; iter[u]++) {
                const ei = adj[u][iter[u]], v = eTo[ei];
                if (eCap[ei] <= 0 || level[v] !== level[u]+1) continue;
                const d = dfs(v, Math.min(pushed, eCap[ei]));
                if (d > 0) { eCap[ei] -= d; eCap[ei^1] += d; return d; }
            }
            return 0;
        }

        while (bfs()) {
            iter.fill(0);
            let f;
            do { f = dfs(S, INF); } while (f > 0);
        }

        // BFS in residual graph from S to find reachable set
        const reachable = new Uint8Array(N);
        const q2 = [S]; reachable[S] = 1; let qi2 = 0;
        while (qi2 < q2.length) {
            const u = q2[qi2++];
            for (let i = 0; i < adj[u].length; i++) {
                const ei = adj[u][i];
                if (eCap[ei] > 0 && !reachable[eTo[ei]]) { reachable[eTo[ei]] = 1; q2.push(eTo[ei]); }
            }
        }

        // Cut tiles: in-node reachable, out-node not reachable
        const ramparts = [];
        for (let x = 2; x < 48; x++) {
            for (let y = 2; y < 48; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                const id = x*50+y;
                if (reachable[id] && !reachable[id+2500]) ramparts.push({x, y});
            }
        }
        return ramparts;
    }

    // ─── Step 8: Road Exit Airlocks ──────────────────────────────────────

    /**
     * For every rampart that sits on a road (a "road exit"),
     * traces 3 tiles inward toward anchor and also places ramparts.
     * This creates a safe rampart corridor over every road exit.
     */
    static addRoadRamparts(blueprint) {
        const roadSet = new Set(blueprint.roads.map(r => `${r.x},${r.y}`));
        const rampartSet = new Set(blueprint.ramparts.map(r => `${r.x},${r.y}`));
        const ax = blueprint.anchor.x, ay = blueprint.anchor.y;
        const newRamparts = [];

        for (let i = 0; i < blueprint.ramparts.length; i++) {
            const rp = blueprint.ramparts[i];
            if (!roadSet.has(`${rp.x},${rp.y}`)) continue;
            let cx = rp.x, cy = rp.y;
            for (let step = 0; step < 3; step++) {
                const dx = ax - cx, dy = ay - cy;
                let nx = cx, ny = cy;
                if (Math.abs(dx) >= Math.abs(dy)) nx += (dx > 0 ? 1 : -1);
                else ny += (dy > 0 ? 1 : -1);
                const nkey = `${nx},${ny}`;
                if (!rampartSet.has(nkey)) { rampartSet.add(nkey); newRamparts.push({x: nx, y: ny}); }
                cx = nx; cy = ny;
            }
        }
        for (let i = 0; i < newRamparts.length; i++) blueprint.ramparts.push(newRamparts[i]);
    }

    // ─── Step 9: Outpost Ramparts ────────────────────────────────────────

    /**
     * BFS inward from anchor (ramparts are boundaries).
     * Any source/controller/mineral NOT reachable from anchor = outside perimeter.
     * For each external resource, places a Chebyshev-range-1 rampart ring.
     */
    static addOutpostRamparts(blueprint, terrain, state) {
        // BFS from anchor, ramparts act as walls
        const rampartSet = new Set(blueprint.ramparts.map(r => `${r.x},${r.y}`));
        const inside = new Set();
        const start = blueprint.anchor;
        inside.add(`${start.x},${start.y}`);
        const q = [{x: start.x, y: start.y}]; let qi = 0;
        while (qi < q.length) {
            const cur = q[qi++];
            const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
            for (let i = 0; i < dirs.length; i++) {
                const nx = cur.x + dirs[i].x, ny = cur.y + dirs[i].y;
                if (nx < 0 || nx >= 50 || ny < 0 || ny >= 50) continue;
                if (terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;
                const key = `${nx},${ny}`;
                if (inside.has(key) || rampartSet.has(key)) continue;
                inside.add(key); q.push({x: nx, y: ny});
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
            if (inside.has(`${pos.x},${pos.y}`)) continue;  // Already inside main perimeter

            // Place tight rampart ring (range 1) around external resource
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const rx = pos.x + dx, ry = pos.y + dy;
                    if (rx < 2 || rx > 47 || ry < 2 || ry > 47) continue;
                    if (terrain.get(rx, ry) === TERRAIN_MASK_WALL) continue;
                    const key = `${rx},${ry}`;
                    if (!rampartSet.has(key)) {
                        rampartSet.add(key);
                        outpostRamparts.push({x: rx, y: ry});
                    }
                }
            }
        }

        blueprint.outpostRamparts = outpostRamparts;
        for (let i = 0; i < outpostRamparts.length; i++) blueprint.ramparts.push(outpostRamparts[i]);
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

        // Containers first — critical for early progression
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

        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_EXTENSION, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_TOWER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_SPAWN, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_STORAGE, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_TERMINAL, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_FACTORY, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_LAB, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_OBSERVER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_NUKER, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);
        sitesPlaced += this.placeStructureType(room, blueprint, STRUCTURE_POWER_SPAWN, rcl, existingPositions, state, maxSitesPerTick - sitesPlaced);

        // Roads (RCL 2+)
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

        // Ramparts (RCL 4+)
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

    // ─── Visualizer ──────────────────────────────────────────────────────

    /**
     * Renders the full blueprint each tick.
     * Color legend:
     *   Roads          — grey dots
     *   Pod centers    — bright white dots (filler creep positions)
     *   Extensions     — yellow squares
     *   Spawns         — orange
     *   Storage        — green  |  Terminal — cyan  |  Factory — amber
     *   Towers         — red    |  Supplier labs — bright cyan + 'S'
     *   Reactor labs   — purple |  PowerSpawn — magenta
     *   Ramparts       — green outline
     *   Road-exit ramp — yellow outline (thicker)
     *   Outpost ramp   — orange outline (outpost protection)
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
                    visual.circle(p.x, p.y, {radius: 0.15, fill: '#888888', opacity: 0.35});
                }
            }

            // Pod centers (filler positions)
            if (blueprint.podCenters) {
                for (let i = 0; i < blueprint.podCenters.length; i++) {
                    const p = blueprint.podCenters[i];
                    visual.circle(p.x, p.y, {radius: 0.22, fill: '#ffffff', opacity: 0.8, stroke: '#aaaaaa', strokeWidth: 0.04});
                }
            }

            // Structures
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

            // Labs (supplier = cyan + label, reactor = purple)
            if (blueprint[STRUCTURE_LAB]) {
                const supplierSet = new Set((blueprint.supplierLabs || []).map(s=>`${s.x},${s.y}`));
                for (let i = 0; i < blueprint[STRUCTURE_LAB].length; i++) {
                    const p = blueprint[STRUCTURE_LAB][i];
                    const isSup = supplierSet.has(`${p.x},${p.y}`);
                    visual.rect(p.x-0.35, p.y-0.35, 0.7, 0.7, {fill: isSup ? '#00ffff' : '#cc44ff', opacity: 0.6});
                    if (isSup) visual.text('S', p.x, p.y+0.1, {color:'#000', font: 0.4});
                }
            }

            // Containers
            if (blueprint.containers) {
                for (let i = 0; i < blueprint.containers.length; i++) {
                    const p = blueprint.containers[i];
                    visual.rect(p.x-0.3, p.y-0.3, 0.6, 0.6, {fill: '#ffffff', opacity: 0.5});
                }
            }

            // Ramparts
            if (blueprint.ramparts) {
                const roadSet = new Set((blueprint.roads || []).map(r=>`${r.x},${r.y}`));
                const outpostSet = new Set((blueprint.outpostRamparts || []).map(r=>`${r.x},${r.y}`));
                for (let i = 0; i < blueprint.ramparts.length; i++) {
                    const p = blueprint.ramparts[i];
                    const isOutpost = outpostSet.has(`${p.x},${p.y}`);
                    const isRoadExit = !isOutpost && roadSet.has(`${p.x},${p.y}`);
                    visual.rect(p.x-0.45, p.y-0.45, 0.9, 0.9, {
                        fill: 'transparent',
                        stroke: isOutpost ? '#ff8800' : isRoadExit ? '#ffff00' : '#00ff00',
                        strokeWidth: isOutpost ? 0.14 : isRoadExit ? 0.12 : 0.07,
                        opacity: 0.7
                    });
                }
            }

            // Anchor marker
            if (blueprint.anchor) {
                visual.circle(blueprint.anchor.x, blueprint.anchor.y, {radius: 0.28, fill: '#ffffff', opacity: 0.9});
                visual.text('⚙', blueprint.anchor.x, blueprint.anchor.y+0.1, {color:'#000000', font: 0.45});
            }
        }
    }
}

module.exports = RoomPlanner;