// src/mincut.js
// Dinic's Algorithm Max-Flow Min-Cut Rampart Boundary Calculation (Zero-Class Flat Functional)
const { GRID_EMPTY, GRID_ROAD, GRID_WALL } = require('./constants');
const { getRoomBlueprint } = require('./bunker');

function isBorderExitTile(terrain, x, y) {
    if (!terrain || !terrain.get) return false;
    return terrain.get(x, y) !== 1;
}

function computeMinCut(terrain, baseSetArray) {
    const N = 5002;
    const S = 5000;
    const T = 5001;
    const INF = 999999;
    const maxEdges = 140000;

    const head = new Int32Array(N).fill(-1);
    const next = new Int32Array(maxEdges);
    const eTo = new Int32Array(maxEdges);
    const eCap = new Int32Array(maxEdges);
    let edgeCount = 0;

    function addEdge(u, v, c) {
        if (edgeCount + 2 >= maxEdges) return;
        eTo[edgeCount] = v; eCap[edgeCount] = c; next[edgeCount] = head[u]; head[u] = edgeCount++;
        eTo[edgeCount] = u; eCap[edgeCount] = 0; next[edgeCount] = head[v]; head[v] = edgeCount++;
    }

    // Precompute nearExit tiles within Chebyshev distance <= 2 of open room border exits
    // so protective dilation never swallows cuttable rampart tiles right before exits.
    const nearExit = new Uint8Array(2500);
    for (let i = 0; i < 50; i++) {
        const edgeCoords = [
            [i, 0], [i, 49], [0, i], [49, i]
        ];
        for (let e = 0; e < 4; e++) {
            const ex = edgeCoords[e][0];
            const ey = edgeCoords[e][1];
            if (!isBorderExitTile(terrain, ex, ey)) continue;
            for (let dx = -2; dx <= 2; dx++) {
                const nx = ex + dx;
                if (nx < 1 || nx > 48) continue;
                for (let dy = -2; dy <= 2; dy++) {
                    const ny = ey + dy;
                    if (ny >= 1 && ny <= 48) {
                        nearExit[nx * 50 + ny] = 1;
                    }
                }
            }
        }
    }

    // Dilate baseSet by 2 tiles for standoff distance against ranged attackers
    const dilatedBaseSet = new Uint8Array(2500);
    if (baseSetArray && baseSetArray.length >= 2500) {
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                if (baseSetArray[x * 50 + y]) {
                    dilatedBaseSet[x * 50 + y] = 1;
                    for (let dx = -2; dx <= 2; dx++) {
                        for (let dy = -2; dy <= 2; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 2 && nx <= 47 && ny >= 2 && ny <= 47 && !nearExit[nx * 50 + ny]) {
                                dilatedBaseSet[nx * 50 + ny] = 1;
                            }
                        }
                    }
                }
            }
        }
    } else {
        for (let x = 18; x <= 32; x++) {
            for (let y = 18; y <= 32; y++) {
                dilatedBaseSet[x * 50 + y] = 1;
            }
        }
    }

    const dirs = [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    // Build bipartite vertex-split graph: in-node (p) -> out-node (p + 2500)
    for (let x = 1; x < 49; x++) {
        for (let y = 1; y < 49; y++) {
            if (terrain && terrain.get && terrain.get(x, y) === 1) continue;
            const p = x * 50 + y;

            // Connect S only to tiles directly adjacent to real open exit border tiles (x=0/49 or y=0/49)
            let isRealExitAdjacent = false;
            if (x === 1 && isBorderExitTile(terrain, 0, y)) isRealExitAdjacent = true;
            else if (x === 48 && isBorderExitTile(terrain, 49, y)) isRealExitAdjacent = true;
            else if (y === 1 && isBorderExitTile(terrain, x, 0)) isRealExitAdjacent = true;
            else if (y === 48 && isBorderExitTile(terrain, x, 49)) isRealExitAdjacent = true;
            else if (x === 1 && y === 1 && (terrain && terrain.get && terrain.get(0, 0) !== 1)) isRealExitAdjacent = true;

            // Keep outer border ring (x=1, x=48, y=1, y=48) un-cuttable (INF) so all cuts lie on valid buildable tiles (2..47)
            const isOuterRing = (x === 1 || x === 48 || y === 1 || y === 48);
            const isProtected = dilatedBaseSet[p] === 1;

            if (isRealExitAdjacent) {
                addEdge(S, p, INF);
            }
            if (isProtected) {
                addEdge(p + 2500, T, INF);
            }

            // CRITICAL: Base core and outer border ring must have INF vertex capacity so Dinic never cuts through them
            const vertexCap = (isProtected || isOuterRing) ? INF : 1;
            addEdge(p, p + 2500, vertexCap);

            for (let i = 0; i < 8; i++) {
                const nx = x + dirs[i][0];
                const ny = y + dirs[i][1];
                if (nx >= 1 && nx < 49 && ny >= 1 && ny < 49) {
                    if (!terrain || !terrain.get || terrain.get(nx, ny) !== 1) {
                        addEdge(p + 2500, nx * 50 + ny, INF);
                    }
                }
            }
        }
    }

    // Dinic's Algorithm BFS + DFS
    const level = new Int32Array(N);
    const ptr = new Int32Array(N);
    const q = new Int32Array(N);

    function bfs() {
        level.fill(-1);
        level[S] = 0;
        let qh = 0, qt = 0;
        q[qt++] = S;
        while (qh < qt) {
            const v = q[qh++];
            for (let e = head[v]; e !== -1; e = next[e]) {
                if (eCap[e] > 0 && level[eTo[e]] === -1) {
                    level[eTo[e]] = level[v] + 1;
                    q[qt++] = eTo[e];
                }
            }
        }
        return level[T] !== -1;
    }

    function dfs(v, pushed) {
        if (pushed === 0 || v === T) return pushed;
        for (let e = ptr[v]; e !== -1; e = next[e]) {
            ptr[v] = e;
            const tr = eTo[e];
            if (level[v] + 1 !== level[tr] || eCap[e] === 0) continue;
            const trPush = dfs(tr, Math.min(pushed, eCap[e]));
            if (trPush > 0) {
                eCap[e] -= trPush;
                eCap[e ^ 1] += trPush;
                return trPush;
            }
        }
        return 0;
    }

    while (bfs()) {
        for (let i = 0; i < N; i++) ptr[i] = head[i];
        while (dfs(S, INF) > 0) {}
    }

    // Reachable set from S in residual graph -> cut edges (p in S-side, p+2500 in T-side)
    bfs();
    const cuts = [];
    for (let x = 2; x <= 47; x++) {
        for (let y = 2; y <= 47; y++) {
            if (terrain && terrain.get && terrain.get(x, y) === 1) continue;
            const p = x * 50 + y;
            if (level[p] !== -1 && level[p + 2500] === -1) {
                cuts.push({ x, y });
            }
        }
    }

    return cuts;
}

function buildBaseProtectMask(room, roomState, blueprintArg) {
    const mask = new Uint8Array(2500);
    let count = 0;
    const blueprint = blueprintArg || (getRoomBlueprint ? getRoomBlueprint(room) : null);

    // Protect all non-road structures encoded inside baseGrid (Core, Hub, Labs, Extensions, Singletons)
    if (blueprint && blueprint.baseGrid) {
        const bg = blueprint.baseGrid;
        for (let y = 2; y <= 47; y++) {
            for (let x = 2; x <= 47; x++) {
                const val = bg[y * 50 + x];
                if (val !== GRID_EMPTY && val !== GRID_WALL && val !== GRID_ROAD) {
                    if (!mask[x * 50 + y]) {
                        mask[x * 50 + y] = 1;
                        count++;
                    }
                }
            }
        }
    }

    // Core structures from blueprint arrays (including fallback when baseGrid is absent)
    const groups = blueprint
        ? [blueprint.spawns, blueprint.storage, blueprint.terminal, blueprint.factory, blueprint.powerSpawn, blueprint.nuker, blueprint.observer, blueprint.towers, blueprint.labs, blueprint.extensions]
        : [];
    for (let g = 0; g < groups.length; g++) {
        const list = groups[g];
        if (!Array.isArray(list)) continue;
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (p && p.x > 1 && p.x < 48 && p.y > 1 && p.y < 48 && !mask[p.x * 50 + p.y]) {
                mask[p.x * 50 + p.y] = 1;
                count++;
            }
        }
    }
    // Only core link at anchor (Chebyshev <= 2). DO NOT protect remote source or controller links!
    if (blueprint && blueprint.links && blueprint.anchor) {
        const a = blueprint.anchor;
        for (let i = 0; i < blueprint.links.length; i++) {
            const l = blueprint.links[i];
            if (Math.abs(l.x - a.x) <= 2 && Math.abs(l.y - a.y) <= 2) {
                if (l.x > 1 && l.x < 48 && l.y > 1 && l.y < 48) {
                    mask[l.x * 50 + l.y] = 1;
                    count++;
                }
            }
        }
    }
    // 5x5 Fast-Filler Core area around anchor
    if (blueprint && blueprint.anchor) {
        const a = blueprint.anchor;
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const nx = a.x + dx;
                const ny = a.y + dy;
                if (nx > 1 && nx < 48 && ny > 1 && ny < 48) {
                    mask[nx * 50 + ny] = 1;
                    count++;
                }
            }
        }
    }
    const spawns = (roomState && roomState.spawns) || [];
    for (let i = 0; i < spawns.length; i++) {
        const p = spawns[i].pos;
        if (p && p.x > 1 && p.x < 48 && p.y > 1 && p.y < 48) {
            mask[p.x * 50 + p.y] = 1;
            count++;
        }
    }
    if (room && room.storage) {
        const p = room.storage.pos;
        mask[p.x * 50 + p.y] = 1;
        count++;
    }
    return count > 0 ? mask : null;
}

function planMincutRamparts(roomOrTerrain, baseSetArray) {
    if (typeof roomOrTerrain === 'string') {
        const room = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[roomOrTerrain] : null;
        if (!room) return [];
        const heap = (typeof global !== 'undefined') ? (global.heap || (global.heap = {})) : null;
        const roomState = heap && heap.rooms ? heap.rooms[roomOrTerrain] : null;
        const rcl = (room.controller && room.controller.level) || 1;
        const blueprint = getRoomBlueprint ? getRoomBlueprint(room) : null;

        const bpVersion = (blueprint && blueprint._version) || 0;
        let cuts = null;
        if (heap && !baseSetArray) {
            if (!heap.mincutCache) heap.mincutCache = {};
            const cached = heap.mincutCache[roomOrTerrain];
            if (cached && cached.rcl === rcl && cached.bpVersion === bpVersion && typeof Game !== 'undefined' && Game.time < cached.expires) {
                cuts = cached.cuts;
            }
        }

        if (!cuts) {
            const terrain = room.getTerrain ? room.getTerrain() : null;
            const mask = baseSetArray || buildBaseProtectMask(room, roomState, blueprint);
            const rawCuts = computeMinCut(terrain, mask);

            cuts = rawCuts;
            if (blueprint) {
                blueprint.ramparts = rawCuts.slice();
            }

            if (heap && !baseSetArray && typeof Game !== 'undefined') {
                heap.mincutCache[roomOrTerrain] = { cuts, rcl, bpVersion, expires: Game.time + 500 };
            }
        }

        // Build set of all approved rampart positions (Single choke line + storage + spawns + core slots)
        const validRampartSet = new Set();
        for (let i = 0; i < cuts.length; i++) {
            validRampartSet.add(cuts[i].x + ':' + cuts[i].y);
        }
        if (room.storage) validRampartSet.add(room.storage.pos.x + ':' + room.storage.pos.y);
        const spawns = (roomState && roomState.spawns) || (room.find ? room.find(FIND_MY_SPAWNS) : []);
        for (let i = 0; i < spawns.length; i++) {
            validRampartSet.add(spawns[i].pos.x + ':' + spawns[i].pos.y);
        }
        const anchor = (blueprint && blueprint.anchor) || null;
        if (anchor) {
            validRampartSet.add(anchor.x + ':' + anchor.y);
            validRampartSet.add((anchor.x - 2) + ':' + anchor.y);
            validRampartSet.add((anchor.x + 2) + ':' + anchor.y);
        }

        // 1. Cancel unapproved rampart construction sites immediately
        if (heap && !baseSetArray && heap.mincutCache[roomOrTerrain]) {
            const mc = heap.mincutCache[roomOrTerrain];
            const stPos = room.storage ? (room.storage.pos.x + ',' + room.storage.pos.y) : '';
            const aKey = anchor ? (anchor.x + ',' + anchor.y) : '';
            mc.approvedSet = validRampartSet;
            mc._approvedSig = `${cuts.length}:${stPos}:${spawns.length}:${aKey}`;
        }
        const sites = (roomState && roomState.constructionSites) || (room.find ? (room.find(FIND_MY_CONSTRUCTION_SITES) || []) : []);
        for (let s = 0; s < sites.length; s++) {
            if (sites[s].structureType === STRUCTURE_RAMPART) {
                const key = sites[s].pos.x + ':' + sites[s].pos.y;
                if (!validRampartSet.has(key) && sites[s].remove) {
                    sites[s].remove();
                }
            }
        }

        // 2. Decommission obsolete / double-row ramparts (up to 5/tick during peacetime)
        const builtRamparts = (roomState && roomState.ramparts) || (room.find ? room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_RAMPART }) : []);
        const hasHostiles = !!(roomState && roomState.hostiles && roomState.hostiles.length > 0);
        if (!hasHostiles) {
            let destroyedRamparts = 0;
            for (let i = 0; i < builtRamparts.length && destroyedRamparts < 5; i++) {
                const rp = builtRamparts[i];
                const key = rp.pos.x + ':' + rp.pos.y;
                if (!validRampartSet.has(key) && rp.destroy) {
                    rp.destroy();
                    destroyedRamparts++;
                }
            }
        }

        // 3. Start sealing single-row perimeter at RCL >= 4 with headroom up to 14 sites
        if (room.createConstructionSite && rcl >= 4 && cuts.length > 0) {
            const rampartBuilt = new Set();
            for (let s = 0; s < builtRamparts.length; s++) {
                rampartBuilt.add(builtRamparts[s].pos.x + ':' + builtRamparts[s].pos.y);
            }
            for (let s = 0; s < sites.length; s++) {
                if (sites[s].structureType === STRUCTURE_RAMPART) {
                    rampartBuilt.add(sites[s].pos.x + ':' + sites[s].pos.y);
                }
            }

            // Prioritize cuts closest to roads/anchor first so enemy chokepoints seal earliest
            const refAnchor = anchor || { x: 25, y: 25 };
            const sortedCuts = cuts.slice().sort((a, b) => {
                const da = Math.max(Math.abs(a.x - refAnchor.x), Math.abs(a.y - refAnchor.y));
                const db = Math.max(Math.abs(b.x - refAnchor.x), Math.abs(b.y - refAnchor.y));
                return da - db;
            });

            let count = sites.length;
            for (let i = 0; i < sortedCuts.length && count < 14; i++) {
                const key = sortedCuts[i].x + ':' + sortedCuts[i].y;
                if (rampartBuilt.has(key)) continue;
                if (room.createConstructionSite(sortedCuts[i].x, sortedCuts[i].y, STRUCTURE_RAMPART) === OK) {
                    rampartBuilt.add(key);
                    count++;
                }
            }
        }
        return cuts;
    }

    if (roomOrTerrain && roomOrTerrain.getTerrain) {
        const terrain = roomOrTerrain.getTerrain();
        return computeMinCut(terrain, baseSetArray);
    }

    if (roomOrTerrain && typeof roomOrTerrain.get === 'function') {
        return computeMinCut(roomOrTerrain, baseSetArray);
    }

    return [];
}

module.exports = {
    buildBaseProtectMask,
    computeMinCut,
    planMincutRamparts
};
