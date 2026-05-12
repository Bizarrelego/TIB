const DeadlockEngine = require('./deadlock');

const DIRECTION_VECTORS = new Map([[1, [0, -1]], [2, [1, -1]], [3, [1, 0]], [4, [1, 1]], [5, [0, 1]], [6, [-1, 1]], [7, [-1, 0]], [8, [-1, -1]]]);

const TrafficManager = {
    intents: new Map(),
    ledger: new Map(),
    swapRegistry: new Map(),
    pipelineLedger: new Map(),

    run() {
        this.intents.clear();
        this.ledger.clear();
        this.swapRegistry.clear();

        // Fatigue Gating / Cascading CPU Throttling
        // Skip ledger cleanup if processing high-latency pathing or system is overloaded
        if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket >= 500) {
            this.pipelineLedger.clear();
        }
    },

    /**
     * Locks a resource pipeline to prevent multiple creeps from targeting the same source.
     * @param {string} creepName - The name of the creep locking the pipeline.
     * @param {string} sourceId - The ID of the source being locked.
     * @param {string} targetId - The ID of the target.
     * @param {string} resourceType - The resource type.
     * @param {number} amount - The amount of resource.
     */
    lockPipeline(creepName, sourceId, targetId, resourceType, amount) {
        this.pipelineLedger.set(sourceId, {
            creepName,
            sourceId,
            targetId,
            resourceType,
            amount,
            tickExpiry: Game.time + 1
        });
    },

    /**
     * Checks if a source pipeline is currently locked.
     * @param {string} sourceId - The ID of the source.
     * @returns {string|boolean} - The name of the locking creep, or false if not locked.
     */
    checkPipeline(sourceId) {
        const lock = this.pipelineLedger.get(sourceId);
        if (lock && Game.time <= lock.tickExpiry) {
            return lock.creepName;
        }
        return false;
    },

    registerTransfer(creep, target, resourceType, amount) {
        if (!this.ledger.has(target.id)) {
            let capacity = target.store ? target.store.getFreeCapacity(resourceType) : 0;
            if (target.energyCapacity) {
                capacity = target.energyCapacity - target.energy;
            }
            this.ledger.set(target.id, capacity);
        }

        let currentCapacity = this.ledger.get(target.id);
        if (currentCapacity < amount) {
            return ERR_FULL;
        }

        this.ledger.set(target.id, currentCapacity - amount);
        return creep.transfer(target, resourceType, amount);
    },

    registerMove(creep, direction) {
        this.intents.set(creep.name, { direction, priority: creep.heap.priority || 0 });
    },

    registerSwap(creepA, creepB) {
        this.swapRegistry.set(creepA.name, creepB.name);
        this.swapRegistry.set(creepB.name, creepA.name);
    },

    executeIntents() {
        try {
            this.resolveDeadlocks();
            this.executeSwaps();

            for (const [creepName, intent] of this.intents.entries()) {
                const liveCreep = global.State.creepLookup.get(creepName);
                if (liveCreep && !this.swapRegistry.has(creepName)) {
                    liveCreep.move(intent.direction);
                }
            }
        } catch (e) {
            console.log(`[TrafficManager Execution Error]: ${e.stack}`);
        }
    },

    resolveDeadlocks() {
        const visited = new Set();
        const recursionStack = new Set();
        const dependencyGraph = new Map();

        const targetPositions = new Map();
        const currentPositions = new Map();

        // Use pre-cached lookup Map
        for (const liveCreep of global.State.creepLookup.values()) {
            currentPositions.set(`${liveCreep.pos.roomName}_${liveCreep.pos.x}_${liveCreep.pos.y}`, liveCreep.name);
        }

        for (const [creepName, intent] of this.intents.entries()) {
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

        DeadlockEngine.detectAndResolve(this.intents, dependencyGraph);
    },

    executeSwaps() {
        const processed = new Set();
        for (const [creepA_name, creepB_name] of this.swapRegistry.entries()) {
            if (processed.has(creepA_name) || processed.has(creepB_name)) continue;

            const liveCreepA = global.State.creepLookup.get(creepA_name);
            const liveCreepB = global.State.creepLookup.get(creepB_name);

            if (liveCreepA && liveCreepB) {
                const intentA = this.intents.get(creepA_name);
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
