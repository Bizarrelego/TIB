/**
 * Bunker Planner - Military Defense Grid
 * Implements Min-Cut flow network to identify natural wall terrain chokepoints.
 * Ramparts are strictly constructed on the cut, preventing energy bleed.
 */
class BunkerPlanner {
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
        // Only place ramparts on open-terrain tiles in the cut.
        const ramparts = [];
        for (let x = 1; x < 49; x++) {
            for (let y = 1; y < 49; y++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                const id = x * 50 + y;
                if (reachable[id] && !reachable[id + 2500]) {
                    ramparts.push({ x, y });
                }
            }
        }

        return ramparts;
    }
}

module.exports = BunkerPlanner;
