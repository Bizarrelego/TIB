/**
 * @file CachedPathing.js
 * @description Utility module for caching and retrieving frequently used creep routes to minimize pathfinding CPU overhead.
 * Paths are serialized into strings for memory efficiency and stored both in `Memory` and a `Map` in `global.Cache` for O(1) retrieval.
 */

// const MemoryUtils = require('./MemoryUtils');
const routePlanner = require('../traffic/routePlanner');

/**
 * Generates a unique cache key for a specific path request.
 * @param {RoomPosition} startPos - The starting position.
 * @param {RoomPosition} endPos - The destination position.
 * @param {Object} [opts={}] - Pathing options (like range).
 * @returns {string} The unique cache key.
 */
function getCacheKey(startPos, endPos, opts = {}) {
    const range = opts.range || 0;
    return `${startPos.roomName}:${startPos.x}:${startPos.y}-${endPos.roomName}:${endPos.x}:${endPos.y}-R${range}`;
}

/**
 * Serializes an array of RoomPositions into a compact string format.
 * Format: "roomName:x1,y1;x2,y2|roomName2:x3,y3;..."
 * @param {Array<RoomPosition>} path - The array of RoomPositions to serialize.
 * @returns {string} The serialized path string.
 */
function serializePath(path) {
    if (!path || path.length === 0) return '';

    let serialized = '';
    let currentRoom = path[0].roomName;
    serialized += `${currentRoom}:`;

    for (let i = 0; i < path.length; i++) {
        const pos = path[i];
        if (pos.roomName !== currentRoom) {
            currentRoom = pos.roomName;
            serialized += `|${currentRoom}:`;
        }
        serialized += `${pos.x},${pos.y}`;
        if (i < path.length - 1 && path[i+1].roomName === currentRoom) {
            serialized += ';';
        }
    }
    return serialized;
}

/**
 * Deserializes a string back into an array of RoomPositions.
 * @param {string} serializedPath - The serialized path string.
 * @returns {Array<RoomPosition>} The array of RoomPositions.
 */
function deserializePath(serializedPath) {
    if (!serializedPath) return [];

    const path = [];
    const roomSegments = serializedPath.split('|');

    for (let i = 0; i < roomSegments.length; i++) {
        const segment = roomSegments[i];
        const [roomName, coordsStr] = segment.split(':');
        if (!roomName || !coordsStr) continue;

        const coords = coordsStr.split(';');
        for (let j = 0; j < coords.length; j++) {
            const [x, y] = coords[j].split(',');
            path.push(new RoomPosition(parseInt(x, 10), parseInt(y, 10), roomName));
        }
    }

    return path;
}

/**
 * Initializes the path caching structures in Memory and global.Cache if they don't exist.
 */
function initCaches() {
    if (!Memory.pathCache) {
        Memory.pathCache = {};
    }
    if (global.Cache && !global.Cache.has('pathing')) {
        global.Cache.set('pathing', new Map());
    }
}

/**
 * Stores a path and its length in the cache.
 * @param {RoomPosition} startPos - The starting position.
 * @param {RoomPosition} endPos - The destination position.
 * @param {Array<RoomPosition>} path - The path to cache.
 * @param {Object} [opts={}] - Pathing options used to generate the cache key.
 */
function storePath(startPos, endPos, path, opts = {}) {
    if (!path || path.length === 0) return;

    initCaches();

    const key = getCacheKey(startPos, endPos, opts);
    const serialized = serializePath(path);
    const length = path.length;

    const cacheObject = {
        path: serialized,
        length: length,
        tick: Game.time
    };

    // Store in global.Cache for O(1) in-memory retrieval
    if (global.Cache && global.Cache.has('pathing')) {
        global.Cache.get('pathing').set(key, {
            pathArray: path,
            length: length,
            tick: Game.time
        });
    }

    // Store in Memory for persistence
    Memory.pathCache[key] = cacheObject;
}

/**
 * Retrieves a cached path or calculates and caches a new one if it doesn't exist.
 * @param {RoomPosition} startPos - The starting position.
 * @param {RoomPosition} endPos - The destination position.
 * @param {Object} [opts={}] - Pathing options (like range).
 * @returns {Array<RoomPosition>|null} The path array, or null if no path could be found.
 */
function getPath(startPos, endPos, opts = {}) {
    initCaches();

    const key = getCacheKey(startPos, endPos, opts);

    // Check global.Cache (Heap) first for O(1) lookup
    if (global.Cache && global.Cache.has('pathing')) {
        const cacheMap = global.Cache.get('pathing');
        if (cacheMap.has(key)) {
            return cacheMap.get(key).pathArray;
        }
    }

    // Fallback to Memory
    if (Memory.pathCache && Memory.pathCache[key]) {
        const cachedData = Memory.pathCache[key];
        const deserializedPath = deserializePath(cachedData.path);

        // Populate global.Cache with deserialized path for future use
        if (global.Cache && global.Cache.has('pathing')) {
            global.Cache.get('pathing').set(key, {
                pathArray: deserializedPath,
                length: cachedData.length,
                tick: cachedData.tick
            });
        }

        return deserializedPath;
    }

    // No cached path found, calculate a new one
    // We use PathFinder.search for actual position calculation.
    // findPathToRoom or custom routePlanner are better for inter-room, but for actual paths we need coordinates

    const range = opts.range || 0;

    const searchOpts = {
        plainCost: 2,
        swampCost: 10,
        ...opts
    };

    // If different rooms, we leverage routePlanner to define allowed rooms before falling back to PathFinder
    let result;
    if (startPos.roomName !== endPos.roomName) {
        const route = routePlanner.findRoute(startPos.roomName, endPos.roomName);
        if (route !== ERR_NO_PATH) {
            const allowedRooms = new Set([startPos.roomName]);
            for (const step of route) allowedRooms.add(step.room);

            searchOpts.roomCallback = (roomName) => {
                if (!allowedRooms.has(roomName)) return false;

                // Keep the heatmap/hostile avoidance logic from pathing.js if desired, or let it pass through
                if (global.State && global.State.heatmapsByRoom && global.State.heatmapsByRoom.has(roomName)) {
                    return global.State.heatmapsByRoom.get(roomName);
                }
                return undefined;
            };
        }
    }

    // Standard PathFinder fallback
    result = PathFinder.search(startPos, { pos: endPos, range: range }, searchOpts);

    if (result && !result.incomplete) {
        storePath(startPos, endPos, result.path, opts);
        return result.path;
    }

    return null;
}

/**
 * Retrieves the cached path length.
 * Useful for pre-spawning logic to determine transit time without loading the full path array.
 * @param {RoomPosition} startPos - The starting position.
 * @param {RoomPosition} endPos - The destination position.
 * @param {Object} [opts={}] - Pathing options used to generate the cache key.
 * @returns {number|null} The path length, or null if the path is not cached.
 */
function getPathLength(startPos, endPos, opts = {}) {
    initCaches();

    const key = getCacheKey(startPos, endPos, opts);

    // Check global.Cache (Heap)
    if (global.Cache && global.Cache.has('pathing')) {
        const cacheMap = global.Cache.get('pathing');
        if (cacheMap.has(key)) {
            return cacheMap.get(key).length;
        }
    }

    // Fallback to Memory
    if (Memory.pathCache && Memory.pathCache[key]) {
        return Memory.pathCache[key].length;
    }

    // Path not cached, calculate it
    const path = getPath(startPos, endPos, opts);
    if (path) {
        return path.length;
    }

    return null;
}

module.exports = {
    getCacheKey,
    serializePath,
    deserializePath,
    storePath,
    getPath,
    getPathLength
};
