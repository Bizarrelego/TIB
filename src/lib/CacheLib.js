const ActionConstants = require('../constants/ActionConstants');

/**
 * V8 Optimized Monomorphic Creep Heap
 */
class CreepHeap {
    constructor() {
        this.state = 'idle';
        this.targetId = null;
        this.actionIntent = ActionConstants.ACTION_IDLE;
        this.harvestPosition = null;
        this.sleepUntil = 0;
        this.sitTargetId = null;
        this.secondaryTargetId = null;
        this.waypointPos = null;
        this.waypointIndex = 0;
        this.destination = null;
        this.fleePos = null;
        this.tooClose = false;
        this.targetRoom = null;
        this.unreachableTargetId = null;
        this.visitedRooms = [];
    }
}

const objectCache = new Map();
let cacheTick = 0;

class CacheLib {
    static getById(id) {
        if (!id || typeof id !== 'string') return null;
        if (Game.time !== cacheTick) {
            objectCache.clear();
            cacheTick = Game.time;
        }
        if (objectCache.has(id)) return objectCache.get(id);
        const obj = Game.getObjectById(id);
        objectCache.set(id, obj);
        return obj;
    }

    static getDefaultHeap() {
        return new CreepHeap();
    }
}

module.exports = CacheLib;
