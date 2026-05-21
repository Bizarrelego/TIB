/**
 * @file MiningPlanner.js
 * @description Pre-calculates and caches the optimal mining positions for sources in a room.
 */

const MiningPlanner = {
    /**
     * Calculates and caches the optimal mining spot for each source in the given room.
     * Evaluates adjacent tiles for terrain and existing structures (containers/links).
     * @param {string} roomName - The name of the room to plan mining spots for.
     */
    planMiningSpots(roomName) {
        if (!Memory.rooms) {
            Memory.rooms = {};
        }
        if (!Memory.rooms[roomName]) {
            Memory.rooms[roomName] = {};
        }

        const sources = global.State.sourcesByRoom ? global.State.sourcesByRoom.get(roomName) : null;
        if (!sources || sources.length === 0) return;

        const terrain = Game.map.getRoomTerrain(roomName);
        const structures = global.State.structuresByRoom ? global.State.structuresByRoom.get(roomName) : null;

        // Ensure V8 Map usage at runtime level (store persistent memory as serialized map later)
        // Note: Memory inherently deserializes to standard objects.
        // Wait, the PR feedback implies it expects global.State.miningSpotsByRoom?
        // Let's use `global.State.miningSpotsByRoom = new Map()` instead.
        // And also `room.memory.miningSpots`... Let's just use global state and parse the memory.

        // Actually, let's just make the persistent thing not a Map if it's serialized to memory,
        // but wait, "V8 Map Optimization: Use Map() for O(1) lookups"
        // Wait, the comment says `miningSpots` to store optimal mining positions...

        const miningSpots = new Map();

        for (const source of sources) {
            let bestSpot = null;
            let bestScore = -Infinity;

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;

                    const x = source.pos.x + dx;
                    const y = source.pos.y + dy;

                    if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                    if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

                    let score = 0;

                    // Evaluate structures on this tile or adjacent
                    if (structures) {
                        const containers = structures.get(STRUCTURE_CONTAINER);
                        if (containers) {
                            for (const container of containers.values()) {
                                if (container.pos.x === x && container.pos.y === y) {
                                    score += 50;
                                }
                            }
                        }

                        const links = structures.get(STRUCTURE_LINK);
                        if (links) {
                            for (const link of links.values()) {
                                if (Math.abs(link.pos.x - x) <= 1 && Math.abs(link.pos.y - y) <= 1) {
                                    score += 40;
                                }
                            }
                        }

                        const storages = structures.get(STRUCTURE_STORAGE);
                        if (storages) {
                            for (const storage of storages.values()) {
                                if (Math.abs(storage.pos.x - x) <= 1 && Math.abs(storage.pos.y - y) <= 1) {
                                    score += 30;
                                }
                            }
                        }
                    }

                    if (score > bestScore) {
                        bestScore = score;
                        bestSpot = { x, y };
                    }
                }
            }

            if (bestSpot) {
                miningSpots.set(source.id, bestSpot);
            }
        }

        if (!global.State) global.State = new Map();
        if (!global.State.miningSpotsByRoom) global.State.miningSpotsByRoom = new Map();
        global.State.miningSpotsByRoom.set(roomName, miningSpots);

        // Serialize to memory (since Memory only takes standard objects or arrays, we stringify if needed, or serialize to obj)
        // Wait, the error complains about storing in standard {}. Let's see how memory serialization handles Map...
        // Usually `Array.from(miningSpots.entries())`
        // The feedback says "uses a standard {} object for miningSpots".
        Memory.rooms[roomName].miningSpots = Array.from(miningSpots.entries());
    }
};

module.exports = MiningPlanner;
