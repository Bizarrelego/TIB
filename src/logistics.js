// src/logistics.js
// Top-Down Virtual Ledger Hauler Matching, Direct Upgrader/Builder Hand-Off & Link Beaming
const { calcDistance, roomCenterPos } = require('./constants');
const { depositNonEnergyLoot, getLootTotal, moveCreep, withdrawOrPickupLoot } = require('./traffic');
const { registerIntent, getEffectiveStore, getEffectiveFreeCapacity, recordEnergyTransfer, safeSuicide } = require('./state');
const { getCensusRequirements } = require('./spawning');
const { getRoomBlueprint } = require('./bunker');

function getLinkEnergy(link) {
    if (!link) return 0;
    if (link.store) return link.store[RESOURCE_ENERGY] || 0;
    return link.energy || 0;
}

function classifyRoomLinks(state, roomName) {
    const links = (state && state.links) || [];
    const sources = (state && state.sources) || [];
    const storage = state ? state.storage : null;
    const controller = state ? state.controller : null;
    const blueprint = getRoomBlueprint(roomName);
    const anchor = blueprint ? blueprint.anchor : null;
    const hubBlueprintLinks = (blueprint && blueprint.links) ? blueprint.links.filter(bl => bl.intent === 'hub') : [];

    const sourceLinks = [];
    const controllerLinks = [];
    let coreLink = null;
    let hubLink = null;

    for (let i = 0; i < links.length; i++) {
        const l = links[i];
        if (!l || !l.pos) continue;
        if (anchor && l.pos.x === anchor.x && l.pos.y === anchor.y) {
            coreLink = l;
            continue;
        }
        const isBpHub = hubBlueprintLinks.some(bl => bl.x === l.pos.x && bl.y === l.pos.y);
        if (isBpHub) {
            hubLink = l;
            continue;
        }
        if (sources.some(s => calcDistance(l.pos, s.pos) <= 2)) {
            sourceLinks.push(l);
            continue;
        }
        if (storage && calcDistance(l.pos, storage.pos) <= 2) {
            hubLink = l;
            continue;
        }
        if (controller && calcDistance(l.pos, controller.pos) <= 3) {
            controllerLinks.push(l);
        }
    }

    return { sourceLinks, controllerLinks, coreLink, hubLink };
}

function runLinks(roomName) {
    const state = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    if (!state || !state.links || state.links.length < 2) return;

    const room = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[roomName] : null;
    const { sourceLinks, controllerLinks, coreLink, hubLink } = classifyRoomLinks(state, roomName);
    const coreNeedsRefill = !!(coreLink && room && room.energyAvailable < room.energyCapacityAvailable && getLinkEnergy(coreLink) < 400);
    const needyCtrlLink = controllerLinks.find(c => getLinkEnergy(c) < 400) || null;

    // 1. Source Links (>= 700 energy): Core Refill -> Controller Feed -> Hub Overflow
    for (let i = 0; i < sourceLinks.length; i++) {
        const sLink = sourceLinks[i];
        if (!sLink || sLink.cooldown > 0) continue;
        const energy = getLinkEnergy(sLink);
        if (energy < 700) continue;

        if (coreNeedsRefill && coreLink.id !== sLink.id) {
            sLink.transferEnergy(coreLink);
        } else if (needyCtrlLink && needyCtrlLink.id !== sLink.id) {
            sLink.transferEnergy(needyCtrlLink);
        } else if (hubLink && hubLink.id !== sLink.id && getLinkEnergy(hubLink) <= 100) {
            sLink.transferEnergy(hubLink);
        }
    }

    // 2. Hub Link Outbound Push (>= 200 energy): push to needy Core or Controller link
    if (hubLink && hubLink.cooldown === 0 && getLinkEnergy(hubLink) >= 200) {
        if (coreNeedsRefill && coreLink.id !== hubLink.id) {
            hubLink.transferEnergy(coreLink);
        } else if (needyCtrlLink && needyCtrlLink.id !== hubLink.id) {
            hubLink.transferEnergy(needyCtrlLink);
        }
    }
}

function initFastFillerBindings(creep, state, room) {
    const heap = creep.heap;
    const staticRoom = global.heap && global.heap.staticRooms ? global.heap.staticRooms[room.name] : null;

    heap.adjLinks = [];
    heap.adjContainers = [];
    heap.adjSpawns = [];
    heap.adjExtensions = [];

    const links = state.links || [];
    for (let i = 0; i < links.length; i++) {
        if (calcDistance(creep.pos, links[i].pos) <= 1) {
            heap.adjLinks.push(links[i].id);
        }
    }

    const containers = state.containers || [];
    for (let i = 0; i < containers.length; i++) {
        if (calcDistance(creep.pos, containers[i].pos) <= 1) {
            heap.adjContainers.push(containers[i].id);
        }
    }

    const spawns = state.spawns || [];
    for (let i = 0; i < spawns.length; i++) {
        if (calcDistance(creep.pos, spawns[i].pos) <= 1) {
            const spIdx = staticRoom && staticRoom.spawnIds ? staticRoom.spawnIds.indexOf(spawns[i].id) : -1;
            heap.adjSpawns.push({ id: spawns[i].id, idx: spIdx });
        }
    }

    const extensions = state.extensions || [];
    for (let i = 0; i < extensions.length; i++) {
        if (calcDistance(creep.pos, extensions[i].pos) <= 1) {
            const extIdx = staticRoom && staticRoom.extensionIds ? staticRoom.extensionIds.indexOf(extensions[i].id) : -1;
            heap.adjExtensions.push({ id: extensions[i].id, idx: extIdx });
        }
    }

    heap.boundLinkCount = links.length;
    heap.boundContCount = containers.length;
    heap.bindingsInit = true;
}

function runFastFiller(creep, state, room) {
    if (creep.spawning || creep.fatigue > 0) return;
    if (!creep.heap) creep.heap = {};
    if (creep.heap.sleepUntil && Game.time < creep.heap.sleepUntil) return;

    room = (typeof room === 'string' && typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[room] : (room || creep.room);
    if (!room) return;
    state = state || (global.heap && global.heap.rooms ? global.heap.rooms[room.name] : {});

    const blueprint = getRoomBlueprint(room.name);
    if (!blueprint || !blueprint.anchor) return;

    const ax = blueprint.anchor.x;
    const ay = blueprint.anchor.y;

    // The 4 designated 5x5 stamp coordinates around the anchor
    const SLOTS = [
        { x: ax - 1, y: ay - 1, idx: 0 },
        { x: ax + 1, y: ay - 1, idx: 1 },
        { x: ax - 1, y: ay + 1, idx: 2 },
        { x: ax + 1, y: ay + 1, idx: 3 }
    ];

    // Check if current (x, y) matches one of the 4 coordinates
    let matchedSlot = -1;
    for (let s = 0; s < 4; s++) {
        if (creep.pos.x === SLOTS[s].x && creep.pos.y === SLOTS[s].y) {
            matchedSlot = s;
            break;
        }
    }

    let slotIndex;
    if (matchedSlot !== -1) {
        // MATCH: Creep is firmly locked into its workstation
        slotIndex = matchedSlot;
        creep.heap.inPosition = true;
        creep.heap.locked = true;
        creep.heap.slotIndex = matchedSlot;
        if (creep.memory) creep.memory.slotIndex = matchedSlot;
    } else {
        // NO MATCH: Creep is in transit
        creep.heap.inPosition = false;
        creep.heap.locked = false;

        // Find all other living fast-fillers in this colony
        const col = global.heap && global.heap.colonies ? global.heap.colonies[room.name] : null;
        const fillers = (col && col.creepsByRole && col.creepsByRole.fastFiller && col.creepsByRole.fastFiller.length > 0)
            ? col.creepsByRole.fastFiller
            : ((state && state.creepsByRole && state.creepsByRole.fastFiller) || []);

        const occupied = [false, false, false, false];
        const physicallyOccupied = [false, false, false, false];

        for (let f = 0; f < fillers.length; f++) {
            const other = fillers[f];
            if (!other || other.id === creep.id) continue;
            // Physical occupancy
            for (let s = 0; s < 4; s++) {
                if (other.pos.x === SLOTS[s].x && other.pos.y === SLOTS[s].y) {
                    physicallyOccupied[s] = true;
                    occupied[s] = true;
                    break;
                }
            }
            // En-route claim
            if (other.heap && other.heap.targetSlotIndex !== undefined && other.heap.targetSlotIndex >= 0 && other.heap.targetSlotIndex < 4) {
                occupied[other.heap.targetSlotIndex] = true;
            } else if (other.memory && other.memory.slotIndex !== undefined && other.memory.slotIndex >= 0 && other.memory.slotIndex < 4) {
                occupied[other.memory.slotIndex] = true;
            }
        }

        // If all 4 slots are marked occupied (e.g. stale claims), fall back to physically occupied only
        let allOccupied = true;
        for (let s = 0; s < 4; s++) {
            if (!occupied[s]) {
                allOccupied = false;
                break;
            }
        }
        const slotMask = allOccupied ? physicallyOccupied : occupied;

        // Find the nearest empty valid slot
        let bestSlot = null;
        let bestDist = Infinity;
        const prefs = [0, 3, 1, 2];

        for (let p = 0; p < prefs.length; p++) {
            const s = prefs[p];
            if (slotMask[s]) continue;
            const dist = calcDistance(creep.pos, SLOTS[s]);
            if (dist < bestDist) {
                bestDist = dist;
                bestSlot = SLOTS[s];
            }
        }

        // Fallback if somehow all slots are physically occupied
        if (!bestSlot) {
            let minPhysDist = Infinity;
            for (let p = 0; p < prefs.length; p++) {
                const s = prefs[p];
                const dist = calcDistance(creep.pos, SLOTS[s]);
                if (dist < minPhysDist) {
                    minPhysDist = dist;
                    bestSlot = SLOTS[s];
                }
            }
        }

        if (bestSlot) {
            creep.heap.targetSlotIndex = bestSlot.idx;
            if (creep.memory) creep.memory.slotIndex = bestSlot.idx;
            moveCreep(creep, new RoomPosition(bestSlot.x, bestSlot.y, room.name), 0);
        }

        // CRUCIAL BYPASS: Even if inPosition === false, if creep has energy and is adjacent to an empty spawn/extension, execute transfer() while moving!
        const carried = creep.store ? creep.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
        if (carried > 0) {
            const spawns = (state && state.spawns) || (room.find ? room.find(FIND_MY_SPAWNS) : []);
            let transferred = false;
            for (let s = 0; s < spawns.length; s++) {
                const sp = spawns[s];
                if (calcDistance(creep.pos, sp.pos) <= 1 && sp.store && sp.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    const toTransfer = Math.min(carried, sp.store.getFreeCapacity(RESOURCE_ENERGY));
                    creep.transfer(sp, RESOURCE_ENERGY);
                    recordEnergyTransfer(room.name, sp.id, toTransfer);
                    transferred = true;
                    break;
                }
            }
            if (!transferred) {
                const extensions = (state && state.extensions) || (room.find ? room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION }) : []);
                for (let e = 0; e < extensions.length; e++) {
                    const ext = extensions[e];
                    if (calcDistance(creep.pos, ext.pos) <= 1 && ext.store && ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        const toTransfer = Math.min(carried, ext.store.getFreeCapacity(RESOURCE_ENERGY));
                        creep.transfer(ext, RESOURCE_ENERGY);
                        recordEnergyTransfer(room.name, ext.id, toTransfer);
                        break;
                    }
                }
            }
        }

        return; // Do not run stationary station logic while in transit
    }

    // Station Handover: If this fast-filler has TTL < 35 and replacement has arrived within range 1
    if (creep.ticksToLive < 35) {
        const col = global.heap && global.heap.colonies ? global.heap.colonies[room.name] : null;
        const fillers = (col && col.creepsByRole && col.creepsByRole.fastFiller && col.creepsByRole.fastFiller.length > 0)
            ? col.creepsByRole.fastFiller
            : ((state.creepsByRole && state.creepsByRole.fastFiller) || []);
        const replacement = fillers.find(other => other.id !== creep.id && other.memory && other.memory.slotIndex === slotIndex && calcDistance(other.pos, creep.pos) <= 1);
        if (replacement) {
            const carried = creep.store ? creep.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
            if (carried > 0 && creep.heap && creep.heap.adjContainers && creep.heap.adjContainers.length > 0) {
                const adjCont = Game.getObjectById(creep.heap.adjContainers[0]);
                if (adjCont && adjCont.store && adjCont.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    creep.transfer(adjCont, RESOURCE_ENERGY);
                }
            }
            safeSuicide(creep, 'slot_handover');
            return;
        }
    }

    // Static adjacency binding on arrival (O(1) lookups thereafter, refreshed every 25t or upon link/container additions)
    if (!creep.heap.bindingsInit || (Game.time % 25 === 0) || (state.links && state.links.length !== creep.heap.boundLinkCount) || (state.containers && state.containers.length !== creep.heap.boundContCount)) {
        initFastFillerBindings(creep, state, room);
    }

    const rHeap = global.heap && global.heap.rooms ? global.heap.rooms[room.name] : null;
    const extEnergy = rHeap ? rHeap.extensionEnergy : null;

    const carried = creep.store ? creep.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
    const freeCap = creep.store ? creep.store.getFreeCapacity(RESOURCE_ENERGY) : 0;

    // Scan adjacent spawns for energy deficit
    let needySpawn = null;
    for (let s = 0; s < creep.heap.adjSpawns.length; s++) {
        const spEntry = creep.heap.adjSpawns[s];
        const spObj = Game.getObjectById(spEntry.id);
        if (spObj && spObj.store && spObj.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            needySpawn = spObj;
            break;
        }
    }

    // Scan adjacent extensions for energy deficit
    let needyExtension = null;
    if (!needySpawn) {
        const rcl = room.controller ? room.controller.level : 1;
        const extCap = rcl >= 8 ? 200 : (rcl >= 7 ? 100 : 50);
        for (let e = 0; e < creep.heap.adjExtensions.length; e++) {
            const extEntry = creep.heap.adjExtensions[e];
            const currentEnergy = (extEnergy && extEntry.idx !== -1) ? extEnergy[extEntry.idx] : 200;
            if (currentEnergy < extCap) {
                const extObj = Game.getObjectById(extEntry.id);
                if (extObj && extObj.store && extObj.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    needyExtension = extObj;
                    break;
                }
            }
        }
    }

    const needsFilling = !!(needySpawn || needyExtension);

    // Look for adjacent Link with energy
    let linkWithEnergy = null;
    for (let l = 0; l < creep.heap.adjLinks.length; l++) {
        const linkObj = Game.getObjectById(creep.heap.adjLinks[l]);
        if (linkObj && linkObj.store && linkObj.store[RESOURCE_ENERGY] > 0) {
            linkWithEnergy = linkObj;
            break;
        }
    }

    // Look for adjacent Container with energy and/or free capacity
    let contWithEnergy = null;
    let contWithFreeSpace = null;
    for (let c = 0; c < creep.heap.adjContainers.length; c++) {
        const contObj = Game.getObjectById(creep.heap.adjContainers[c]);
        if (contObj && contObj.store) {
            if (!contWithEnergy && contObj.store[RESOURCE_ENERGY] > 0) {
                contWithEnergy = contObj;
            }
            if (!contWithFreeSpace && contObj.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                contWithFreeSpace = contObj;
            }
        }
    }

    // Ground dropped energy (pickup immediately if under/adjacent to creep)
    const drops = state.droppedEnergy || [];
    for (let d = 0; d < drops.length; d++) {
        if (drops[d].amount > 0 && calcDistance(creep.pos, drops[d].pos) <= 1 && freeCap > 0) {
            creep.pickup(drops[d]);
            return;
        }
    }

    // --- STEP 1: FILL ADJACENT SPAWNS & EXTENSIONS ---
    if (carried > 0 && needsFilling) {
        if (needySpawn) {
            const toTransfer = Math.min(carried, needySpawn.store.getFreeCapacity(RESOURCE_ENERGY));
            creep.transfer(needySpawn, RESOURCE_ENERGY);
            recordEnergyTransfer(room.name, needySpawn.id, toTransfer);
            return;
        }
        if (needyExtension) {
            const toTransfer = Math.min(carried, needyExtension.store.getFreeCapacity(RESOURCE_ENERGY));
            creep.transfer(needyExtension, RESOURCE_ENERGY);
            recordEnergyTransfer(room.name, needyExtension.id, toTransfer);
            return;
        }
    }

    // --- STEP 2: BUFFER EXTRA LINK ENERGY INTO CONTAINERS ---
    // If all extensions/spawns are full, but we have energy pulled from link (or link has extra energy), store surplus in container
    if (carried > 0 && !needsFilling && contWithFreeSpace && creep.heap.pulledFromLink) {
        creep.transfer(contWithFreeSpace, RESOURCE_ENERGY);
        creep.heap.pulledFromLink = false;
        return;
    }

    // --- STEP 3: RECHARGE INTENTS ---
    // Primary: Pull from Link!
    if (linkWithEnergy && freeCap > 0) {
        // Pull if extensions need filling OR if container has space to buffer surplus link energy
        if (needsFilling || contWithFreeSpace) {
            creep.withdraw(linkWithEnergy, RESOURCE_ENERGY);
            creep.heap.pulledFromLink = true;
            return;
        }
    }

    // Secondary: Pull from Container (ONLY if extensions/spawns actually need filling!)
    if (carried < 50 && needsFilling && !linkWithEnergy && contWithEnergy) {
        creep.withdraw(contWithEnergy, RESOURCE_ENERGY);
        creep.heap.pulledFromLink = false;
        return;
    }

    // --- STEP 4: IDLE / SLEEP ---
    // If containers and links are full, or nothing needs energy, sit full of energy and sleep until needed!
    if (!needsFilling) {
        creep.heap.sleepUntil = Game.time + 3;
    }
}

function moveToLabViaHallway(creep, state, targetLab) {
    if (!creep || !targetLab || !targetLab.pos) return;
    const dist = calcDistance(creep.pos, targetLab.pos);
    if (dist <= 1) return;

    const hallways = (state && Array.isArray(state.labHallway)) ? state.labHallway : [];
    let bestHall = null;
    let bestHallDist = Infinity;

    for (let i = 0; i < hallways.length; i++) {
        const h = hallways[i];
        if (!h) continue;
        if (calcDistance(h, targetLab.pos) <= 1) {
            const d = calcDistance(creep.pos, h);
            if (d < bestHallDist) {
                bestHallDist = d;
                bestHall = h;
            }
        }
    }

    if (bestHall && (creep.pos.x !== bestHall.x || creep.pos.y !== bestHall.y)) {
        const rName = (creep.room && creep.room.name) || bestHall.roomName;
        moveCreep(creep, new RoomPosition(bestHall.x, bestHall.y, rName), 0);
        return;
    }
    moveCreep(creep, targetLab.pos, 1);
}

function getLabPartitionForLogistics(state) {
    if (state && Array.isArray(state.supplierLabs) && Array.isArray(state.reactorLabs) &&
        state.supplierLabs.length === 2 && state.reactorLabs.length >= 1) {
        return { supplierLabs: state.supplierLabs, reactorLabs: state.reactorLabs };
    }
    const labs = (state && state.labs) || [];
    if (labs.length >= 3) {
        return { supplierLabs: [labs[0], labs[1]], reactorLabs: labs.slice(2) };
    }
    return { supplierLabs: labs.slice(0, 2), reactorLabs: [] };
}

function hasPendingLabTask(state, terminal, storage) {
    if (!state) return false;
    const partition = getLabPartitionForLogistics(state);
    const supA = partition.supplierLabs[0] || null;
    const supB = partition.supplierLabs[1] || null;
    const reactorLabs = partition.reactorLabs || [];
    const active = state.activeReaction || null;

    if (supA && (supA.mineralAmount || 0) > 0 && (!active || supA.mineralType !== active.input1)) return true;
    if (supB && (supB.mineralAmount || 0) > 0 && (!active || supB.mineralType !== active.input2)) return true;
    const harvestMin = active ? 500 : 1;
    for (let i = 0; i < reactorLabs.length; i++) {
        const rx = reactorLabs[i];
        if (!rx || (rx.mineralAmount || 0) <= 0) continue;
        if (!active || rx.mineralType !== active.compound || rx.mineralAmount >= harvestMin) return true;
    }
    if (active && supA && supB) {
        if ((supA.mineralAmount || 0) < 2000 && findMineralSupply(terminal, storage, active.input1, 1)) return true;
        if ((supB.mineralAmount || 0) < 2000 && findMineralSupply(terminal, storage, active.input2, 1)) return true;
    }
    const minCont = state.mineralContainer;
    if (minCont && minCont.store) {
        const thresh = (state.mineral && state.mineral.mineralAmount > 0) ? 400 : 1;
        for (const k in minCont.store) {
            if (k !== RESOURCE_ENERGY && (minCont.store[k] || 0) >= thresh) return true;
        }
    }
    return false;
}

function distributorNeedsEnergyWork(room, state, coreContainers, towers, storage, terminal, fastFillersList, hasHomeHaulers) {
    if (fastFillersList.length === 0 && room.energyAvailable < room.energyCapacityAvailable) return true;
    for (let i = 0; i < coreContainers.length; i++) {
        if (coreContainers[i].store && (coreContainers[i].store[RESOURCE_ENERGY] || 0) < 1000) return true;
    }
    const towerTarget = (state.hostiles && state.hostiles.length > 0) ? 700 : 500;
    for (let t = 0; t < towers.length; t++) {
        if (towers[t].store && (towers[t].store[RESOURCE_ENERGY] || 0) < towerTarget) return true;
    }
    const extMask = state.extDirtyMask;
    if (extMask && (extMask[0] !== 0 || extMask[1] !== 0)) return true;
    if (!hasHomeHaulers && state.controllerContainer && state.controllerContainer.store &&
        (state.controllerContainer.store[RESOURCE_ENERGY] || 0) < 600) return true;

    const storageEnergy = (storage && storage.store) ? (storage.store[RESOURCE_ENERGY] || 0) : 0;
    const termEnergyTarget = storageEnergy >= 60000 ? 25000 : 15000;
    if (terminal && terminal.store && storageEnergy >= 20000 &&
        (terminal.store[RESOURCE_ENERGY] || 0) < termEnergyTarget &&
        terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 0) return true;

    const roomLabs = state.labs || [];
    if (storageEnergy >= 20000) {
        for (let l = 0; l < roomLabs.length; l++) {
            const lab = roomLabs[l];
            if (lab && lab.store && (lab.store[RESOURCE_ENERGY] || 0) < 1000 &&
                lab.store.getFreeCapacity(RESOURCE_ENERGY) >= 200) return true;
        }
    }
    const powerSpawn = (state.powerSpawns && state.powerSpawns.length > 0) ? state.powerSpawns[0] : null;
    if (powerSpawn && powerSpawn.store && powerSpawn.store[RESOURCE_ENERGY] < 4500) return true;
    if (state.factory && state.factory.store && state.factory.store[RESOURCE_ENERGY] < 2000) return true;
    if (storageEnergy >= 100000 && state.nuker && state.nuker.store &&
        state.nuker.store.getFreeCapacity(RESOURCE_ENERGY) >= 5000) return true;

    const { controllerLinks, coreLink, hubLink } = classifyRoomLinks(state, room.name);
    const coreNeedsRefill = !!(coreLink && room.energyAvailable < room.energyCapacityAvailable && getLinkEnergy(coreLink) < 400);
    const ctrlNeedsRefill = controllerLinks.some(c => getLinkEnergy(c) < 400);
    if (hubLink && (coreNeedsRefill || ctrlNeedsRefill) && getLinkEnergy(hubLink) < 400 && storageEnergy >= 1000) return true;

    return false;
}

function findMineralSupply(terminal, storage, mineralType, minNeeded) {
    const threshold = minNeeded || 1;
    if (terminal && terminal.store && (terminal.store[mineralType] || 0) >= threshold) return terminal;
    if (storage && storage.store && (storage.store[mineralType] || 0) >= threshold) return storage;
    return null;
}

function runLabLogistics(creep, state, room) {
    if (!creep || !state || !creep.store) return false;

    const terminal = state.terminal || (room && room.terminal) || null;
    const storage = state.storage || (room && room.storage) || null;
    const partition = getLabPartitionForLogistics(state);
    const supA = partition.supplierLabs[0] || null;
    const supB = partition.supplierLabs[1] || null;
    const reactorLabs = partition.reactorLabs || [];
    const active = state.activeReaction || null;

    const totalCarried = creep.store.getUsedCapacity();
    const energyCarried = creep.store.getUsedCapacity(RESOURCE_ENERGY);
    const freeCap = creep.store.getFreeCapacity();

    // 1. Deliver or Deposit Carried Non-Energy Mineral
    if (totalCarried > energyCarried) {
        let carriedMin = null;
        for (const resKey in creep.store) {
            if (resKey !== RESOURCE_ENERGY && (creep.store[resKey] || 0) > 0) {
                carriedMin = resKey;
                break;
            }
        }
        if (!carriedMin) return false;

        if (active && supA && supB) {
            if (carriedMin === active.input1 &&
                (!supA.mineralType || supA.mineralType === active.input1) &&
                (supA.mineralAmount || 0) < 2000) {
                if (calcDistance(creep.pos, supA.pos) <= 1) {
                    const maxAccept = Math.min(creep.store[carriedMin] || 0, 2000 - (supA.mineralAmount || 0));
                    if (maxAccept > 0) creep.transfer(supA, carriedMin, maxAccept);
                } else {
                    moveToLabViaHallway(creep, state, supA);
                }
                return true;
            }
            if (carriedMin === active.input2 &&
                (!supB.mineralType || supB.mineralType === active.input2) &&
                (supB.mineralAmount || 0) < 2000) {
                if (calcDistance(creep.pos, supB.pos) <= 1) {
                    const maxAccept = Math.min(creep.store[carriedMin] || 0, 2000 - (supB.mineralAmount || 0));
                    if (maxAccept > 0) creep.transfer(supB, carriedMin, maxAccept);
                } else {
                    moveToLabViaHallway(creep, state, supB);
                }
                return true;
            }
        }

        // Feed Nuker if carrying excess Ghodium not slated for storage dumping
        if (carriedMin === RESOURCE_GHODIUM && state.nuker && state.nuker.store &&
            state.nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0 &&
            (!active || (active.input1 !== RESOURCE_GHODIUM && active.input2 !== RESOURCE_GHODIUM))) {
            if (calcDistance(creep.pos, state.nuker.pos) <= 1) creep.transfer(state.nuker, RESOURCE_GHODIUM);
            else moveCreep(creep, state.nuker.pos, 1);
            return true;
        }

        const termAmt = (terminal && terminal.store) ? (terminal.store[carriedMin] || 0) : 0;
        const dest = (terminal && termAmt <= 45000 && terminal.store.getFreeCapacity() > 0) ? terminal : storage;
        if (dest) {
            if (calcDistance(creep.pos, dest.pos) <= 1) creep.transfer(dest, carriedMin);
            else moveCreep(creep, dest.pos, 1);
            return true;
        }
        return false;
    }

    // Only pull new mineral loads when creep hold is completely clear
    if (totalCarried > 0 || freeCap <= 0) return false;

    const boostMap = global.heap && global.heap.boostReservedLabs ? global.heap.boostReservedLabs : null;

    // 2. Flush any mismatched minerals from Suppliers or Reactors back to Terminal/Storage
    if (supA && (supA.mineralAmount || 0) > 0 && (!active || (supA.mineralType && supA.mineralType !== active.input1))) {
        if (calcDistance(creep.pos, supA.pos) <= 1) creep.withdraw(supA, supA.mineralType);
        else moveToLabViaHallway(creep, state, supA);
        return true;
    }
    if (supB && (supB.mineralAmount || 0) > 0 && (!active || (supB.mineralType && supB.mineralType !== active.input2))) {
        if (calcDistance(creep.pos, supB.pos) <= 1) creep.withdraw(supB, supB.mineralType);
        else moveToLabViaHallway(creep, state, supB);
        return true;
    }
    for (let i = 0; i < reactorLabs.length; i++) {
        const rx = reactorLabs[i];
        if (!rx || (rx.mineralAmount || 0) <= 0) continue;
        if ((rx._boostReservedUntil && rx._boostReservedUntil > Game.time) ||
            (boostMap && boostMap[rx.id] && boostMap[rx.id] > Game.time)) continue;
        if (!active || (rx.mineralType && rx.mineralType !== active.compound)) {
            if (calcDistance(creep.pos, rx.pos) <= 1) creep.withdraw(rx, rx.mineralType);
            else moveToLabViaHallway(creep, state, rx);
            return true;
        }
    }

    // 3. Harvest finished reaction product from reactorLabs (>= 500 units, or > 0 when idle)
    const harvestMin = active ? 500 : 1;
    for (let i = 0; i < reactorLabs.length; i++) {
        const rx = reactorLabs[i];
        if (!rx || (rx.mineralAmount || 0) < harvestMin) continue;
        if ((rx._boostReservedUntil && rx._boostReservedUntil > Game.time) ||
            (boostMap && boostMap[rx.id] && boostMap[rx.id] > Game.time)) continue;
        if (rx.mineralType) {
            if (calcDistance(creep.pos, rx.pos) <= 1) creep.withdraw(rx, rx.mineralType);
            else moveToLabViaHallway(creep, state, rx);
            return true;
        }
    }

    // 4. Load supplierA (input1) and supplierB (input2) up to 2,000 units each
    if (active && supA && supB) {
        const curA = (supA.mineralType === active.input1) ? (supA.mineralAmount || 0) : 0;
        const deficitA = 2000 - curA;
        if (deficitA > 0 && (!supA.mineralType || supA.mineralType === active.input1)) {
            const supSrcA = findMineralSupply(terminal, storage, active.input1, 1);
            if (supSrcA) {
                const availA = supSrcA.store[active.input1] || 0;
                const minChunk = curA === 0 ? 1 : Math.min(freeCap, 250);
                if (deficitA >= minChunk || availA <= deficitA) {
                    const pullAmt = Math.min(freeCap, deficitA, availA);
                    if (pullAmt > 0) {
                        if (calcDistance(creep.pos, supSrcA.pos) <= 1) creep.withdraw(supSrcA, active.input1, pullAmt);
                        else moveCreep(creep, supSrcA.pos, 1);
                        return true;
                    }
                }
            }
        }

        const curB = (supB.mineralType === active.input2) ? (supB.mineralAmount || 0) : 0;
        const deficitB = 2000 - curB;
        if (deficitB > 0 && (!supB.mineralType || supB.mineralType === active.input2)) {
            const supSrcB = findMineralSupply(terminal, storage, active.input2, 1);
            if (supSrcB) {
                const availB = supSrcB.store[active.input2] || 0;
                const minChunk = curB === 0 ? 1 : Math.min(freeCap, 250);
                if (deficitB >= minChunk || availB <= deficitB) {
                    const pullAmt = Math.min(freeCap, deficitB, availB);
                    if (pullAmt > 0) {
                        if (calcDistance(creep.pos, supSrcB.pos) <= 1) creep.withdraw(supSrcB, active.input2, pullAmt);
                        else moveCreep(creep, supSrcB.pos, 1);
                        return true;
                    }
                }
            }
        }
    }

    // 5. Haul extracted native mineral from Mineral Container into Terminal/Storage
    const minCont = state.mineralContainer;
    if (minCont && minCont.store) {
        const minEmptyThreshold = (state.mineral && state.mineral.mineralAmount > 0) ? 400 : 1;
        for (const resKey in minCont.store) {
            if (resKey === RESOURCE_ENERGY) continue;
            if ((minCont.store[resKey] || 0) >= minEmptyThreshold) {
                if (calcDistance(creep.pos, minCont.pos) <= 1) creep.withdraw(minCont, resKey);
                else moveCreep(creep, minCont.pos, 1);
                return true;
            }
        }
    }

    return false;
}

function runDistributor(creep, state, room) {
    if (creep.spawning || creep.fatigue > 0) return;
    if (!creep.heap) creep.heap = {};

    // Traffic Decongestion: If a healthy non-dying distributor already owns the role, park and sleep (never kill newborn replacements)
    const col = global.heap && global.heap.colonies ? global.heap.colonies[room.name] : null;
    const distributors = (col && col.creepsByRole && col.creepsByRole.distributor && col.creepsByRole.distributor.length > 0)
        ? col.creepsByRole.distributor
        : ((state.creepsByRole && state.creepsByRole.distributor) || []);

    const healthyDistributors = distributors.filter(d => !d.spawning && (d.ticksToLive === undefined || d.ticksToLive >= 60));
    if (healthyDistributors.length > 1) {
        const myHealthyIndex = healthyDistributors.findIndex(d => d.id === creep.id);
        if (myHealthyIndex > 0) {
            creep.heap.actionIntent = 'idle';
            creep.heap.sleepUntil = Game.time + 25;
            return;
        }
    }

    const storage = state.storage;
    // If the room has NO storage structure at all and RCL < 4, sleep instead of blind suicide (only retire if < 50 TTL & empty)
    if (!storage && (room.controller && room.controller.level < 4)) {
        const held = creep.store ? creep.store.getUsedCapacity() : 0;
        if (held === 0 && creep.ticksToLive !== undefined && creep.ticksToLive < 50) {
            safeSuicide(creep, 'no_storage_low_ttl');
            return;
        }
        creep.heap.actionIntent = 'idle';
        creep.heap.sleepUntil = Game.time + 25;
        return;
    }

    if (creep.heap.sleepUntil && Game.time < creep.heap.sleepUntil) return;

    const totalCarried = creep.store ? creep.store.getUsedCapacity() : 0;
    const carried = creep.store ? creep.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
    const freeCap = creep.store ? creep.store.getFreeCapacity(RESOURCE_ENERGY) : 0;

    // Drain or deliver any non-energy mineral in distributor hold before running energy loop
    const terminal = state.terminal;
    if (totalCarried > carried && creep.store) {
        let carriedMin = null;
        for (const resKey in creep.store) {
            if (resKey !== RESOURCE_ENERGY && (creep.store[resKey] || 0) > 0) { carriedMin = resKey; break; }
        }
        if (carriedMin) {
            const powerSpawn = (state.powerSpawns && state.powerSpawns.length > 0) ? state.powerSpawns[0] : null;
            if (carriedMin === RESOURCE_POWER && powerSpawn && powerSpawn.store && powerSpawn.store[RESOURCE_POWER] < 100) {
                if (calcDistance(creep.pos, powerSpawn.pos) <= 1) creep.transfer(powerSpawn, RESOURCE_POWER);
                else moveCreep(creep, powerSpawn.pos, 1);
                return;
            }
            if (runLabLogistics(creep, state, room)) return;
        }
    }

    if (carried === 0) {
        creep.heap.working = false;
        creep.heap.drainingCoreOverflow = false;
        creep.heap.drainingHubLink = false;
        creep.heap.loadingHubLink = false;
    } else if (freeCap === 0) {
        creep.heap.working = true;
    } else if (creep.heap.working === undefined) {
        creep.heap.working = carried > freeCap;
    }

    const towers = state.towers || [];
    const containers = state.containers || [];
    const blueprint = getRoomBlueprint(room.name);
    const anchor = blueprint ? blueprint.anchor : null;
    const { controllerLinks, coreLink, hubLink } = classifyRoomLinks(state, room.name);
    const coreNeedsLinkRefill = !!(coreLink && room.energyAvailable < room.energyCapacityAvailable && getLinkEnergy(coreLink) < 400);
    const ctrlNeedsLinkRefill = controllerLinks.some(c => getLinkEnergy(c) < 400);
    const hubPushPending = !!(hubLink && (coreNeedsLinkRefill || ctrlNeedsLinkRefill));

    // Core containers at anchor (-2, 0) and (+2, 0)
    const coreContainers = anchor ? containers.filter(c => Math.abs(c.pos.y - anchor.y) <= 1 && (Math.abs(c.pos.x - (anchor.x - 2)) <= 1 || Math.abs(c.pos.x - (anchor.x + 2)) <= 1)) : [];

    const coreNeedsEnergy = (room.energyAvailable < room.energyCapacityAvailable) ||
        coreContainers.some(c => (c.store && (c.store[RESOURCE_ENERGY] || 0) < 1200));
    const minStorageReserve = coreNeedsEnergy ? 50 : 1000;

    const fastFillersList = (col && col.creepsByRole && col.creepsByRole.fastFiller && col.creepsByRole.fastFiller.length > 0)
        ? col.creepsByRole.fastFiller
        : ((state.creepsByRole && state.creepsByRole.fastFiller) || []);
    const hasHomeHaulers = !!(state.creepsByRole && state.creepsByRole.hauler && state.creepsByRole.hauler.length > 0);

    if (!creep.heap.working) {
        // Prioritize lab mineral flushing/loading and mineral container drainage when core is not starving
        if (totalCarried === 0 && !coreNeedsEnergy) {
            if (runLabLogistics(creep, state, room)) return;
        }

        // Hub Link Drain -> Storage (immediately empty hubLink whenever no outbound push is pending)
        if (totalCarried === 0 && hubLink && getLinkEnergy(hubLink) > 0 && !hubPushPending &&
            storage && storage.store && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            creep.heap.drainingHubLink = true;
            if (calcDistance(creep.pos, hubLink.pos) <= 1) {
                creep.withdraw(hubLink, RESOURCE_ENERGY);
                creep.heap.working = true;
            } else {
                moveCreep(creep, hubLink.pos, 1);
            }
            return;
        }

        // Hub Link Push <- Storage (load hubLink when coreLink or controllerLink needs energy)
        if (totalCarried === 0 && hubPushPending && getLinkEnergy(hubLink) < 400 &&
            storage && storage.store && (storage.store[RESOURCE_ENERGY] || 0) >= 1000) {
            creep.heap.loadingHubLink = true;
            if (calcDistance(creep.pos, storage.pos) <= 1) {
                creep.withdraw(storage, RESOURCE_ENERGY);
                creep.heap.working = true;
            } else {
                moveCreep(creep, storage.pos, 1);
            }
            return;
        }

        // Only withdraw energy if an energy consumer actually needs filling; otherwise sleep empty ready for lab work
        const wantsEnergy = distributorNeedsEnergyWork(room, state, coreContainers, towers, storage, terminal, fastFillersList, hasHomeHaulers);
        // Multi-Tier Energy & Catalyst Scavenging:
        let supply = null;
        let scavengeRes = RESOURCE_ENERGY;

        // 0. Check if PowerSpawn needs power and we have power in terminal or storage
        const powerSpawn = (state.powerSpawns && state.powerSpawns.length > 0) ? state.powerSpawns[0] : null;
        if (powerSpawn && powerSpawn.store && powerSpawn.store[RESOURCE_POWER] < 100) {
            if (terminal && terminal.store && (terminal.store[RESOURCE_POWER] || 0) > 0) {
                supply = terminal;
                scavengeRes = RESOURCE_POWER;
            } else if (storage && storage.store && (storage.store[RESOURCE_POWER] || 0) > 0) {
                supply = storage;
                scavengeRes = RESOURCE_POWER;
            }
        }

        // 0b. Check if Nuker needs ghodium and we have ghodium in terminal or storage
        if (!supply && state.nuker && state.nuker.store && state.nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0) {
            if (terminal && terminal.store && (terminal.store[RESOURCE_GHODIUM] || 0) > 0) {
                supply = terminal;
                scavengeRes = RESOURCE_GHODIUM;
            } else if (storage && storage.store && (storage.store[RESOURCE_GHODIUM] || 0) > 0) {
                supply = storage;
                scavengeRes = RESOURCE_GHODIUM;
            }
        }

        // 1. Overflowing Core Containers (drain >= 1600, or >= 1000 when !hubLink & extensions full)
        // 2. Storage (if >= minStorageReserve and wantsEnergy)
        // 3. Terminal (if >= 2000 and wantsEnergy)
        // 4. Core Containers (if >= 1500 via Link overflow)
        // 5. Source Containers (if >= 1200, or >= 50 if core starving)
        // 6. Dropped Energy / Tombstones / Ruins (if core starving)
        if (!supply && (wantsEnergy || coreNeedsEnergy || (!hubLink && room.energyAvailable === room.energyCapacityAvailable))) {
            const emergencyNoHub = !hubLink && room.energyAvailable === room.energyCapacityAvailable;
            const overflowThresh = emergencyNoHub ? 1000 : 1600;
            const overflowCoreCont = ((!coreNeedsEnergy || emergencyNoHub) && storage && storage.store && storage.store.getFreeCapacity(RESOURCE_ENERGY) >= 1000)
                ? coreContainers.find(c => c.store && (c.store[RESOURCE_ENERGY] || 0) >= overflowThresh)
                : null;
            if (overflowCoreCont) {
                supply = overflowCoreCont;
                creep.heap.drainingCoreOverflow = true;
            } else {
                creep.heap.drainingCoreOverflow = false;
                if (storage && storage.store && storage.store[RESOURCE_ENERGY] >= minStorageReserve) {
                    supply = storage;
                } else if (terminal && terminal.store && terminal.store[RESOURCE_ENERGY] >= 2000) {
                    supply = terminal;
                } else {
                    const highCoreCont = coreContainers.find(c => c.store && c.store[RESOURCE_ENERGY] >= 1500);
                    if (highCoreCont) {
                        supply = highCoreCont;
                    } else {
                        const minContainerEnergy = coreNeedsEnergy ? 50 : 1200;
                        supply = containers.find(c => (!anchor || calcDistance(c.pos, anchor) > 3) && c.store && c.store[RESOURCE_ENERGY] >= minContainerEnergy);

                        if (!supply && coreNeedsEnergy) {
                            const dropped = (state.droppedEnergy || []).find(d => d.amount >= 50);
                            if (dropped) {
                                supply = dropped;
                            } else {
                                const ruin = (state.tombstones || []).concat(state.ruins || []).find(r => r.store && r.store[RESOURCE_ENERGY] >= 50);
                                if (ruin) supply = ruin;
                            }
                        }
                    }
                }
            }
        }

        if (supply && supply.pos) {
            if (calcDistance(creep.pos, supply.pos) <= 1) {
                if (supply.amount !== undefined) {
                    creep.pickup(supply);
                } else {
                    creep.withdraw(supply, scavengeRes);
                }
            } else {
                moveCreep(creep, supply.pos, 1);
            }
            return;
        }

        // Fallback check on lab tasks if core was starving or storage <-> terminal deadband rebalance needed
        if (totalCarried === 0 && runLabLogistics(creep, state, room)) return;
        creep.heap.actionIntent = 'idle';
        creep.heap.sleepUntil = Game.time + 6;
        return;
    }

    // Delivery Priorities:
    // 0a. Complete Hub Link Drain -> Storage or Push -> Hub Link
    if (creep.heap.drainingHubLink && storage && storage.store && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        if (calcDistance(creep.pos, storage.pos) <= 1) {
            creep.transfer(storage, RESOURCE_ENERGY);
            creep.heap.drainingHubLink = false;
        } else {
            moveCreep(creep, storage.pos, 1);
        }
        return;
    }
    if (creep.heap.loadingHubLink && hubLink && hubLink.store && hubLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        if (calcDistance(creep.pos, hubLink.pos) <= 1) {
            creep.transfer(hubLink, RESOURCE_ENERGY);
            creep.heap.loadingHubLink = false;
        } else {
            moveCreep(creep, hubLink.pos, 1);
        }
        return;
    }

    // 0. Emergency Core Fallback: If all fastFillers are dead, Distributor immediately fills Spawns & ALL Extensions!
    if (fastFillersList.length === 0) {
        const spawns = state.spawns || [];
        for (let s = 0; s < spawns.length; s++) {
            const sp = spawns[s];
            if (sp && sp.store && sp.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (calcDistance(creep.pos, sp.pos) <= 1) {
                    const toTransfer = Math.min(carried, sp.store.getFreeCapacity(RESOURCE_ENERGY));
                    creep.transfer(sp, RESOURCE_ENERGY);
                    recordEnergyTransfer(room.name, sp.id, toTransfer);
                } else {
                    moveCreep(creep, sp.pos, 1);
                }
                return;
            }
        }
        const allExts = state.extensions || [];
        for (let e = 0; e < allExts.length; e++) {
            const ext = allExts[e];
            if (ext && ext.store && ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (calcDistance(creep.pos, ext.pos) <= 1) {
                    const toTransfer = Math.min(carried, ext.store.getFreeCapacity(RESOURCE_ENERGY));
                    creep.transfer(ext, RESOURCE_ENERGY);
                    recordEnergyTransfer(room.name, ext.id, toTransfer);
                } else {
                    moveCreep(creep, ext.pos, 1);
                }
                return;
            }
        }
    }

    // 1. Maintain Core Containers with hysteresis (avoid 200e top-off thrashing)
    const coreContThresh = (state.links && state.links.length >= 2) ? 400 : 800;
    const starvingCoreCont = coreContainers.find(c => c.store && c.store[RESOURCE_ENERGY] < coreContThresh);
    if (starvingCoreCont) {
        if (calcDistance(creep.pos, starvingCoreCont.pos) <= 1) {
            creep.transfer(starvingCoreCont, RESOURCE_ENERGY);
        } else {
            moveCreep(creep, starvingCoreCont.pos, 1);
        }
        return;
    }

    // 2. Maintain Towers with hysteresis (< 500 peacetime, < 700 when hostiles present)
    const towerTarget = (state.hostiles && state.hostiles.length > 0) ? 700 : 500;
    const needyTower = towers.find(t => t.store && t.store[RESOURCE_ENERGY] < towerTarget);
    if (needyTower) {
        if (calcDistance(creep.pos, needyTower.pos) <= 1) {
            creep.transfer(needyTower, RESOURCE_ENERGY);
        } else {
            moveCreep(creep, needyTower.pos, 1);
        }
        return;
    }

    // 3. Refill outer extensions if any have deficits (O(1) dirty bitmask gate)
    const extMask = state.extDirtyMask;
    if (!extMask || extMask[0] !== 0 || extMask[1] !== 0) {
        const extensions = state.extensions || [];
        for (let e = 0; e < extensions.length; e++) {
            if (extMask && (extMask[e >> 5] & (1 << (e & 31))) === 0) continue;
            const ext = extensions[e];
            if (ext && ext.store && ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (calcDistance(creep.pos, ext.pos) <= 1) {
                    const toTransfer = Math.min(carried, ext.store.getFreeCapacity(RESOURCE_ENERGY));
                    creep.transfer(ext, RESOURCE_ENERGY);
                    recordEnergyTransfer(room.name, ext.id, toTransfer);
                } else {
                    moveCreep(creep, ext.pos, 1);
                }
                return;
            }
        }
    }

    // 4. If all full (and not draining core overflow), top off core containers only when below 1000
    if (!creep.heap.drainingCoreOverflow) {
        const nonFullCoreCont = coreContainers.find(c => c.store && (c.store[RESOURCE_ENERGY] || 0) < 1000);
        if (nonFullCoreCont) {
            if (calcDistance(creep.pos, nonFullCoreCont.pos) <= 1) {
                creep.transfer(nonFullCoreCont, RESOURCE_ENERGY);
            } else {
                moveCreep(creep, nonFullCoreCont.pos, 1);
            }
            return;
        }
    }

    // 4a. Top off Controller Container (< 600 only if no dedicated haulers) or flush drained Core Container overflow into Storage
    const distCtrlCont = state.controllerContainer;
    if (!hasHomeHaulers && distCtrlCont && distCtrlCont.store && (distCtrlCont.store[RESOURCE_ENERGY] || 0) < 600) {
        if (calcDistance(creep.pos, distCtrlCont.pos) <= 1) {
            creep.transfer(distCtrlCont, RESOURCE_ENERGY);
            creep.heap.drainingCoreOverflow = false;
        } else {
            moveCreep(creep, distCtrlCont.pos, 1);
        }
        return;
    }
    if (creep.heap.drainingCoreOverflow && storage && storage.store && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        if (calcDistance(creep.pos, storage.pos) <= 1) {
            creep.transfer(storage, RESOURCE_ENERGY);
            creep.heap.drainingCoreOverflow = false;
        } else {
            moveCreep(creep, storage.pos, 1);
        }
        return;
    }

    // 4b. Advanced Infrastructure & Lab/Terminal Energy Deliveries
    const storageEnergy = (storage && storage.store) ? (storage.store[RESOURCE_ENERGY] || 0) : 0;
    const termEnergyTarget = storageEnergy >= 60000 ? 25000 : 15000;
    if (terminal && terminal.store && storageEnergy >= 20000 &&
        (terminal.store[RESOURCE_ENERGY] || 0) < termEnergyTarget &&
        terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        if (calcDistance(creep.pos, terminal.pos) <= 1) {
            creep.transfer(terminal, RESOURCE_ENERGY);
        } else {
            moveCreep(creep, terminal.pos, 1);
        }
        return;
    }

    const roomLabs = state.labs || [];
    if (storageEnergy >= 20000 && roomLabs.length > 0) {
        for (let l = 0; l < roomLabs.length; l++) {
            const lab = roomLabs[l];
            if (lab && lab.store && (lab.store[RESOURCE_ENERGY] || 0) < 1000 && lab.store.getFreeCapacity(RESOURCE_ENERGY) >= 200) {
                if (calcDistance(creep.pos, lab.pos) <= 1) {
                    creep.transfer(lab, RESOURCE_ENERGY);
                } else {
                    moveToLabViaHallway(creep, state, lab);
                }
                return;
            }
        }
    }

    const powerSpawn = (state.powerSpawns && state.powerSpawns.length > 0) ? state.powerSpawns[0] : null;
    if (powerSpawn && powerSpawn.store && powerSpawn.store[RESOURCE_ENERGY] < 4500) {
        if (calcDistance(creep.pos, powerSpawn.pos) <= 1) {
            creep.transfer(powerSpawn, RESOURCE_ENERGY);
        } else {
            moveCreep(creep, powerSpawn.pos, 1);
        }
        return;
    }

    if (state.factory && state.factory.store && state.factory.store[RESOURCE_ENERGY] < 2000) {
        if (calcDistance(creep.pos, state.factory.pos) <= 1) {
            creep.transfer(state.factory, RESOURCE_ENERGY);
        } else {
            moveCreep(creep, state.factory.pos, 1);
        }
        return;
    }

    if (storage && storage.store && storage.store[RESOURCE_ENERGY] >= 100000 && state.nuker && state.nuker.store && state.nuker.store.getFreeCapacity(RESOURCE_ENERGY) >= 5000) {
        if (calcDistance(creep.pos, state.nuker.pos) <= 1) {
            creep.transfer(state.nuker, RESOURCE_ENERGY);
        } else {
            moveCreep(creep, state.nuker.pos, 1);
        }
        return;
    }

    // 4c. If holding energy while idle and lab logistics need cargo space, return energy to Storage
    if (carried > 0 && storage && storage.store && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
        hasPendingLabTask(state, terminal, storage)) {
        if (calcDistance(creep.pos, storage.pos) <= 1) {
            creep.transfer(storage, RESOURCE_ENERGY);
            creep.heap.working = false;
        } else {
            moveCreep(creep, storage.pos, 1);
        }
        return;
    }

    // 5. Storage <-> Terminal 1-Way Mineral Valve (Deadband: 15,000..45,000 avoids ping-pong shuffling)
    if (storage && terminal && storage.store && terminal.store && creep.store) {
        const cap = creep.store.getFreeCapacity();
        if (cap > 0) {
            for (const resKey in terminal.store) {
                if (resKey === RESOURCE_ENERGY) continue;
                const tAmt = terminal.store[resKey] || 0;
                if (tAmt > 45000 && storage.store.getFreeCapacity() >= 1000) {
                    if (calcDistance(creep.pos, terminal.pos) <= 1) {
                        creep.withdraw(terminal, resKey, Math.min(cap, tAmt - 30000));
                    } else {
                        moveCreep(creep, terminal.pos, 1);
                    }
                    return;
                }
            }
            if (terminal.store.getFreeCapacity() >= 5000) {
                for (const resKey in storage.store) {
                    if (resKey === RESOURCE_ENERGY) continue;
                    const sAmt = storage.store[resKey] || 0;
                    const tAmt = terminal.store[resKey] || 0;
                    if (sAmt > 0 && tAmt < 15000) {
                        if (calcDistance(creep.pos, storage.pos) <= 1) {
                            creep.withdraw(storage, resKey, Math.min(cap, sAmt, 15000 - tAmt));
                        } else {
                            moveCreep(creep, storage.pos, 1);
                        }
                        return;
                    }
                }
            }
        }
    }

    // Idle state: Everything is satisfied. Sleep in place and yield right-of-way.
    creep.heap.actionIntent = 'idle';
    creep.heap.sleepUntil = Game.time + 6;
}

function runFiller(c, state) {
    if (c.spawning || c.fatigue > 0) return;
    if (!c.heap) c.heap = {};

    const carried = c.store ? c.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
    const freeCap = c.store ? c.store.getFreeCapacity(RESOURCE_ENERGY) : 0;

    if (carried === 0) {
        c.heap.working = false;
    } else if (freeCap === 0) {
        c.heap.working = true;
    } else if (c.heap.working === undefined) {
        c.heap.working = carried > freeCap;
    }

    const spawns = state.spawns || [];
    const extensions = state.extensions || [];
    const towers = state.towers || [];
    const storage = state.storage;
    const terminal = state.terminal;
    const labs = state.labs || [];
    const links = state.links || [];
    const storageLink = storage ? links.find(l => calcDistance(l.pos, storage.pos) <= 2) : null;

    if (!c.heap.working) {
        // Fetch energy: Empty incoming storageLink first so Link network never stalls, then Storage!
        let sourceTarget = null;
        if (storageLink && getEffectiveStore(storageLink) > 0) {
            sourceTarget = storageLink;
        } else if (storage && getEffectiveStore(storage) > 0) {
            sourceTarget = storage;
        } else if (terminal && terminal.store && terminal.store[RESOURCE_ENERGY] > 10000) {
            sourceTarget = terminal;
        } else {
            const cont = (state.containers || []).find(cnt => getEffectiveStore(cnt) >= 100);
            if (cont) sourceTarget = cont;
            else {
                const drop = (state.droppedEnergy || []).find(d => d.amount >= 50);
                if (drop) sourceTarget = drop;
            }
        }

        if (sourceTarget) {
            if (calcDistance(c.pos, sourceTarget.pos) <= 1) {
                const amount = Math.min(freeCap, getEffectiveStore(sourceTarget));
                if (sourceTarget.amount !== undefined) {
                    c.pickup(sourceTarget);
                } else if (amount > 0) {
                    c.withdraw(sourceTarget, RESOURCE_ENERGY, amount);
                    registerIntent(c, 'withdraw', sourceTarget, amount);
                }
            } else {
                moveCreep(c, sourceTarget.pos, 1);
            }
        }
    } else {
        // Delivery targets for filler:
        // 1. Spawns and Extensions (Fast filler priority!)
        let dest = null;
        for (let s = 0; s < spawns.length; s++) {
            if (getEffectiveFreeCapacity(spawns[s]) > 0) { dest = spawns[s]; break; }
        }
        if (!dest && extensions.length > 0) {
            const extMask = state.extDirtyMask;
            if (extMask && (extMask[0] !== 0 || extMask[1] !== 0)) {
                // Check adjacent extensions first for 0-step fast filling
                for (let e = 0; e < extensions.length; e++) {
                    if ((extMask[e >> 5] & (1 << (e & 31))) !== 0) {
                        if (calcDistance(c.pos, extensions[e].pos) <= 1) {
                            dest = extensions[e];
                            break;
                        }
                    }
                }
                if (!dest) {
                    let minD = Infinity;
                    for (let e = 0; e < extensions.length; e++) {
                        if ((extMask[e >> 5] & (1 << (e & 31))) !== 0) {
                            const d = calcDistance(c.pos, extensions[e].pos);
                            if (d < minD) { minD = d; dest = extensions[e]; }
                        }
                    }
                }
            }
        }
        // 2. Towers (< 800 energy)
        if (!dest) {
            for (let t = 0; t < towers.length; t++) {
                if (getEffectiveFreeCapacity(towers[t]) >= 200) { dest = towers[t]; break; }
            }
        }
        // 3. Labs needing energy
        if (!dest) {
            for (let l = 0; l < labs.length; l++) {
                if (labs[l].store && labs[l].store.getFreeCapacity(RESOURCE_ENERGY) >= 200) {
                    dest = labs[l]; break;
                }
            }
        }
        // 4. Terminal balancing: if storage is rich (> 80k) and terminal needs energy (< 30k)
        if (!dest && terminal && storage && storage.store[RESOURCE_ENERGY] > 80000) {
            if (terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && (terminal.store[RESOURCE_ENERGY] || 0) < 30000) {
                dest = terminal;
            }
        }
        // 5. Return excess energy drained from storageLink back into Storage
        if (!dest && storage && getEffectiveFreeCapacity(storage) > 0 && storageLink && calcDistance(c.pos, storageLink.pos) <= 2) {
            dest = storage;
        }

        if (dest) {
            if (calcDistance(c.pos, dest.pos) <= 1) {
                const amount = Math.min(carried, getEffectiveFreeCapacity(dest));
                if (amount > 0) {
                    c.transfer(dest, RESOURCE_ENERGY, amount);
                    registerIntent(c, 'transfer', dest, amount);
                }
            } else {
                moveCreep(c, dest.pos, 1);
            }
        } else {
            // Idle filler: mark idle and clear spawn runway if standing on it
            c.heap.actionIntent = 'idle';
            const nearSpawn = spawns.find(sp => calcDistance(c.pos, sp.pos) <= 1);
            if (nearSpawn) {
                if (storage && calcDistance(c.pos, storage.pos) > 1) {
                    moveCreep(c, storage.pos, 1);
                } else {
                    const dx = Math.sign(c.pos.x - nearSpawn.pos.x) || 1;
                    const dy = Math.sign(c.pos.y - nearSpawn.pos.y) || 1;
                    c.heap.nextStep = { x: c.pos.x + dx, y: c.pos.y + dy, roomName: c.room.name };
                }
            }
        }
    }
}

function selectDeliveryTarget(c, state, cContainer, upgraders, builders, spawnNeedsEnergy, hasFiller) {
    const spawns = state.spawns || [];
    const extensions = state.extensions || [];
    const towers = state.towers || [];
    const storage = state.storage;
    const controller = state.controller;
    const carried = c.store ? (c.store[RESOURCE_ENERGY] || 0) : 0;

    const canAcceptController = (cnt) => {
        if (!cnt || !cnt.store) return false;
        const cEnergy = cnt.store[RESOURCE_ENERGY] || 0;
        if (c.heap && c.heap.targetId === cnt.id) return cEnergy < 2000;
        const incoming = state.controllerIncomingEnergy || 0;
        return (2000 - cEnergy - incoming) >= carried * 0.5;
    };

    // Critical tower defense (if towers are dangerously low < 400)
    for (let t = 0; t < towers.length; t++) {
        if (towers[t].store && towers[t].store[RESOURCE_ENERGY] < 400 && getEffectiveFreeCapacity(towers[t]) >= 200) {
            return towers[t];
        }
    }

    // IF A FILLER IS ACTIVE AND STORAGE EXISTS (with healthy reserve >= 1000):
    // Haulers NEVER waste time wandering between 20-60 extensions!
    // Haulers deliver directly to Storage (or top off controller container)!
    // If storage < 1000, haulers prioritize feeding spawns and core containers first!
    const storageEnergy = (storage && storage.store) ? (storage.store[RESOURCE_ENERGY] || 0) : 0;
    if (storage && hasFiller && storageEnergy >= 1000 && getEffectiveFreeCapacity(storage) > 0) {
        if (cContainer && canAcceptController(cContainer) && (2000 - (cContainer.store[RESOURCE_ENERGY] || 0)) >= 400) {
            if (!c.heap || c.heap.targetId !== cContainer.id) {
                state.controllerIncomingEnergy = (state.controllerIncomingEnergy || 0) + carried;
            }
            return cContainer;
        }
        return storage;
    }

    // If fastFillers are active with core containers (RCL 2-4 without storage, or storage < 1000):
    // Keep core containers topped to >= 1000 before feeding spawns/controller so core containers never starve RCL progression
    if (hasFiller && (!storage || storageEnergy < 1000)) {
        const blueprint = getRoomBlueprint(c.room.name);
        if (blueprint && blueprint.anchor) {
            const coreCont = (state.containers || []).find(cnt => {
                return Math.abs(cnt.pos.y - blueprint.anchor.y) <= 1 &&
                    (Math.abs(cnt.pos.x - (blueprint.anchor.x - 2)) <= 1 || Math.abs(cnt.pos.x - (blueprint.anchor.x + 2)) <= 1) &&
                    (cnt.store ? (cnt.store[RESOURCE_ENERGY] || 0) : 0) < 1000 &&
                    getEffectiveFreeCapacity(cnt) >= 200;
            });
            if (coreCont) return coreCont;
        }
    }

    // 1. Spawns & Extensions (when spawning is active/needed, or after RCL 1 sprint workforce is complete)
    if (spawnNeedsEnergy) {
        for (let s = 0; s < spawns.length; s++) {
            if (getEffectiveFreeCapacity(spawns[s]) > 0) return spawns[s];
        }
        for (let e = 0; e < extensions.length; e++) {
            if (getEffectiveFreeCapacity(extensions[e]) > 0) return extensions[e];
        }
    }

    // 2. Towers (< 800)
    for (let t = 0; t < towers.length; t++) {
        if (getEffectiveFreeCapacity(towers[t]) >= 200) return towers[t];
    }

    // 3. Controller Container (with In-Flight Reservation Cap)
    if (cContainer && canAcceptController(cContainer)) {
        if (!c.heap || c.heap.targetId !== cContainer.id) {
            state.controllerIncomingEnergy = (state.controllerIncomingEnergy || 0) + carried;
        }
        return cContainer;
    }

    // 4. Direct hand-off to Builders (when construction sites exist) or Upgraders
    if (state.constructionSites && state.constructionSites.length > 0) {
        for (let b = 0; b < builders.length; b++) {
            const bd = builders[b];
            if (bd && !bd.spawning && getEffectiveFreeCapacity(bd) >= 20) {
                return bd;
            }
        }
    }
    for (let u = 0; u < upgraders.length; u++) {
        const up = upgraders[u];
        if (up && !up.spawning && getEffectiveFreeCapacity(up) >= 15) {
            return up;
        }
    }

    // 5. Fallback: top off Spawns/Extensions even if census is satisfied
    for (let s = 0; s < spawns.length; s++) {
        if (getEffectiveFreeCapacity(spawns[s]) > 0) return spawns[s];
    }
    for (let e = 0; e < extensions.length; e++) {
        if (getEffectiveFreeCapacity(extensions[e]) > 0) return extensions[e];
    }

    // 5b. Advanced Infrastructure Saturation (RCL 7-8) when Storage is healthy (>= 50,000)
    if (storageEnergy >= 50000) {
        if (state.powerSpawns && state.powerSpawns.length > 0) {
            for (let ps = 0; ps < state.powerSpawns.length; ps++) {
                const pSpawn = state.powerSpawns[ps];
                if (pSpawn && pSpawn.store && pSpawn.store[RESOURCE_ENERGY] < 4500 && getEffectiveFreeCapacity(pSpawn) >= 200) {
                    return pSpawn;
                }
            }
        }
        if (state.factory && state.factory.store && state.factory.store[RESOURCE_ENERGY] < 2000 && getEffectiveFreeCapacity(state.factory) >= 200) {
            return state.factory;
        }
        if (storageEnergy >= 100000 && state.nuker && state.nuker.store && state.nuker.store.getFreeCapacity(RESOURCE_ENERGY) >= 5000) {
            return state.nuker;
        }
    }

    // 5c. Top off remaining capacity in Core Containers when all higher-priority targets are satisfied
    if (hasFiller && (!storage || storageEnergy < 1000)) {
        const blueprint = getRoomBlueprint(c.room.name);
        if (blueprint && blueprint.anchor) {
            const topOffCore = (state.containers || []).find(cnt => {
                return Math.abs(cnt.pos.y - blueprint.anchor.y) <= 1 &&
                    (Math.abs(cnt.pos.x - (blueprint.anchor.x - 2)) <= 1 || Math.abs(cnt.pos.x - (blueprint.anchor.x + 2)) <= 1) &&
                    getEffectiveFreeCapacity(cnt) >= 200;
            });
            if (topOffCore) return topOffCore;
        }
    }

    // 6. Storage (ONLY if hauler did NOT withdraw from storage to prevent yo-yo loops!)
    if (storage && !c.heap.fetchedFromStorage && getEffectiveFreeCapacity(storage) > 0 && controller && controller.level >= 4) {
        return storage;
    }
    return null;
}

function runLogistics(roomName) {
    if (typeof Game === 'undefined' || !Game.creeps) return;

    const state = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    if (!state) return;
    if (!state.ledger) state.ledger = {};

    const room = Game.rooms[roomName];
    if (!room) return;

    const spawns = state.spawns || [];
    const extensions = state.extensions || [];
    const towers = state.towers || [];
    const storage = state.storage;
    const controller = state.controller;
    const sources = state.sources || [];
    const dropped = state.droppedEnergy || [];
    const tombstones = state.tombstones || [];
    const ruins = state.ruins || [];
    const containers = state.containers || [];

    const col = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
    const getRole = (r) => (col && col.creepsByRole && col.creepsByRole[r] && col.creepsByRole[r].length > 0)
        ? col.creepsByRole[r]
        : ((state.creepsByRole && state.creepsByRole[r]) || []);
    const upgraders = getRole('upgrader');
    const builders = getRole('builder');
    const haulers = getRole('hauler');
    const fillers = getRole('filler');
    const fastFillers = getRole('fastFiller');
    const distributors = getRole('distributor');
    const scavengers = getRole('scavenger');

    for (let f = 0; f < fastFillers.length; f++) {
        runFastFiller(fastFillers[f], state, room);
    }

    for (let d = 0; d < distributors.length; d++) {
        runDistributor(distributors[d], state, room);
    }

    for (let f = 0; f < fillers.length; f++) {
        runFiller(fillers[f], state);
    }

    // Emergency & Cross-Room Rival-Remote Scavengers ([CARRY, MOVE])
    for (let sc = 0; sc < scavengers.length; sc++) {
        const s = scavengers[sc];
        if (!s || s.spawning || s.fatigue > 0) continue;
        if (!s.heap) s.heap = {};
        const used = s.store ? s.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
        const free = s.store ? s.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
        if (used === 0) s.heap.working = false;
        else if (free === 0) s.heap.working = true;
        const lootRoom = (s.memory && s.memory.targetRoom) || roomName;
        if (s.heap.working) {
            if (s.room.name !== roomName) {
                moveCreep(s, roomCenterPos(roomName), 2);
                continue;
            }
            const dest = selectDeliveryTarget(s, state, state.controllerContainer, upgraders, builders, true, false);
            if (dest) {
                if (calcDistance(s.pos, dest.pos) <= 1) s.transfer(dest, RESOURCE_ENERGY);
                else moveCreep(s, dest.pos, 1);
            }
        } else {
            if (s.room.name !== lootRoom) {
                moveCreep(s, roomCenterPos(lootRoom), 18);
                continue;
            }
            const scState = (global.heap && global.heap.rooms && global.heap.rooms[lootRoom]) || state;
            const scDropped = (scState && scState.droppedEnergy) || [];
            const scTombs = (scState && scState.tombstones) || [];
            const scRuins = (scState && scState.ruins) || [];
            let loot = null;
            for (let d = 0; d < scDropped.length; d++) {
                if (scDropped[d].amount >= 10) { loot = scDropped[d]; break; }
            }
            if (!loot) {
                for (let t = 0; t < scTombs.length; t++) {
                    if (scTombs[t].store && (scTombs[t].store[RESOURCE_ENERGY] || 0) >= 10) { loot = scTombs[t]; break; }
                }
            }
            if (!loot) {
                for (let r = 0; r < scRuins.length; r++) {
                    if (scRuins[r].store && (scRuins[r].store[RESOURCE_ENERGY] || 0) >= 10) { loot = scRuins[r]; break; }
                }
            }
            if (loot) {
                if (calcDistance(s.pos, loot.pos) <= 1) {
                    if (loot.amount !== undefined) s.pickup(loot);
                    else s.withdraw(loot, RESOURCE_ENERGY);
                } else {
                    moveCreep(s, loot.pos, 1);
                }
            } else if (used > 0) {
                s.heap.working = true;
            }
        }
    }
    const hasFiller = !!(storage && fillers.length > 0) || (fastFillers.length > 0);

    if (!haulers.length) return;

    if (Game.time % 50 === 0) {
        const freeSpawnEnergy = spawns.reduce((acc, s) => acc + (s.store ? s.store.getFreeCapacity(RESOURCE_ENERGY) : 0), 0) +
                                extensions.reduce((acc, e) => acc + (e.store ? e.store.getFreeCapacity(RESOURCE_ENERGY) : 0), 0);
        const totalDropped = dropped.reduce((acc, d) => acc + (d.amount || 0), 0);
        console.log(`[DEBUG] [HAULER_STATUS] ${roomName}: ${haulers.length} haulers active. Unfilled spawn energy: ${freeSpawnEnergy}, Dropped energy: ${totalDropped}`);
    }

    const cContainer = state.controllerContainer || (controller ? containers.find(cnt => calcDistance(cnt.pos, controller.pos) <= 3) : null);

    // Check if spawn actually needs energy for census (at RCL 1 once 2 harvesters, 1 hauler, 2 upgraders exist, feed upgraders directly!)
    const rcl = (controller && controller.level) || 1;
    let baseSpawnNeedsEnergy = true;
    if (rcl === 1) {
        const need = getCensusRequirements ? getCensusRequirements(roomName) : {};
        const totalNeed = (need.harvester || 0) + (need.hauler || 0) + (need.upgrader || 0) + (need.builder || 0);
        if (totalNeed === 0) {
            baseSpawnNeedsEnergy = false;
        }
    }

    const haulersAtSource = {};
    for (let h = 0; h < haulers.length; h++) {
        const hCreep = haulers[h];
        if (hCreep.spawning) continue;
        for (let s = 0; s < sources.length; s++) {
            if (calcDistance(hCreep.pos, sources[s].pos) <= 2) {
                haulersAtSource[sources[s].id] = (haulersAtSource[sources[s].id] || 0) + 1;
            }
        }
    }

    const needSpawnCap = spawns.some(s => getEffectiveFreeCapacity(s) > 0) ||
                         extensions.some(e => getEffectiveFreeCapacity(e) > 0);
    const needTowerEnergy = towers.some(t => getEffectiveFreeCapacity(t) >= 200);
    const needControllerEnergy = cContainer && getEffectiveFreeCapacity(cContainer) >= 400;

    // Top-Down Room Logistics Dispatch: compute once per tick per room
    if (!state._logisticsDispatchTick || state._logisticsDispatchTick !== Game.time) {
        state._logisticsDispatchTick = Game.time;
        state._logisticsDispatch = {
            needSpawnCap,
            needTowerEnergy,
            needControllerEnergy
        };
    }

    for (let i = 0; i < haulers.length; i++) {
        const c = haulers[i];
        if (c.spawning || c.fatigue > 0) continue;
        if (!c.heap) c.heap = {};
        if (c.heap.sleepUntil && Game.time < c.heap.sleepUntil && (!c.store || c.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) continue;

        let spawnNeedsEnergy = baseSpawnNeedsEnergy;
        if (rcl === 2 && !cContainer) {
            const harvCount = (state.creepsByRole && state.creepsByRole.harvester) ? state.creepsByRole.harvester.length : 0;
            if (harvCount >= 2 && haulers.length >= 2 && upgraders.length >= 2 && builders.length >= 1) {
                spawnNeedsEnergy = (i === 0);
            }
        }

        const carried = c.store ? c.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
        const freeCap = c.store ? c.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
        const totalHaulCarried = c.store ? c.store.getUsedCapacity() : 0;

        // If carrying non-energy minerals or acting as lab filler fallback when no distributor exists
        if (totalHaulCarried > carried || (distributors.length === 0 && i === 0 && totalHaulCarried === 0 && rcl >= 6 && !needSpawnCap)) {
            if (runLabLogistics(c, state, room)) continue;
        }

        if (totalHaulCarried === 0) {
            c.heap.working = false;
            c.heap.fetchedFromStorage = false;
            c.heap.drainingCoreOverflow = false;
        } else if (freeCap === 0) {
            c.heap.working = true;
        } else if (c.heap.working === undefined) {
            c.heap.working = totalHaulCarried > freeCap;
        }

        const canStoreMinerals = !!(room && (room.terminal || room.storage));

        // 1. FETCH MODE: Find energy or loot supply using Virtual Ledger
        if (!c.heap.working) {
            let preferredSource = null;
            let minCongestion = Infinity;
            for (let s = 0; s < sources.length; s++) {
                const src = sources[s];
                const cong = haulersAtSource[src.id] || 0;
                if (cong < minCongestion) {
                    minCongestion = cong;
                    preferredSource = src;
                }
            }
            if (!preferredSource && sources.length) preferredSource = sources[i % sources.length];

            let target = null;
            const armedCount = (state.armedHostiles && state.armedHostiles.length) || 0;
            const lootList = armedCount === 0 ? (state.lootTargets || []) : [];

            // Priority 0: Multi-resource Tombstones/Ruins/Non-Energy Loot when canStoreMinerals (or energy >= 50)
            if (lootList.length > 0 && canStoreMinerals) {
                for (let li = 0; li < lootList.length; li++) {
                    const lt = lootList[li];
                    if (!lt || !lt.pos) continue;
                    if (lt.amount !== undefined) {
                        if (lt.resourceType !== RESOURCE_ENERGY || lt.amount >= 50) { target = lt; break; }
                    } else if (lt.store && getLootTotal(lt.store, true) > 0) {
                        target = lt;
                        break;
                    }
                }
            }

            let bestDrop = null;
            let maxDropScore = -Infinity;

            // Priority A: Dropped energy near sources (ignore drops already within pickup range 1 of cContainer or a living upgrader)
            if (!target) for (let d = 0; d < dropped.length; d++) {
                const drop = dropped[d];
                if (controller && calcDistance(drop.pos, controller.pos) <= 3) {
                    const nearCtrlCont = cContainer && calcDistance(drop.pos, cContainer.pos) <= 1;
                    const nearUpgrader = upgraders.some(u => !u.spawning && calcDistance(drop.pos, u.pos) <= 1);
                    if (nearCtrlCont || nearUpgrader) continue;
                }

                const effective = getEffectiveStore(drop);
                const minThreshold = calcDistance(c.pos, drop.pos) <= 3 ? 4 : 15;
                if (effective < minThreshold) continue;

                // Strongly prefer close sources over distant 45,8 source unless already near it
                let score = effective - calcDistance(c.pos, drop.pos) * 12;
                if (preferredSource && calcDistance(drop.pos, preferredSource.pos) <= 3 && calcDistance(c.pos, preferredSource.pos) <= 25) {
                    score += 100;
                }
                if (score > maxDropScore) {
                    maxDropScore = score;
                    bestDrop = drop;
                }
            }

            if (bestDrop) {
                target = bestDrop;
            } else {
                // Priority B: Tombstones or ruins
                const tomb = tombstones.find(t => getEffectiveStore(t) >= 25) ||
                             ruins.find(r => getEffectiveStore(r) >= 25);
                if (tomb) {
                    target = tomb;
                } else {
                    // Priority C: Source containers (or coreContainers >= 1000 when !hubLink & extensions full)
                    const bp = getRoomBlueprint(roomName);
                    const anc = bp ? bp.anchor : null;
                    const { hubLink: roomHubLink } = classifyRoomLinks(state, roomName);
                    const emergencyCoreDrain = !roomHubLink && room.energyAvailable === room.energyCapacityAvailable &&
                        storage && storage.store && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    let bestContainer = null;
                    let bestContainerScore = -Infinity;
                    for (let cntIdx = 0; cntIdx < containers.length; cntIdx++) {
                        const cnt = containers[cntIdx];
                        if (cContainer && cnt.id === cContainer.id) continue;
                        if (controller && calcDistance(cnt.pos, controller.pos) <= 3) continue;
                        const isCoreCnt = !!(anc && Math.abs(cnt.pos.y - anc.y) <= 1 && (Math.abs(cnt.pos.x - (anc.x - 2)) <= 1 || Math.abs(cnt.pos.x - (anc.x + 2)) <= 1));
                        const eff = getEffectiveStore(cnt);
                        if (isCoreCnt) {
                            if (emergencyCoreDrain && eff >= 1000) {
                                bestContainer = cnt;
                                c.heap.drainingCoreOverflow = true;
                                break;
                            }
                            if (fastFillers.length > 0 || !needSpawnCap) continue;
                        }
                        if (eff < 50) continue;

                        if (preferredSource && calcDistance(cnt.pos, preferredSource.pos) <= 2 && eff >= 200) {
                            bestContainer = cnt;
                            break;
                        }
                        if (eff > bestContainerScore) {
                            bestContainerScore = eff;
                            bestContainer = cnt;
                        }
                    }

                    if (bestContainer) {
                        target = bestContainer;
                    } else if (storage && getEffectiveStore(storage) >= 500 && (needSpawnCap || needTowerEnergy || needControllerEnergy)) {
                        target = storage;
                        c.heap.fetchedFromStorage = true;
                    }
                }
            }

            if (target) {
                if (!target.pos) { c.heap.targetId = null; continue; }
                const action = target.amount !== undefined ? 'pickup' : 'withdraw';
                registerIntent(c, action, target, freeCap);
                const dist = calcDistance(c.pos, target.pos);
                if (dist <= 1) {
                    const avail = target.store ? getLootTotal(target.store, canStoreMinerals) : (getEffectiveStore(target) + freeCap);
                    withdrawOrPickupLoot(c, target, canStoreMinerals);
                    if (storage && target.id === storage.id) {
                        c.heap.fetchedFromStorage = true;
                    }
                    const nextCarried = totalHaulCarried + Math.min(freeCap, avail);
                    const totalCap = c.store ? c.store.getCapacity() : 100;
                    const stillHasLoot = !!(target.store && getLootTotal(target.store, canStoreMinerals) > freeCap);
                    if (!stillHasLoot && (nextCarried >= Math.min(totalCap, 40) || !preferredSource || calcDistance(c.pos, preferredSource.pos) > 3)) {
                        c.heap.working = true;
                        // Simultaneous Intent Stacking: immediately begin moving toward delivery destination on the same tick!
                        if (!depositNonEnergyLoot(c, room, true)) {
                            const nextDest = (c.heap.drainingCoreOverflow && storage && storage.store && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                                ? storage
                                : selectDeliveryTarget(c, state, cContainer, upgraders, builders, spawnNeedsEnergy, hasFiller);
                            if (nextDest && nextDest.pos) {
                                moveCreep(c, nextDest.pos, 1);
                            } else if (controller) {
                                moveCreep(c, controller.pos, 2);
                            }
                        }
                    }
                } else {
                    moveCreep(c, target.pos, 1);
                }
            } else if (carried > 0) {
                c.heap.working = true;
            } else if (preferredSource) {
                // Pre-position near assigned source if waiting for drop
                if (calcDistance(c.pos, preferredSource.pos) > 2) {
                    moveCreep(c, preferredSource.pos, 2);
                } else {
                    c.heap.actionIntent = 'idle';
                    c.heap.sleepUntil = Game.time + 4;
                }
            } else {
                c.heap.actionIntent = 'idle';
                c.heap.sleepUntil = Game.time + 4;
            }
            continue;
        }

        // 2. DELIVERY MODE: Deposit non-energy loot to Terminal/Storage first, then normal energy delivery
        if (c.heap.working) {
            if (depositNonEnergyLoot(c, room)) continue;
            const target = (c.heap.drainingCoreOverflow && storage && storage.store && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                ? storage
                : selectDeliveryTarget(c, state, cContainer, upgraders, builders, spawnNeedsEnergy, hasFiller);

            if (!target && !cContainer && state.controllerContainerPos) {
                // Virtual Loading Dock Fallback: even when container is missing, drop onto containerPos for O(1) upgrader pickup
                const vPos = state.controllerContainerPos;
                const d = calcDistance(c.pos, vPos);
                if (d === 0) {
                    c.drop(RESOURCE_ENERGY);
                    c.heap.working = false;
                } else {
                    moveCreep(c, new RoomPosition(vPos.x, vPos.y, roomName), 0);
                }
            } else if (!target && controller) {
                const distToCtrl = calcDistance(c.pos, controller.pos);
                if (distToCtrl > 2) {
                    moveCreep(c, controller.pos, 2);
                } else {
                    c.drop(RESOURCE_ENERGY);
                    c.heap.working = false;
                    if (sources.length > 0) {
                        moveCreep(c, sources[i % sources.length].pos, 2);
                    }
                }
            } else if (target) {
                if (!target.pos) { c.heap.targetId = null; continue; }
                const isCtrlCont = !!(cContainer && target.id === cContainer.id);
                const transferAmt = Math.min(carried, getEffectiveFreeCapacity(target));
                registerIntent(c, 'transfer', target, transferAmt);
                const dist = calcDistance(c.pos, target.pos);

                if (isCtrlCont) {
                    if (dist <= 1) {
                        const freeSpace = target.store ? target.store.getFreeCapacity(RESOURCE_ENERGY) : 0;
                        if (freeSpace >= carried) {
                            c.transfer(target, RESOURCE_ENERGY);
                            c.heap.targetId = null;
                            c.heap.working = false;
                            c.heap.waitTicks = 0;
                            if (sources.length > 0) moveCreep(c, sources[i % sources.length].pos, 2);
                        } else if (freeSpace > 0) {
                            c.transfer(target, RESOURCE_ENERGY);
                            c.heap.targetId = null;
                            c.heap.waitTicks = 0;
                        } else {
                            // Container is full: Drop-and-Go immediately
                            c.drop(RESOURCE_ENERGY);
                            c.heap.targetId = null;
                            c.heap.working = false;
                            c.heap.waitTicks = 0;
                            if (sources.length > 0) moveCreep(c, sources[i % sources.length].pos, 2);
                        }
                    } else {
                        // Congestion Bailout Valve: only trigger after genuinely stalling >= 3 ticks at range <= 2
                        if (dist <= 2 && (c.heap.stuckTicks || 0) > 0) {
                            c.heap.waitTicks = (c.heap.waitTicks || 0) + 1;
                            if (c.heap.waitTicks >= 3) {
                                const adjUp = upgraders.find(u => calcDistance(c.pos, u.pos) <= 1 && getEffectiveFreeCapacity(u) > 0);
                                if (adjUp) {
                                    c.transfer(adjUp, RESOURCE_ENERGY);
                                    c.heap.targetId = null;
                                    c.heap.working = false;
                                    c.heap.waitTicks = 0;
                                    if (sources.length > 0) moveCreep(c, sources[i % sources.length].pos, 2);
                                    continue;
                                } else if (upgraders.some(u => calcDistance(c.pos, u.pos) <= 1)) {
                                    c.drop(RESOURCE_ENERGY);
                                    c.heap.targetId = null;
                                    c.heap.working = false;
                                    c.heap.waitTicks = 0;
                                    if (sources.length > 0) moveCreep(c, sources[i % sources.length].pos, 2);
                                    continue;
                                } else if (storage && !c.heap.fetchedFromStorage && getEffectiveFreeCapacity(storage) > 0) {
                                    c.heap.targetId = storage.id;
                                    c.heap.waitTicks = 0;
                                    if (calcDistance(c.pos, storage.pos) <= 1) {
                                        c.transfer(storage, RESOURCE_ENERGY);
                                        c.heap.working = false;
                                    } else {
                                        moveCreep(c, storage.pos, 1);
                                    }
                                    continue;
                                }
                            }
                        } else {
                            c.heap.waitTicks = 0;
                        }
                        const dockList = state.controllerDockPosList;
                        if (dockList && dockList.length > 0) {
                            const dockDest = dockList[i % dockList.length];
                            moveCreep(c, dockDest, 0);
                        } else {
                            moveCreep(c, target.pos, 1);
                        }
                    }
                    continue;
                }

                if (dist <= 1) {
                    c.transfer(target, RESOURCE_ENERGY);
                    const remaining = carried - transferAmt;
                    if (remaining <= 0) {
                        c.heap.working = false;
                        if (sources.length > 0) {
                            moveCreep(c, sources[i % sources.length].pos, 2);
                        }
                    } else {
                        const nextTarget = selectDeliveryTarget(c, state, cContainer, upgraders, builders, spawnNeedsEnergy, hasFiller);
                        if (nextTarget && nextTarget.id !== target.id) {
                            moveCreep(c, nextTarget.pos, 1);
                        } else if (controller && calcDistance(c.pos, controller.pos) <= 3) {
                            c.drop(RESOURCE_ENERGY);
                            c.heap.working = false;
                        }
                    }
                } else {
                    moveCreep(c, target.pos, 1);
                }
            }
        }
    }
}

function buildRoomLogisticsDispatch(roomName, state) {
    if (!state) return null;
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    if (state._logisticsDispatchTick === now && state._logisticsDispatch) {
        return state._logisticsDispatch;
    }
    const spawns = state.spawns || [];
    const extensions = state.extensions || [];
    const towers = state.towers || [];
    const cContainer = state.controllerContainer || null;
    const dispatch = {
        needSpawnCap: spawns.some(s => getEffectiveFreeCapacity(s) > 0) || extensions.some(e => getEffectiveFreeCapacity(e) > 0),
        needTowerEnergy: towers.some(t => getEffectiveFreeCapacity(t) >= 200),
        needControllerEnergy: !!(cContainer && getEffectiveFreeCapacity(cContainer) >= 400)
    };
    state._logisticsDispatchTick = now;
    state._logisticsDispatch = dispatch;
    return dispatch;
}

module.exports = {
    buildRoomLogisticsDispatch,
    depositNonEnergyLoot,
    moveToLabViaHallway,
    runLabLogistics,
    runLinks,
    runLogistics,
    selectDeliveryTarget,
    runFastFiller,
    runDistributor,
    withdrawOrPickupLoot
};