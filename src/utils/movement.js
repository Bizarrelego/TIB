module.exports = {
    moveTo: function(creep, target, opts = {}) {
        if (!creep.heap.path || !Array.isArray(creep.heap.path)) {
            const targetPos = target.pos || target;
            // The destination for PathFinder.search should be mapped to an object like {pos: targetPos, range: 1} or just targetPos if we assume room position.
            // Screeps PathFinder.search takes origin: RoomPosition, goal: {pos: RoomPosition, range: number} | RoomPosition | Array
            const pathInfo = PathFinder.search(creep.pos, targetPos, opts);
            if (pathInfo && pathInfo.path) {
                creep.heap.path = pathInfo.path;
            } else {
                creep.heap.path = null;
            }
        }

        if (creep.heap.path && creep.heap.path.length > 0) {
            const result = creep.moveByPath(creep.heap.path);

            if (result === ERR_NOT_FOUND || result === ERR_INVALID_ARGS) {
                creep.heap.path = null;
            }

            return result;
        }

        return ERR_NOT_FOUND;
    }
};
