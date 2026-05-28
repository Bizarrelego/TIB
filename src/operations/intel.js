const Profiler = require('../utils/profiler');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');
const { executeManager } = require('../utils/errorHandler');
const SegmentManager = require('../managers/SegmentManager');
/**
 * @file intel.js
 * @description Manages cross-room intel, heatmaps, and RawMemory mapping.
 */

function getAdjacentRooms(roomName) {
    const coords = roomName.match(/([WE])([0-9]+)([NS])([0-9]+)/);
    let hDir = coords[1];
    let x = parseInt(coords[2], 10);
    let vDir = coords[3];
    let y = parseInt(coords[4], 10);
    const neighbors = [];

    const getNextCoord = (dir, val, delta) => {
        let newVal = val + delta;
        if (newVal < 0) {
            newVal = Math.abs(newVal) - 1;
            dir = dir === 'W' ? 'E' : (dir === 'E' ? 'W' : (dir === 'N' ? 'S' : 'N'));
        }
        return dir + newVal;
    };

    neighbors.push(getNextCoord(hDir, x, 0) + getNextCoord(vDir, y, -1)); // TOP
    neighbors.push(getNextCoord(hDir, x, 1) + getNextCoord(vDir, y, 0)); // RIGHT
    neighbors.push(getNextCoord(hDir, x, 0) + getNextCoord(vDir, y, 1)); // BOTTOM
    neighbors.push(getNextCoord(hDir, x, -1) + getNextCoord(vDir, y, 0)); // LEFT

    return neighbors;
}

/**
 * Determines a room's type (highway, SK, center, regular) based on coordinate math.
 * @param {string} roomName - The name of the room.
 * @returns {string} The computed room type.
 */
function getRoomType(roomName) {
    const coords = roomName.match(/[a-zA-Z]+|[0-9]+/g);
    const x = parseInt(coords[1], 10);
    const y = parseInt(coords[3], 10);

    if (x % 10 === 0 || y % 10 === 0) return 'highway';
    if (x % 10 >= 4 && x % 10 <= 6 && y % 10 >= 4 && y % 10 <= 6) return 'sk';
    if (x % 10 === 5 && y % 10 === 5) return 'center';
    return 'regular';
}

/**
 * Gathers current state info for a room and persists it to global.State.intel.
 * Logs sources, minerals, structures, and controllers.
 * @param {string} roomName - The name of the room to gather intel from.
 * @returns {void}
 */
function gatherIntel(roomName) {
    if (!global.State) return;
    if (!global.State.intel) global.State.intel = new Map();

    let intel = global.State.intel.get(roomName);
    if (!intel) {
        intel = {};
        global.State.intel.set(roomName, intel);
    }

    if (!global.State.scannedRooms || !global.State.scannedRooms.has(roomName)) return; // Only gather if vision

    intel.lastSeen = Game.time;
    intel.type = getRoomType(roomName);

    if (intel.type === 'regular' || intel.type === 'sk') {
        const sources = global.State.sourcesByRoom.get(roomName) || [];
        intel.sources = sources.length;

        const minerals = global.State.mineralsByRoom.get(roomName) || [];
        const mineral = minerals[0];
        if (mineral) {
            intel.mineral = mineral.mineralType;
        }

        const roomStructuresMap = global.State.structuresByRoom.get(roomName);
        let structureCount = 0;

        if (intel.type === 'sk') {
            const lairsMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_KEEPER_LAIR) : null;
            intel.skLairs = lairsMap ? (lairsMap instanceof Map ? lairsMap.size : lairsMap.length) : 0;
        }

        if (roomStructuresMap) {
            for (const structures of roomStructuresMap.values()) {
                structureCount += (structures instanceof Map ? structures.size : structures.length);
            }
        }
        intel.structureCount = structureCount;

        const towersMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_TOWER) : null;
        intel.towerCount = towersMap ? (towersMap instanceof Map ? towersMap.size : towersMap.length) : 0;

        const spawnsMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_SPAWN) : null;
        intel.spawnCount = spawnsMap ? (spawnsMap instanceof Map ? spawnsMap.size : spawnsMap.length) : 0;

        const storageMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_STORAGE) : null;
        intel.hasStorage = storageMap ? (storageMap instanceof Map ? storageMap.size > 0 : storageMap.length > 0) : false;

        const terminalMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_TERMINAL) : null;
        intel.hasTerminal = terminalMap ? (terminalMap instanceof Map ? terminalMap.size > 0 : terminalMap.length > 0) : false;

        const labsMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_LAB) : null;
        intel.labCount = labsMap ? (labsMap instanceof Map ? labsMap.size : labsMap.length) : 0;

        const nukerMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_NUKER) : null;
        intel.hasNuker = nukerMap ? (nukerMap instanceof Map ? nukerMap.size > 0 : nukerMap.length > 0) : false;

        const controller = global.State.controllersByRoom.get(roomName);
        if (controller) {
            intel.level = controller.level || 0;

            if (controller.owner) {
                intel.owner = controller.owner.username;
                intel.hostile = !controller.my;
            } else if (controller.reservation) {
                intel.reservation = controller.reservation.username;
                intel.hostile = controller.reservation.username !== 'jules'; // placeholder for own username
            } else {
                intel.owner = null;
                intel.reservation = null;
                intel.hostile = false;
            }

            if (intel.hostile && intel.owner && intel.towerCount === 0) {
                intel.vulnerableNeighbor = true;
                intel.harassmentTarget = true;
            } else {
                intel.vulnerableNeighbor = false;
                intel.harassmentTarget = false;
            }

            intel.enemyRemoteMiners = false;
            if (global.State.hostilesByRoom && global.State.hostilesByRoom.has(roomName)) {
                const hostiles = Array.from(global.State.hostilesByRoom.get(roomName).values());
                for (let i = 0; i < hostiles.length; i++) {
                    const h = hostiles[i];
                    if (h.body) {
                        for (let j = 0; j < h.body.length; j++) {
                            if (h.body[j].type === WORK) {
                                intel.enemyRemoteMiners = true;
                                break;
                            }
                        }
                    }
                    if (intel.enemyRemoteMiners) break;
                }
            }

            if (!intel.hostile && intel.type === 'regular' && intel.sources > 0) {
                intel.remoteCandidate = true;
            } else {
                intel.remoteCandidate = false;
            }

            // Score logic for expansion
            if (!intel.hostile && intel.type === 'regular' && intel.sources >= 2) {
                let score = 100;
                // Prefer rooms with multiple sources and a mineral
                if (intel.mineral) score += 50;

                intel.expansionScore = score;
            } else {
                intel.expansionScore = 0;
            }

            if (intel.vulnerableNeighbor) {
                intel.expansionScore += 200;
            }
        }
    } else if (intel.type === 'highway') {
        const roomStructuresMap = global.State.structuresByRoom.get(roomName);
        const portalsMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_PORTAL) : null;
        intel.portals = portalsMap ? (portalsMap instanceof Map ? portalsMap.size > 0 : portalsMap.length > 0) : false;

        // Can track power banks and deposits in the future
    }
}

/**
 * Builds cost matrices (heatmaps) around hostiles for auto-kiting.
 * Penalty tiles range up to 3 tiles outward.
 * @returns {void}
 */
function buildHeatmaps() {
    if (!global.State.scannedRooms) return;
    if (!global.State.heatmapsByRoom) global.State.heatmapsByRoom = new Map();

    for (const roomName of global.State.scannedRooms) {
        const hostiles = global.State.hostilesByRoom?.get(roomName) || [];
        if (hostiles.length > 0) {
            const costMatrix = new PathFinder.CostMatrix();
            for (const hostile of hostiles) {
                // Exact tile penalty
                costMatrix.set(hostile.pos.x, hostile.pos.y, 255);

                // Radius 3 penalty
                for (let dx = -3; dx <= 3; dx++) {
                    for (let dy = -3; dy <= 3; dy++) {
                        if (dx === 0 && dy === 0) continue; // Skip exact tile, already set to 255
                        const x = hostile.pos.x + dx;
                        const y = hostile.pos.y + dy;
                        if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                            const currentCost = costMatrix.get(x, y);
                            // Set to 50 if it's less than 50
                            if (currentCost < 50) {
                                costMatrix.set(x, y, 50);
                            }
                        }
                    }
                }
            }
            global.State.heatmapsByRoom.set(roomName, costMatrix);
        } else {
            // Option to clear if no hostiles, or let it age. Prompt says "generate" if hostiles exist.
            // A safe approach is to clear it if no hostiles are present.
            if (global.State.heatmapsByRoom.has(roomName)) {
                global.State.heatmapsByRoom.delete(roomName);
            }
        }
    }
}

/**
 * Serializes and maps intel and heatmaps to RawMemory segments (0 and 1).
 * @returns {void}
 */
function mapToRawMemory() {
    // Request segments
    SegmentManager.requestActive(0);
    SegmentManager.requestActive(1);

    // Segment 0: Intel
    if (global.State.intel) {
        const intelObj = Object.fromEntries(global.State.intel);
        RawMemory.segments[0] = JSON.stringify(intelObj);
    }

    // Segment 1: Heatmaps
    if (global.State.heatmapsByRoom) {
        const heatmapsObj = {};
        for (const [roomName, costMatrix] of global.State.heatmapsByRoom.entries()) {
            heatmapsObj[roomName] = costMatrix.serialize();
        }
        RawMemory.segments[1] = JSON.stringify(heatmapsObj);
    }
}

/**
 * Main intel loop to generate heatmaps and serialize to memory.
 * @returns {void}
 */
const run = Profiler.wrap('intelManager', function intelManager() {
    if (Game.time % 10 === 0) {
            buildHeatmaps();
            mapToRawMemory();
        }
});

run.gatherIntel = gatherIntel;
run.getAdjacentRooms = getAdjacentRooms;
run.getRoomType = getRoomType;
module.exports = wrapModuleFunctions(run, (funcName, originalFunc, ...args) => executeManager(`intelManager.${funcName}`, originalFunc, ...args));
