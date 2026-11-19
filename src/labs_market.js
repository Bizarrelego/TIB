// src/labs_market.js
// Automated T1-T3 Lab Reactions, Creep Boosting, Terminal Inter-Room Balancing & Market Arbitrage
// Ported & Flattened from KasamiBot's Production-Grade Industrial Engine (Zero OOP/Classes)

const { REACTION_RECIPES, calcDistance } = require('./constants');
const { moveCreep } = require('./traffic');
const { getConfig } = require('./config');

const INGREDIENTS_FOR_COMPOUND = REACTION_RECIPES || {
    OH: ['O', 'H'], ZK: ['Z', 'K'], UL: ['U', 'L'], G: ['ZK', 'UL'],
    UH: ['U', 'H'], UO: ['U', 'O'], KH: ['K', 'H'], KO: ['K', 'O'],
    LH: ['L', 'H'], LO: ['L', 'O'], ZH: ['Z', 'H'], ZO: ['Z', 'O'],
    GH: ['G', 'H'], GO: ['G', 'O'],
    UH2O: ['UH', 'OH'], UHO2: ['UO', 'OH'], KH2O: ['KH', 'OH'], KHO2: ['KO', 'OH'],
    LH2O: ['LH', 'OH'], LHO2: ['LO', 'OH'], ZH2O: ['ZH', 'OH'], ZHO2: ['ZO', 'OH'],
    GH2O: ['GH', 'OH'], GHO2: ['GO', 'OH'],
    XUH2O: ['X', 'UH2O'], XUHO2: ['X', 'UHO2'], XKH2O: ['X', 'KH2O'], XKHO2: ['X', 'KHO2'],
    XLH2O: ['X', 'LH2O'], XLHO2: ['X', 'LHO2'], XZH2O: ['X', 'ZH2O'], XZHO2: ['X', 'ZHO2'],
    XGH2O: ['X', 'GH2O'], XGHO2: ['X', 'GHO2']
};

const REACTION_TARGETS = [
    ['OH', 3000], ['ZK', 3000], ['UL', 3000], ['G', 3000],
    ['XGHO2', 3000], ['XLHO2', 3000], ['XZH2O', 3000], ['XKHO2', 3000], ['XUH2O', 3000], ['XZHO2', 3000], ['XGH2O', 3000],
    ['XGHO2', 6000], ['XLHO2', 6000], ['XZH2O', 6000], ['XKHO2', 6000], ['XUH2O', 6000], ['XZHO2', 6000], ['XGH2O', 6000]
];

const BASIC_MINERALS = [
    RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM,
    RESOURCE_KEANIUM, RESOURCE_LEMERGIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST
];

const BASIC_MINERAL_SET = {
    [RESOURCE_HYDROGEN]: true,
    [RESOURCE_OXYGEN]: true,
    [RESOURCE_UTRIUM]: true,
    [RESOURCE_KEANIUM]: true,
    [RESOURCE_LEMERGIUM]: true,
    [RESOURCE_ZYNTHIUM]: true,
    [RESOURCE_CATALYST]: true
};

const MIN_REACTION_BATCH_INPUT = 5;
const MIN_INTERMEDIATE_PREFER = 500;

// --- DAG TOPOLOGICAL REACTION RESOLVER ---

function getRequiredBasicMinerals(mineral) {
    const counts = {};
    function recurse(m) {
        const ingredients = INGREDIENTS_FOR_COMPOUND[m];
        if (!ingredients) {
            counts[m] = (counts[m] || 0) + 1;
        } else {
            recurse(ingredients[0]);
            recurse(ingredients[1]);
        }
    }
    recurse(mineral);
    return counts;
}

function getRequiredReactions(mineral) {
    const list = [];
    function recurse(m) {
        const ingredients = INGREDIENTS_FOR_COMPOUND[m];
        if (!ingredients) return;
        recurse(ingredients[0]);
        recurse(ingredients[1]);
        list.push(m);
    }
    recurse(mineral);
    return list;
}

function getRoomLabs(room) {
    const roomState = global.heap && global.heap.rooms ? global.heap.rooms[room.name] : null;
    if (roomState && roomState.labs && roomState.labs.length) {
        return roomState.labs;
    }
    return room.find ? room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB }) : [];
}

function getLabPartition(room, roomState) {
    if (roomState && Array.isArray(roomState.supplierLabs) && Array.isArray(roomState.reactorLabs) &&
        roomState.supplierLabs.length === 2 && roomState.reactorLabs.length >= 1) {
        return { supplierLabs: roomState.supplierLabs, reactorLabs: roomState.reactorLabs };
    }
    const allLabs = (roomState && Array.isArray(roomState.labs) && roomState.labs.length)
        ? roomState.labs
        : getRoomLabs(room);
    if (allLabs.length < 3) return { supplierLabs: allLabs.slice(0, 2), reactorLabs: [] };
    return { supplierLabs: [allLabs[0], allLabs[1]], reactorLabs: allLabs.slice(2) };
}

function ensureLabHeapState(roomName, roomState) {
    if (!global.heap) global.heap = {};
    if (!global.heap.labReactions) global.heap.labReactions = {};
    let entry = global.heap.labReactions[roomName];
    if (!entry) {
        entry = { activeReaction: null, missingBaseMinerals: [], nextDagCheck: 0 };
        global.heap.labReactions[roomName] = entry;
    }
    if (roomState) {
        const desc = Object.getOwnPropertyDescriptor(roomState, 'activeReaction');
        if (!desc || !desc.get) {
            if (roomState.activeReaction !== undefined) entry.activeReaction = roomState.activeReaction;
            if (Array.isArray(roomState.missingBaseMinerals)) entry.missingBaseMinerals = roomState.missingBaseMinerals;
        }
    }
    return entry;
}

function getColonyMineralStock(room, roomState, resourceType, includeAllLabs) {
    if (!resourceType) return 0;
    const terminal = (roomState && roomState.terminal) || room.terminal;
    const storage = (roomState && roomState.storage) || room.storage;
    let total = (terminal && terminal.store ? (terminal.store[resourceType] || 0) : 0) +
        (storage && storage.store ? (storage.store[resourceType] || 0) : 0);

    if (includeAllLabs !== false) {
        const labs = (roomState && roomState.labs) || getRoomLabs(room);
        for (let i = 0; i < labs.length; i++) {
            const lab = labs[i];
            if (lab && lab.mineralType === resourceType) {
                total += (lab.mineralAmount || 0);
            }
        }
    }
    return total;
}

function collectMissingBaseForLeaf(room, roomState, mineral, desired, missingList, missingSeen) {
    if (BASIC_MINERAL_SET[mineral]) {
        const stock = getColonyMineralStock(room, roomState, mineral, true);
        if (stock < Math.max(MIN_REACTION_BATCH_INPUT, desired) && !missingSeen[mineral]) {
            missingSeen[mineral] = true;
            missingList.push(mineral);
        }
    }
}

function resolveReactionStep(room, roomState, compound, desiredAmount, missingList, missingSeen, visiting) {
    const ingredients = INGREDIENTS_FOR_COMPOUND[compound];
    if (!ingredients || ingredients.length < 2) {
        collectMissingBaseForLeaf(room, roomState, compound, desiredAmount, missingList, missingSeen);
        return null;
    }
    if (visiting[compound]) return null;

    const currentStock = getColonyMineralStock(room, roomState, compound, true);
    if (currentStock >= desiredAmount) return null;

    visiting[compound] = true;
    const ing1 = ingredients[0];
    const ing2 = ingredients[1];
    const remainingDeficit = Math.max(MIN_REACTION_BATCH_INPUT, desiredAmount - currentStock);
    const subTarget = Math.min(3000, remainingDeficit);

    const stock1 = getColonyMineralStock(room, roomState, ing1, true);
    const stock2 = getColonyMineralStock(room, roomState, ing2, true);

    if (INGREDIENTS_FOR_COMPOUND[ing1] && stock1 < Math.min(MIN_INTERMEDIATE_PREFER, subTarget)) {
        const subStep1 = resolveReactionStep(room, roomState, ing1, subTarget, missingList, missingSeen, visiting);
        if (subStep1) {
            delete visiting[compound];
            return subStep1;
        }
    } else if (!INGREDIENTS_FOR_COMPOUND[ing1] && stock1 < subTarget) {
        collectMissingBaseForLeaf(room, roomState, ing1, subTarget, missingList, missingSeen);
    }

    if (INGREDIENTS_FOR_COMPOUND[ing2] && stock2 < Math.min(MIN_INTERMEDIATE_PREFER, subTarget)) {
        const subStep2 = resolveReactionStep(room, roomState, ing2, subTarget, missingList, missingSeen, visiting);
        if (subStep2) {
            delete visiting[compound];
            return subStep2;
        }
    } else if (!INGREDIENTS_FOR_COMPOUND[ing2] && stock2 < subTarget) {
        collectMissingBaseForLeaf(room, roomState, ing2, subTarget, missingList, missingSeen);
    }

    delete visiting[compound];

    if (stock1 >= MIN_REACTION_BATCH_INPUT && stock2 >= MIN_REACTION_BATCH_INPUT) {
        return {
            compound: compound,
            input1: ing1,
            input2: ing2,
            targetAmount: desiredAmount
        };
    }
    return null;
}

function evaluateRoomReactionDAG(room, roomState, allowSwitchReaction) {
    const labHeap = ensureLabHeapState(room.name, roomState);
    const missingList = labHeap.missingBaseMinerals;
    missingList.length = 0;
    const missingSeen = {};
    const visiting = {};
    let chosen = null;

    for (let i = 0; i < REACTION_TARGETS.length; i++) {
        const targetCompound = REACTION_TARGETS[i][0];
        const quota = REACTION_TARGETS[i][1];
        const current = getColonyMineralStock(room, roomState, targetCompound, true);
        if (current >= quota) continue;

        const step = resolveReactionStep(room, roomState, targetCompound, quota, missingList, missingSeen, visiting);
        if (step && !chosen && allowSwitchReaction) {
            chosen = step;
        }
    }

    if (allowSwitchReaction) {
        labHeap.activeReaction = chosen;
        if (roomState) roomState.activeReaction = chosen;
    }
    if (roomState) roomState.missingBaseMinerals = missingList;
    labHeap.nextDagCheck = (typeof Game !== 'undefined' ? Game.time : 0) + 50;
    return chosen;
}

function isActiveReactionValid(room, roomState, active) {
    if (!active || !active.compound || !active.input1 || !active.input2) return false;
    const producedStock = getColonyMineralStock(room, roomState, active.compound, true);
    if (producedStock >= (active.targetAmount || 3000)) return false;
    const in1Stock = getColonyMineralStock(room, roomState, active.input1, true);
    const in2Stock = getColonyMineralStock(room, roomState, active.input2, true);
    if (in1Stock < MIN_REACTION_BATCH_INPUT || in2Stock < MIN_REACTION_BATCH_INPUT) return false;
    return true;
}

// --- LAB REACTION RUNNER ---

function runLabs(roomName) {
    if (typeof Game === 'undefined') return;
    const cfg = getConfig();
    if (!cfg.labReactionsEnabled) return;

    for (const rName in Game.rooms) {
        if (roomName && rName !== roomName) continue;
        const room = Game.rooms[rName];
        if (!room || !room.controller || !room.controller.my || room.controller.level < 6) continue;

        const roomState = global.heap && global.heap.rooms ? global.heap.rooms[rName] : null;
        const partition = getLabPartition(room, roomState);
        const supplierLabs = partition.supplierLabs;
        const reactorLabs = partition.reactorLabs;
        if (supplierLabs.length < 2 || reactorLabs.length < 1) continue;

        const inputLabA = supplierLabs[0];
        const inputLabB = supplierLabs[1];
        if (!inputLabA || !inputLabB) continue;

        const terminal = (roomState && roomState.terminal) || room.terminal;
        const storage = (roomState && roomState.storage) || room.storage;
        if (!terminal && !storage) continue;

        const labHeap = ensureLabHeapState(rName, roomState);
        let active = labHeap.activeReaction;

        // 1. Keep Batch Locked until target quota met or either input runs dry (< 5 units)
        if (active && !isActiveReactionValid(room, roomState, active)) {
            active = null;
            labHeap.activeReaction = null;
            if (roomState) roomState.activeReaction = null;
        }

        // 2. Re-evaluate DAG immediately when idle/completed or every 50 ticks to refresh Market demands
        const dueForCheck = !active || !labHeap.nextDagCheck || Game.time >= labHeap.nextDagCheck;
        if (dueForCheck) {
            evaluateRoomReactionDAG(room, roomState, !active);
            active = labHeap.activeReaction;
        }

        if (!active) continue;

        // 3. Execute Reactions across reactorLabs on cooldown === 0 (skipping boost-reserved labs)
        const hasA = inputLabA.mineralType === active.input1 && (inputLabA.mineralAmount || 0) >= MIN_REACTION_BATCH_INPUT;
        const hasB = inputLabB.mineralType === active.input2 && (inputLabB.mineralAmount || 0) >= MIN_REACTION_BATCH_INPUT;
        if (!hasA || !hasB) continue;

        const boostMap = global.heap && global.heap.boostReservedLabs ? global.heap.boostReservedLabs : null;
        for (let i = 0; i < reactorLabs.length; i++) {
            const reactor = reactorLabs[i];
            if (!reactor) continue;
            if (reactor.cooldown && reactor.cooldown > 0) continue;
            if ((reactor._boostReservedUntil && reactor._boostReservedUntil > Game.time) ||
                (boostMap && boostMap[reactor.id] && boostMap[reactor.id] > Game.time)) continue;
            if (reactor.mineralType && reactor.mineralType !== active.compound) continue;
            const cap = reactor.mineralCapacity || 3000;
            if ((reactor.mineralAmount || 0) > cap - MIN_REACTION_BATCH_INPUT) continue;

            reactor.runReaction(inputLabA, inputLabB);
        }
    }
}

// --- TERMINAL INTER-ROOM BALANCING ---

const ENERGY_SHARE_PROVIDER_RCL = 7;
const ENERGY_SHARE_PROVIDER_STORAGE = 100000;
const ENERGY_SHARE_RECEIVER_STORAGE = 30000;
const ENERGY_SHARE_BATCH_SIZE = 25000;
const RESERVE_ENERGY_FLOOR = 100000;
const MINERAL_QUOTA_BASE = 20000;
const MINERAL_QUOTA_T3 = 10000;
const MIN_TRANSFER_CHUNK = 3000;
const WAR_BOOSTS = ['XGHO2', 'XLHO2', 'XZHO2', 'XZH2O', 'XKHO2', 'XUH2O'];

// Throttled O(1) Equalization Matrix (runs once per empire every 50 ticks with 30%+ delta deadband & distance sort)
function runTerminalEqualization(colonies) {
    if (typeof Game === 'undefined' || Game.time % 50 !== 0) return;
    const h = global.heap || (global.heap = {});
    if (h.termEqTick === Game.time) return;
    h.termEqTick = Game.time;

    const colonyRooms = [];
    const seenNames = {};
    for (const rName in colonies) {
        const rm = Game.rooms[rName];
        if (rm && rm.controller && rm.controller.my && rm.terminal) {
            colonyRooms.push(rm);
            seenNames[rName] = true;
        }
    }
    for (const rName in Game.rooms) {
        if (seenNames[rName]) continue;
        const rm = Game.rooms[rName];
        if (rm && rm.controller && rm.controller.my && rm.terminal) colonyRooms.push(rm);
    }
    if (colonyRooms.length < 2) return;

    const resources = BASIC_MINERALS.concat(WAR_BOOSTS);
    for (let r = 0; r < resources.length; r++) {
        const res = resources[r];
        const target = (r >= BASIC_MINERALS.length) ? MINERAL_QUOTA_T3 : MINERAL_QUOTA_BASE;
        const isBasic = r < BASIC_MINERALS.length;
        const surplusList = [];
        const deficitList = [];

        for (let c = 0; c < colonyRooms.length; c++) {
            const rm = colonyRooms[c];
            const rState = h.rooms ? h.rooms[rm.name] : null;
            const total = (rm.terminal.store[res] || 0) + (rm.storage ? (rm.storage.store[res] || 0) : 0);
            const termStock = rm.terminal.store[res] || 0;
            const totalEnergy = (rm.terminal.store[RESOURCE_ENERGY] || 0) + (rm.storage ? (rm.storage.store[RESOURCE_ENERGY] || 0) : 0);
            const dagNeeds = isBasic && rState && Array.isArray(rState.missingBaseMinerals) && rState.missingBaseMinerals.includes(res);
            const priorityRecv = !!(
                dagNeeds ||
                (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[rm.name] && Memory.rooms[rm.name].fob === true) ||
                (h.rooms && h.rooms[rm.name] && h.rooms[rm.name].sieged) ||
                (h.lockdown && h.lockdown[rm.name] > Game.time)
            );
            if (dagNeeds && total < 3000) {
                deficitList.push({ room: rm, need: 3000 - total, priorityRecv: true, dagNeed: true });
            } else if (total < target * 0.5) {
                deficitList.push({ room: rm, need: target - total, priorityRecv: priorityRecv, dagNeed: false });
            } else if (total > target * 1.2 && termStock >= MIN_TRANSFER_CHUNK && rm.terminal.cooldown === 0) {
                surplusList.push({ room: rm, avail: Math.min(termStock, total - target), totalEnergy: totalEnergy });
            } else if (isBasic && total >= 4500 && termStock >= 1500 && rm.terminal.cooldown === 0) {
                const active = rState && rState.activeReaction;
                if (!active || (active.input1 !== res && active.input2 !== res)) {
                    surplusList.push({ room: rm, avail: Math.min(termStock, total - 3000), totalEnergy: totalEnergy, dagSpare: true });
                }
            }
        }
        if (surplusList.length === 0 || deficitList.length === 0) continue;

        for (let d = 0; d < deficitList.length; d++) {
            const def = deficitList[d];
            surplusList.sort((a, b) =>
                Game.map.getRoomLinearDistance(a.room.name, def.room.name) -
                Game.map.getRoomLinearDistance(b.room.name, def.room.name)
            );
            for (let s = 0; s < surplusList.length; s++) {
                const sur = surplusList[s];
                const minChunk = def.dagNeed ? 1000 : MIN_TRANSFER_CHUNK;
                if (sur.dagSpare && !def.dagNeed) continue;
                if (sur.avail < minChunk) continue;
                if (!def.priorityRecv && sur.totalEnergy < RESERVE_ENERGY_FLOOR) continue;
                const sendAmt = Math.min(sur.avail, Math.max(minChunk, def.need));
                const cost = Game.market.calcTransactionCost(sendAmt, sur.room.name, def.room.name);
                const neededEnergy = (res === RESOURCE_ENERGY ? sendAmt + cost : cost) + 5000;
                if ((sur.room.terminal.store[RESOURCE_ENERGY] || 0) >= neededEnergy) {
                    if (sur.room.terminal.send(res, sendAmt, def.room.name) === OK) {
                        sur.avail = 0; // Terminal entered cooldown
                        break;
                    }
                }
            }
        }
    }
}

function runTerminal(roomName) {
    if (typeof Game === 'undefined') return;

    const heap = global.heap || {};
    const colonies = heap.colonies || {};

    runTerminalEqualization(colonies);

    for (const rName in Game.rooms) {
        if (roomName && rName !== roomName) continue;
        const room = Game.rooms[rName];
        if (!room || !room.terminal || !room.controller || !room.controller.my) continue;

        const terminal = room.terminal;
        if (terminal.cooldown > 0) continue;

        const storage = room.storage;
        const storageEnergy = storage ? (storage.store[RESOURCE_ENERGY] || 0) : 0;
        const terminalEnergy = terminal.store[RESOURCE_ENERGY] || 0;
        if (storageEnergy + terminalEnergy < RESERVE_ENERGY_FLOOR) continue;

        // 1. Inter-Colony Emergency & Growth Energy Equalization
        if (room.controller.level >= ENERGY_SHARE_PROVIDER_RCL && storageEnergy >= ENERGY_SHARE_PROVIDER_STORAGE && terminalEnergy >= 10000) {
            for (const otherName in colonies) {
                if (otherName === rName) continue;
                const otherRoom = Game.rooms[otherName];
                if (!otherRoom || !otherRoom.terminal || !otherRoom.controller || !otherRoom.controller.my) continue;

                const otherStorage = otherRoom.storage;
                const otherStorageEnergy = otherStorage ? (otherStorage.store[RESOURCE_ENERGY] || 0) : 0;

                if (otherStorageEnergy < ENERGY_SHARE_RECEIVER_STORAGE) {
                    const sendAmt = Math.min(ENERGY_SHARE_BATCH_SIZE, terminalEnergy - 5000);
                    const cost = Game.market.calcTransactionCost(sendAmt, rName, otherName);
                    if (terminalEnergy >= sendAmt + cost && sendAmt >= 1000) {
                        terminal.send(RESOURCE_ENERGY, sendAmt, otherName);
                        return;
                    }
                }
            }
        }

        // 1b. Inter-Colony Praiseroom GCL Energy Support (KasamiBot GCL Rocket Pattern)
        const praiseRoomName = (typeof Memory !== 'undefined' && Memory.empire) ? Memory.empire.praiseRoom : null;
        if (praiseRoomName && praiseRoomName !== rName && room.controller.level >= 7 && storageEnergy >= 120000 && terminalEnergy >= 25000) {
            const pRoom = Game.rooms[praiseRoomName];
            if (pRoom && pRoom.terminal) {
                const sendAmt = Math.min(ENERGY_SHARE_BATCH_SIZE, terminalEnergy - 5000);
                const cost = Game.market.calcTransactionCost(sendAmt, rName, praiseRoomName);
                if (terminalEnergy >= sendAmt + cost) {
                    terminal.send(RESOURCE_ENERGY, sendAmt, praiseRoomName);
                    return;
                }
            }
        }
    }
}

// --- PUBLIC MARKET ARBITRAGE & LIQUIDATION ---

const ORDER_TYPE_BUY = (typeof global !== 'undefined' && global.ORDER_BUY) ? global.ORDER_BUY : 'buy';
const ORDER_TYPE_SELL = (typeof global !== 'undefined' && global.ORDER_SELL) ? global.ORDER_SELL : 'sell';

// --- FACTORY PRODUCTION ENGINE ---

const RES_UTRIUM_BAR = 'utrium_bar';
const RES_LEMERGIUM_BAR = 'lemergium_bar';
const RES_ZYNTHIUM_BAR = 'zynthium_bar';
const RES_KEANIUM_BAR = 'keanium_bar';
const RES_OXIDANT = 'oxidant';
const RES_REDUCTANT = 'reductant';
const RES_PURIFIER = 'purifier';
const RES_GHODIUM_MELT = 'ghodium_melt';
const RES_BATTERY = 'battery';

const RES_WIRE = 'wire';
const RES_ALLOY = 'alloy';
const RES_CELL = 'cell';
const RES_CONDENSATE = 'condensate';

const RES_COMPOSITE = 'composite';
const RES_TUBE = 'tube';
const RES_SWITCH = 'switch';

const FACTORY_RECIPES = {
    [RES_UTRIUM_BAR]: { level: 0, components: { [RESOURCE_UTRIUM]: 500, [RESOURCE_ENERGY]: 200 } },
    [RES_LEMERGIUM_BAR]: { level: 0, components: { [RESOURCE_LEMERGIUM]: 500, [RESOURCE_ENERGY]: 200 } },
    [RES_ZYNTHIUM_BAR]: { level: 0, components: { [RESOURCE_ZYNTHIUM]: 500, [RESOURCE_ENERGY]: 200 } },
    [RES_KEANIUM_BAR]: { level: 0, components: { [RESOURCE_KEANIUM]: 500, [RESOURCE_ENERGY]: 200 } },
    [RES_OXIDANT]: { level: 0, components: { [RESOURCE_OXYGEN]: 500, [RESOURCE_ENERGY]: 200 } },
    [RES_REDUCTANT]: { level: 0, components: { [RESOURCE_HYDROGEN]: 500, [RESOURCE_ENERGY]: 200 } },
    [RES_PURIFIER]: { level: 0, components: { [RESOURCE_CATALYST]: 500, [RESOURCE_ENERGY]: 200 } },
    [RES_GHODIUM_MELT]: { level: 0, components: { [RESOURCE_GHODIUM]: 500, [RESOURCE_ENERGY]: 200 } },
    [RES_BATTERY]: { level: 0, components: { [RESOURCE_ENERGY]: 600 } },

    [RES_WIRE]: { level: 0, components: { silicon: 100, [RESOURCE_ENERGY]: 40 } },
    [RES_ALLOY]: { level: 0, components: { metal: 100, [RESOURCE_ENERGY]: 40 } },
    [RES_CELL]: { level: 0, components: { biomass: 100, [RESOURCE_ENERGY]: 40 } },
    [RES_CONDENSATE]: { level: 0, components: { mist: 100, [RESOURCE_ENERGY]: 40 } },

    [RES_COMPOSITE]: { level: 1, components: { [RES_UTRIUM_BAR]: 20, [RES_ZYNTHIUM_BAR]: 20, [RESOURCE_ENERGY]: 20 } },
    [RES_TUBE]: { level: 1, components: { [RES_ALLOY]: 40, [RES_ZYNTHIUM_BAR]: 16, [RESOURCE_ENERGY]: 8 } },
    [RES_SWITCH]: { level: 1, components: { [RES_WIRE]: 40, [RES_OXIDANT]: 95, [RES_UTRIUM_BAR]: 15, [RESOURCE_ENERGY]: 8 } },
    crystal: { level: 2, components: { [RES_LEMERGIUM_BAR]: 6, [RES_KEANIUM_BAR]: 6, [RES_PURIFIER]: 6, [RESOURCE_ENERGY]: 45 } },
    liquid: { level: 3, components: { [RES_OXIDANT]: 12, [RES_REDUCTANT]: 12, [RES_GHODIUM_MELT]: 12, [RESOURCE_ENERGY]: 90 } },
    transistor: { level: 2, components: { [RES_SWITCH]: 4, [RES_WIRE]: 15, [RES_REDUCTANT]: 85, [RESOURCE_ENERGY]: 8 } },
    microchip: { level: 3, components: { transistor: 2, [RES_COMPOSITE]: 50, [RES_WIRE]: 117, [RES_PURIFIER]: 25, [RESOURCE_ENERGY]: 16 } },
    circuit: { level: 4, components: { microchip: 1, transistor: 5, [RES_SWITCH]: 4, [RES_OXIDANT]: 115, [RESOURCE_ENERGY]: 32 } },
    device: { level: 5, components: { circuit: 1, microchip: 3, crystal: 110, [RES_GHODIUM_MELT]: 150, [RESOURCE_ENERGY]: 64 } }
};

function runFactory(roomName) {
    if (typeof Game === 'undefined') return;
    const room = Game.rooms[roomName];
    if (!room || !room.controller || !room.controller.my || room.controller.level < 7) return;

    const roomState = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    let factory = (roomState && roomState.factory) || (room.find ? (room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_FACTORY })[0] || null) : null);
    if (!factory || factory.cooldown > 0) return;

    const factoryLevel = factory.level || 0;
    const fStore = factory.store;
    if (!fStore) return;

    for (const commodity in FACTORY_RECIPES) {
        const recipe = FACTORY_RECIPES[commodity];
        if (recipe.level > factoryLevel) continue;

        let canProduce = true;
        for (const comp in recipe.components) {
            const needed = recipe.components[comp];
            if ((fStore[comp] || 0) < needed) {
                canProduce = false;
                break;
            }
        }

        if (canProduce) {
            factory.produce(commodity);
            return;
        }
    }
}

const MARKET_ALPHA = 2 / (14 + 1); // 14-day EMA smoothing factor
const MARKET_DRIFT_LIMIT = 0.15;   // > 15% drift gate before changeOrderPrice()
const ORDER_REFILL_FLOOR = 1000;   // Extend order only when remainingAmount < 1,000
const MINERAL_RESERVE_FLOOR = 20000;
const MINERAL_SURPLUS_TRIGGER = 25000;
const MARKET_BUY_BATCH = 3000;

function getMarketHistoryEMA(resourceType) {
    if (!global.heap) global.heap = {};
    if (!global.heap.marketEMA) global.heap.marketEMA = {};
    const cached = global.heap.marketEMA[resourceType];
    if (cached && Game.time < cached.expires) return cached.price;

    if (typeof Game !== 'undefined' && Game.market && Game.market.getHistory) {
        const history = Game.market.getHistory(resourceType);
        if (Array.isArray(history) && history.length > 0) {
            let ema = null;
            const limit = Math.min(14, history.length);
            for (let i = 0; i < limit; i++) {
                const rec = history[i];
                if (rec && rec.volume > 0 && rec.avgPrice > 0) {
                    ema = (ema === null) ? rec.avgPrice : (rec.avgPrice * MARKET_ALPHA + ema * (1 - MARKET_ALPHA));
                }
            }
            if (ema !== null) {
                global.heap.marketEMA[resourceType] = { price: ema, expires: Game.time + 1000 };
                return ema;
            }
        }
    }
    return null;
}

function getEmpireNetworkMineralStock(ownedTerminalRooms, mineral) {
    let total = 0;
    for (let i = 0; i < ownedTerminalRooms.length; i++) {
        const rm = ownedTerminalRooms[i];
        const rState = global.heap && global.heap.rooms ? global.heap.rooms[rm.name] : null;
        total += getColonyMineralStock(rm, rState, mineral, true);
    }
    return total;
}

function liquidateRoomSurplus(room, roomState, myOrders, credits, ENERGY_VALUE) {
    const terminal = room.terminal;
    const storage = room.storage;
    if (!terminal || terminal.cooldown > 0 || !terminal.store) return false;

    const termEnergy = terminal.store[RESOURCE_ENERGY] || 0;
    const active = roomState && roomState.activeReaction ? roomState.activeReaction : null;
    const nativeMineral = (roomState && roomState.mineral) ? roomState.mineral.mineralType : null;

    const candidates = [];
    const seen = {};
    if (nativeMineral) {
        candidates.push(nativeMineral);
        seen[nativeMineral] = true;
    }
    for (let i = 0; i < BASIC_MINERALS.length; i++) {
        if (!seen[BASIC_MINERALS[i]]) {
            candidates.push(BASIC_MINERALS[i]);
            seen[BASIC_MINERALS[i]] = true;
        }
    }

    for (let i = 0; i < candidates.length; i++) {
        const res = candidates[i];
        if (active && (active.input1 === res || active.input2 === res)) continue;

        const termAmt = terminal.store[res] || 0;
        const storAmt = storage && storage.store ? (storage.store[res] || 0) : 0;
        const totalStock = termAmt + storAmt;
        if (totalStock <= MINERAL_SURPLUS_TRIGGER) continue;

        const surplus = totalStock - MINERAL_RESERVE_FLOOR;
        const sellAmount = Math.min(termAmt, surplus, 10000);
        const ema = getMarketHistoryEMA(res);

        // Prefer instant Game.market.deal() into public buy orders meeting MIN_DEAL_PROFIT and within 5% of EMA
        if (sellAmount >= 100 && termEnergy > 5000) {
            const buyOrders = Game.market.getAllOrders({ type: ORDER_TYPE_BUY, resourceType: res }) || [];
            let bestOrder = null;
            let bestDealAmount = 0;
            let bestUnitNet = -Infinity;

            for (let b = 0; b < buyOrders.length; b++) {
                const ord = buyOrders[b];
                if (!ord || ord.amount <= 0 || ord.price <= 0.001) continue;
                if (ema && ord.price < ema * 0.95) continue;
                const dealAmt = Math.min(sellAmount, ord.amount);
                const cost = Game.market.calcTransactionCost(dealAmt, room.name, ord.roomName);
                if (termEnergy < cost + 5000) continue;
                const netProfit = (dealAmt * ord.price) - (cost * ENERGY_VALUE);
                if (netProfit < getConfig().minDealProfit) continue;
                const unitNet = netProfit / dealAmt;
                if (unitNet > bestUnitNet) {
                    bestUnitNet = unitNet;
                    bestOrder = ord;
                    bestDealAmount = dealAmt;
                }
            }

            if (bestOrder && bestDealAmount > 0) {
                if (Game.market.deal(bestOrder.id, bestDealAmount, room.name) === OK) {
                    return true;
                }
            }
        }

        // Fallback: maintain a single throttled ORDER_SELL (only update if > 15% drifted from EMA)
        if (!global.heap.marketSellSync) global.heap.marketSellSync = {};
        const syncKey = `${room.name}:${res}`;
        const nextSync = global.heap.marketSellSync[syncKey] || 0;
        if (Game.time < nextSync && Game.time % 100 !== 0) continue;
        global.heap.marketSellSync[syncKey] = Game.time + 100;

        const targetPrice = Math.round(((ema && ema > 0) ? ema : 2.0) * 1000) / 1000;
        const existingOrder = myOrders.find(o => o.roomName === room.name && o.resourceType === res && o.type === ORDER_TYPE_SELL);

        if (existingOrder) {
            if (ema && ema > 0 && Game.market.changeOrderPrice) {
                const drift = Math.abs(targetPrice - existingOrder.price) / Math.max(0.001, ema);
                if (drift > MARKET_DRIFT_LIMIT && targetPrice > 0) {
                    Game.market.changeOrderPrice(existingOrder.id, targetPrice);
                }
            }
            if (existingOrder.remainingAmount < ORDER_REFILL_FLOOR && Game.market.extendOrder && termAmt >= 1000) {
                Game.market.extendOrder(existingOrder.id, Math.min(5000, surplus));
            }
        } else if (sellAmount >= 500 && credits >= 1000 && myOrders.length < 50 && Game.market.createOrder) {
            Game.market.createOrder({
                type: ORDER_TYPE_SELL,
                resourceType: res,
                price: targetPrice,
                totalAmount: Math.min(10000, surplus),
                roomName: room.name
            });
            return true;
        }
    }

    // Energy overflow safeguard if Terminal approaches capacity (> 150k or near full Storage)
    let totalStorage = 0;
    if (storage && storage.store) {
        for (const k in storage.store) totalStorage += storage.store[k] || 0;
    }
    const eAmt = termEnergy;
    if (eAmt > 150000 || (totalStorage > 900000 && eAmt > 50000)) {
        const sellAmount = Math.min(eAmt - 50000, 10000);
        const buyOrders = Game.market.getAllOrders({ type: ORDER_TYPE_BUY, resourceType: RESOURCE_ENERGY }) || [];
        const emaE = getMarketHistoryEMA(RESOURCE_ENERGY);
        buyOrders.sort((a, b) => b.price - a.price);
        const best = buyOrders[0];
        if (best && best.price > 0.01 && (!emaE || best.price >= emaE * 0.95)) {
            const dealAmt = Math.min(sellAmount, best.amount);
            const cost = Game.market.calcTransactionCost(dealAmt, room.name, best.roomName);
            const netProfit = (dealAmt * best.price) - (cost * ENERGY_VALUE);
            if (eAmt >= dealAmt + cost + 5000 && netProfit >= getConfig().minDealProfit) {
                if (Game.market.deal(best.id, dealAmt, room.name) === OK) return true;
            }
        }
    }

    return false;
}

function acquireMissingBaseMinerals(ownedTerminalRooms, credits, ENERGY_VALUE) {
    if (credits <= getConfig().creditFloor) return false;

    for (let r = 0; r < ownedTerminalRooms.length; r++) {
        const room = ownedTerminalRooms[r];
        const terminal = room.terminal;
        if (!terminal || terminal.cooldown > 0 || !terminal.store) continue;

        const termEnergy = terminal.store[RESOURCE_ENERGY] || 0;
        if (termEnergy <= 5000) continue;

        const roomState = global.heap && global.heap.rooms ? global.heap.rooms[room.name] : null;
        const labHeap = ensureLabHeapState(room.name, roomState);
        if (!labHeap.missingBaseMinerals || labHeap.missingBaseMinerals.length === 0 || Game.time >= labHeap.nextDagCheck) {
            evaluateRoomReactionDAG(room, roomState, false);
        }

        const neededList = labHeap.missingBaseMinerals || [];
        for (let i = 0; i < neededList.length; i++) {
            const mineral = neededList[i];
            if (!BASIC_MINERAL_SET[mineral]) continue;

            // Only buy if unavailable across the entire empire Terminal network (< 3,000)
            const empireStock = getEmpireNetworkMineralStock(ownedTerminalRooms, mineral);
            if (empireStock >= MARKET_BUY_BATCH) continue;

            const ema = getMarketHistoryEMA(mineral);
            const sellOrders = Game.market.getAllOrders({ type: ORDER_TYPE_SELL, resourceType: mineral }) || [];
            if (!sellOrders.length) continue;

            let bestOrder = null;
            let bestDealAmt = 0;
            let bestEffUnitCost = Infinity;

            for (let s = 0; s < sellOrders.length; s++) {
                const ord = sellOrders[s];
                if (!ord || ord.amount <= 0 || ord.price <= 0) continue;
                if (ema && ord.price > ema * 1.25) continue;

                const dealAmt = Math.min(MARKET_BUY_BATCH, ord.amount);
                const totalSpend = dealAmt * ord.price;
                if (credits < totalSpend) continue;

                const cost = Game.market.calcTransactionCost(dealAmt, room.name, ord.roomName);
                if (termEnergy <= cost + 5000) continue;

                const effUnitCost = ord.price + ((cost / Math.max(1, dealAmt)) * ENERGY_VALUE);
                if (effUnitCost < bestEffUnitCost) {
                    bestEffUnitCost = effUnitCost;
                    bestOrder = ord;
                    bestDealAmt = dealAmt;
                }
            }

            if (bestOrder && bestDealAmt > 0) {
                if (Game.market.deal(bestOrder.id, bestDealAmt, room.name) === OK) {
                    return true;
                }
            }
        }
    }
    return false;
}

function runMarket() {
    if (typeof Game === 'undefined' || !Game.market) return;
    if (!getConfig().marketEnabled) return;
    if (Game.time % 25 !== 0) return;
    if (Game.cpu && Game.cpu.bucket !== undefined && Game.cpu.bucket < 1500) return;

    const colonies = (global.heap && global.heap.colonies) || {};
    const seenRooms = {};
    const ownedTerminalRooms = [];
    for (const rName in colonies) {
        const rm = Game.rooms[rName];
        if (rm && rm.controller && rm.controller.my && rm.controller.level >= 6 && rm.terminal) {
            ownedTerminalRooms.push(rm);
            seenRooms[rName] = true;
        }
    }
    for (const rName in Game.rooms) {
        if (seenRooms[rName]) continue;
        const rm = Game.rooms[rName];
        if (rm && rm.controller && rm.controller.my && rm.controller.level >= 6 && rm.terminal) {
            ownedTerminalRooms.push(rm);
        }
    }
    if (!ownedTerminalRooms.length) return;

    const credits = Game.market.credits || 0;
    const ENERGY_VALUE = Math.max(1.5, getMarketHistoryEMA(RESOURCE_ENERGY) || 2);
    const myOrders = Object.values(Game.market.orders || {});

    // 1. Liquidate Surplus Extractor / Terminal Minerals (keep 20k reserve, sell above 25k)
    for (let r = 0; r < ownedTerminalRooms.length; r++) {
        const room = ownedTerminalRooms[r];
        const roomState = global.heap && global.heap.rooms ? global.heap.rooms[room.name] : null;
        if (liquidateRoomSurplus(room, roomState, myOrders, credits, ENERGY_VALUE)) {
            return;
        }
    }

    // 2. Acquire Missing Reaction DAG Base Minerals (< 3,000 empire stock, credits > 50,000, energy > cost + 5,000)
    acquireMissingBaseMinerals(ownedTerminalRooms, credits, ENERGY_VALUE);
}

// --- CREEP MILITARY BOOST LOGISTICS ---

const BOOST_TIERS = {
    TOUGH: ['XGHO2', 'GHO2', 'GO'],
    RANGED_ATTACK: ['XKHO2', 'KHO2', 'KO'],
    ATTACK: ['XUH2O', 'UH2O', 'UH'],
    HEAL: ['XLHO2', 'LHO2', 'LO'],
    MOVE: ['XZHO2', 'ZHO2', 'ZO'],
    WORK: ['XZH2O', 'ZH2O', 'ZH', 'XGH2O', 'GH2O', 'GH']
};

function boostCreepIfEligible(creep) {
    if (!creep || creep.spawning) return true;
    if (creep.heap && creep.heap.boosted) return true;

    const role = (creep.memory && creep.memory.role) || (creep.heap && creep.heap.role);
    const eligibleRoles = ['quad', 'defender', 'raider', 'teamWrecker', 'teamHealer', 'skGuard'];
    if (!eligibleRoles.includes(role)) {
        if (!creep.heap) creep.heap = {};
        creep.heap.boosted = true;
        return true;
    }

    const room = creep.room;
    if (!room || !room.controller || !room.controller.my || room.controller.level < 6) {
        if (!creep.heap) creep.heap = {};
        creep.heap.boosted = true;
        return true;
    }

    const labs = getRoomLabs(room);
    if (!labs || labs.length === 0) {
        if (!creep.heap) creep.heap = {};
        creep.heap.boosted = true;
        return true;
    }

    const cfg = getConfig();
    if (!cfg.boostsEnabled) {
        if (!creep.heap) creep.heap = {};
        creep.heap.boosted = true;
        return true;
    }

    // Tier 2 & Tier 3 Combat Economy Gating:
    const storageEnergy = (room.storage && room.storage.store) ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0;
    if (room.storage && storageEnergy < cfg.siegeTier1Energy) {
        // Attrition / Survival mode: Cut boost costs, deploy raw creeps
        if (!creep.heap) creep.heap = {};
        creep.heap.boosted = true;
        return true;
    }

    const body = creep.body || [];
    const neededCompounds = [];

    for (let i = 0; i < body.length; i++) {
        const part = body[i];
        if (part.boost) continue; // Already boosted
        const candidates = BOOST_TIERS[part.type];
        if (candidates) {
            for (let c = 0; c < candidates.length; c++) {
                if (!neededCompounds.includes(candidates[c])) {
                    neededCompounds.push(candidates[c]);
                }
            }
        }
    }

    if (neededCompounds.length === 0) {
        if (!creep.heap) creep.heap = {};
        creep.heap.boosted = true;
        return true;
    }

    let boostLab = null;
    for (let i = 0; i < labs.length; i++) {
        const lab = labs[i];
        if (lab.mineralType && neededCompounds.includes(lab.mineralType)) {
            if (lab.mineralAmount >= 30 && lab.energy >= 20) {
                boostLab = lab;
                break;
            }
        }
    }

    if (!boostLab) {
        if (!creep.heap) creep.heap = {};
        creep.heap.boosted = true;
        return true;
    }

    if (!global.heap) global.heap = {};
    if (!global.heap.boostReservedLabs) global.heap.boostReservedLabs = {};
    global.heap.boostReservedLabs[boostLab.id] = Game.time + 2;
    boostLab._boostReservedUntil = Game.time + 2;

    const dist = calcDistance(creep.pos, boostLab.pos);
    if (dist <= 1) {
        boostLab.boostCreep(creep);
        return false;
    } else {
        moveCreep(creep, boostLab.pos, 1);
        return false;
    }
}

module.exports = {
    REACTION_TARGETS,
    boostCreepIfEligible,
    evaluateRoomReactionDAG,
    getColonyMineralStock,
    getMarketHistoryEMA,
    getRequiredBasicMinerals,
    getRequiredReactions,
    resolveReactionStep,
    runFactory,
    runLabs,
    runMarket,
    runTerminal
};
