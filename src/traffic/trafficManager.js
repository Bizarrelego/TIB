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
     * Initializes global state only if missing to support hot-reloads/rehydration.
     */
    init() {
        if (!global.State) global.State = {};
        if (!(global.State.trafficIntents instanceof Map)) global.State.trafficIntents = new Map();
        if (!(global.State.ledger instanceof Map)) global.State.ledger = new Map();
        if (!(global.State.swapRegistry instanceof Map)) global.State.swapRegistry = new Map();
        if (!(global.State.pipelineLedger instanceof Map)) global.State.pipelineLedger = new Map();
    },

    /**
     * Initializes pipeline ledger as a Map if not present.
     * @returns {void}
     */
    initializeLedger() {
        if (!(global.State.pipelineLedger instanceof Map)) {
            global.State.pipelineLedger = new Map();
        }
    },

    /**
     * TrafficManager must operate on global.State.
     * State is persistent across ticks, allowing the logic to persist.
     * @returns {void}
     */
    run() {
        try {
            this.init();

            // Clean volatile entries only
            global.State.trafficIntents.clear();
            global.State.ledger.clear();
            global.State.swapRegistry.clear();

            // Clean pipeline locks every 10 ticks
            if (Game.time % 10 === 0) {
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
     * @param {string} type - 'TRANSFER' or 'WITHDRAW'
     * @returns {void}
     */
    lockPipeline(creepName, sourceId, targetId, resourceType, amount, type) {
        if (global.State && global.State.pipelineLedger) {
            global.State.pipelineLedger.set(sourceId, {
                creepName,
                targetId,
                resourceType,
                amount,
                type,
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

    getVirtualState(target, resourceType) {
        const ledger = global.State.ledger;
        if (!ledger) return { used: 0, free: 0 };

        const state = ledger.get(target.id) || { used: target.store ? target.store.getUsedCapacity(resourceType) : 0, cap: target.store ? target.store.getCapacity(resourceType) : 0 };
        return { used: state.used, free: state.cap - state.used };
    },

    registerTransfer(creep, target, resourceType, amount) {
        const ledger = global.State.ledger;
        if (!ledger) return ERR_FULL;

        const targetState = this.getVirtualState(target, resourceType);
        if (targetState.free < amount) return ERR_FULL;

        ledger.set(target.id, { used: targetState.used + amount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, resourceType);
        ledger.set(creep.id, { used: creepState.used - amount, cap: creepState.cap });

        return OK;
    },

    registerWithdraw(creep, target, resourceType, amount) {
        const ledger = global.State.ledger;
        if (!ledger) return ERR_NOT_ENOUGH_RESOURCES;

        const targetState = this.getVirtualState(target, resourceType);
        if (targetState.used < amount) return ERR_NOT_ENOUGH_RESOURCES;

        ledger.set(target.id, { used: targetState.used - amount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, resourceType);
        ledger.set(creep.id, { used: creepState.used + amount, cap: creepState.cap });

        return OK;
    },

    /**
     * @param {object} creep
     * @param {number} direction
     */
    registerMove(creep, direction) {
        // Fatigue Gating: Ensure only the specific creep is gated.
        // The TrafficManager should only process creeps that are capable of moving.
        if (!creep || creep.fatigue > 0) return;

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

    /**
     * Executes pipeline ledger intents.
     * @param {object} creep - The target creep.
     * @param {Object} intent - The ledger intent data.
     * @param {string} intent.type - 'TRANSFER' or 'WITHDRAW'.
     * @param {string} intent.targetId - ID of target.
     * @param {string} intent.resourceType - Resource constant.
     * @returns {void}
     */
    flushIntent(creep, intent) {
        if (!creep || creep.fatigue > 0 || !intent) return;

        try {
            // Ensure no conflicting movement intents exist
            if (global.State.trafficIntents && global.State.trafficIntents.has(creep.name)) {
                return;
            }

            const target = Game.getObjectById(intent.targetId);
            if (!target) return;

            // Use intent.type instead of re-scanning creep.store
            intent.type === 'TRANSFER'
                ? creep.transfer(target, intent.resourceType)
                : creep.withdraw(target, intent.resourceType);
        } catch (e) {
            console.error(`[TrafficManager] FlushIntent Error on ${creep.name}: ${e.stack}`);
        }
    },

    executeIntents() {
        try {
            // Process pipeline ledger first
            if (global.State && global.State.pipelineLedger) {
                for (const [creepId, intent] of global.State.pipelineLedger.entries()) {
                    const liveCreep = Game.getObjectById(creepId);
                    if (liveCreep) {
                        this.flushIntent(liveCreep, intent);
                    }
                    global.State.pipelineLedger.delete(creepId);
                }
            }

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
