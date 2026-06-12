const TrafficManager = require('../managers/TrafficManager'); // For CostMatrix retrieval

class PathCache {
    static init() {
        if (!global.PathCache) {
            global.PathCache = new Map();
        }
    }

    /**
     * Gets or generates a path. If blocked, attempts a local A* patch.
     */
    static getPath(creep, destination, fleeGoals = null) {
        this.init();
        const heap = creep.heap;

        if (fleeGoals && fleeGoals.length > 0) {
            const pathResult = PathFinder.search(creep.pos, fleeGoals, {
                flee: true,
                plainCost: 2,
                swampCost: 10,
                roomCallback: TrafficManager.getCostMatrix
            });
            return pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
        }

        const destRange = destination.range !== undefined ? destination.range : 1;
        const pathKey = `${creep.pos.roomName}_${creep.pos.x}_${creep.pos.y}_${destination.roomName}_${destination.x}_${destination.y}_${destRange}`;
        const cached = global.PathCache.get(pathKey);

        if (cached && Game.time < cached.expireTime) {
            return cached.path;
        }

        const targetPos = new RoomPosition(destination.x, destination.y, destination.roomName);
        const searchOptions = {
            plainCost: 2,
            swampCost: 10,
            roomCallback: TrafficManager.getCostMatrix
        };
        
        if (creep.pos.roomName === targetPos.roomName) {
            searchOptions.maxRooms = 1;
        }

        const pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: destRange }, searchOptions);
        const serializedPath = pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));

        global.PathCache.set(pathKey, {
            path: serializedPath,
            incomplete: pathResult.incomplete,
            expireTime: Game.time + 1500
        });

        return serializedPath;
    }

    /**
     * Local A* patch around an obstacle
     */
    static patchPath(creep, path, currentIndex) {
        if (!path || currentIndex >= path.length) return path;

        // Take a window of the next 5 steps to bypass
        const lookAhead = Math.min(currentIndex + 5, path.length - 1);
        const bypassTarget = path[lookAhead];
        
        // Ensure bypass target is in the same room to keep local search fast
        if (bypassTarget.roomName !== creep.room.name) return null;

        const targetPos = new RoomPosition(bypassTarget.x, bypassTarget.y, bypassTarget.roomName);
        
        const pathResult = PathFinder.search(creep.pos, { pos: targetPos, range: 0 }, {
            plainCost: 2,
            swampCost: 10,
            maxRooms: 1,
            roomCallback: TrafficManager.getCostMatrix
        });

        if (pathResult.incomplete) return null; // Patch failed

        // Splice the new local path into the existing long-range path
        const serializedPatch = pathResult.path.map(p => ({ x: p.x, y: p.y, roomName: p.roomName }));
        
        const newPath = path.slice(0, currentIndex).concat(serializedPatch).concat(path.slice(lookAhead + 1));
        return newPath;
    }
}

module.exports = PathCache;
