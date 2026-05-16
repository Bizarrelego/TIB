module.exports = {
    /**
     * Checks if a creep is fatigued.
     * @param {Creep} creep - The creep to check.
     * @returns {boolean} True if the creep's fatigue is > 0, otherwise false.
     */
    checkFatigue: function(creep) {
        if (!creep) return false;
        return creep.fatigue > 0;
    },

    moveTo: function(creep, target, opts = {}) {
        // Anti-clustering / Stuck-detection logic
        const currentPos = creep.pos;
        if (creep.heap.lastPos) {
            if (currentPos.x === creep.heap.lastPos.x &&
                currentPos.y === creep.heap.lastPos.y &&
                currentPos.roomName === creep.heap.lastPos.roomName) {
                if (creep.fatigue === 0) {
                    creep.heap.stuckTicks = (creep.heap.stuckTicks || 0) + 1;
                }
            } else {
                creep.heap.stuckTicks = 0;
            }
        } else {
            creep.heap.stuckTicks = 0;
        }
        creep.heap.lastPos = { x: currentPos.x, y: currentPos.y, roomName: currentPos.roomName };

        // Default pathing opts
        const pathingOpts = { reusePath: 20, ignoreCreeps: true, ...opts };

        if (creep.heap.stuckTicks > 2) {
            pathingOpts.reusePath = 0;
            pathingOpts.ignoreCreeps = false;
            creep.heap.stuckTicks = 0; // Reset stuckTicks after forcing recalculation
            delete creep.heap.path; // Force repath
        }

        // IMPROVEMENT: Eliminate native moveTo. Route all moves through TrafficManager.
        // Reason: Enforces atomic lockstep execution and prevents native pathing from bypassing the swap/deadlock registry.
        if (!creep.heap.path || creep.heap.path.length === 0) {
            const targetPos = target.pos || target;
            const pathInfo = PathFinder.search(creep.pos, targetPos, pathingOpts);
            if (pathInfo.path.length > 0) creep.heap.path = pathInfo.path;
        }

        if (creep.heap.path && creep.heap.path.length > 0) {
            if (creep.pos.x === creep.heap.path[0].x &&
                creep.pos.y === creep.heap.path[0].y &&
                creep.pos.roomName === creep.heap.path[0].roomName) {
                creep.heap.path.shift(); // Advance path
            }
            if (creep.heap.path.length > 0) {
                const getTrafficManager = () => require('../traffic/trafficManager');
                getTrafficManager().registerMoveIntent(creep, creep.heap.path[0], pathingOpts);
            }
        }
    }
};
