// src/power_creeps.js
// Autonomous Power Creep (Operator) Pipeline, Ops Economy & Dynamic Structure Boosting
// Zero OOP, Flat Functional, TypedArray-Compliant Architecture

const { calcDistance } = require('./constants');
const { moveCreep } = require('./traffic');
const { getConfig } = require('./config');

const RES_OPS = typeof global !== 'undefined' && global.RESOURCE_OPS ? global.RESOURCE_OPS : 'ops';
const RES_ENERGY = typeof global !== 'undefined' && global.RESOURCE_ENERGY ? global.RESOURCE_ENERGY : 'energy';

const PWR_OPS = typeof global !== 'undefined' && global.PWR_GENERATE_OPS ? global.PWR_GENERATE_OPS : 1;
const PWR_SPAWN = typeof global !== 'undefined' && global.PWR_OPERATE_SPAWN ? global.PWR_OPERATE_SPAWN : 2;
const PWR_TOWER = typeof global !== 'undefined' && global.PWR_OPERATE_TOWER ? global.PWR_OPERATE_TOWER : 3;
const PWR_STORAGE = typeof global !== 'undefined' && global.PWR_OPERATE_STORAGE ? global.PWR_OPERATE_STORAGE : 4;
const PWR_EXT = typeof global !== 'undefined' && global.PWR_OPERATE_EXTENSION ? global.PWR_OPERATE_EXTENSION : 6;
const PWR_FACTORY = typeof global !== 'undefined' && global.PWR_OPERATE_FACTORY ? global.PWR_OPERATE_FACTORY : 19;

function tryGenerateOps(pc) {
    if (!pc || !pc.powers) return;
    const power = pc.powers[PWR_OPS];
    if (power && (!power.cooldown || power.cooldown === 0)) {
        pc.usePower(PWR_OPS);
    }
}

function spawnUnspawnedPowerCreep(pc) {
    const colonies = (global.heap && global.heap.colonies) || {};
    let bestPowerSpawn = null;
    let highestRcl = 0;

    for (const rName in colonies) {
        const room = Game.rooms[rName];
        if (!room || !room.controller || !room.controller.my) continue;
        const rcl = room.controller.level;
        if (rcl >= 8) {
            const roomState = global.heap && global.heap.rooms ? global.heap.rooms[rName] : null;
            const pSpawns = (roomState && roomState.powerSpawns && roomState.powerSpawns.length > 0)
                ? roomState.powerSpawns
                : (room.find ? room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_POWER_SPAWN }) : []);
            if (pSpawns.length > 0 && rcl > highestRcl) {
                highestRcl = rcl;
                bestPowerSpawn = pSpawns[0];
            }
        }
    }

    if (bestPowerSpawn && pc.spawn) {
        pc.spawn(bestPowerSpawn);
    }
}

function manageOpsInventory(pc, room) {
    const opsAmount = pc.store ? (pc.store[RES_OPS] || 0) : 0;
    const terminal = room.terminal;
    const storage = room.storage;
    const targetDepot = (terminal && terminal.store && terminal.store.getFreeCapacity(RES_OPS) > 1000) ? terminal : storage;

    // Regulate ceiling: Transfer excess ops (> 500) into depot
    if (opsAmount > 500 && targetDepot && targetDepot.store) {
        const excess = opsAmount - 200;
        if (calcDistance(pc.pos, targetDepot.pos) <= 1) {
            pc.transfer(targetDepot, RES_OPS, excess);
        } else {
            moveCreep(pc, targetDepot.pos, 1);
        }
        return true;
    }

    // Regulate floor: Withdraw ops if below 100 and depot has stored reserves
    if (opsAmount < 100 && targetDepot && targetDepot.store && (targetDepot.store[RES_OPS] || 0) >= 100) {
        const pullAmount = Math.min(200, targetDepot.store[RES_OPS]);
        if (calcDistance(pc.pos, targetDepot.pos) <= 1) {
            pc.withdraw(targetDepot, RES_OPS, pullAmount);
        } else {
            moveCreep(pc, targetDepot.pos, 1);
        }
        return true;
    }

    return false;
}

function applyTargetedPowers(pc, room, roomState) {
    const opsAmount = pc.store ? (pc.store[RES_OPS] || 0) : 0;
    const storage = room.storage;
    const terminal = room.terminal;
    const hasOps = opsAmount >= 10;

    if (!hasOps) return false;

    // A. PWR_OPERATE_TOWER during active siege
    const isSieged = (roomState && (roomState.sieged || (roomState.armedHostiles && roomState.armedHostiles.length > 0)));
    const pTower = pc.powers && pc.powers[PWR_TOWER];
    if (isSieged && pTower && (!pTower.cooldown || pTower.cooldown === 0) && opsAmount >= 10) {
        const towers = (roomState && roomState.towers) || [];
        const unboostedTower = towers.find(t => !t.effects || !t.effects.some(e => e.power === PWR_TOWER));
        if (unboostedTower) {
            if (calcDistance(pc.pos, unboostedTower.pos) <= 3) {
                pc.usePower(PWR_TOWER, unboostedTower);
                return true;
            }
            moveCreep(pc, unboostedTower.pos, 3);
            return true;
        }
    }

    // B. PWR_OPERATE_EXTENSION during energy droughts
    const pExt = pc.powers && pc.powers[PWR_EXT];
    if (pExt && (!pExt.cooldown || pExt.cooldown === 0) && opsAmount >= 2) {
        const energyAvailable = room.energyAvailable;
        const energyCapacity = room.energyCapacityAvailable;
        const isDrought = energyAvailable < energyCapacity * 0.5;
        const depot = (storage && storage.store[RES_ENERGY] > 20000) ? storage : ((terminal && terminal.store[RES_ENERGY] > 20000) ? terminal : null);

        if (isDrought && depot) {
            if (calcDistance(pc.pos, depot.pos) <= 3) {
                pc.usePower(PWR_EXT, depot);
                return true;
            }
            moveCreep(pc, depot.pos, 3);
            return true;
        }
    }

    // C. PWR_OPERATE_SPAWN during spawn backlog
    const pSpawn = pc.powers && pc.powers[PWR_SPAWN];
    if (pSpawn && (!pSpawn.cooldown || pSpawn.cooldown === 0) && opsAmount >= 100) {
        const spawns = (roomState && roomState.spawns)
            ? roomState.spawns
            : (room.find ? room.find(FIND_MY_SPAWNS) : []);
        const activeSpawn = spawns.find(s => s.spawning && (!s.effects || !s.effects.some(e => e.power === PWR_SPAWN)));
        if (activeSpawn) {
            if (calcDistance(pc.pos, activeSpawn.pos) <= 3) {
                pc.usePower(PWR_SPAWN, activeSpawn);
                return true;
            }
            moveCreep(pc, activeSpawn.pos, 3);
            return true;
        }
    }

    // D. PWR_OPERATE_FACTORY for recipe synthesis
    const pFactory = pc.powers && pc.powers[PWR_FACTORY];
    if (pFactory && (!pFactory.cooldown || pFactory.cooldown === 0) && opsAmount >= 100) {
        const factories = (roomState && roomState.factory)
            ? [roomState.factory]
            : (room.find ? room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_FACTORY }) : []);
        const factory = factories[0] || null;
        if (factory && (!factory.effects || !factory.effects.some(e => e.power === PWR_FACTORY))) {
            if (calcDistance(pc.pos, factory.pos) <= 3) {
                pc.usePower(PWR_FACTORY, factory);
                return true;
            }
            moveCreep(pc, factory.pos, 3);
            return true;
        }
    }

    // E. PWR_OPERATE_STORAGE: Scaled 100k-500k capacity expansion (capped at level * 100k up to 500k)
    const pStorage = pc.powers && pc.powers[PWR_STORAGE];
    if (pStorage && (!pStorage.cooldown || pStorage.cooldown === 0) && opsAmount >= 100 && storage && storage.store) {
        const currentCap = storage.store.getCapacity ? storage.store.getCapacity() : 1000000;
        const usedCap = storage.store.getUsedCapacity ? storage.store.getUsedCapacity() : 0;
        const maxLevelCap = 1000000 + (pStorage.level * 100000); // 1.1M to 1.5M ceiling

        if (usedCap > 850000 && currentCap < maxLevelCap && (!storage.effects || !storage.effects.some(e => e.power === PWR_STORAGE))) {
            if (calcDistance(pc.pos, storage.pos) <= 3) {
                pc.usePower(PWR_STORAGE, storage);
                return true;
            }
            moveCreep(pc, storage.pos, 3);
            return true;
        }
    }

    // Idle park at range 2 of storage
    if (storage && calcDistance(pc.pos, storage.pos) > 2) {
        moveCreep(pc, storage.pos, 2);
        return true;
    }

    return false;
}

function runPowerCreeps() {
    if (typeof Game === 'undefined' || !Game.powerCreeps) return;
    if (!getConfig().powerCreepsEnabled) return;

    for (const name in Game.powerCreeps) {
        const pc = Game.powerCreeps[name];
        if (!pc) continue;

        // 1. Autonomous Lifecycle Management: Respawn if dead
        if (!pc.ticksToLive) {
            spawnUnspawnedPowerCreep(pc);
            continue;
        }

        if (!pc.heap) pc.heap = {};
        const room = pc.room;
        if (!room) continue;

        const roomState = (global.heap && global.heap.rooms) ? global.heap.rooms[room.name] : null;
        const powerSpawns = (roomState && roomState.powerSpawns)
            ? roomState.powerSpawns
            : (room.find ? room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_POWER_SPAWN }) : []);
        const powerSpawn = powerSpawns[0] || null;

        // 2. Proactive Renewal: Path to powerSpawn and renew if TTL < 500
        if (pc.ticksToLive < 500 && powerSpawn) {
            if (calcDistance(pc.pos, powerSpawn.pos) <= 1) {
                pc.renew(powerSpawn);
            } else {
                moveCreep(pc, powerSpawn.pos, 1);
            }
            // Concurrently generate ops even while moving or renewing!
            tryGenerateOps(pc);
            continue;
        }

        // 3. Concurrent Ops Generation: Always attempt every 50 ticks
        tryGenerateOps(pc);

        // 4. Ops Inventory Regulation: Prevent hoarding > 500 ops or drying < 100 ops
        const handledInventory = manageOpsInventory(pc, room);
        if (handledInventory) continue;

        // 5. Targeted Structure Boosting: Apply powers based on conditional room gates
        applyTargetedPowers(pc, room, roomState);
    }
}

module.exports = {
    applyTargetedPowers,
    manageOpsInventory,
    runPowerCreeps,
    spawnUnspawnedPowerCreep,
    tryGenerateOps
};
