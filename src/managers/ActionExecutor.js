const ActionConstants = require('../constants/ActionConstants');
const StateEnums = require('../constants/StateEnums');
const CacheLib = require('../lib/CacheLib');
const MemoryHeap = require('../state/MemoryHeap');

/**
 * Maps intents directly to Screeps API calls, bypassing roles entirely.
 */
class ActionExecutor {
    static run() {
        MemoryHeap.init();
        if (!global.creepHeap) global.creepHeap = new Map();
        if (!global.structureHeap) global.structureHeap = new Map();
        
        const allCreeps = Object.values(Game.creeps).concat(Object.values(Game.powerCreeps));
        for (const creep of allCreeps) {
            try {
                if (creep.fatigue && creep.fatigue > 0) continue;
                if (creep.ticksToLive === undefined && !creep.name.includes('Operator')) {
                    if (creep.spawning) continue;
                }

                let heap = global.creepHeap.get(creep.name);
                if (!heap) {
                    heap = CacheLib.getDefaultHeap();
                    global.creepHeap.set(creep.name, heap);
                }
                creep.heap = heap;

                if (Game.time < heap.sleepUntil) continue;

                // 1. Movement Execution
                if (heap.moveDirection) {
                    creep.move(heap.moveDirection);
                    heap.moveDirection = null; // Clear after execution
                }

                // 2. Opportunistic Execution
                if (heap.opportunisticTarget) {
                    const oppTarget = CacheLib.getById(heap.opportunisticTarget);
                    if (oppTarget) {
                        creep.repair(oppTarget);
                    }
                    heap.opportunisticTarget = null;
                }

                const intent = heap.actionIntent;
                if (!intent || intent === ActionConstants.ACTION_IDLE) continue;

                if (intent === ActionConstants.ACTION_MOVE_ROOM) {
                    // Improves architectural consistency by stripping tactical routing from the ActionExecutor
                    continue;
                }

                const target = heap.targetId ? CacheLib.getById(heap.targetId) : null;
                if (heap.targetId && !target) {
                    heap.state = 'idle';
                    heap.actionIntent = ActionConstants.ACTION_IDLE;
                    heap.targetId = null;
                    continue;
                }

                ActionExecutor.executeIntent(creep, heap, intent, target);
            } catch (err) {
                console.log(`[ERROR] ActionExecutor crashed for creep ${creep.name}: ${err.message}\n${err.stack}`);
            }
        }

        // Process MemoryHeap Intended Payloads (New Architecture)
        for (const [targetId, intents] of global.MemoryHeap.actionIntents.entries()) {
            for (let i = 0; i < intents.length; i++) {
                const intentPayload = intents[i];
                const creep = Game.creeps[intentPayload.c] || Game.powerCreeps[intentPayload.c];
                if (!creep) continue;
                const target = CacheLib.getById(targetId) || null;
                ActionExecutor.executeMemoryHeapIntent(creep, intentPayload, target);
            }
        }
        MemoryHeap.clearIntents();

        // Process Structure Native Calls
        for (const [structureId, heap] of global.structureHeap.entries()) {
            const structure = CacheLib.getById(structureId);
            if (!structure || !heap.actionIntent) continue;
            
            const intent = heap.actionIntent;
            const target = heap.targetId ? CacheLib.getById(heap.targetId) : null;

            if (intent === ActionConstants.ACTION_ATTACK && target) structure.attack(target);
            else if (intent === ActionConstants.ACTION_HEAL && target) structure.heal(target);
            else if (intent === ActionConstants.ACTION_REPAIR && target) structure.repair(target);
            else if (intent === ActionConstants.ACTION_TRANSFER_ENERGY && target) structure.transferEnergy(target);
            else if (intent === ActionConstants.ACTION_RUN_REACTION) {
                const r1 = heap.targetId ? CacheLib.getById(heap.targetId) : null;
                const r2 = heap.secondaryTargetId ? CacheLib.getById(heap.secondaryTargetId) : null;
                if (r1 && r2) structure.runReaction(r1, r2);
            }
        }
        global.structureHeap.clear();
    }

    static executeMemoryHeapIntent(creep, payload, target) {
        let result = ERR_INVALID_TARGET;
        const intentNum = payload.a;

        if (intentNum === StateEnums.ACTION_HARVEST) result = creep.harvest(target);
        else if (intentNum === StateEnums.ACTION_WITHDRAW) result = creep.withdraw(target, payload.res || RESOURCE_ENERGY);
        else if (intentNum === StateEnums.ACTION_TRANSFER) result = creep.transfer(target, payload.res || RESOURCE_ENERGY);
        else if (intentNum === StateEnums.ACTION_UPGRADE) result = creep.upgradeController(target);
        else if (intentNum === StateEnums.ACTION_BUILD) result = creep.build(target);
        else if (intentNum === StateEnums.ACTION_REPAIR) result = creep.repair(target);
        else if (intentNum === StateEnums.ACTION_PICKUP) result = creep.pickup(target);
        else if (intentNum === StateEnums.ACTION_DROP) result = creep.drop(payload.res || RESOURCE_ENERGY);
        else if (intentNum === StateEnums.ACTION_ATTACK) result = creep.attack(target);
        else if (intentNum === StateEnums.ACTION_RANGED_ATTACK) result = creep.rangedAttack(target);
        else if (intentNum === StateEnums.ACTION_HEAL) result = creep.heal(target);
        else if (intentNum === StateEnums.ACTION_RESERVE) result = creep.reserveController(target);
        else if (intentNum === StateEnums.ACTION_CLAIM) result = creep.claimController(target);
        else if (intentNum === StateEnums.ACTION_ATTACK_CONTROLLER) result = creep.attackController(target);
        else if (intentNum === StateEnums.ACTION_USE_POWER) result = creep.usePower(payload.powerId, target);
        else if (intentNum === StateEnums.ACTION_RENEW) result = creep.renew(target);
        else if (intentNum === StateEnums.ACTION_ENABLE_ROOM) result = creep.enableRoom(target);
        
        return result;
    }

    static executeIntent(creep, heap, intent, target) {
        let result = ERR_INVALID_TARGET;

        if (heap.secondaryIntent) {
            const secTarget = heap.secondaryTargetId ? CacheLib.getById(heap.secondaryTargetId) : null;
            if (heap.secondaryIntent === ActionConstants.ACTION_PICKUP && secTarget) {
                creep.pickup(secTarget);
            }
        }

        if (intent === ActionConstants.ACTION_HARVEST) {
            result = creep.harvest(target);
        } else if (intent === ActionConstants.ACTION_WITHDRAW) {
            let res = RESOURCE_ENERGY;
            if (target.store) {
                const keys = Object.keys(target.store);
                let maxAmt = -1;
                for (let i = 0; i < keys.length; i++) {
                    const amt = target.store.getUsedCapacity(keys[i]);
                    if (amt > maxAmt) { maxAmt = amt; res = keys[i]; }
                }
            }
            result = creep.withdraw(target, res);
        } else if (intent === ActionConstants.ACTION_TRANSFER) {
            let res = RESOURCE_ENERGY;
            if (creep.store) {
                const keys = Object.keys(creep.store);
                for (let i = 0; i < keys.length; i++) {
                    if (creep.store.getUsedCapacity(keys[i]) > 0) {
                        res = keys[i];
                        if (res !== RESOURCE_ENERGY) break;
                    }
                }
            }
            result = creep.transfer(target, res);
        } else if (intent === ActionConstants.ACTION_BUILD) {
            result = creep.build(target);
        } else if (intent === ActionConstants.ACTION_REPAIR) {
            result = creep.repair(target);
        } else if (intent === ActionConstants.ACTION_UPGRADE) {
            result = creep.upgradeController(target);
        } else if (intent === ActionConstants.ACTION_PICKUP) {
            result = creep.pickup(target);
        } else if (intent === ActionConstants.ACTION_DROP) {
            let res = RESOURCE_ENERGY;
            if (creep.store) {
                const keys = Object.keys(creep.store);
                for (let i = 0; i < keys.length; i++) {
                    if (creep.store.getUsedCapacity(keys[i]) > 0) {
                        res = keys[i];
                        if (res !== RESOURCE_ENERGY) break;
                    }
                }
            }
            result = creep.drop(res);
        } else if (intent === ActionConstants.ACTION_ATTACK) {
            result = creep.attack(target);
        } else if (intent === ActionConstants.ACTION_RANGED_ATTACK) {
            result = creep.rangedAttack(target);
        } else if (intent === ActionConstants.ACTION_HEAL) {
            result = creep.heal(target);
        } else if (intent === ActionConstants.ACTION_DISMANTLE) {
            result = creep.dismantle(target);
        } else if (intent === ActionConstants.ACTION_RESERVE) {
            result = creep.reserveController(target);
        } else if (intent === ActionConstants.ACTION_CLAIM) {
            result = creep.claimController(target);
        } else if (intent === ActionConstants.ACTION_ATTACK_CONTROLLER) {
            result = creep.attackController(target);
        } else if (intent === ActionConstants.ACTION_USE_POWER) {
            result = creep.usePower(heap.powerId, target);
        } else if (intent === ActionConstants.ACTION_RENEW) {
            result = creep.renew(target);
        } else if (intent === ActionConstants.ACTION_ENABLE_ROOM) {
            result = creep.enableRoom(target);
        }

        if (result === ERR_NOT_IN_RANGE) {
            let range = 1;
            if (intent === ActionConstants.ACTION_UPGRADE || intent === ActionConstants.ACTION_BUILD || intent === ActionConstants.ACTION_REPAIR || intent === ActionConstants.ACTION_RANGED_ATTACK) range = 3;
            if (intent === ActionConstants.ACTION_DROP && target && target.memory && target.memory.role === 'upgrader') range = 1;
            else if (intent === ActionConstants.ACTION_DROP) range = 3;

            heap.destination = { x: target.pos.x, y: target.pos.y, roomName: target.pos.roomName, range };
        } else if (result === OK || result === ERR_NOT_ENOUGH_RESOURCES || result === ERR_FULL || result === ERR_INVALID_TARGET) {
            if (intent !== ActionConstants.ACTION_HARVEST) {
                heap.state = 'idle';
                heap.actionIntent = ActionConstants.ACTION_IDLE;
                heap.targetId = null;
            }
        }
    }


}

module.exports = ActionExecutor;
