/**
 * Wasm-ready Scaffold for Ford-Fulkerson Min-Cut
 * Calculates optimal choke points by treating room tiles as graph nodes.
 *
 * Attempts to offload heavy computations to WASM, falling back to pure JS
 * if WASM is unavailable.
 */

const MinCutInterface = require('./wasm/minCutInterface');

class MinCut {
    /**
     * Helper to map x, y to a 1D array index
     */
    static getIndex(x, y) {
        return y * 50 + x;
    }

    /**
     * Compute min cut rampart placement.
     * Attempts to use the WASM interface (MinCutInterface.getCutTilesWasm) first,
     * falling back to pure JavaScript if unavailable or fails.
     * Returns an array of RoomPositions to build ramparts on.
     * @param {string} roomName
     * @param {Object[]} sources E.g., [{x1: 10, y1: 10, x2: 15, y2: 15}]
     * @param {CostMatrix} bounds 255 = unbuildable, 0 = buildable
     * @returns {RoomPosition[]}
     */
    static getCutTiles(roomName, sources, bounds = new PathFinder.CostMatrix()) {
        const wasmResult = MinCutInterface.getCutTilesWasm(roomName, sources, bounds);
        if (wasmResult !== null) {
            return wasmResult;
        }

        const V = 50 * 50 + 2;
        const SOURCE = V - 2;
        const SINK = V - 1;

        // Adjacency list: Map node -> { to, cap, flow, rev }
        const adj = new Array(V);
        for (let i = 0; i < V; i++) adj[i] = [];

        function addEdge(u, v, cap) {
            adj[u].push({ to: v, cap: cap, flow: 0, rev: adj[v].length });
            adj[v].push({ to: u, cap: 0, flow: 0, rev: adj[u].length - 1 });
        }

        // Build the grid graph
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                // If it's a boundary wall, it acts as a sink
                if (x === 0 || y === 0 || x === 49 || y === 49) {
                    addEdge(MinCut.getIndex(x, y), SINK, Infinity);
                }

                // If unwalkable cost matrix (like natural walls), we cannot pass
                if (bounds.get(x, y) === 255) continue;

                // Edges to adjacent walkable tiles
                const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
                for (const d of dirs) {
                    const nx = x + d[0];
                    const ny = y + d[1];
                    if (nx >= 0 && nx < 50 && ny >= 0 && ny < 50 && bounds.get(nx, ny) !== 255) {
                        // Capacity 1 means placing 1 rampart here blocks this path
                        addEdge(MinCut.getIndex(x, y), MinCut.getIndex(nx, ny), 1);
                    }
                }
            }
        }

        // Connect sources to SOURCE node
        for (const s of sources) {
            for (let x = s.x1; x <= s.x2; x++) {
                for (let y = s.y1; y <= s.y2; y++) {
                    if (x >= 0 && x < 50 && y >= 0 && y < 50) {
                        addEdge(SOURCE, MinCut.getIndex(x, y), Infinity);
                    }
                }
            }
        }

        // Dinic's Algorithm (BFS level map + DFS flow pushed)
        let level = new Int32Array(V);
        function bfs() {
            level.fill(-1);
            level[SOURCE] = 0;
            let q = [SOURCE];
            let head = 0;
            while (head < q.length) {
                let u = q[head++];
                for (let edge of adj[u]) {
                    if (level[edge.to] < 0 && edge.flow < edge.cap) {
                        level[edge.to] = level[u] + 1;
                        q.push(edge.to);
                    }
                }
            }
            return level[SINK] >= 0;
        }

        let ptr = new Int32Array(V);
        function dfs(u, pushed) {
            if (pushed === 0) return 0;
            if (u === SINK) return pushed;
            for (let cid = ptr[u]; cid < adj[u].length; ++cid) {
                ptr[u] = cid;
                let edge = adj[u][cid];
                let tr = edge.to;
                if (level[u] + 1 !== level[tr] || edge.flow >= edge.cap) continue;
                let push = dfs(tr, Math.min(pushed, edge.cap - edge.flow));
                if (push === 0) continue;
                edge.flow += push;
                adj[tr][edge.rev].flow -= push;
                return push;
            }
            return 0;
        }

        while (bfs()) {
            ptr.fill(0);
            while (dfs(SOURCE, Infinity) !== 0) {
                // Keep pushing flow until no more can be pushed
            }
        }

        // Any nodes reachable from SOURCE in the residual graph are the cut set
        let visited = new Uint8Array(V);
        let q = [SOURCE];
        visited[SOURCE] = 1;
        let head = 0;
        while (head < q.length) {
            let u = q[head++];
            for (let edge of adj[u]) {
                if (edge.flow < edge.cap && !visited[edge.to]) {
                    visited[edge.to] = 1;
                    q.push(edge.to);
                }
            }
        }

        let cutTiles = [];
        for (let x = 0; x < 50; x++) {
            for (let y = 0; y < 50; y++) {
                let u = MinCut.getIndex(x, y);
                if (visited[u]) {
                    for (let edge of adj[u]) {
                        // The cut edges are those going from visited to unvisited
                        if (edge.to !== SINK && !visited[edge.to] && edge.cap === 1) {
                            cutTiles.push(new RoomPosition(x, y, roomName));
                            break; // Avoid pushing the same tile multiple times
                        }
                    }
                }
            }
        }

        return cutTiles;
    }
}

module.exports = MinCut;
