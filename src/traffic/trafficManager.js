const DeadlockEngine = require('./deadlock');
const movement = require('../utils/movement');
const ROLE_PRIORITIES = require('../constants/rolePriorities');


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

            // Clean pipeline locks every tick
            for (const [id, lock] of global.State.pipelineLedger) {
                if (Game.time > lock.tickExpiry) {
                    global.State.pipelineLedger.delete(id);
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
        if (!ledger) return { used: 0, free: 0, cap: 0 };

        if (ledger.has(target.id)) {
            const state = ledger.get(target.id);
            return { used: state.used, free: Math.max(0, state.cap - state.used), cap: state.cap };
        }

        let used = 0;
        let cap = 0;

        if (target.store) {
            used = target.store.getUsedCapacity(resourceType) || 0;
            cap = target.store.getCapacity(resourceType) || 0;
        } else if (target.amount !== undefined) {
            used = target.amount;
            cap = target.amount; // For dropped resources, cap is amount
        } else if (target.mineralAmount !== undefined) {
            used = target.mineralAmount;
            cap = target.mineralCapacity !== undefined ? target.mineralCapacity : target.mineralAmount;
        } else if (target.energyCapacity !== undefined) {
            used = target.energy;
            cap = target.energyCapacity;
        } else if (target.progressTotal !== undefined) {
            used = target.progress;
            cap = target.progressTotal;
        }

        return { used, free: Math.max(0, cap - used), cap };
    },

    registerTransfer(creep, target, resourceType, amount) {
        if (this.checkPipeline(creep.id)) return ERR_BUSY;

        const ledger = global.State.ledger;
        if (!ledger) return ERR_FULL;

        const targetState = this.getVirtualState(target, resourceType);
        if (targetState.free < amount) return ERR_FULL;

        ledger.set(target.id, { used: targetState.used + amount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, resourceType);
        ledger.set(creep.id, { used: creepState.used - amount, cap: creepState.cap });
        this.lockPipeline(creep.name, creep.id, target.id, resourceType, amount, 'TRANSFER');

        return OK;
    },

    registerWithdraw(creep, target, resourceType, amount) {
        if (this.checkPipeline(creep.id)) return ERR_BUSY;

        const ledger = global.State.ledger;
        if (!ledger) return ERR_NOT_ENOUGH_RESOURCES;

        const resType = resourceType || target.resourceType || RESOURCE_ENERGY;
        const targetState = this.getVirtualState(target, resType);
        if (targetState.used < amount) return ERR_NOT_ENOUGH_RESOURCES;

        ledger.set(target.id, { used: targetState.used - amount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, resType);
        ledger.set(creep.id, { used: creepState.used + amount, cap: creepState.cap });
        this.lockPipeline(creep.name, creep.id, target.id, resType, amount, 'WITHDRAW');

        return OK;
    },

    registerPickup(creep, target, resourceType, amount) {
        if (this.checkPipeline(creep.id)) return ERR_BUSY;
        const ledger = global.State.ledger;
        if (!ledger) return ERR_NOT_ENOUGH_RESOURCES;

        const targetState = this.getVirtualState(target, resourceType);
        if (targetState.used < amount) return ERR_NOT_ENOUGH_RESOURCES;

        ledger.set(target.id, { used: targetState.used - amount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, resourceType);
        ledger.set(creep.id, { used: creepState.used + amount, cap: creepState.cap });
        this.lockPipeline(creep.name, creep.id, target.id, resourceType, amount, 'PICKUP');

        return OK;
    },

    registerDrop(creep, resourceType, amount) {
        if (this.checkPipeline(creep.id)) return ERR_BUSY;
        const ledger = global.State.ledger;
        if (!ledger) return ERR_NOT_ENOUGH_RESOURCES;

        const resType = resourceType || RESOURCE_ENERGY;
        const creepState = this.getVirtualState(creep, resType);
        if (creepState.used < amount) return ERR_NOT_ENOUGH_RESOURCES;

        ledger.set(creep.id, { used: creepState.used - amount, cap: creepState.cap });
        this.lockPipeline(creep.name, creep.id, null, resType, amount, 'DROP');

        return OK;
    },

    registerHarvest(creep, target) {
        if (this.checkPipeline(creep.id)) return ERR_BUSY;
        const ledger = global.State.ledger;
        if (!ledger) return ERR_NOT_ENOUGH_RESOURCES;

        const resType = target.mineralType || target.resourceType || RESOURCE_ENERGY;
        const targetState = this.getVirtualState(target, resType);
        const workParts = creep.getActiveBodyparts(WORK);

        let harvestAmount = 0;
        if (target.mineralType) {
            harvestAmount = Math.min(targetState.used, workParts * 1); // 1 mineral per work part
        } else {
            harvestAmount = Math.min(targetState.used, workParts * 2); // 2 energy per work part
        }

        if (harvestAmount <= 0) return ERR_NOT_ENOUGH_RESOURCES;

        ledger.set(target.id, { used: targetState.used - harvestAmount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, resType);
        ledger.set(creep.id, { used: creepState.used + harvestAmount, cap: creepState.cap });
        this.lockPipeline(creep.name, creep.id, target.id, resType, harvestAmount, 'HARVEST');

        return OK;
    },

    /**
     * @param {object} creep
     * @param {number} direction
     */
    registerMove(creep, direction) {
        // Fatigue Gating: Ensure only the specific creep is gated.
        // The TrafficManager should only process creeps that are capable of moving.
        if (!creep || creep.fatigue > 0 || this.checkPipeline(creep.id)) return ERR_BUSY;

        if (global.State && global.State.trafficIntents) {
            global.State.trafficIntents.set(creep.name, { direction, priority: creep.heap.priority || 0 });
        }
        return OK;
    },

    /**
     * @param {object} creep
     * @param {object} targetPos
     * @param {object} [opts={}]
     */
    registerMoveIntent(creep, targetPos, opts = {}) {
        if (!creep || creep.fatigue > 0 || this.checkPipeline(creep.id)) return ERR_BUSY;
        if (!global.State) global.State = {};
        if (!(global.State.trafficIntents instanceof Map)) global.State.trafficIntents = new Map();

        global.State.trafficIntents.set(creep.name, {
            creep,
            targetPos,
            opts,
            originalPos: creep.pos
        });
        return OK;
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
     * @param {string} intent.type - 'TRANSFER', 'WITHDRAW', 'PICKUP', 'HARVEST', or 'DROP'.
     * @param {string} intent.targetId - ID of target.
     * @param {string} intent.resourceType - Resource constant.
     * @returns {void}
     */
    flushIntent(creep, intent) {
        if (!creep || creep.fatigue > 0 || !intent) return;

        try {
            // Prioritize pipeline intents by removing conflicting movement
            if (global.State.trafficIntents && global.State.trafficIntents.has(creep.name)) {
                global.State.trafficIntents.delete(creep.name);
            }

            const target = intent.targetId ? Game.getObjectById(intent.targetId) : null;
            if (!target && intent.type !== 'DROP') return;

            switch (intent.type) {
                case 'TRANSFER':
                    creep.transfer(target, intent.resourceType);
                    break;
                case 'WITHDRAW':
                    creep.withdraw(target, intent.resourceType);
                    break;
                case 'PICKUP':
                    creep.pickup(target);
                    break;
                case 'HARVEST':
                    creep.harvest(target);
                    break;
                case 'DROP':
                    creep.drop(intent.resourceType, intent.amount);
                    break;
            }
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

            if (!global.State || !global.State.trafficIntents || global.State.trafficIntents.size === 0) return;

            // Phase 1: Build Dependency Graph & Identify Swaps
            const dependencyGraph = new Map();
            if (!(global.State.swapRegistry instanceof Map)) global.State.swapRegistry = new Map();
            global.State.swapRegistry.clear();


            const currentPositions = new Map();
            for (const roomName of global.State.scannedRooms || []) {
                const roomCreeps = global.State.creepsByRoom.get(roomName);
                if (roomCreeps) {
                    for (const roleCreeps of roomCreeps.values()) {
                        if (Array.isArray(roleCreeps)) {
                            for (const creep of roleCreeps) {
                                currentPositions.set(`${creep.pos.roomName}_${creep.pos.x}_${creep.pos.y}`, creep.name);
                            }
                        }
                    }
                }
            }



            for (const [creepName, intent] of global.State.trafficIntents.entries()) {
                const { creep, targetPos } = intent;
                if (!creep || !targetPos) continue;

                let intendedNextPos = null;
                const dx = Math.abs(creep.pos.x - targetPos.x);
                const dy = Math.abs(creep.pos.y - targetPos.y);

                if (dx <= 1 && dy <= 1 && creep.pos.roomName === targetPos.roomName) {
                    intendedNextPos = targetPos;
                } else if (creep.heap && creep.heap.path && creep.heap.path.length > 0) {
                    // Pull from pre-calculated CostMatrix path if available
                    intendedNextPos = creep.heap.path[0];
                } else {
                     // Provide default intendedNextPos to skip heavy PathFinder inside loop
                     // Since PathFinder is forbidden here.
                     continue;
                }


                if (!intendedNextPos) continue;
                intent.intendedNextPos = intendedNextPos;

                const posKey = `${intendedNextPos.roomName}_${intendedNextPos.x}_${intendedNextPos.y}`;
                const blockingCreepName = currentPositions.get(posKey);

                if (blockingCreepName && blockingCreepName !== creepName) {
                    dependencyGraph.set(creepName, blockingCreepName);
                }
            }

            // Phase 2: Resolve Deadlocks
            DeadlockEngine.detectAndResolve(global.State.trafficIntents, dependencyGraph);

            // Phase 3: Execute Moves
            const remainingIntents = Array.from(global.State.trafficIntents.values());
            remainingIntents.sort((a, b) => {
                const priorityA = (a.creep && a.creep.memory && a.creep.memory.role) ? (ROLE_PRIORITIES.get(a.creep.memory.role) || 0) : 0;
                const priorityB = (b.creep && b.creep.memory && b.creep.memory.role) ? (ROLE_PRIORITIES.get(b.creep.memory.role) || 0) : 0;
                return priorityB - priorityA; // Descending priority
            });

            const processedSwaps = new Set();

            for (const intent of remainingIntents) {
                const { creep, targetPos, opts, intendedNextPos } = intent;
                if (!creep) continue;

                if (global.State.swapRegistry.has(creep.name)) {
                    if (processedSwaps.has(creep.name)) continue;


                    const blockingCreepName = global.State.swapRegistry.get(creep.name);
                    const blockingCreep = global.State.creepLookup ? global.State.creepLookup.get(blockingCreepName) : Game.creeps[blockingCreepName];


                    if (blockingCreep) {

                        const dir = creep.pos.getDirectionTo(blockingCreep.pos); // Alternative logic

                        // Custom getDirection logic if needed since getDirectionTo exists in Screeps API
                        if (dir) {
                           creep.move(dir);
                           blockingCreep.move(((dir + 3) % 8) + 1);
                        }
                    }

                    processedSwaps.add(creep.name);
                    processedSwaps.add(blockingCreepName);
                    global.State.trafficIntents.delete(creep.name);
                    global.State.trafficIntents.delete(blockingCreepName);
                    continue;
                }

                if (intendedNextPos) {
                    const posKey = `${intendedNextPos.roomName}_${intendedNextPos.x}_${intendedNextPos.y}`;
                    const blockingCreepName = currentPositions.get(posKey);

                    if (blockingCreepName && blockingCreepName !== creep.name) {
                        if (!global.State.trafficIntents.has(blockingCreepName)) {
                            // Blocked by a stationary creep, do not move
                            global.State.trafficIntents.delete(creep.name);
                            continue;
                        }
                    }
                }

                movement.moveTo(creep, targetPos, opts);
                global.State.trafficIntents.delete(creep.name);
            }
        } catch (e) {
            console.error(`[TrafficManager Execution Error]: ${e.stack}`);
        }
    }
};

module.exports = TrafficManager;
