const DeadlockEngine = require('./deadlock');

const DIRECTION_VECTORS = new Map([[1, [0, -1]], [2, [1, -1]], [3, [1, 0]], [4, [1, 1]], [5, [0, 1]], [6, [-1, 1]], [7, [-1, 0]], [8, [-1, -1]]]);

/**
 * @typedef {Object} PipelineLock
 * @property {string} creepName
 * @property {string} targetId
 * @property {string} resourceType
 * @property {number} amount
 * @property {number} tickExpiry
 */

const TrafficManager = {
    /**
     * TrafficManager must operate on global.State.
     * State is persistent across ticks, allowing the logic to persist.
     * @returns {void}
     */
    run() {
        try {
            // Fatigue Gating: Global check for creep exhaustion
            if (global.State && global.State.globalFatigue > 0) return;

            // Initialize/clear volatile state from global.State
            if (global.State) {
                global.State.trafficIntents = new Map();
                global.State.ledger = new Map();
                global.State.swapRegistry = new Map();
                if (!global.State.pipelineLedger) {
                    global.State.pipelineLedger = new Map();
                }
            }

            // Clean pipeline locks every 10 ticks
            if (Game.time % 10 === 0 && global.State && global.State.pipelineLedger) {
                for (const [id, lock] of global.State.pipelineLedger) {
                    if (Game.time > lock.tickExpiry) {
                        global.State.pipelineLedger.delete(id);
                    }
                }
            }
        } catch (e) {
            console.error(`TrafficManager CRITICAL: ${e.stack}`);
        }
    },

    /**
     * @param {string} creepName
     * @param {string} sourceId
     * @param {string} targetId
     * @param {string} resourceType
     * @param {number} amount
     * @returns {void}
     */
    lockPipeline(creepName, sourceId, targetId, resourceType, amount) {
        if (global.State && global.State.pipelineLedger) {
            global.State.pipelineLedger.set(sourceId, {
                creepName,
                targetId,
                resourceType,
                amount,
                tickExpiry: Game.time + 1
            });
        }
    },

    /**
     * @param {string} sourceId
     * @returns {string|boolean}
     */
    checkPipeline(sourceId) {
        if (global.State && global.State.pipelineLedger) {
            const lock = global.State.pipelineLedger.get(sourceId);
            return lock ? lock.creepName : false;
        }
        return false;
    },

    registerTransfer(creep, target, resourceType, amount) {
        if (!global.State || !global.State.ledger) return ERR_FULL;

        if (!global.State.ledger.has(target.id)) {
            let capacity = target.store ? target.store.getFreeCapacity(resourceType) : 0;
            if (target.energyCapacity) {
                capacity = target.energyCapacity - target.energy;
            }
            global.State.ledger.set(target.id, capacity);
        }

        let currentCapacity = global.State.ledger.get(target.id);
        if (currentCapacity < amount) {
            return ERR_FULL;
        }

        global.State.ledger.set(target.id, currentCapacity - amount);
        return creep.transfer(target, resourceType, amount);
    },

    registerMove(creep, direction) {
        if (global.State && global.State.trafficIntents) {
            global.State.trafficIntents.set(creep.name, { direction, priority: creep.heap.priority || 0 });
        }
    },

    registerSwap(creepA, creepB) {
        if (global.State && global.State.swapRegistry) {
            global.State.swapRegistry.set(creepA.name, creepB.name);
            global.State.swapRegistry.set(creepB.name, creepA.name);
        }
    },

    executeIntents() {
        try {
            if (!global.State || !global.State.trafficIntents) return;

            this.resolveDeadlocks();
            this.executeSwaps();

            for (const [creepName, intent] of global.State.trafficIntents.entries()) {
                const liveCreep = global.State.creepLookup.get(creepName);
                if (liveCreep && (!global.State.swapRegistry || !global.State.swapRegistry.has(creepName))) {
                    liveCreep.move(intent.direction);
                }
            }
        } catch (e) {
            console.error(`[TrafficManager Execution Error]: ${e.stack}`);
        }
    },

    resolveDeadlocks() {
        if (!global.State || !global.State.trafficIntents) return;

        const dependencyGraph = new Map();

        const targetPositions = new Map();
        const currentPositions = new Map();

        // Use pre-cached lookup Map
        for (const liveCreep of global.State.creepLookup.values()) {
            currentPositions.set(`${liveCreep.pos.roomName}_${liveCreep.pos.x}_${liveCreep.pos.y}`, liveCreep.name);
        }

        for (const [creepName, intent] of global.State.trafficIntents.entries()) {
            const liveCreep = global.State.creepLookup.get(creepName);
            if (!liveCreep) continue;
            const [dx, dy] = DIRECTION_VECTORS.get(intent.direction) || [0, 0];
            const posKey = `${liveCreep.pos.roomName}_${liveCreep.pos.x + dx}_${liveCreep.pos.y + dy}`;

            const blockerName = targetPositions.get(posKey);
            if (blockerName) {
                dependencyGraph.set(creepName, blockerName);
            } else {
                const statBlocker = currentPositions.get(posKey);
                if (statBlocker && statBlocker !== creepName) dependencyGraph.set(creepName, statBlocker);
            }

            targetPositions.set(posKey, creepName);
        }

        DeadlockEngine.detectAndResolve(global.State.trafficIntents, dependencyGraph);
    },

    executeSwaps() {
        if (!global.State || !global.State.swapRegistry) return;

        const processed = new Set();
        for (const [creepA_name, creepB_name] of global.State.swapRegistry.entries()) {
            if (processed.has(creepA_name) || processed.has(creepB_name)) continue;

            const liveCreepA = global.State.creepLookup.get(creepA_name);
            const liveCreepB = global.State.creepLookup.get(creepB_name);

            if (liveCreepA && liveCreepB) {
                const intentA = global.State.trafficIntents ? global.State.trafficIntents.get(creepA_name) : null;
                if (intentA) {
                    const oppositeDirection = ((intentA.direction + 3) % 8) + 1;
                    liveCreepA.move(intentA.direction);
                    liveCreepB.move(oppositeDirection);

                    processed.add(creepA_name);
                    processed.add(creepB_name);
                }
            }
        }
    }
};

module.exports = TrafficManager;
