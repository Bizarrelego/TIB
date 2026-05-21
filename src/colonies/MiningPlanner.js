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

        const miningSpots = {};

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
                miningSpots[source.id] = bestSpot;
            }
        }

        Memory.rooms[roomName].miningSpots = miningSpots;
    }
};

module.exports = MiningPlanner;
