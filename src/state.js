// src/state.js
// Global State Scanner, Colony Hierarchy, O(1) Room Caches & Virtual Capacity Ledger
const { BODY_COSTS, calcDistance, getRivalSafeModeRemaining, getOrCreateIntId, resetIdDictionary, resetRoomHashDictionary } = require('./constants');
const { getConfig, getRampartBaseline, log } = require('./config');

const ROLE_ID = {
    harvester: 0,
    hauler: 1,
    filler: 2,
    fastFiller: 3,
    distributor: 4,
    upgrader: 5,
    builder: 6,
    defender: 7,
    raider: 8,
    claimer: 9,
    pioneer: 10,
    remoteMiner: 11,
    remoteHauler: 12,
    reserver: 13,
    scout: 14,
    mineralMiner: 15,
    janitor: 16,
    outpostDefender: 17,
    skGuard: 18,
    skHealer: 19,
    drainer: 20,
    teamWrecker: 21,
    teamHealer: 22,
    bankAttacker: 23,
    bankHealer: 24,
    bankHauler: 25,
    praiser: 26,
    quad: 27,
    assassin: 28,
    scavenger: 29,
    hunter: 30,
    pest: 31,
    operator: 32
};

// Monomorphic Creep Heap Schema (Key order strictly preserved across all creep heaps to lock V8 hidden class)
function createCreepHeap(roleId = 0, role = null) {
    return {
        roleId: roleId,
        role: role,
        subRole: null,
        targetId: null,
        targetRoom: null,
        targetInt: 0,
        actionIntent: 'idle',
        working: false,
        sleepUntil: 0,
        stuckTicks: 0,
        inPosition: false,
        locked: false,
        nextStep: null,
        path: null,
        pathBuffer: null,
        _path: null,
        _pathKey: null,
        _targetSig: null,
        _stepIdx: 0,
        _targetPos: null,
        _destRange: 0,
        _lastTickPos: 0,
        _prevPos: null,
        buildingRampartPos: null,
        buildingRampartSiteId: null,
        rampartHandoffId: null,
        rampartHandoffInt: 0,
        bindingsInit: false,
        adjContainers: null,
        adjLinks: null,
        adjExtensions: null,
        adjSpawns: null,
        boundContCount: 0,
        boundLinkCount: 0,
        pulledFromLink: false,
        fetchedFromStorage: false,
        drainingCoreOverflow: false,
        borderWait: 0,
        baitMode: false,
        safeRoom: null,
        boosted: false,
        waitTicks: 0,
        spawnLeadTicks: 0,
        sourceId: null,
        siteApproachTicks: 0,
        siteStuckBailouts: 0,
        targetSiteId: null,
        targetSlotIndex: -1,
        slotIndex: -1,
        mem: null
    };
}

function markMemoryDirty() {
    if (typeof global !== 'undefined' && global.heap) {
        global.heap.memoryDirty = true;
    }
}

function safeSuicide(creep, reason) {
    if (!creep || creep.spawning || typeof creep.suicide !== 'function') return false;
    const ttl = creep.ticksToLive;
    if (ttl === undefined || ttl > 1400) return false;
    const role = (creep.memory && creep.memory.role) || (creep.heap && creep.heap.role) || 'unknown';
    const h = getHeap();
    if (!h._lastSuicideLog) h._lastSuicideLog = {};
    const logKey = `${role}:${reason || 'unspecified'}`;
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    if (!h._lastSuicideLog[logKey] || (now - h._lastSuicideLog[logKey]) >= 10) {
        h._lastSuicideLog[logKey] = now;
        log(1, `[SUICIDE] ${creep.name} (${role}) ttl=${ttl} reason=${reason || 'unspecified'}`);
    }
    return creep.suicide() === (typeof OK !== 'undefined' ? OK : 0);
}

if (typeof Creep !== 'undefined') {
    if (!Creep.prototype.hasOwnProperty('heap')) {
        Object.defineProperty(Creep.prototype, 'heap', {
            get() {
                if (!global.heap) global.heap = {};
                if (!global.heap.creeps) global.heap.creeps = {};
                let h = global.heap.creeps[this.name];
                if (!h) {
                    const r = this.name ? this.name.split('_')[0] : null;
                    const rid = (r && ROLE_ID && ROLE_ID[r] !== undefined) ? ROLE_ID[r] : 0;
                    h = createCreepHeap(rid, r);
                    global.heap.creeps[this.name] = h;
                    global.heap[this.name] = h;
                }
                return h;
            },
            set(val) {
                if (!global.heap) global.heap = {};
                if (!global.heap.creeps) global.heap.creeps = {};
                global.heap.creeps[this.name] = val;
                global.heap[this.name] = val;
            },
            configurable: true,
            enumerable: false
        });
    }

    if (!Creep.prototype.hasOwnProperty('memory')) {
        Object.defineProperty(Creep.prototype, 'memory', {
            get() {
                const h = this.heap;
                if (h && h.mem) return h.mem;
                const sMem = (global.heap && global.heap.state && global.heap.state.creeps) ? global.heap.state.creeps[this.name] : null;
                if (sMem) {
                    if (h) h.mem = sMem;
                    return sMem;
                }
                if (typeof Memory !== 'undefined' && Memory && Memory.creeps && Memory.creeps[this.name]) {
                    if (h) h.mem = Memory.creeps[this.name];
                    return Memory.creeps[this.name];
                }
                const empty = {};
                if (this.name && this.name.indexOf('_') > 0) {
                    const prefix = this.name.split('_')[0];
                    if (ROLE_ID[prefix] !== undefined) empty.role = prefix;
                }
                if (h) h.mem = empty;
                if (typeof Memory !== 'undefined') {
                    if (!Memory.creeps) Memory.creeps = {};
                    Memory.creeps[this.name] = empty;
                }
                if (global.heap && global.heap.state) {
                    if (!global.heap.state.creeps) global.heap.state.creeps = {};
                    global.heap.state.creeps[this.name] = empty;
                }
                return empty;
            },
            set(val) {
                const h = this.heap;
                if (h) h.mem = val;
                if (global.heap) {
                    if (!global.heap.state) global.heap.state = {};
                    if (!global.heap.state.creeps) global.heap.state.creeps = {};
                    global.heap.state.creeps[this.name] = val;
                    global.heap.memoryDirty = true;
                }
                if (typeof Memory !== 'undefined' && Memory && Memory.creeps) {
                    Memory.creeps[this.name] = val;
                }
            },
            configurable: true,
            enumerable: false
        });
    }
}

if (typeof global !== 'undefined') {
    global.lastReset = global.lastReset || (typeof Game !== 'undefined' ? Game.time : 0);
    if (!global.heap) global.heap = {};
    if (!global.heap.rooms) global.heap.rooms = {};
    if (!global.heap.creeps) global.heap.creeps = {};
    if (!global.heap.colonies) global.heap.colonies = {};
    if (!global.heap.remoteRooms) global.heap.remoteRooms = {};
    if (!global.heap.roomIntel) global.heap.roomIntel = {};
    if (!global.heap.sourceSpots) global.heap.sourceSpots = {};
    if (global.heap.memoryDirty === undefined) global.heap.memoryDirty = false;
    if (!global.heap.telemetry) {
        global.heap.telemetry = {
            sourceIdleTicks: 0,
            minerGapTicks: 0,
            spawnIdleWithEnergyTicks: 0,
            energyCappedTicks: 0,
            creepStuckSwapTicks: 0,
            unrepairedCriticalTicks: 0
        };
    }
}

function getHeap() {
    if (!global.heap) global.heap = {};
    if (!global.heap.rooms) global.heap.rooms = {};
    if (!global.heap.creeps) global.heap.creeps = {};
    if (!global.heap.colonies) global.heap.colonies = {};
    if (!global.heap.remoteRooms) global.heap.remoteRooms = {};
    if (!global.heap.roomIntel) global.heap.roomIntel = {};
    if (!global.heap.sourceSpots) global.heap.sourceSpots = {};
    return global.heap;
}

function getExecutionMode() {
    return 'production';
}

function resolveMyUsername() {
    const heap = getHeap();
    if (heap.myUsername) return heap.myUsername;
    if (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.myUsername) {
        heap.myUsername = Memory.empire.myUsername;
        return heap.myUsername;
    }
    if (typeof Game !== 'undefined') {
        if (Game.spawns) {
            for (const sName in Game.spawns) {
                const sp = Game.spawns[sName];
                if (sp && sp.my && sp.owner && sp.owner.username) {
                    heap.myUsername = sp.owner.username;
                    if (typeof Memory !== 'undefined') {
                        if (!Memory.empire) Memory.empire = {};
                        Memory.empire.myUsername = sp.owner.username;
                    }
                    return heap.myUsername;
                }
            }
        }
        if (Game.rooms) {
            for (const rName in Game.rooms) {
                const rm = Game.rooms[rName];
                if (rm && rm.controller && rm.controller.my && rm.controller.owner && rm.controller.owner.username) {
                    heap.myUsername = rm.controller.owner.username;
                    if (typeof Memory !== 'undefined') {
                        if (!Memory.empire) Memory.empire = {};
                        Memory.empire.myUsername = rm.controller.owner.username;
                    }
                    return heap.myUsername;
                }
            }
        }
        if (Game.creeps) {
            for (const cName in Game.creeps) {
                const cr = Game.creeps[cName];
                if (cr && cr.my && cr.owner && cr.owner.username) {
                    heap.myUsername = cr.owner.username;
                    if (typeof Memory !== 'undefined') {
                        if (!Memory.empire) Memory.empire = {};
                        Memory.empire.myUsername = cr.owner.username;
                    }
                    return heap.myUsername;
                }
            }
        }
    }
    return null;
}

function isFriendlyOrEmpireRoom(roomName) {
    if (!roomName) return false;
    const heap = getHeap();
    const myUser = resolveMyUsername();

    // 1. Owned colony or friendly reserved room in Game.rooms
    if (typeof Game !== 'undefined' && Game.rooms && Game.rooms[roomName]) {
        const r = Game.rooms[roomName];
        if (r.controller && r.controller.my) return true;
        if (r.controller && r.controller.reservation && myUser && r.controller.reservation.username === myUser) return true;
    }

    // 2. Colony in heap or Memory
    if (heap.colonies && heap.colonies[roomName]) return true;
    if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].anchor) return true;

    // 3. Outpost partition ownership in heap
    if (heap.outpostOwners && heap.outpostOwners[roomName]) return true;

    // 4. Any colony's outpost list in heap or Memory
    if (heap.colonies) {
        for (const cName in heap.colonies) {
            const col = heap.colonies[cName];
            if (col && Array.isArray(col.outposts) && col.outposts.indexOf(roomName) !== -1) return true;
        }
    }
    if (typeof Memory !== 'undefined' && Memory.rooms) {
        for (const cName in Memory.rooms) {
            const rMem = Memory.rooms[cName];
            if (rMem && Array.isArray(rMem.outposts) && rMem.outposts.indexOf(roomName) !== -1) return true;
        }
    }

    // 5. Remote room scout reservation matching my username
    if (heap.remoteRooms && heap.remoteRooms[roomName]) {
        const info = heap.remoteRooms[roomName];
        if (info.controller && info.controller.reservation && myUser && info.controller.reservation === myUser) return true;
    }
    if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].scoutData) {
        const sd = Memory.rooms[roomName].scoutData;
        if (sd && sd.controller && sd.controller.reservation && myUser && sd.controller.reservation === myUser) return true;
    }

    return false;
}

function cleanupMemory() {
    if (typeof Memory !== 'undefined' && Memory.creeps) {
        for (const id in Memory.creeps) {
            if (!Game.creeps[id]) {
                delete Memory.creeps[id];
                if (global.heap) {
                    if (global.heap.creeps && global.heap.creeps[id]) delete global.heap.creeps[id];
                    if (global.heap[id]) delete global.heap[id];
                    global.heap.memoryDirty = true;
                }
            } else {
                const mem = Memory.creeps[id];
                for (const k in mem) {
                    if (k !== 'role' && k !== 'colony' && k !== 'sourceId' && k !== 'targetRoom' && k !== 'recentRooms' && k !== 'slotIndex' && k !== 'subRole' && k !== 'squadId' && k !== 'quadSlot') {
                        delete mem[k];
                        if (global.heap) global.heap.memoryDirty = true;
                    }
                }
            }
        }
    }
    // Sweep stale heap keys from deceased creeps every 100 ticks
    if (global.heap && typeof Game !== 'undefined' && Game.time % 100 === 0) {
        for (const k in global.heap) {
            if (k.indexOf('_') > 0 && !Game.creeps[k]) {
                delete global.heap[k];
            }
        }
    }
    if (typeof Memory !== 'undefined' && Memory.rooms) {
        const myRoomNames = typeof Game !== 'undefined' && Game.rooms
            ? Object.keys(Game.rooms).filter(rn => Game.rooms[rn].controller && Game.rooms[rn].controller.my)
            : [];
        for (const rName in Memory.rooms) {
            const rMem = Memory.rooms[rName];
            for (const k in rMem) {
                if (k !== 'anchor' && k !== 'outposts' && k !== 'outpostEconomics' && k !== 'scoutData' && k !== 'threat' && k !== 'peakThreat' && k !== 'phoenix' && k !== 'phoenixComplete' && k !== 'spawnStallTicks' && k !== 'fob' && k !== 'fobTarget') {
                    delete rMem[k];
                }
            }
            // Move plain neutral room scout records out of Memory into heap.remoteRooms to eliminate serialization bloat
            const isOwned = typeof Game !== 'undefined' && Game.rooms && Game.rooms[rName] && Game.rooms[rName].controller && Game.rooms[rName].controller.my;
            const isActiveOutpost = !!((global.heap && global.heap.outpostOwners && global.heap.outpostOwners[rName]) ||
                (Memory.empire && Memory.empire.outpostOwners && Memory.empire.outpostOwners[rName]));
            const hasRivalOwner = !!(rMem.scoutData && rMem.scoutData.controller && rMem.scoutData.controller.owner);
            if (!isOwned && !rMem.anchor && !isActiveOutpost && !hasRivalOwner && !rMem.threat && !rMem.peakThreat && !rMem.fob) {
                if (rMem.scoutData) {
                    if (!global.heap) global.heap = {};
                    if (!global.heap.remoteRooms) global.heap.remoteRooms = {};
                    if (!global.heap.remoteRooms[rName]) global.heap.remoteRooms[rName] = rMem.scoutData;
                }
                delete Memory.rooms[rName];
                if (global.heap) global.heap.memoryDirty = true;
                continue;
            }
            if (Object.keys(rMem).length === 0) {
                delete Memory.rooms[rName];
                continue;
            }
            // Prune stale non-colony scout records (> 12000 ticks old) to prevent unbounded Memory bloat
            if (!isOwned && !rMem.anchor && rMem.scoutData && rMem.scoutData.lastSeen && typeof Game !== 'undefined' && (Game.time - rMem.scoutData.lastSeen) > 12000) {
                let nearMyColony = false;
                if (Game.map && Game.map.getRoomLinearDistance) {
                    for (let m = 0; m < myRoomNames.length; m++) {
                        if (Game.map.getRoomLinearDistance(myRoomNames[m], rName) <= 5) {
                            nearMyColony = true;
                            break;
                        }
                    }
                }
                if (!nearMyColony) delete Memory.rooms[rName];
            }
        }
        // Invalidate stale post-respawn expansionTarget or clustered targets (distance <= 1 or active outpost)
        if (Memory.empire && Memory.empire.expansionTarget && myRoomNames.length > 0 && Game.map && Game.map.getRoomLinearDistance) {
            const exp = Memory.empire.expansionTarget;
            const inRange = myRoomNames.some(rn => Game.map.getRoomLinearDistance(rn, exp) <= 4);
            const tooClose = myRoomNames.some(rn => rn !== exp && Game.map.getRoomLinearDistance(rn, exp) <= 1);
            let isOutpost = false;
            if (Memory.empire.outpostOwners && Memory.empire.outpostOwners[exp]) isOutpost = true;
            if (Memory.rooms) {
                for (const r in Memory.rooms) {
                    if (Memory.rooms[r] && Array.isArray(Memory.rooms[r].outposts) && Memory.rooms[r].outposts.includes(exp)) {
                        isOutpost = true;
                        break;
                    }
                }
            }
            const expInfo = (global.heap && global.heap.remoteRooms && global.heap.remoteRooms[exp]) ||
                (Memory.rooms && Memory.rooms[exp] ? Memory.rooms[exp].scoutData : null);
            const myUsername = resolveMyUsername();
            const expReservation = expInfo && ((expInfo.controller && expInfo.controller.reservation) || expInfo.reservation);
            const expInvalid = !!(expInfo && (expInfo.safe === false || expInfo.invaderCoreLevel > 0 || expInfo.threatLevel === 'invader_core' || expInfo.threatLevel === 'hostile_active' || (expReservation && (!myUsername || expReservation !== myUsername))));
            if (!inRange || tooClose || isOutpost || expInvalid) {
                delete Memory.empire.expansionTarget;
                Memory.empire.expansionPoints = [];
                Memory.empire.enemyOutposts = [];
                markMemoryDirty();
            }
        }
    }
    if (typeof Memory !== 'undefined' && Memory.empire) {
        // Purge self rooms from raidTargets, enemyOutposts, enemyRooms, and stale threats
        if (Array.isArray(Memory.empire.raidTargets)) {
            Memory.empire.raidTargets = Memory.empire.raidTargets.filter(r => r && !isFriendlyOrEmpireRoom(r.roomName));
        }
        if (Array.isArray(Memory.empire.enemyOutposts)) {
            Memory.empire.enemyOutposts = Memory.empire.enemyOutposts.filter(r => r && !isFriendlyOrEmpireRoom(r.roomName));
        }
        if (Array.isArray(Memory.empire.enemyRooms)) {
            Memory.empire.enemyRooms = Memory.empire.enemyRooms.filter(r => r && !isFriendlyOrEmpireRoom(r));
        }
        if (Array.isArray(Memory.empire.threats)) {
            Memory.empire.threats = Memory.empire.threats.filter(t => {
                if (!t || !t.roomName) return false;
                const isEmpire = isFriendlyOrEmpireRoom(t.roomName);
                if (isEmpire) {
                    const rState = (global.heap && global.heap.rooms) ? global.heap.rooms[t.roomName] : null;
                    return rState && rState.armedHostiles && rState.armedHostiles.length > 0;
                }
                return true;
            });
        }
    }
    if (typeof global !== 'undefined' && global.creepHeap) {
        for (const id in global.creepHeap) {
            if (!Game.creeps[id]) delete global.creepHeap[id];
        }
    }
}

function getRoomLedger(target) {
    const heap = getHeap();
    const rName = target && target.pos && target.pos.roomName ? target.pos.roomName : (target && target.room ? target.room.name : null);
    if (rName && heap.rooms && heap.rooms[rName]) {
        if (!heap.rooms[rName].ledger) heap.rooms[rName].ledger = {};
        return heap.rooms[rName].ledger;
    }
    if (!heap.ledger) heap.ledger = {};
    return heap.ledger;
}

function resetTickLedger(primaryRoom) {
    const heap = getHeap();
    heap.ledger = {};
    heap.trafficIntents = {};
    if (primaryRoom && primaryRoom.name && heap.rooms && heap.rooms[primaryRoom.name]) {
        heap.rooms[primaryRoom.name].ledger = {};
    }
    heap.spawnEnergy = primaryRoom ? primaryRoom.energyAvailable : 0;
}

function reserveWithdraw(id, amount, roomName) {
    const heap = getHeap();
    const qty = amount || 0;
    if (roomName && heap.rooms && heap.rooms[roomName] && heap.rooms[roomName].ledger) {
        heap.rooms[roomName].ledger[id] = (heap.rooms[roomName].ledger[id] || 0) - qty;
    }
    if (!heap.ledger) heap.ledger = {};
    heap.ledger[id] = (heap.ledger[id] || 0) - qty;
}

function reserveTransfer(id, amount, roomName) {
    const heap = getHeap();
    const qty = amount || 0;
    if (roomName && heap.rooms && heap.rooms[roomName] && heap.rooms[roomName].ledger) {
        heap.rooms[roomName].ledger[id] = (heap.rooms[roomName].ledger[id] || 0) + qty;
    }
    if (!heap.ledger) heap.ledger = {};
    heap.ledger[id] = (heap.ledger[id] || 0) + qty;
}

function registerIntent(creep, action, target, amount) {
    if (!target || action === 'move' || action === 'moveTo') return;
    const targetId = target.id ? target.id : target;
    const rName = (target.pos && target.pos.roomName) || (creep && creep.room && creep.room.name) || null;
    const qty = typeof amount === 'number'
        ? amount
        : (creep && creep.store
            ? (action === 'transfer' ? creep.store.getUsedCapacity(RESOURCE_ENERGY) : creep.store.getFreeCapacity(RESOURCE_ENERGY))
            : 50);

    if (action === 'transfer') {
        reserveTransfer(targetId, qty, rName);
    } else if (action === 'withdraw' || action === 'pickup') {
        reserveWithdraw(targetId, qty, rName);
    }

    if (creep) {
        if (!creep.heap) creep.heap = createCreepHeap();
        creep.heap.targetId = targetId;
        creep.heap.targetInt = getOrCreateIntId(targetId);
        creep.heap.actionIntent = action;
        creep.heap.intent = { action, targetId, amount: qty, tick: Game.time };
    }
}

function getEffectiveStore(target, resource = RESOURCE_ENERGY) {
    if (!target) return 0;
    const actualAmount = target.store
        ? (target.store[resource] || 0)
        : (target.amount !== undefined ? target.amount : (target.energy || 0));
    const ledger = getRoomLedger(target);
    const delta = (target.id && ledger[target.id]) ? ledger[target.id] : 0;
    return Math.max(0, actualAmount + delta);
}

function getEffectiveFreeCapacity(target, resource = RESOURCE_ENERGY) {
    if (!target || !target.store) return 0;
    const actualFree = target.store.getFreeCapacity ? (target.store.getFreeCapacity(resource) || 0) : 0;
    const ledger = getRoomLedger(target);
    const delta = (target.id && ledger[target.id]) ? ledger[target.id] : 0;
    return Math.max(0, actualFree - delta);
}

function computeSourceSpots(room, sources) {
    const heap = getHeap();
    if (!heap.sourceSpots[room.name]) {
        const spotsBySource = {};
        const terrain = room.getTerrain ? room.getTerrain() : (typeof Game !== 'undefined' && Game.map ? Game.map.getRoomTerrain(room.name) : null);
        const spawns = room.find ? room.find(FIND_MY_SPAWNS) : [];
        const spPos = spawns.length > 0 ? spawns[0].pos : null;
        for (let i = 0; i < sources.length; i++) {
            const src = sources[i];
            const spots = [];
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const x = src.pos.x + dx;
                    const y = src.pos.y + dy;
                    if (spPos && x === spPos.x && y === spPos.y) continue;
                    if (x > 0 && x < 49 && y > 0 && y < 49 && (!terrain || terrain.get(x, y) !== TERRAIN_MASK_WALL)) {
                        spots.push({ x, y });
                    }
                }
            }
            spotsBySource[src.id] = spots;
        }
        heap.sourceSpots[room.name] = spotsBySource;
    }
    return heap.sourceSpots[room.name];
}

function computeUpgradePositions(room, staticRoom) {
    if (!room || !room.controller) return [];
    if (staticRoom && staticRoom.upgradePositions) return staticRoom.upgradePositions;
    const terrain = room.getTerrain ? room.getTerrain() : (typeof Game !== 'undefined' && Game.map ? Game.map.getRoomTerrain(room.name) : null);
    const ctrlPos = room.controller.pos;
    const anchor = (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[room.name] && Memory.rooms[room.name].anchor)
        ? Memory.rooms[room.name].anchor
        : { x: 25, y: 25 };
    const candidates = [];
    for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            if (dist < 2 || dist > 3) continue; // range 2-3 arc around controller
            const x = ctrlPos.x + dx;
            const y = ctrlPos.y + dy;
            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
            if (terrain && terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            candidates.push({ x, y, dist: calcDistance({ x, y }, anchor), cDist: dist });
        }
    }
    candidates.sort((a, b) => (a.cDist - b.cDist) || (a.dist - b.dist));
    const result = candidates.slice(0, 6).map(p => ({ x: p.x, y: p.y, roomName: room.name }));
    if (staticRoom) staticRoom.upgradePositions = result;
    return result;
}

function computeControllerDockAndArc(room, staticRoom, s) {
    if (!room || !s.controller) return;
    const cPos = s.controllerContainer
        ? s.controllerContainer.pos
        : (s.upgradePositions && s.upgradePositions.length > 0 ? s.upgradePositions[0] : null);
    s.controllerContainerPos = cPos;
    if (!cPos) {
        s.controllerDockTiles = null;
        s.controllerDockPosList = [];
        s.upgradeArcTiles = s.upgradePositions || [];
        return;
    }

    const posKey = `${cPos.x},${cPos.y}`;
    if (staticRoom && staticRoom.dockContainerPosKey === posKey && staticRoom.controllerDockTiles) {
        s.controllerDockTiles = staticRoom.controllerDockTiles;
        s.controllerDockPosList = staticRoom.controllerDockPosList;
        s.upgradeArcTiles = staticRoom.upgradeArcTiles;
        return;
    }

    const terrain = room.getTerrain ? room.getTerrain() : (typeof Game !== 'undefined' && Game.map ? Game.map.getRoomTerrain(room.name) : null);
    const anchor = (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[room.name] && Memory.rooms[room.name].anchor)
        ? Memory.rooms[room.name].anchor
        : (s.spawns && s.spawns.length > 0 ? s.spawns[0].pos : { x: 25, y: 25 });
    const ctrlPos = s.controller.pos;

    const ring1 = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const x = cPos.x + dx;
            const y = cPos.y + dy;
            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
            if (terrain && terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            ring1.push({ x, y, roomName: room.name, dAnchor: calcDistance({ x, y }, anchor), dCtrl: calcDistance({ x, y }, ctrlPos) });
        }
    }
    ring1.sort((a, b) => a.dAnchor - b.dAnchor);

    const dockArr = new Uint16Array(2);
    dockArr[0] = 65535;
    dockArr[1] = 65535;
    const dockPosList = [];
    const dockSet = new Set();

    // Reserve up to 2 front-facing tiles as Loading Dock (keep at least 1 tile for upgrade arc if <= 2 walkable)
    const maxDock = ring1.length > 2 ? 2 : (ring1.length > 1 ? 1 : 0);
    for (let i = 0; i < maxDock; i++) {
        dockArr[i] = ring1[i].x * 50 + ring1[i].y;
        dockPosList.push({ x: ring1[i].x, y: ring1[i].y, roomName: room.name });
        dockSet.add(dockArr[i]);
    }

    const arc1 = [];
    for (let i = 0; i < ring1.length; i++) {
        const pt = ring1[i];
        const packed = pt.x * 50 + pt.y;
        if (dockSet.has(packed)) continue;
        if (pt.dCtrl <= 3) arc1.push(pt);
    }
    arc1.sort((a, b) => a.dCtrl - b.dCtrl);

    const arc2 = [];
    for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== 2) continue;
            const x = cPos.x + dx;
            const y = cPos.y + dy;
            if (x < 2 || x > 47 || y < 2 || y > 47) continue;
            if (terrain && terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
            const packed = x * 50 + y;
            if (dockSet.has(packed)) continue;
            const dCtrl = calcDistance({ x, y }, ctrlPos);
            if (dCtrl <= 3) arc2.push({ x, y, roomName: room.name, dCtrl, rangeToCont: 2 });
        }
    }
    arc2.sort((a, b) => a.dCtrl - b.dCtrl);

    const upgradeArc = arc1.map(p => ({ x: p.x, y: p.y, roomName: room.name, rangeToCont: 1 })).concat(arc2);

    if (staticRoom) {
        staticRoom.dockContainerPosKey = posKey;
        staticRoom.controllerDockTiles = dockArr;
        staticRoom.controllerDockPosList = dockPosList;
        staticRoom.upgradeArcTiles = upgradeArc;
    }
    s.controllerDockTiles = dockArr;
    s.controllerDockPosList = dockPosList;
    s.upgradeArcTiles = upgradeArc;
}

function scanRoom(room) {
    const heap = getHeap();
    if (!heap.staticRooms) heap.staticRooms = {};

    let staticRoom = heap.staticRooms[room.name];
    const hasPreBuckets = (heap._preBucketTick === Game.time);
    const sites = hasPreBuckets
        ? ((heap._sitesByRoom && heap._sitesByRoom[room.name]) || [])
        : (room.find ? room.find(FIND_MY_CONSTRUCTION_SITES) : []);
    const evDestroyed = (typeof global !== 'undefined' && global.EVENT_OBJECT_DESTROYED) ? global.EVENT_OBJECT_DESTROYED : 2;

    const isEnemyOwned = !!(room.controller && room.controller.owner && !room.controller.my);
    const maxStaticAge = isEnemyOwned ? 10 : 30;
    let needStaticRefresh = false;
    if (!staticRoom || !staticRoom.valid || (Game.time - staticRoom.lastRefresh) >= maxStaticAge) {
        needStaticRefresh = true;
    } else if (sites.length < (staticRoom.prevSitesCount || 0)) {
        needStaticRefresh = true; // Construction site completed
    } else if ((staticRoom.hadHostiles || (staticRoom.hostileStructureIds && staticRoom.hostileStructureIds.length > 0)) && room.getEventLog) {
        const events = room.getEventLog();
        for (let i = 0; i < events.length; i++) {
            if (events[i].event === evDestroyed) {
                needStaticRefresh = true;
                break;
            }
        }
    }

    if (needStaticRefresh) {
        const rawStructures = room.find(FIND_STRUCTURES);
        staticRoom = {
            valid: true,
            lastRefresh: Game.time,
            prevSitesCount: sites.length,
            spawnIds: [],
            extensionIds: [],
            containerIds: [],
            linkIds: [],
            towerIds: [],
            labIds: [],
            powerSpawnIds: [],
            storageId: null,
            terminalId: null,
            factoryId: null,
            nukerId: null,
            observerId: null,
            extractorId: null,
            rampartIds: [],
            wallIds: [],
            roadIds: [],
            keeperLairIds: [],
            hostileStructureIds: [],
            invaderCoreId: null,
            energyStructureIds: [],
            roadGrid: new Uint8Array(2500),
            roadIndexGrid: new Uint16Array(2500),
            rampartGrid: new Uint8Array(2500)
        };
        const isUnownedOrHostileRoom = !room.controller || !room.controller.my;
        for (let i = 0; i < rawStructures.length; i++) {
            const o = rawStructures[i];
            if (o.structureType === STRUCTURE_WALL) {
                staticRoom.wallIds.push(o.id);
                if (isUnownedOrHostileRoom) staticRoom.hostileStructureIds.push(o.id);
            } else if (o.my === false && o.structureType !== STRUCTURE_CONTROLLER) {
                staticRoom.hostileStructureIds.push(o.id);
            }
            if (o.structureType === 'keeperLair' || (typeof global !== 'undefined' && global.STRUCTURE_KEEPER_LAIR && o.structureType === global.STRUCTURE_KEEPER_LAIR)) {
                staticRoom.keeperLairIds.push(o.id);
            }
            if (o.structureType === 'invaderCore' || (typeof global !== 'undefined' && global.STRUCTURE_INVADER_CORE && o.structureType === global.STRUCTURE_INVADER_CORE)) {
                staticRoom.invaderCoreId = o.id;
            }
            switch (o.structureType) {
                case STRUCTURE_SPAWN: if (o.my) staticRoom.spawnIds.push(o.id); break;
                case STRUCTURE_EXTENSION: if (o.my) staticRoom.extensionIds.push(o.id); break;
                case STRUCTURE_CONTAINER: staticRoom.containerIds.push(o.id); break;
                case STRUCTURE_LINK: if (o.my) staticRoom.linkIds.push(o.id); break;
                case STRUCTURE_TOWER: if (o.my) staticRoom.towerIds.push(o.id); break;
                case STRUCTURE_LAB: if (o.my) staticRoom.labIds.push(o.id); break;
                case STRUCTURE_POWER_SPAWN: if (o.my) staticRoom.powerSpawnIds.push(o.id); break;
                case STRUCTURE_STORAGE: if (o.my) staticRoom.storageId = o.id; break;
                case STRUCTURE_TERMINAL: if (o.my) staticRoom.terminalId = o.id; break;
                case STRUCTURE_FACTORY: if (o.my) staticRoom.factoryId = o.id; break;
                case STRUCTURE_NUKER: if (o.my) staticRoom.nukerId = o.id; break;
                case STRUCTURE_OBSERVER: if (o.my) staticRoom.observerId = o.id; break;
                case STRUCTURE_EXTRACTOR: if (o.my) staticRoom.extractorId = o.id; break;
                case STRUCTURE_RAMPART:
                    if (o.my) {
                        staticRoom.rampartIds.push(o.id);
                        staticRoom.rampartGrid[o.pos.x * 50 + o.pos.y] = 1;
                    }
                    break;
                case STRUCTURE_ROAD: {
                    const rIdx = staticRoom.roadIds.push(o.id);
                    const tIdx = o.pos.x * 50 + o.pos.y;
                    staticRoom.roadGrid[tIdx] = 1;
                    staticRoom.roadIndexGrid[tIdx] = rIdx;
                    break;
                }
                default: break;
            }
        }

        // Sort extensions: 15 Core FAST_FILLER_STAMP extensions first, then outer extensions sorted by distance to anchor
        const anchor = (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[room.name] && Memory.rooms[room.name].anchor)
            ? Memory.rooms[room.name].anchor
            : (staticRoom.spawnIds.length > 0 ? (Game.getObjectById(staticRoom.spawnIds[0]) ? Game.getObjectById(staticRoom.spawnIds[0]).pos : null) : null);

        if (anchor && staticRoom.extensionIds.length > 0) {
            const rawExts = [];
            for (let i = 0; i < staticRoom.extensionIds.length; i++) {
                const extObj = Game.getObjectById(staticRoom.extensionIds[i]);
                if (extObj) rawExts.push(extObj);
            }
            const coreExts = [];
            const outerExts = [];
            for (let i = 0; i < rawExts.length; i++) {
                const ext = rawExts[i];
                if (Math.abs(ext.pos.x - anchor.x) <= 2 && Math.abs(ext.pos.y - anchor.y) <= 2) {
                    coreExts.push(ext);
                } else {
                    outerExts.push(ext);
                }
            }
            outerExts.sort((a, b) => calcDistance(a.pos, anchor) - calcDistance(b.pos, anchor));
            const coreIds = coreExts.map(e => e.id);
            const outerIds = outerExts.map(e => e.id);
            staticRoom.coreExtCount = coreIds.length;
            staticRoom.extensionIds = coreIds.concat(outerIds);
            // Reverse Draw Priority: 15 Core Extensions -> 3 Spawns -> Outer Extensions
            staticRoom.energyStructureIds = coreIds.concat(staticRoom.spawnIds, outerIds);
        } else {
            staticRoom.coreExtCount = 0;
            staticRoom.energyStructureIds = staticRoom.spawnIds.concat(staticRoom.extensionIds);
        }

        staticRoom.energySynced = false;
        heap.staticRooms[room.name] = staticRoom;
    } else {
        staticRoom.prevSitesCount = sites.length;
    }

    if (!heap.sourceIds) heap.sourceIds = {};
    let sources = null;
    if (heap.sourceIds[room.name]) {
        sources = [];
        const sIds = heap.sourceIds[room.name];
        for (let i = 0; i < sIds.length; i++) {
            const obj = Game.getObjectById(sIds[i]);
            if (obj) sources.push(obj);
        }
    }
    if (!sources || sources.length === 0) {
        sources = room.find(FIND_SOURCES);
        heap.sourceIds[room.name] = sources.map(s => s.id);
    }

    if (!heap.mineralIds) heap.mineralIds = {};
    let mineral = null;
    if (heap.mineralIds[room.name]) {
        mineral = Game.getObjectById(heap.mineralIds[room.name]);
    }
    if (!mineral) {
        const minerals = room.find(FIND_MINERALS);
        mineral = minerals.length ? minerals[0] : null;
        if (mineral) heap.mineralIds[room.name] = mineral.id;
    }

function classifyRoomLabs(room, staticRoom, heap, resolveIds) {
    const labIds = staticRoom.labIds || [];
    if (labIds.length === 0) {
        staticRoom.supplierLabIds = [];
        staticRoom.reactorLabIds = [];
        staticRoom.labHallway = null;
        return { supplierLabs: [], reactorLabs: [], allLabs: [], labHallway: [] };
    }

    const bp = (heap.blueprints && heap.blueprints[room.name]) ||
        (typeof global !== 'undefined' && typeof global.getRoomBlueprint === 'function' ? global.getRoomBlueprint(room) : null);
    const hasBpLabs = !!(bp && Array.isArray(bp.supplierLabs) && bp.supplierLabs.length >= 2);

    if (staticRoom.labClassifyIdsLen === labIds.length &&
        Array.isArray(staticRoom.supplierLabIds) &&
        (!hasBpLabs || staticRoom.labBpClassified)) {
        return {
            supplierLabs: resolveIds(staticRoom.supplierLabIds),
            reactorLabs: resolveIds(staticRoom.reactorLabIds || []),
            allLabs: resolveIds(staticRoom.orderedLabIds || labIds),
            labHallway: staticRoom.labHallway || []
        };
    }

    const rawLabs = resolveIds(labIds);
    const supplierLabs = [];
    const reactorLabs = [];
    const usedIds = new Set();

    if (hasBpLabs) {
        for (let sIdx = 0; sIdx < bp.supplierLabs.length && supplierLabs.length < 2; sIdx++) {
            const target = bp.supplierLabs[sIdx];
            const match = rawLabs.find(l => !usedIds.has(l.id) && l.pos && l.pos.x === target.x && l.pos.y === target.y);
            if (match) {
                supplierLabs.push(match);
                usedIds.add(match.id);
            }
        }
        if (Array.isArray(bp.reactorLabs) && bp.reactorLabs.length > 0) {
            for (let rIdx = 0; rIdx < bp.reactorLabs.length; rIdx++) {
                const target = bp.reactorLabs[rIdx];
                const match = rawLabs.find(l => !usedIds.has(l.id) && l.pos && l.pos.x === target.x && l.pos.y === target.y);
                if (match) {
                    reactorLabs.push(match);
                    usedIds.add(match.id);
                }
            }
        }
    }

    // Geometric fallback for synthetic/non-blueprint labs: pick the diagonal pair within range 2 of all labs
    if (supplierLabs.length < 2 && rawLabs.length >= 3) {
        let bestPair = null;
        for (let i = 0; i < rawLabs.length && !bestPair; i++) {
            for (let j = i + 1; j < rawLabs.length && !bestPair; j++) {
                const a = rawLabs[i];
                const b = rawLabs[j];
                if (!a.pos || !b.pos) continue;
                if (Math.abs(a.pos.x - b.pos.x) === 1 && Math.abs(a.pos.y - b.pos.y) === 1) {
                    const reachesAll = rawLabs.every(other =>
                        other.id === a.id || other.id === b.id ||
                        (calcDistance(a.pos, other.pos) <= 2 && calcDistance(b.pos, other.pos) <= 2)
                    );
                    if (reachesAll) bestPair = [a, b];
                }
            }
        }
        if (bestPair) {
            supplierLabs.length = 0;
            reactorLabs.length = 0;
            usedIds.clear();
            supplierLabs.push(bestPair[0], bestPair[1]);
            usedIds.add(bestPair[0].id);
            usedIds.add(bestPair[1].id);
        }
    }

    for (let i = 0; i < rawLabs.length; i++) {
        const lab = rawLabs[i];
        if (usedIds.has(lab.id)) continue;
        if (supplierLabs.length < 2 && (!hasBpLabs || supplierLabs.length === 0)) {
            supplierLabs.push(lab);
        } else {
            reactorLabs.push(lab);
        }
        usedIds.add(lab.id);
    }

    const orderedLabs = supplierLabs.concat(reactorLabs);
    let labHallway = [];
    if (bp && Array.isArray(bp.labHallway) && bp.labHallway.length > 0) {
        labHallway = bp.labHallway.map(pt => ({ x: pt.x, y: pt.y, roomName: room.name }));
    } else if (supplierLabs.length === 2 && supplierLabs[0].pos && supplierLabs[1].pos) {
        labHallway = [
            { x: supplierLabs[0].pos.x, y: supplierLabs[1].pos.y, roomName: room.name },
            { x: supplierLabs[1].pos.x, y: supplierLabs[0].pos.y, roomName: room.name }
        ];
    }

    staticRoom.supplierLabIds = supplierLabs.map(l => l.id);
    staticRoom.reactorLabIds = reactorLabs.map(l => l.id);
    staticRoom.orderedLabIds = orderedLabs.map(l => l.id);
    staticRoom.labHallway = labHallway;
    staticRoom.labClassifyIdsLen = labIds.length;
    staticRoom.labBpClassified = hasBpLabs && supplierLabs.length === 2;

    return { supplierLabs, reactorLabs, allLabs: orderedLabs, labHallway };
}

function resolveIds(ids) {
    const res = [];
    for (let i = 0; i < ids.length; i++) {
        const obj = Game.getObjectById(ids[i]);
        if (obj) res.push(obj);
    }
    return res;
}

    const resolvedSpawns = resolveIds(staticRoom.spawnIds);
    const resolvedExtensions = resolveIds(staticRoom.extensionIds);
    const coreCount = staticRoom.coreExtCount || 0;
    const resolvedEnergyStructures = (resolvedExtensions.length === staticRoom.extensionIds.length && coreCount > 0 && resolvedExtensions.length >= coreCount)
        ? resolvedExtensions.slice(0, coreCount).concat(resolvedSpawns, resolvedExtensions.slice(coreCount))
        : (resolvedExtensions.length === staticRoom.extensionIds.length
            ? resolvedSpawns.concat(resolvedExtensions)
            : resolveIds(staticRoom.energyStructureIds));
    const labClassification = classifyRoomLabs(room, staticRoom, heap, resolveIds);
    const resolvedContainers = resolveIds(staticRoom.containerIds);
    let resolvedRoadsCache = null;
    let resolvedRampartsCache = null;

    const s = {
        name: room.name,
        controller: room.controller || null,
        storage: room.storage || (staticRoom.storageId ? Game.getObjectById(staticRoom.storageId) : null),
        terminal: room.terminal || (staticRoom.terminalId ? Game.getObjectById(staticRoom.terminalId) : null),
        factory: staticRoom.factoryId ? Game.getObjectById(staticRoom.factoryId) : null,
        nuker: staticRoom.nukerId ? Game.getObjectById(staticRoom.nukerId) : null,
        observer: staticRoom.observerId ? Game.getObjectById(staticRoom.observerId) : null,
        extractor: staticRoom.extractorId ? Game.getObjectById(staticRoom.extractorId) : null,
        sources: sources,
        mineral: mineral,
        spawns: resolvedSpawns,
        extensions: resolvedExtensions,
        containers: resolvedContainers,
        mineralContainer: mineral ? (resolvedContainers.find(cnt => calcDistance(cnt.pos, mineral.pos) <= 1) || null) : null,
        links: resolveIds(staticRoom.linkIds),
        towers: resolveIds(staticRoom.towerIds),
        labs: labClassification.allLabs,
        supplierLabs: labClassification.supplierLabs,
        reactorLabs: labClassification.reactorLabs,
        labHallway: labClassification.labHallway,
        powerSpawns: resolveIds(staticRoom.powerSpawnIds),
        keeperLairs: resolveIds(staticRoom.keeperLairIds),
        hostileStructures: resolveIds(staticRoom.hostileStructureIds),
        walls: resolveIds(staticRoom.wallIds || []),
        hostileTowers: [],
        hostileSpawns: [],
        primaryTargetInt: 0,
        breachTargetInt: 0,
        invaderCore: staticRoom.invaderCoreId ? Game.getObjectById(staticRoom.invaderCoreId) : null,
        spawnIds: staticRoom.spawnIds,
        extensionIds: staticRoom.extensionIds,
        energyStructures: resolvedEnergyStructures,
        energyStructureIds: staticRoom.energyStructureIds,
        containerIds: staticRoom.containerIds,
        linkIds: staticRoom.linkIds,
        towerIds: staticRoom.towerIds,
        labIds: staticRoom.labIds,
        rampartIds: staticRoom.rampartIds,
        roadIds: staticRoom.roadIds,
        roadGrid: staticRoom.roadGrid,
        roadIndexGrid: staticRoom.roadIndexGrid,
        rampartGrid: staticRoom.rampartGrid,
        droppedEnergy: [],
        droppedResources: [],
        lootTargets: [],
        ruins: [],
        tombstones: [],
        constructionSites: sites,
        hostiles: [],
        armedHostiles: [],
        creeps: [],
        powerCreeps: [],
        creepsByRole: {},
        sourceSpots: computeSourceSpots(room, sources),
        upgradePositions: computeUpgradePositions(room, staticRoom),
        containerBySource: {},
        controllerContainer: null,
        ledger: {}
    };
    for (let hsIdx = 0; hsIdx < s.hostileStructures.length; hsIdx++) {
        const hs = s.hostileStructures[hsIdx];
        if (hs.structureType === STRUCTURE_TOWER) s.hostileTowers.push(hs);
        else if (hs.structureType === STRUCTURE_SPAWN) s.hostileSpawns.push(hs);
    }
    if (!heap.labReactions) heap.labReactions = {};
    if (!heap.labReactions[room.name]) {
        heap.labReactions[room.name] = { activeReaction: null, missingBaseMinerals: [], nextDagCheck: 0 };
    }
    const labHeap = heap.labReactions[room.name];
    Object.defineProperty(s, 'activeReaction', {
        get() { return labHeap.activeReaction; },
        set(val) { labHeap.activeReaction = val; },
        configurable: true,
        enumerable: true
    });
    Object.defineProperty(s, 'missingBaseMinerals', {
        get() { return labHeap.missingBaseMinerals; },
        set(val) { labHeap.missingBaseMinerals = val; },
        configurable: true,
        enumerable: true
    });
    Object.defineProperty(s, 'roads', {
        get() {
            if (!resolvedRoadsCache) resolvedRoadsCache = resolveIds(staticRoom.roadIds);
            return resolvedRoadsCache;
        },
        set(val) {
            resolvedRoadsCache = val;
        },
        configurable: true,
        enumerable: true
    });
    Object.defineProperty(s, 'ramparts', {
        get() {
            if (!resolvedRampartsCache) resolvedRampartsCache = resolveIds(staticRoom.rampartIds);
            return resolvedRampartsCache;
        },
        set(val) {
            resolvedRampartsCache = val;
        },
        configurable: true,
        enumerable: true
    });

    // Staggered 20-tick resync for flat Uint16Array extension/spawn energy ledgers and 64-bit dirty bitmask
    // Stored on staticRoom (persistent across ticks, unlike heap.rooms which resets every tick)
    if (!staticRoom.extensionEnergy || staticRoom.extensionEnergy.length !== 60) {
        staticRoom.extensionEnergy = new Uint16Array(60);
    }
    if (!staticRoom.spawnEnergy || staticRoom.spawnEnergy.length !== 3) {
        staticRoom.spawnEnergy = new Uint16Array(3);
    }
    if (!staticRoom.extDirtyMask || staticRoom.extDirtyMask.length !== 2) {
        staticRoom.extDirtyMask = new Uint32Array(2);
    }

    const roomHash = (room.name.charCodeAt(0) * 31 + room.name.charCodeAt(room.name.length - 1)) % 20;
    const isResyncTick = (Game.time % 20 === roomHash) || !staticRoom.energySynced;

    if (isResyncTick) {
        staticRoom.extDirtyMask[0] = 0;
        staticRoom.extDirtyMask[1] = 0;
        for (let i = 0; i < s.extensions.length; i++) {
            const ext = s.extensions[i];
            const energy = ext.store ? ext.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
            const cap = ext.store ? ext.store.getCapacity(RESOURCE_ENERGY) : 50;
            staticRoom.extensionEnergy[i] = energy;
            if (energy < cap) {
                staticRoom.extDirtyMask[i >> 5] |= (1 << (i & 31));
            }
        }
        for (let i = 0; i < s.spawns.length; i++) {
            const sp = s.spawns[i];
            staticRoom.spawnEnergy[i] = sp.store ? sp.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
        }
        staticRoom.energySynced = true;
    }
    s.extensionEnergy = staticRoom.extensionEnergy;
    s.spawnEnergy = staticRoom.spawnEnergy;
    s.extDirtyMask = staticRoom.extDirtyMask;

    const myUsername = resolveMyUsername();
    const rawHostiles = room.find(FIND_HOSTILE_CREEPS);
    s.hostiles = myUsername ? rawHostiles.filter(h => !h.my && (!h.owner || h.owner.username !== myUsername)) : rawHostiles;
    staticRoom.hadHostiles = s.hostiles.length > 0;

    s.armedHostiles = (s.hostiles || []).filter(h => h.getActiveBodyparts && (
        h.getActiveBodyparts(ATTACK) > 0 ||
        h.getActiveBodyparts(RANGED_ATTACK) > 0 ||
        h.getActiveBodyparts(HEAL) > 0 ||
        h.getActiveBodyparts(WORK) > 0
    ));

    if (typeof Memory !== 'undefined' && Memory.rooms) {
        if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
        if (s.armedHostiles.length > 0 || s.invaderCore) {
            Memory.rooms[room.name].threat = {
                hasArmedHostiles: true,
                count: s.armedHostiles.length + (s.invaderCore ? 1 : 0),
                expiresAt: Game.time + 100
            };
            if (heap.remoteRooms && heap.remoteRooms[room.name]) {
                heap.remoteRooms[room.name].safe = false;
            }
        } else if (Memory.rooms[room.name].threat && s.hostiles.length === 0 && !s.invaderCore) {
            delete Memory.rooms[room.name].threat;
            if (heap.remoteRooms && heap.remoteRooms[room.name]) {
                heap.remoteRooms[room.name].safe = true;
            }
        }
    }

    s.sources = s.sources.filter(src => !s.sourceSpots[src.id] || s.sourceSpots[src.id].length > 0);
    if (s.sources.length > 1 && s.spawns.length > 0) {
        const sp = s.spawns[0];
        s.sources.sort((a, b) => calcDistance(a.pos, sp.pos) - calcDistance(b.pos, sp.pos));
    }

    for (let i = 0; i < s.sources.length; i++) {
        const src = s.sources[i];
        s.containerBySource[src.id] = s.containers.find(cnt => calcDistance(cnt.pos, src.pos) <= 1) || null;
    }
    if (s.controller) {
        s.controllerContainer = s.containers.find(cnt => calcDistance(cnt.pos, s.controller.pos) <= 3) || null;
        if (s.controller.my) {
            computeControllerDockAndArc(room, staticRoom, s);
        }
    }
    s.controllerIncomingEnergy = 0;

    const isSafeRemoteRoom = !(room.controller && room.controller.my) && s.armedHostiles.length === 0;
    const remoteThrottleOk = !isSafeRemoteRoom || !staticRoom.lastRemoteScan || (Game.time - staticRoom.lastRemoteScan) >= 10 || needStaticRefresh;

    if (remoteThrottleOk) {
        const dropped = room.find(FIND_DROPPED_RESOURCES);
        staticRoom.droppedIds = [];
        for (let i = 0; i < dropped.length; i++) {
            if (dropped[i].resourceType !== RESOURCE_ENERGY) {
                s.droppedResources.push(dropped[i]);
                staticRoom.droppedIds.push(dropped[i].id);
            } else if (dropped[i].amount >= 5) {
                s.droppedEnergy.push(dropped[i]);
                staticRoom.droppedIds.push(dropped[i].id);
            }
        }
        if (isSafeRemoteRoom) staticRoom.lastRemoteScan = Game.time;
    } else if (staticRoom.droppedIds) {
        for (let i = 0; i < staticRoom.droppedIds.length; i++) {
            const d = Game.getObjectById(staticRoom.droppedIds[i]);
            if (!d) continue;
            if (d.resourceType !== RESOURCE_ENERGY) s.droppedResources.push(d);
            else if (d.amount >= 5) s.droppedEnergy.push(d);
        }
    }

    const myCreeps = hasPreBuckets
        ? ((heap._creepsByRoom && heap._creepsByRoom[room.name]) || [])
        : (room.find ? room.find(FIND_MY_CREEPS) : []);
    s.creeps = myCreeps;
    for (let i = 0; i < myCreeps.length; i++) {
        const c = myCreeps[i];
        if (!c.heap) c.heap = {};
        let role = c.memory && c.memory.role;
        if (!role && c.name && c.name.indexOf('_') > 0) {
            const prefix = c.name.split('_')[0];
            if (ROLE_ID[prefix] !== undefined) {
                role = prefix;
                if (c.memory) c.memory.role = prefix;
                markMemoryDirty();
            }
        }
        role = role || 'unknown';
        if (c.heap.roleId === undefined || c.heap.roleId === 255) {
            c.heap.roleId = ROLE_ID[role] !== undefined ? ROLE_ID[role] : 255;
            c.heap.role = role;
        }
        if (!c.heap.targetRoom && c.memory && c.memory.targetRoom) {
            c.heap.targetRoom = c.memory.targetRoom;
        }
        if (!s.creepsByRole[role]) s.creepsByRole[role] = [];
        s.creepsByRole[role].push(c);
    }

    const getStoreUsed = (st) => {
        if (!st) return 0;
        if (typeof st.getUsedCapacity === 'function') return st.getUsedCapacity() || 0;
        let sum = 0;
        for (const k in st) sum += st[k] || 0;
        return sum;
    };

    const postCombatClear = (s.armedHostiles.length === 0 && staticRoom.hadArmedHostiles);
    const tombInterval = isSafeRemoteRoom ? 10 : 5;
    const needTombScan = !staticRoom.lastTombScan || (Game.time - staticRoom.lastTombScan) >= tombInterval ||
        postCombatClear || s.hostiles.length > 0 || myCreeps.length < (staticRoom.lastCreepCount || 0) || needStaticRefresh;
    if (needTombScan) {
        const ruins = room.find(FIND_RUINS);
        staticRoom.ruinIds = [];
        for (let i = 0; i < ruins.length; i++) {
            try {
                if (ruins[i].store && getStoreUsed(ruins[i].store) > 0) {
                    s.ruins.push(ruins[i]);
                    staticRoom.ruinIds.push(ruins[i].id);
                }
            } catch (_) {}
        }
        const tombs = room.find(FIND_TOMBSTONES);
        staticRoom.tombstoneIds = [];
        for (let i = 0; i < tombs.length; i++) {
            try {
                if (tombs[i].store && getStoreUsed(tombs[i].store) > 0) {
                    s.tombstones.push(tombs[i]);
                    staticRoom.tombstoneIds.push(tombs[i].id);
                }
            } catch (_) {}
        }
        staticRoom.lastTombScan = Game.time;
    } else {
        const rIds = staticRoom.ruinIds || [];
        for (let i = 0; i < rIds.length; i++) {
            const obj = Game.getObjectById(rIds[i]);
            try {
                if (obj && obj.store && getStoreUsed(obj.store) > 0) s.ruins.push(obj);
            } catch (_) {}
        }
        const tIds = staticRoom.tombstoneIds || [];
        for (let i = 0; i < tIds.length; i++) {
            const obj = Game.getObjectById(tIds[i]);
            try {
                if (obj && obj.store && getStoreUsed(obj.store) > 0) s.tombstones.push(obj);
            } catch (_) {}
        }
    }
    staticRoom.hadArmedHostiles = s.armedHostiles.length > 0;
    staticRoom.lastCreepCount = myCreeps.length;

    // Build sorted roomState.lootTargets (empty while armedHostiles > 0; non-energy first, suppress < 50 pure-energy scraps)
    if (s.armedHostiles.length === 0) {
        const lootMeta = [];
        const addStoreLoot = (obj) => {
            if (!obj || !obj.store) return;
            const total = getStoreUsed(obj.store);
            const energy = obj.store[RESOURCE_ENERGY] || 0;
            const nonEnergy = Math.max(0, total - energy);
            if (nonEnergy === 0 && energy < 50) return;
            lootMeta.push({ obj, nonEnergy, total });
        };
        for (let i = 0; i < s.tombstones.length; i++) addStoreLoot(s.tombstones[i]);
        for (let i = 0; i < s.ruins.length; i++) addStoreLoot(s.ruins[i]);
        for (let i = 0; i < s.droppedResources.length; i++) {
            const d = s.droppedResources[i];
            if (d && d.amount > 0) lootMeta.push({ obj: d, nonEnergy: d.amount, total: d.amount });
        }
        for (let i = 0; i < s.droppedEnergy.length; i++) {
            const d = s.droppedEnergy[i];
            if (d && d.amount >= 50) lootMeta.push({ obj: d, nonEnergy: 0, total: d.amount });
        }
        lootMeta.sort((a, b) => {
            if ((b.nonEnergy > 0) !== (a.nonEnergy > 0)) return b.nonEnergy > 0 ? 1 : -1;
            return b.total - a.total;
        });
        for (let i = 0; i < lootMeta.length; i++) {
            s.lootTargets.push(lootMeta[i].obj);
        }
    }

    if (typeof Game !== 'undefined' && Game.powerCreeps) {
        for (const name in Game.powerCreeps) {
            const pc = Game.powerCreeps[name];
            if (pc && pc.ticksToLive && pc.room && pc.room.name === room.name) {
                if (!pc.heap) pc.heap = {};
                if (pc.heap.roleId === undefined) {
                    pc.heap.roleId = 32;
                    pc.heap.role = 'operator';
                }
                s.powerCreeps.push(pc);
            }
        }
    }

    s.bootstrapMode = getBootstrapMode(room, s);
    heap.rooms[room.name] = s;
    return s;
}

function getBootstrapMode(room, s) {
    if (!room || !room.controller || !room.controller.my) return 0;
    const byRole = s.creepsByRole || {};
    const harvesters = byRole.harvester ? byRole.harvester.length : 0;
    const haulers = byRole.hauler ? byRole.hauler.length : 0;
    const fastFillers = byRole.fastFiller ? byRole.fastFiller.length : 0;
    const distributors = byRole.distributor ? byRole.distributor.length : 0;
    const pioneers = byRole.pioneer ? byRole.pioneer.length : 0;

    if (harvesters === 0 && haulers === 0 && pioneers === 0) {
        return 1; // COLD_START_SPRINT
    }
    const totalLogistics = haulers + fastFillers + distributors;
    if (totalLogistics === 0) {
        const storageE = (s.storage && s.storage.store) ? (s.storage.store[RESOURCE_ENERGY] || 0) : 0;
        let contE = 0;
        for (let i = 0; i < (s.containers || []).length; i++) {
            contE += (s.containers[i].store ? (s.containers[i].store[RESOURCE_ENERGY] || 0) : 0);
        }
        let dropE = 0;
        for (let i = 0; i < (s.droppedEnergy || []).length; i++) {
            dropE += (s.droppedEnergy[i].amount || 0);
        }
        if (harvesters > 0 || (storageE + contE + dropE) >= 300) {
            return 2; // LOGISTICS_RECOVERY
        }
    }
    return 0; // NORMAL_OPERATIONS
}

function getSafeStructureEnergy(struct) {
    if (!struct) return 0;
    try {
        if (struct.store) return struct.store[RESOURCE_ENERGY] || 0;
    } catch (_) {
        return struct.energy || 0;
    }
    return struct.energy || 0;
}

const BOOST_POWER_MULT = {
    UH: 2, UH2O: 3, XUH2O: 4,
    KO: 2, KHO2: 3, XKHO2: 4,
    LO: 2, LHO2: 3, XLHO2: 4,
    GO: 2, GHO2: 3, XGHO2: 4
};

function getBoostMult(boost) {
    if (!boost) return 1;
    const mapped = BOOST_POWER_MULT[boost];
    if (mapped) return mapped;
    if (boost[0] === 'X') return 4;
    if (boost.indexOf('2') !== -1) return 3;
    return 2;
}

function calcUnitPower(creep) {
    if (!creep) return 0;
    const atkType = typeof ATTACK !== 'undefined' ? ATTACK : 'attack';
    const rngType = typeof RANGED_ATTACK !== 'undefined' ? RANGED_ATTACK : 'ranged_attack';
    const healType = typeof HEAL !== 'undefined' ? HEAL : 'heal';
    const toughType = typeof TOUGH !== 'undefined' ? TOUGH : 'tough';
    let power = 0;

    if (Array.isArray(creep.body)) {
        for (let i = 0; i < creep.body.length; i++) {
            const part = creep.body[i];
            if (!part) continue;
            if (part.hits !== undefined && part.hits <= 0) continue;
            const t = typeof part === 'string' ? part : part.type;
            const boost = typeof part === 'string' ? null : part.boost;
            const mult = boost ? getBoostMult(boost) : 1;
            if (t === atkType) power += 30 * mult;
            else if (t === rngType) power += 20 * mult;
            else if (t === healType) power += 36 * mult;
            else if (t === toughType && boost) power += 15 * mult;
        }
        return power;
    }

    if (creep.getActiveBodyparts) {
        power += (creep.getActiveBodyparts(atkType) || 0) * 30;
        power += (creep.getActiveBodyparts(rngType) || 0) * 20;
        power += (creep.getActiveBodyparts(healType) || 0) * 36;
    }
    return power;
}

function calcBodyPower(body) {
    return Array.isArray(body) ? calcUnitPower({ body }) : 0;
}

function calcRoomHostilePower(roomState) {
    if (!roomState) return { threatPower: 0, activeTowers: 0, armedCount: 0 };
    const myUsername = resolveMyUsername();
    const resEnergy = typeof RESOURCE_ENERGY !== 'undefined' ? RESOURCE_ENERGY : 'energy';
    const twrType = typeof STRUCTURE_TOWER !== 'undefined' ? STRUCTURE_TOWER : 'tower';
    const atkType = typeof ATTACK !== 'undefined' ? ATTACK : 'attack';
    const rngType = typeof RANGED_ATTACK !== 'undefined' ? RANGED_ATTACK : 'ranged_attack';
    const healType = typeof HEAL !== 'undefined' ? HEAL : 'heal';

    let creepPower = 0;
    let armedCount = 0;
    const hostiles = roomState.hostiles || [];
    for (let i = 0; i < hostiles.length; i++) {
        const h = hostiles[i];
        if (!h || h.my || (h.owner && myUsername && h.owner.username === myUsername)) continue;
        const p = calcUnitPower(h);
        if (p > 0) {
            creepPower += p;
            armedCount++;
        } else if (h.getActiveBodyparts &&
            ((h.getActiveBodyparts(atkType) || 0) > 0 || (h.getActiveBodyparts(rngType) || 0) > 0 || (h.getActiveBodyparts(healType) || 0) > 0)) {
            armedCount++;
        }
    }

    let activeTowers = 0;
    let towers = roomState.hostileTowers;
    if (!towers) {
        towers = [];
        const hs = roomState.hostileStructures || [];
        for (let i = 0; i < hs.length; i++) {
            if (hs[i] && hs[i].structureType === twrType) towers.push(hs[i]);
        }
    }
    for (let i = 0; i < towers.length; i++) {
        const t = towers[i];
        if (!t || t.my || (t.owner && myUsername && t.owner.username === myUsername)) continue;
        const energy = t.store ? (t.store[resEnergy] || 0) : (t.energy || 0);
        const active = (!t.isActive || t.isActive());
        if (energy >= 10 && active) activeTowers++;
    }

    return {
        threatPower: creepPower + activeTowers * 600,
        activeTowers,
        armedCount
    };
}

function updateRoomThreatIntel(room, s) {
    if (!room || !s) return { threatPower: 0, threatPowerTick: 0, activeTowers: 0, armedCount: 0, lastSeen: 0 };
    const heap = getHeap();
    if (!heap.roomIntel) heap.roomIntel = {};
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    const isMyColony = !!(room.controller && room.controller.my);
    const { threatPower, activeTowers, armedCount } = calcRoomHostilePower(s);
    const entry = {
        threatPower,
        threatPowerTick: now,
        activeTowers,
        armedCount,
        lastSeen: now
    };
    if (!isMyColony || threatPower > 0) {
        heap.roomIntel[room.name] = entry;
    } else if (heap.roomIntel[room.name]) {
        delete heap.roomIntel[room.name];
    }
    return entry;
}

function getRoomIntel(roomName) {
    if (!roomName) return null;
    const heap = getHeap();
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    let entry = (heap.roomIntel && heap.roomIntel[roomName]) ? heap.roomIntel[roomName] : null;

    if ((!entry || entry.threatPowerTick !== now) &&
        typeof Game !== 'undefined' && Game.rooms && Game.rooms[roomName] &&
        heap.rooms && heap.rooms[roomName]) {
        const computed = calcRoomHostilePower(heap.rooms[roomName]);
        if (!heap.roomIntel) heap.roomIntel = {};
        entry = {
            threatPower: computed.threatPower,
            threatPowerTick: now,
            activeTowers: computed.activeTowers,
            armedCount: computed.armedCount,
            lastSeen: now
        };
        heap.roomIntel[roomName] = entry;
        return entry;
    }

    if (!entry) {
        const rem = (heap.remoteRooms && heap.remoteRooms[roomName]) ||
            ((typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName]) ? Memory.rooms[roomName].scoutData : null);
        if (rem && rem.threatPower !== undefined) {
            if (!heap.roomIntel) heap.roomIntel = {};
            entry = {
                threatPower: rem.threatPower || 0,
                threatPowerTick: rem.threatPowerTick !== undefined ? rem.threatPowerTick : (rem.lastSeen || 0),
                activeTowers: rem.towersCount || 0,
                armedCount: 0,
                lastSeen: rem.lastSeen || 0
            };
            heap.roomIntel[roomName] = entry;
        }
    }

    if (entry && (now - (entry.threatPowerTick || 0)) > 500) {
        entry.threatPower = 0;
    }
    return entry;
}

function getRoomThreatPower(roomName) {
    const entry = getRoomIntel(roomName);
    if (!entry) return 0;
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    if ((now - (entry.threatPowerTick || 0)) > 500) {
        entry.threatPower = 0;
        return 0;
    }
    return entry.threatPower || 0;
}

function parseRoomIntelligence(room, s) {
    const roomName = room.name;
    const myUsername = resolveMyUsername();
    const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
    let roomType = 'normal';
    if (match) {
        const x = parseInt(match[2], 10);
        const y = parseInt(match[4], 10);
        const modX = x % 10;
        const modY = y % 10;
        if (modX === 0 || modY === 0) roomType = 'highway';
        else if (modX === 5 && modY === 5) roomType = 'center';
        else if (modX >= 4 && modX <= 6 && modY >= 4 && modY <= 6) roomType = 'sourceKeeper';
    }

    const structs = getAllStructures(s);
    const keeperLairs = (s.keeperLairs && s.keeperLairs.length > 0) ? s.keeperLairs : structs.filter(st => st.structureType === 'keeperLair' || (typeof global !== 'undefined' && global.STRUCTURE_KEEPER_LAIR && st.structureType === global.STRUCTURE_KEEPER_LAIR));
    const isSourceKeeper = (roomType === 'sourceKeeper') || keeperLairs.length > 0;
    if (isSourceKeeper) roomType = 'sourceKeeper';

    const invaderCoreLevel = s.invaderCore ? (s.invaderCore.level || 1) : 0;

    const towers = (s.hostileStructures || []).filter(st => st.structureType === STRUCTURE_TOWER);
    const spawns = (s.hostileStructures || []).filter(st => st.structureType === STRUCTURE_SPAWN);

    const armedHostiles = (s.hostiles || []).filter(h => h.getActiveBodyparts && (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0 || h.getActiveBodyparts(HEAL) > 0));

    // Threat Classification
    let threatLevel = 'none';
    const isEmpire = isFriendlyOrEmpireRoom(roomName);
    if (isEmpire) {
        if (armedHostiles.length > 0) threatLevel = 'hostile_active';
        else if (invaderCoreLevel > 0) threatLevel = 'invader_core';
    } else if (isSourceKeeper) {
        threatLevel = 'sk';
    } else if (invaderCoreLevel > 0) {
        threatLevel = 'invader_core';
    } else if (room.controller && room.controller.owner && !room.controller.my && (!myUsername || room.controller.owner.username !== myUsername)) {
        threatLevel = towers.length > 0 ? 'player_defended' : 'player_weak';
    } else if (armedHostiles.length > 0) {
        threatLevel = 'hostile_active';
    }

    const safe = (threatLevel === 'none');

    // Deep Combat Surveillance Profile (enemy DPS, HPS, Boosts, Rampart Min/Avg, Tower Threat)
    let enemyDPS = 0;
    let enemyHPS = 0;
    let boostedCount = 0;
    const boostTypes = {};
    const hostilesList = s.hostiles || [];
    for (let h = 0; h < hostilesList.length; h++) {
        const hostile = hostilesList[h];
        if (!hostile || !Array.isArray(hostile.body)) continue;
        let isBoosted = false;
        for (let b = 0; b < hostile.body.length; b++) {
            const part = hostile.body[b];
            if (part.hits <= 0) continue;
            const boost = part.boost;
            let mult = 1;
            if (boost) {
                isBoosted = true;
                boostTypes[boost] = (boostTypes[boost] || 0) + 1;
                mult = getBoostMult(boost);
            }
            if (part.type === ATTACK) enemyDPS += 30 * mult;
            else if (part.type === RANGED_ATTACK) enemyDPS += 10 * mult;
            else if (part.type === HEAL) enemyHPS += 12 * mult;
        }
        if (isBoosted) boostedCount++;
    }

    const ramparts = structs.filter(st => !st.my && (st.structureType === STRUCTURE_RAMPART || st.structureType === STRUCTURE_WALL));
    let minRampartHits = ramparts.length > 0 ? Infinity : 0;
    let sumRampartHits = 0;
    for (let r = 0; r < ramparts.length; r++) {
        const hits = ramparts[r].hits || 0;
        if (hits < minRampartHits) minRampartHits = hits;
        sumRampartHits += hits;
    }
    const avgRampartHits = ramparts.length > 0 ? Math.round(sumRampartHits / ramparts.length) : 0;
    const towerMaxDPS = towers.length * 600;
    const estimatedBreachDPS = Math.round(enemyDPS + towerMaxDPS + Math.ceil(enemyHPS * 1.1));

    const combatProfile = {
        enemyDPS,
        enemyHPS,
        boostedCount,
        boostTypes: Object.keys(boostTypes),
        towerCount: towers.length,
        towerMaxDPS,
        minRampartHits,
        avgRampartHits,
        estimatedBreachDPS
    };

    // Expansion Potential: 2 sources, unowned controller, not SK or highway
    let expansionScore = 0;
    if (roomType === 'normal' && room.controller && !room.controller.owner) {
        expansionScore += (s.sources ? s.sources.length * 50 : 0);
        if (s.mineral) expansionScore += 20;
        if (invaderCoreLevel > 0) expansionScore -= 30;
    }

    // Poaching Potential: rival player room with RCL 1-3, 0 towers, or undefended neutral room with rival player reservation/creeps
    let poachScore = 0;
    let enemyOwner = null;
    if (!isEmpire) {
        if (threatLevel === 'player_weak') {
            poachScore = 100 - (room.controller ? room.controller.level * 20 : 0);
            enemyOwner = room.controller && room.controller.owner ? room.controller.owner.username : null;
        } else if (room.controller && room.controller.reservation && room.controller.reservation.username &&
                   room.controller.reservation.username !== 'Invader' &&
                   (!myUsername || room.controller.reservation.username !== myUsername)) {
            poachScore = 60; // Rival player reserved neutral room, prime for takeover
            enemyOwner = room.controller.reservation.username;
        } else if (roomType === 'normal' && towers.length === 0 && (s.hostiles || []).some(h => h.owner && h.owner.username !== 'Invader' && h.owner.username !== 'Source Keeper' && (!myUsername || h.owner.username !== myUsername))) {
            poachScore = 50; // Neutral room being mined/controlled by enemy creeps
            const rival = s.hostiles.find(h => h.owner && h.owner.username !== 'Invader' && h.owner.username !== 'Source Keeper' && (!myUsername || h.owner.username !== myUsername));
            enemyOwner = rival ? rival.owner.username : null;
        }
    }

    const powerInfo = calcRoomHostilePower(s);

    return {
        name: roomName,
        roomType: roomType,
        isSourceKeeper: isSourceKeeper,
        isHighway: (roomType === 'highway'),
        safe: safe,
        threatLevel: threatLevel,
        invaderCoreLevel: invaderCoreLevel,
        threatPower: powerInfo.threatPower,
        threatPowerTick: (typeof Game !== 'undefined' ? Game.time : 0),
        expansionScore: expansionScore,
        poachScore: poachScore,
        enemyOwner: enemyOwner,
        towersCount: towers.length,
        lastSeen: Game.time,
        sources: (s.sources || []).map(src => ({
            id: src.id,
            x: src.pos.x,
            y: src.pos.y,
            roomName: roomName
        })),
        controller: room.controller ? {
            level: room.controller.level,
            owner: room.controller.owner ? room.controller.owner.username : null,
            reservation: room.controller.reservation ? room.controller.reservation.username : null,
            ticksToEnd: room.controller.reservation ? room.controller.reservation.ticksToEnd : 0,
            safeMode: room.controller.safeMode || 0,
            safeModeUntil: room.controller.safeMode ? Game.time + room.controller.safeMode : 0
        } : null,
        mineral: s.mineral ? {
            mineralType: s.mineral.mineralType,
            density: s.mineral.density,
            x: s.mineral.pos.x,
            y: s.mineral.pos.y
        } : null,
        structuresSummary: {
            towersCount: towers.length,
            spawnsCount: spawns.length,
            storageEnergy: getSafeStructureEnergy(room.storage),
            terminalEnergy: getSafeStructureEnergy(room.terminal),
            keeperLairsCount: keeperLairs.length
        },
        combatProfile: combatProfile
    };
}

function recordCombatEvents(room, s) {
    if (!room || !room.getEventLog || typeof Memory === 'undefined') return;
    const heap = getHeap();
    const hasHostiles = !!(s.hostiles && s.hostiles.length > 0) || !!(s.armedHostiles && s.armedHostiles.length > 0);
    const hadHostiles = !!(heap.prevHostileIds && heap.prevHostileIds[room.name] && heap.prevHostileIds[room.name].size > 0);
    let hasDamagedCreep = false;
    const scList = s.creeps || [];
    for (let i = 0; i < scList.length; i++) {
        if (scList[i].hits < scList[i].hitsMax) { hasDamagedCreep = true; break; }
    }
    if (!hasHostiles && !hadHostiles && !hasDamagedCreep) return;
    const evLog = room.getEventLog();
    if ((!evLog || evLog.length === 0) && !hasHostiles) return;
    if (!Memory.empire) Memory.empire = {};
    if (!Memory.empire.combatStats) {
        Memory.empire.combatStats = {
            damageDealt: 0,
            damageTaken: 0,
            healingDone: 0,
            hostilesKilled: 0,
            friendlyDeaths: 0,
            lastCombatTick: 0,
            quadTicks: 0,
            quadCohesiveTicks: 0,
            quadCohesionPct: 100
        };
    }

    if (!heap.prevMyIds) heap.prevMyIds = {};
    if (!heap.prevHostileIds) heap.prevHostileIds = {};
    if (!heap.roomCombatSnap) heap.roomCombatSnap = {};

    const stats = Memory.empire.combatStats;
    const currMyIds = new Set();
    const currHostileIds = new Set();
    const currFriendlies = {};
    const currHostiles = {};
    const currHStructs = {};

    const creeps = s.creeps || [];
    for (let i = 0; i < creeps.length; i++) {
        const c = creeps[i];
        currMyIds.add(c.id);
        let cCost = 0;
        if (c.body && BODY_COSTS) {
            for (let b = 0; b < c.body.length; b++) {
                cCost += BODY_COSTS[c.body[b].type] || 50;
            }
        }
        currFriendlies[c.id] = { hits: c.hits, hitsMax: c.hitsMax, x: c.pos.x, y: c.pos.y, ttl: c.ticksToLive || 1500, cost: cCost };
    }
    const towers = s.towers || [];
    for (let i = 0; i < towers.length; i++) currMyIds.add(towers[i].id);
    const structs = getAllStructures(s);
    for (let i = 0; i < structs.length; i++) {
        const st = structs[i];
        if (st.my) currMyIds.add(st.id);
        else if (st.my === false) {
            currHostileIds.add(st.id);
            if (st.hits && st.structureType !== STRUCTURE_CONTROLLER) {
                currHStructs[st.id] = { hits: st.hits, x: st.pos.x, y: st.pos.y };
            }
        }
    }
    const hostiles = s.hostiles || [];
    for (let i = 0; i < hostiles.length; i++) {
        const h = hostiles[i];
        currHostileIds.add(h.id);
        currHostiles[h.id] = { hits: h.hits, hitsMax: h.hitsMax, x: h.pos.x, y: h.pos.y, ttl: h.ticksToLive || 1500 };
    }

    const prevMy = heap.prevMyIds[room.name] || currMyIds;
    const prevHostile = heap.prevHostileIds[room.name] || currHostileIds;
    const prevSnap = heap.roomCombatSnap[room.name];

    const EV_ATTACK = (typeof global !== 'undefined' && global.EVENT_ATTACK) ? global.EVENT_ATTACK : 1;
    const EV_DESTROYED = (typeof global !== 'undefined' && global.EVENT_OBJECT_DESTROYED) ? global.EVENT_OBJECT_DESTROYED : 2;
    const EV_HEAL = (typeof global !== 'undefined' && global.EVENT_HEAL) ? global.EVENT_HEAL : 6;

    let evHealedThisTick = 0;
    let evKillsThisTick = 0;
    let evDeathsThisTick = 0;
    const dmgTakenByFriendlyId = {};

    if (!heap.targetRoi) heap.targetRoi = {};
    let roiEntry = heap.targetRoi[room.name];
    if (!roiEntry) {
        roiEntry = { damageDealt: 0, energyLost: 0, haltedUntil: 0 };
        heap.targetRoi[room.name] = roiEntry;
    }

    const events = room.getEventLog(false) || [];
    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (!ev || !ev.data) continue;
        const targetId = ev.data.targetId;
        if (ev.event === EV_ATTACK) {
            const dmg = ev.data.damage || 0;
            if (prevMy.has(ev.objectId) || currMyIds.has(ev.objectId)) {
                stats.damageDealt += dmg;
                roiEntry.damageDealt += dmg;
                stats.lastCombatTick = Game.time;
            } else if (prevMy.has(targetId) || currMyIds.has(targetId)) {
                stats.damageTaken += dmg;
                dmgTakenByFriendlyId[targetId] = (dmgTakenByFriendlyId[targetId] || 0) + dmg;
                stats.lastCombatTick = Game.time;
            }
        } else if (ev.event === EV_HEAL) {
            if (prevMy.has(ev.objectId) || currMyIds.has(ev.objectId) || prevMy.has(targetId) || currMyIds.has(targetId)) {
                const amt = ev.data.amount || 0;
                stats.healingDone += amt;
                evHealedThisTick += amt;
            }
        } else if (ev.event === EV_DESTROYED) {
            if (prevHostile.has(ev.objectId)) {
                if (!ev.data.type || ev.data.type === 'creep') {
                    stats.hostilesKilled++;
                    evKillsThisTick++;
                }
                stats.lastCombatTick = Game.time;
            } else if (prevMy.has(ev.objectId) && (!ev.data.type || ev.data.type === 'creep')) {
                stats.friendlyDeaths++;
                evDeathsThisTick++;
                const lostCost = (prevSnap && prevSnap.friendlies && prevSnap.friendlies[ev.objectId] && prevSnap.friendlies[ev.objectId].cost) || 500;
                roiEntry.energyLost += lostCost;
                if (roiEntry.energyLost >= 4000 && roiEntry.damageDealt < roiEntry.energyLost * 0.5) {
                    if (!roiEntry.haltedUntil || roiEntry.haltedUntil <= Game.time) {
                        roiEntry.haltedUntil = Game.time + 500;
                    }
                }
                stats.lastCombatTick = Game.time;
            }
        } else if (ev.event === 12 && (ev.data.amount || 0) > 0 && targetId) {
            // xxscreeps binary schema variant fallback for attack events (data.amount carries combat damage)
            const dmg = ev.data.amount || 0;
            const atkMine = prevMy.has(ev.objectId) || currMyIds.has(ev.objectId);
            const atkHostile = prevHostile.has(ev.objectId) || currHostileIds.has(ev.objectId);
            const tgtMine = prevMy.has(targetId) || currMyIds.has(targetId);
            const tgtHostile = prevHostile.has(targetId) || currHostileIds.has(targetId);

            if (atkMine && tgtHostile) {
                stats.damageDealt += dmg;
                stats.lastCombatTick = Game.time;
            } else if (atkHostile && tgtMine) {
                stats.damageTaken += dmg;
                dmgTakenByFriendlyId[targetId] = (dmgTakenByFriendlyId[targetId] || 0) + dmg;
                stats.lastCombatTick = Game.time;
            }
        }
    }

    // Reconcile Kills, Deaths & Conservation-of-HP Healing when engine omits EV_DESTROYED / EV_HEAL
    if (prevSnap) {
        if (evKillsThisTick === 0) {
            for (const hid in prevSnap.hostiles) {
                if (!currHostiles[hid]) {
                    const ph = prevSnap.hostiles[hid];
                    if (ph.ttl > 2 && ph.x > 1 && ph.x < 48 && ph.y > 1 && ph.y < 48) {
                        stats.hostilesKilled++;
                        stats.lastCombatTick = Game.time;
                    }
                }
            }
        }
        if (evDeathsThisTick === 0) {
            for (const fid in prevSnap.friendlies) {
                if (!currFriendlies[fid]) {
                    const pf = prevSnap.friendlies[fid];
                    if (pf.ttl > 2 && pf.x > 1 && pf.x < 48 && pf.y > 1 && pf.y < 48) {
                        stats.friendlyDeaths++;
                        stats.lastCombatTick = Game.time;
                    }
                }
            }
        }
        if (evHealedThisTick === 0) {
            for (const fid in currFriendlies) {
                const pf = prevSnap.friendlies[fid];
                if (!pf) continue;
                const cf = currFriendlies[fid];
                const taken = dmgTakenByFriendlyId[fid] || 0;
                const effectiveHeal = cf.hits - (pf.hits - taken);
                if (effectiveHeal > 0) {
                    stats.healingDone += effectiveHeal;
                }
            }
        }
    }

    heap.prevMyIds[room.name] = currMyIds;
    heap.prevHostileIds[room.name] = currHostileIds;
    heap.roomCombatSnap[room.name] = {
        friendlies: currFriendlies,
        hostiles: currHostiles,
        hStructs: currHStructs
    };
}

function scanGlobalState() {
    const heap = getHeap();
    if (!heap.colonies) heap.colonies = {};
    heap.rooms = {}; // Clean slate each tick: ONLY currently visible rooms belong here!
    if (!heap.remoteRooms) heap.remoteRooms = {};
    if (!heap.expansion) heap.expansion = { targetRoom: null, parentRooms: [], travelTicks: 0, phase: 'IDLE', claimTick: 0, spawnBuiltTick: 0 };
    heap.ledger = {};

    // Global Reset Handler: clear ID mapping and stale targetInt/rampartHandoffInt on alive creeps
    if (typeof Game !== 'undefined' && global.lastReset === Game.time) {
        resetIdDictionary();
        resetRoomHashDictionary();
        if (Game.creeps) {
            for (const cName in Game.creeps) {
                const c = Game.creeps[cName];
                if (c && c.heap) {
                    c.heap.targetInt = 0;
                    c.heap.rampartHandoffInt = 0;
                    c.heap.targetId = null;
                    c.heap.rampartHandoffId = null;
                    c.heap.actionIntent = 'idle';
                    c.heap.path = null;
                    c.heap.pathBuffer = null;
                    c.heap._path = null;
                    c.heap._pathKey = null;
                    c.heap._targetSig = null;
                    c.heap._stepIdx = 0;
                    c.heap.nextStep = null;
                }
            }
        }
        if (Game.powerCreeps) {
            for (const pcName in Game.powerCreeps) {
                const pc = Game.powerCreeps[pcName];
                if (pc && pc.heap) {
                    pc.heap.targetInt = 0;
                    pc.heap.rampartHandoffInt = 0;
                    pc.heap.targetId = null;
                    pc.heap.rampartHandoffId = null;
                    pc.heap.actionIntent = 'idle';
                    pc.heap.path = null;
                    pc.heap.pathBuffer = null;
                    pc.heap._path = null;
                    pc.heap._pathKey = null;
                    pc.heap._targetSig = null;
                    pc.heap._stepIdx = 0;
                    pc.heap.nextStep = null;
                }
            }
        }
    }

    if (typeof Memory !== 'undefined') {
        if (!Memory.rooms) Memory.rooms = {};
        if (!Memory.empire) Memory.empire = {};
        if (!Memory.empire.powerBanks) {
            if (heap._seg11Checked) {
                Memory.empire.powerBanks = {};
            } else {
                const seg11 = getSegmentData(11);
                if (seg11 !== null) {
                    try { Memory.empire.powerBanks = seg11 ? JSON.parse(seg11) : {}; } catch (e) { Memory.empire.powerBanks = {}; }
                    heap._seg11Checked = true;
                } else {
                    requestSegment(11);
                }
            }
        }
        if (!Memory.empire.deposits) {
            if (heap._seg10Checked) {
                Memory.empire.deposits = {};
            } else {
                const seg10 = getSegmentData(10);
                if (seg10 !== null) {
                    try { Memory.empire.deposits = seg10 ? JSON.parse(seg10) : {}; } catch (e) { Memory.empire.deposits = {}; }
                    heap._seg10Checked = true;
                } else {
                    requestSegment(10);
                }
            }
        }
    }

    // Single-pass global pre-bucketing by room to eliminate 22+ per-room room.find() scans
    heap._sitesByRoom = Object.create(null);
    if (typeof Game !== 'undefined' && Game.constructionSites) {
        for (const sid in Game.constructionSites) {
            const cs = Game.constructionSites[sid];
            const rn = cs && cs.pos ? cs.pos.roomName : null;
            if (rn) {
                if (!heap._sitesByRoom[rn]) heap._sitesByRoom[rn] = [];
                heap._sitesByRoom[rn].push(cs);
            }
        }
    }
    heap._creepsByRoom = Object.create(null);
    heap.hasQuadCreeps = false;
    if (typeof Game !== 'undefined' && Game.creeps) {
        for (const cName in Game.creeps) {
            const c = Game.creeps[cName];
            if (!c) continue;
            if ((c.memory && c.memory.role === 'quad') || (c.heap && c.heap.role === 'quad')) {
                heap.hasQuadCreeps = true;
            }
            const rn = c.pos ? c.pos.roomName : (c.room ? c.room.name : null);
            if (rn) {
                if (!heap._creepsByRoom[rn]) heap._creepsByRoom[rn] = [];
                heap._creepsByRoom[rn].push(c);
            }
        }
    }
    heap._preBucketTick = typeof Game !== 'undefined' ? Game.time : 0;

    const visibleThreatEntries = {};
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room) continue;
        const s = scanRoom(room);
        if (!s) continue;
        recordCombatEvents(room, s);
        const intelEntry = updateRoomThreatIntel(room, s);

        const isMyColony = !!(room.controller && room.controller.my);
        const roomHasHostiles = !!(s.hostiles && s.hostiles.length > 0);
        let scoutEntry = null;
        if (!isMyColony) {
            const prevEntry = heap.remoteRooms && heap.remoteRooms[roomName];
            if (!roomHasHostiles && !s.invaderCore && prevEntry && (Game.time - (prevEntry.lastSeen || 0)) < 25) {
                scoutEntry = prevEntry;
                scoutEntry.lastSeen = Game.time;
                scoutEntry.threatPower = intelEntry.threatPower;
                scoutEntry.threatPowerTick = intelEntry.threatPowerTick;
                if (room.controller && scoutEntry.controller) {
                    scoutEntry.controller.reservation = room.controller.reservation ? room.controller.reservation.username : null;
                    scoutEntry.controller.ticksToEnd = room.controller.reservation ? room.controller.reservation.ticksToEnd : 0;
                    scoutEntry.controller.level = room.controller.level;
                    scoutEntry.controller.owner = room.controller.owner ? room.controller.owner.username : null;
                }
            } else {
                try {
                    scoutEntry = parseRoomIntelligence(room, s);
                } catch (e) {
                    log(1, `[WARN] parseRoomIntelligence failed in ${roomName}: ${e && e.message}`);
                }
            }
        } else if (roomHasHostiles || (Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].peakThreat)) {
            try {
                scoutEntry = parseRoomIntelligence(room, s);
            } catch (e) {
                log(1, `[WARN] parseRoomIntelligence failed in ${roomName}: ${e && e.message}`);
            }
        } else {
            if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].scoutData) {
                delete Memory.rooms[roomName].scoutData;
            }
            if (heap.remoteRooms && heap.remoteRooms[roomName]) {
                delete heap.remoteRooms[roomName];
            }
            continue;
        }
        if (!scoutEntry) continue;
        if (typeof Memory !== 'undefined' && Memory.rooms) {
            const cp = scoutEntry.combatProfile;
            if (cp && (cp.enemyDPS > 0 || cp.enemyHPS > 0 || cp.towerCount > 0)) {
                if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
                const prevPeak = Memory.rooms[roomName].peakThreat;
                const currWeight = cp.enemyDPS + cp.enemyHPS + cp.towerCount * 600;
                const prevWeight = prevPeak ? (prevPeak.enemyDPS + prevPeak.enemyHPS + prevPeak.towers * 600) : -1;
                if (!prevPeak || (Game.time - prevPeak.tick) > 500 || currWeight >= prevWeight) {
                    Memory.rooms[roomName].peakThreat = {
                        owner: (scoutEntry.controller ? scoutEntry.controller.owner : null) || scoutEntry.enemyOwner || 'Invader/SK',
                        threatLevel: scoutEntry.threatLevel,
                        enemyDPS: cp.enemyDPS,
                        enemyHPS: cp.enemyHPS,
                        towers: cp.towerCount,
                        boosted: cp.boostedCount,
                        minRampartHits: cp.minRampartHits,
                        breachDPSNeeded: cp.estimatedBreachDPS,
                        tick: Game.time
                    };
                }
            }
        }

        if (!room.controller || !room.controller.my) {
            recordRemoteThreatTick(roomName, !!(s.armedHostiles && s.armedHostiles.length > 0));
            const myU = resolveMyUsername();
            if (!room.controller || !room.controller.owner) {
                if (!heap.rivalRemoteFlags) heap.rivalRemoteFlags = new Uint8Array(256);
                if (!heap.rivalRemoteMeta) heap.rivalRemoteMeta = new Uint16Array(256);
                if (!heap.rivalRemoteTick) heap.rivalRemoteTick = new Int32Array(256);
                if (!heap.rivalDropAmount) heap.rivalDropAmount = new Uint32Array(256);
                const rSlot = getRemoteSlot(roomName);
                let workers = 0;
                let threat = 0;
                const rh = s.hostiles || [];
                for (let hIdx = 0; hIdx < rh.length; hIdx++) {
                    const hc = rh[hIdx];
                    const own = hc && hc.owner ? hc.owner.username : null;
                    if (!own || own === 'Invader' || own === 'Source Keeper' || (myU && own === myU) || !hc.getActiveBodyparts) continue;
                    if (hc.getActiveBodyparts(CARRY) + hc.getActiveBodyparts(WORK) > 0) workers++;
                    const arm = hc.getActiveBodyparts(ATTACK) + hc.getActiveBodyparts(RANGED_ATTACK) + hc.getActiveBodyparts(HEAL);
                    if (arm > 0) threat += arm;
                }
                let dropsSum = 0;
                for (let d = 0; d < (s.droppedEnergy || []).length; d++) dropsSum += s.droppedEnergy[d].amount || 0;
                for (let tb = 0; tb < (s.tombstones || []).length; tb++) dropsSum += (s.tombstones[tb].store ? (s.tombstones[tb].store[RESOURCE_ENERGY] || 0) : 0);
                const prevF = heap.rivalRemoteFlags[rSlot];
                if (workers > 0) heap.rivalRemoteFlags[rSlot] = (prevF | 1) & ~2;
                else {
                    let nf = prevF & ~1;
                    if (prevF & 1) nf |= 2;
                    if ((nf & 2) && dropsSum >= 300 && threat === 0) nf |= 4;
                    else if (dropsSum < 150) nf &= ~4;
                    heap.rivalRemoteFlags[rSlot] = nf;
                }
                heap.rivalRemoteMeta[rSlot] = (Math.min(255, threat) << 8) | Math.min(255, workers);
                heap.rivalRemoteTick[rSlot] = Game.time;
                heap.rivalDropAmount[rSlot] = dropsSum;
            } else if (!isFriendlyOrEmpireRoom(roomName)) {
                if (!heap.rivalCitadelStorage) heap.rivalCitadelStorage = {};
                const rLvl = room.controller.level || 1;
                const stEn = room.storage ? getSafeStructureEnergy(room.storage) : (rLvl >= 4 ? 0 : -1);
                let twr = 0;
                for (let stIdx = 0; stIdx < (s.hostileStructures || []).length; stIdx++) {
                    if (s.hostileStructures[stIdx].structureType === STRUCTURE_TOWER) twr++;
                }
                heap.rivalCitadelStorage[roomName] = {
                    roomName: roomName,
                    owner: room.controller.owner.username,
                    rcl: rLvl,
                    storageEnergy: stEn,
                    towers: twr,
                    safeMode: room.controller.safeMode || 0,
                    safeModeUntil: room.controller.safeMode ? Game.time + room.controller.safeMode : 0,
                    tick: Game.time
                };
                if (Game.time % 20 === 0) setSegmentData(12, JSON.stringify(heap.rivalCitadelStorage));
            }
            heap.remoteRooms[roomName] = scoutEntry;

            // Only persist active outposts, rival owned rooms, or threatened rooms to Memory.rooms (keep neutral exploration in heap)
            const persistToMem = !!((heap.outpostOwners && heap.outpostOwners[roomName]) ||
                (scoutEntry.controller && scoutEntry.controller.owner) ||
                (scoutEntry.threatLevel && scoutEntry.threatLevel !== 'none'));
            if (persistToMem && typeof Memory !== 'undefined' && Memory.rooms) {
                if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
                Memory.rooms[roomName].scoutData = scoutEntry;
            }
        } else {
            // Owned colony: purge any stale scoutData and remove from remoteRooms
            if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].scoutData) {
                delete Memory.rooms[roomName].scoutData;
            }
            if (heap.remoteRooms && heap.remoteRooms[roomName]) {
                delete heap.remoteRooms[roomName];
            }
            if ((s.hostiles && s.hostiles.length > 0) || (Memory.rooms[roomName] && Memory.rooms[roomName].peakThreat)) {
                visibleThreatEntries[roomName] = scoutEntry;
            }
        }
    }

    // Track total in-flight energy targeted at each colony's Controller Container
    if (typeof Game !== 'undefined' && Game.creeps) {
        for (const cName in Game.creeps) {
            const c = Game.creeps[cName];
            if (!c.heap || !c.heap.targetId) continue;
            const r = c.memory && c.memory.role;
            if (r !== 'hauler' && r !== 'remoteHauler') continue;
            const colName = c.memory.colony;
            const rState = colName && heap.rooms ? heap.rooms[colName] : null;
            if (rState && rState.controllerContainer && c.heap.targetId === rState.controllerContainer.id && c.store) {
                rState.controllerIncomingEnergy += (c.store[RESOURCE_ENERGY] || 0);
            }
        }
    }

    // Restore unvisited remote rooms from Memory once per global reset if heap was wiped
    if (typeof Memory !== 'undefined' && Memory.rooms) {
        if (!heap._remoteRoomsHydrated) {
            heap._remoteRoomsHydrated = true;
            for (const rName in Memory.rooms) {
                const isOwnedColony = (Game.rooms[rName] && Game.rooms[rName].controller && Game.rooms[rName].controller.my) ||
                                      (heap.colonies && heap.colonies[rName]);
                if (isOwnedColony) {
                    delete Memory.rooms[rName].scoutData;
                    continue;
                }
                if (!heap.remoteRooms[rName] && Memory.rooms[rName] && Memory.rooms[rName].scoutData) {
                    const sd = Memory.rooms[rName].scoutData;
                    heap.remoteRooms[rName] = sd;
                    if (sd.threatPower !== undefined) {
                        if (!heap.roomIntel) heap.roomIntel = {};
                        heap.roomIntel[rName] = {
                            threatPower: sd.threatPower || 0,
                            threatPowerTick: sd.threatPowerTick !== undefined ? sd.threatPowerTick : (sd.lastSeen || 0),
                            activeTowers: sd.towersCount || 0,
                            armedCount: 0,
                            lastSeen: sd.lastSeen || 0
                        };
                    }
                }
            }
        }

        // Aggregate Empire Intelligence into Memory.empire (throttled every 20 ticks for CPU efficiency)
        if (!Memory.empire) Memory.empire = {};
        if (Game.time % 20 === 0 || !Memory.empire.surveillance) {
            const threats = [];
            const expansionPoints = [];
            const raidTargets = [];
            const enemyOutposts = [];
            const surveillance = [];
            const skRooms = [];
            const highways = [];
            const myUsername = resolveMyUsername();
            const myRoomNames = typeof Game !== 'undefined' && Game.rooms
                ? Object.keys(Game.rooms).filter(rn => Game.rooms[rn].controller && Game.rooms[rn].controller.my)
                : [];

            const activeOutposts = new Set();
            if (Memory.empire && Memory.empire.outpostOwners) {
                for (const out in Memory.empire.outpostOwners) activeOutposts.add(out);
            }
            if (Memory.rooms) {
                for (const r in Memory.rooms) {
                    if (Memory.rooms[r] && Array.isArray(Memory.rooms[r].outposts)) {
                        for (let i = 0; i < Memory.rooms[r].outposts.length; i++) {
                            activeOutposts.add(Memory.rooms[r].outposts[i]);
                        }
                    }
                }
            }

            const pushSurveillance = (rName, info, isEmpire) => {
                const cp = (info && info.combatProfile) || {};
                const peak = (Memory.rooms[rName] && Memory.rooms[rName].peakThreat) || null;
                const usePeak = peak && (Game.time - peak.tick) <= 500;
                const enemyDPS = cp.enemyDPS > 0 ? cp.enemyDPS : (usePeak ? peak.enemyDPS : 0);
                const enemyHPS = cp.enemyHPS > 0 ? cp.enemyHPS : (usePeak ? peak.enemyHPS : 0);
                const towers = cp.towerCount > 0 ? cp.towerCount : (usePeak ? peak.towers : (info.towersCount || 0));
                const breachDPSNeeded = cp.estimatedBreachDPS > 0 ? cp.estimatedBreachDPS : (usePeak ? peak.breachDPSNeeded : 0);
                const tLevel = (info.threatLevel && info.threatLevel !== 'none') ? info.threatLevel : (usePeak ? peak.threatLevel : 'none');

                if (tLevel !== 'none' || enemyDPS > 0 || towers > 0) {
                    let threatOwner = 'Invader/SK';
                    if (isEmpire) {
                        threatOwner = (usePeak && peak.owner && peak.owner !== myUsername) ? peak.owner : 'Hostile Invader';
                    } else {
                        threatOwner = (info.controller ? info.controller.owner : null) || info.enemyOwner || (usePeak ? peak.owner : null) || 'Invader/SK';
                    }
                    surveillance.push({
                        roomName: rName,
                        owner: threatOwner,
                        threatLevel: tLevel,
                        enemyDPS: enemyDPS,
                        enemyHPS: enemyHPS,
                        towers: towers,
                        boosted: cp.boostedCount || (usePeak ? peak.boosted : 0) || 0,
                        minRampartHits: cp.minRampartHits || (usePeak ? peak.minRampartHits : 0) || 0,
                        breachDPSNeeded: breachDPSNeeded,
                        isEmpireRoom: !!isEmpire,
                        lastSeen: info.lastSeen || Game.time
                    });
                }
            };

            for (const rName in heap.remoteRooms) {
                const info = heap.remoteRooms[rName];
                if (!info) continue;
                const isEmpire = isFriendlyOrEmpireRoom(rName);

                pushSurveillance(rName, info, isEmpire);
                if (info.threatLevel && info.threatLevel !== 'none') {
                    if (!isEmpire || (info.threatLevel === 'hostile_active' || info.threatLevel === 'invader_core')) {
                        threats.push({ roomName: rName, threat: info.threatLevel, isEmpire: isEmpire });
                    }
                }
                // Strategic Imperial Colonization Qualification:
                // 1. Not an empire room, not SK, not highway
                // 2. Unowned controller, not reserved by rival
                // 3. STRICT 2-SOURCE REQUIREMENT (never colonize 1-source rooms!)
                // 4. ANTI-CLUSTERING: Minimum linear distance to ANY colony must be >= 2!
                // 5. ANTI-CANNIBALIZATION: Never colonize an existing colony's active outpost!
                const srcCount = (info.sources && Array.isArray(info.sources)) ? info.sources.length : (info.sourceCount || 0);
                const infoOwner = (info.controller && info.controller.owner) || info.owner;
                const infoRes = (info.controller && info.controller.reservation) || info.reservation;
                const infoHostileOrCore = info.safe === false || info.invaderCoreLevel > 0 || info.threatLevel === 'invader_core' || info.threatLevel === 'hostile_active' || isRemoteExcluded(rName);
                if (!isEmpire && !info.isSourceKeeper && !info.isHighway && !infoOwner && !infoHostileOrCore && srcCount >= 2 && !activeOutposts.has(rName)) {
                    if (!infoRes || (myUsername && infoRes === myUsername)) {
                        let minDistToColony = Infinity;
                        for (let c = 0; c < myRoomNames.length; c++) {
                            const d = (Game.map && Game.map.getRoomLinearDistance) ? Game.map.getRoomLinearDistance(rName, myRoomNames[c]) : 2;
                            if (d < minDistToColony) minDistToColony = d;
                        }

                        // Anti-Clustering: Enforce configured colony spacing [minColonyDistance..maxColonyDistance]
                        const expCfg = getConfig();
                        const minColDist = expCfg.minColonyDistance || 4;
                        const maxColDist = expCfg.maxColonyDistance || 7;
                        if (minDistToColony >= minColDist && minDistToColony <= maxColDist) {
                            let stratScore = 150;
                            if (minDistToColony <= 5) stratScore += 60;
                            else stratScore += 30;

                            const minType = info.mineral ? (info.mineral.mineralType || info.mineral) : null;
                            if (minType === RESOURCE_CATALYST) stratScore += 40;
                            else if (minType === RESOURCE_HYDROGEN || minType === RESOURCE_OXYGEN) stratScore += 25;
                            else if (minType) stratScore += 10;

                            if (info.invaderCoreLevel > 0) stratScore -= 30;

                            // Outpost Halo: inspect surrounding rooms for future outposts
                            if (Game.map && Game.map.describeExits) {
                                const exits = Game.map.describeExits(rName);
                                if (exits) {
                                    for (const dir in exits) {
                                        const neighbor = exits[dir];
                                        if (activeOutposts.has(neighbor) || isFriendlyOrEmpireRoom(neighbor)) continue;
                                        const nInfo = heap.remoteRooms[neighbor] || (Memory.rooms && Memory.rooms[neighbor] ? Memory.rooms[neighbor].scoutData : null);
                                        if (nInfo && !nInfo.owner && !nInfo.isSourceKeeper && !nInfo.isHighway) {
                                            const nSrc = nInfo.sources ? nInfo.sources.length : 1;
                                            stratScore += nSrc * 15;
                                        }
                                    }
                                }
                            }

                            // Check terrain wallability first (for both min-cut and Forward Operating Base qualification)
                            let wallTiles = 0;
                            let swampTiles = 0;
                            const tBytes = getStaticTerrainBytes(rName);
                            if (tBytes) {
                                for (let idx = 0; idx < 2500; idx++) {
                                    if (tBytes[idx] === 1) wallTiles++;
                                    else if (tBytes[idx] === 2) swampTiles++;
                                }
                                if (wallTiles > 1600) continue; // Over-walled / cramped chamber
                                stratScore += Math.min(30, Math.floor(wallTiles / 30)) - Math.min(25, Math.floor(swampTiles / 40));
                            }

                            // FOB Scoring (+1000 for defensible border rooms 1-2 hops from rival RCL 6+ citadels) vs standard citadel buffer
                            let nearRivalCitadel = false;
                            let fobTarget = null;
                            for (const rivalName in heap.remoteRooms) {
                                const rv = heap.remoteRooms[rivalName];
                                const rvOwner = rv && ((rv.controller && rv.controller.owner) || rv.owner || rv.enemyOwner);
                                if (!rv || !rvOwner || isFriendlyOrEmpireRoom(rivalName)) continue;
                                const rvRcl = (rv.controller && rv.controller.level) || 0;
                                const rvDist = (Game.map && Game.map.getRoomLinearDistance) ? Game.map.getRoomLinearDistance(rName, rivalName) : 9;
                                if (rvRcl >= 6 && rvDist >= 1 && rvDist <= 2) {
                                    if (wallTiles >= 350 && !fobTarget) {
                                        fobTarget = rivalName;
                                    } else if (rvRcl >= 7) {
                                        nearRivalCitadel = true;
                                    }
                                }
                            }
                            if (nearRivalCitadel && !fobTarget) continue;
                            if (fobTarget) stratScore += 1000;

                            expansionPoints.push({
                                roomName: rName,
                                score: stratScore,
                                sources: srcCount,
                                minDistance: minDistToColony,
                                mineral: minType,
                                isFob: !!fobTarget,
                                fobTarget: fobTarget
                            });
                        }
                    }
                }
                if (!isEmpire && info.poachScore > 0 && (!myUsername || info.enemyOwner !== myUsername)) {
                    const smRem = getRivalSafeModeRemaining(info.controller ? {
                        safeMode: info.controller.safeMode,
                        safeModeUntil: info.controller.safeModeUntil,
                        tick: info.lastSeen
                    } : null);

                    const entry = {
                        roomName: rName,
                        poachScore: smRem > 0 ? 0 : info.poachScore,
                        rawPoachScore: info.poachScore,
                        owner: (info.controller ? info.controller.owner : null) || info.enemyOwner || null,
                        reservation: info.controller ? info.controller.reservation : null,
                        towersCount: info.towersCount || (info.structuresSummary ? info.structuresSummary.towersCount : 0),
                        safeModeRemaining: smRem,
                        safeModeUntil: info.controller && info.controller.safeModeUntil ? info.controller.safeModeUntil : (smRem > 0 ? Game.time + smRem : 0)
                    };
                    raidTargets.push(entry);
                    const isClaimedCitadel = !!(info.controller && info.controller.owner);
                    if (!isClaimedCitadel && entry.towersCount === 0 && !info.isSourceKeeper) {
                        enemyOutposts.push(entry);
                    }
                }
                if (info.isSourceKeeper) {
                    skRooms.push({ roomName: rName, sources: info.sources ? info.sources.length : 3 });
                }
                if (info.isHighway) {
                    highways.push(rName);
                }
            }
            for (const rName in visibleThreatEntries) {
                pushSurveillance(rName, visibleThreatEntries[rName], true);
            }

            expansionPoints.sort((a, b) => b.score - a.score);
            raidTargets.sort((a, b) => b.poachScore - a.poachScore);
            enemyOutposts.sort((a, b) => b.poachScore - a.poachScore);
            surveillance.sort((a, b) => (b.enemyDPS + b.towers * 600) - (a.enemyDPS + a.towers * 600));

            Memory.empire.threats = threats;
            Memory.empire.expansionPoints = expansionPoints.slice(0, 5);
            Memory.empire.raidTargets = raidTargets.slice(0, 8);
            Memory.empire.enemyOutposts = enemyOutposts.slice(0, 8);
            Memory.empire.surveillance = surveillance.slice(0, 12);
            Memory.empire.skRooms = skRooms;
            Memory.empire.highways = highways;
            Memory.empire.knownRoomsCount = Object.keys(heap.remoteRooms).length;

            // Imperial Security Bureau (ISB) Faction Intelligence Dossier
            const factionDossier = {};
            for (const rName in heap.remoteRooms) {
                const info = heap.remoteRooms[rName];
                if (!info || isFriendlyOrEmpireRoom(rName)) continue;
                const owner = (info.controller ? info.controller.owner : null) || info.enemyOwner;
                if (owner && owner !== 'Invader' && owner !== 'Source Keeper' && (!myUsername || owner !== myUsername)) {
                    if (!factionDossier[owner]) {
                        factionDossier[owner] = {
                            faction: owner,
                            systemsControlled: 0,
                            outposts: [],
                            peakDPS: 0,
                            peakHPS: 0,
                            towersTotal: 0,
                            threatTier: 'MODERATE'
                        };
                    }
                    const f = factionDossier[owner];
                    f.systemsControlled++;
                    f.outposts.push(rName);
                    const cp = info.combatProfile || {};
                    if ((cp.enemyDPS || 0) > f.peakDPS) f.peakDPS = cp.enemyDPS;
                    if ((cp.enemyHPS || 0) > f.peakHPS) f.peakHPS = cp.enemyHPS;
                    f.towersTotal += (info.towersCount || (info.structuresSummary ? info.structuresSummary.towersCount : 0));
                    if (f.towersTotal >= 6 || f.peakDPS >= 600 || (cp.boostedCount || 0) > 0) {
                        f.threatTier = 'CRITICAL_RIVAL'; // Heavy enemy siege force like TooAngel
                    } else if (f.towersTotal >= 2 || f.peakDPS >= 200) {
                        f.threatTier = 'HIGH';
                    }
                }
            }

            // Planetary Shield Telemetry for all Imperial Citadels
            const shields = {};
            for (const cName in heap.colonies) {
                const cRoom = Game.rooms[cName];
                if (!cRoom) continue;
                const rcl = cRoom.controller ? cRoom.controller.level : 1;
                const targetHits = getRampartBaseline(rcl);
                const cState = heap.rooms ? heap.rooms[cName] : null;
                const ramparts = (cState && cState.ramparts) || (cRoom.find ? cRoom.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_RAMPART && s.my }) : []);
                let minHits = ramparts.length > 0 ? Infinity : 0;
                let sumHits = 0;
                for (let r = 0; r < ramparts.length; r++) {
                    const hits = ramparts[r].hits || 0;
                    if (hits < minHits) minHits = hits;
                    sumHits += hits;
                }
                const avgHits = ramparts.length > 0 ? Math.round(sumHits / ramparts.length) : 0;
                const shieldIntegrity = ramparts.length > 0 ? Math.min(100, Math.round((minHits / targetHits) * 100)) : 0;
                shields[cName] = {
                    status: shieldIntegrity >= 80 ? 'ACTIVE_OPTIMAL' : (shieldIntegrity >= 30 ? 'FORTIFYING' : 'VULNERABLE'),
                    rampartsCount: ramparts.length,
                    minHits: minHits === Infinity ? 0 : minHits,
                    avgHits,
                    targetHits,
                    shieldIntegrityPct: shieldIntegrity
                };
            }

            Memory.empire.isb = {
                lastSweep: Game.time,
                knownSystems: Object.keys(heap.remoteRooms).length,
                factions: factionDossier,
                planetaryShields: shields,
                activeThreats: threats.length,
                interdictionTargets: enemyOutposts.slice(0, 5).map(e => e.roomName)
            };
        }

        if (Game.time % 50 === 0 && Memory.empire.combatStats && Memory.empire.combatStats.lastCombatTick > 0) {
            const cs = Memory.empire.combatStats;
            log(1, `[IMPERIAL COMMAND] [COMBAT] Dealt: ${cs.damageDealt} | Taken: ${cs.damageTaken} | Healed: ${cs.healingDone} | Kills: ${cs.hostilesKilled} | Losses: ${cs.friendlyDeaths} | QuadCohesion: ${cs.quadCohesionPct || 100}%`);
        }

        if (Game.time % 100 === 0 && Memory.empire.knownRoomsCount > 0) {
            const expList = Memory.empire.expansionPoints || [];
            const raidList = Memory.empire.enemyOutposts || [];
            const expStr = expList.map(e => `${e.roomName}(${e.sources}s)`).join(', ') || 'none';
            const raidStr = raidList.map(r => r.roomName).join(', ') || 'none';
            const isbFactions = Object.keys((Memory.empire.isb && Memory.empire.isb.factions) || {}).join(', ') || 'None';
            log(1, `[IMPERIAL COMMAND] [ISB] Systems Monitored: ${Memory.empire.knownRoomsCount} | Expansions: ${expStr} | Threats: ${(Memory.empire.threats || []).length} | InterdictionTargets: ${raidStr} | RivalFactions: ${isbFactions}`);

            if (heap.rivalCitadelStorage) {
                for (const cRoom in heap.rivalCitadelStorage) {
                    const prof = heap.rivalCitadelStorage[cRoom];
                    if (!prof || isFriendlyOrEmpireRoom(cRoom)) continue;
                    const smRem = getRivalSafeModeRemaining(prof);
                    if (smRem > 0) {
                        const expiry = prof.safeModeUntil || (Game.time + smRem);
                        log(1, `[IMPERIAL COMMAND] [ISB] Rival Citadel ${cRoom} (${prof.owner || 'Unknown'}) SAFE MODE ACTIVE: ${smRem} ticks remaining (expires at Tick ${expiry}). Direct assaults paused; outposts active.`);
                    }
                }
            }
        }
    }

    // Clean up any stale colonies whose rooms are no longer visible or owned
    for (const cName in heap.colonies) {
        const cRoom = Game.rooms[cName];
        if (!cRoom || !cRoom.controller || !cRoom.controller.my) {
            delete heap.colonies[cName];
        }
    }

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room && room.controller && room.controller.my) {
            const roomState = heap.rooms[roomName];
            if (!roomState) continue;
            const colonyName = roomState.name;
            if (!heap.colonies[colonyName]) {
                heap.colonies[colonyName] = {
                    name: colonyName,
                    coreRoom: roomState,
                    outposts: [],
                    creeps: [],
                    creepsByRole: { harvester: [], hauler: [], filler: [], upgrader: [], builder: [], defender: [], raider: [], mineralMiner: [], remoteMiner: [], remoteHauler: [], reserver: [], scout: [], quad: [] },
                    sources: [],
                    constructionSites: [],
                    threats: []
                };
            }
            const col = heap.colonies[colonyName];
            col.coreRoom = roomState;
            col.sources = roomState.sources ? roomState.sources.slice() : [];
            col.constructionSites = roomState.constructionSites ? roomState.constructionSites.slice() : [];
            col.creeps = [];
            col.creepsByRole = { harvester: [], hauler: [], filler: [], upgrader: [], builder: [], defender: [], raider: [], mineralMiner: [], remoteMiner: [], remoteHauler: [], reserver: [], scout: [], quad: [] };
            col.threats = [];

            // Aggregate active threats across home room & outposts
            if (roomState.armedHostiles && roomState.armedHostiles.length > 0) {
                col.threats.push({ roomName: colonyName, count: roomState.armedHostiles.length, hostiles: roomState.armedHostiles, isHome: true });
            }
            const colonyOutposts = (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[colonyName] && Memory.rooms[colonyName].outposts)
                ? Memory.rooms[colonyName].outposts
                : (col.outposts || []);
            for (let o = 0; o < colonyOutposts.length; o++) {
                const outName = colonyOutposts[o];
                const outState = heap.rooms[outName];
                if (outState && outState.armedHostiles && outState.armedHostiles.length > 0) {
                    col.threats.push({ roomName: outName, count: outState.armedHostiles.length, hostiles: outState.armedHostiles, isHome: false });
                } else if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[outName] && Memory.rooms[outName].threat) {
                    const t = Memory.rooms[outName].threat;
                    if (t.expiresAt > Game.time) {
                        col.threats.push({ roomName: outName, count: t.count || 1, hostiles: [], isHome: false });
                    }
                }
            }
            heap.threats = col.threats;
        }
    }

    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (!c || !c.memory) continue;
        let colName = c.memory.colony;
        if (!colName && c.room && heap.colonies[c.room.name]) {
            colName = c.room.name;
            c.memory.colony = colName;
        }
        if (!c.memory.role && c.name && c.name.indexOf('_') > 0) {
            const prefix = c.name.split('_')[0];
            if (ROLE_ID[prefix] !== undefined) {
                c.memory.role = prefix;
                if (c.heap) {
                    c.heap.role = prefix;
                    c.heap.roleId = ROLE_ID[prefix];
                }
                markMemoryDirty();
            }
        }
        const col = colName && heap.colonies[colName];
        if (col) {
            col.creeps.push(c);
            const role = c.memory.role || 'unknown';
            if (!col.creepsByRole[role]) col.creepsByRole[role] = [];
            col.creepsByRole[role].push(c);
        }
    }

    for (const roomName in heap.rooms) {
        const roomState = heap.rooms[roomName];
        resetTickLedger(roomState);
    }

    syncEmpireMissions();
    evaluateEmpireQrf();
}

function getRoomLinearDistSafe(a, b) {
    if (!a || !b) return Infinity;
    if (a === b) return 0;
    if (typeof Game !== 'undefined' && Game.map && Game.map.getRoomLinearDistance) {
        return Game.map.getRoomLinearDistance(a, b);
    }
    return 1;
}

function getColonySnapshot(roomName, r, rs) {
    const rcl = (r && r.controller && r.controller.level) || 0;
    let spawns = [];
    if (rs && Array.isArray(rs.spawns)) spawns = rs.spawns;
    else if (r && typeof r.find === 'function' && typeof FIND_MY_SPAWNS !== 'undefined') spawns = r.find(FIND_MY_SPAWNS);

    let towers = [];
    if (rs && Array.isArray(rs.towers)) towers = rs.towers;
    else if (r && typeof r.find === 'function' && typeof FIND_MY_STRUCTURES !== 'undefined' && typeof STRUCTURE_TOWER !== 'undefined') {
        const allMy = r.find(FIND_MY_STRUCTURES);
        for (let i = 0; i < allMy.length; i++) {
            if (allMy[i] && allMy[i].structureType === STRUCTURE_TOWER) towers.push(allMy[i]);
        }
    }

    const storage = (rs && rs.storage) || (r && r.storage) || null;
    const storageEnergy = (storage && storage.store) ? (storage.store[RESOURCE_ENERGY] || 0) : 0;

    let armedHostiles = 0;
    if (rs && Array.isArray(rs.armedHostiles)) {
        armedHostiles = rs.armedHostiles.length;
    } else if (r && typeof r.find === 'function' && typeof FIND_HOSTILE_CREEPS !== 'undefined') {
        const hostiles = r.find(FIND_HOSTILE_CREEPS);
        for (let i = 0; i < hostiles.length; i++) {
            const h = hostiles[i];
            if (!h || !h.body) continue;
            for (let p = 0; p < h.body.length; p++) {
                const pt = h.body[p].type;
                if (pt === ATTACK || pt === RANGED_ATTACK || pt === HEAL || pt === WORK) {
                    armedHostiles++;
                    break;
                }
            }
        }
    }

    let idleSpawns = 0;
    for (let i = 0; i < spawns.length; i++) {
        if (spawns[i] && !spawns[i].spawning) idleSpawns++;
    }

    return {
        roomName,
        rcl,
        spawns: spawns.length,
        towers: towers.length,
        storageEnergy,
        armedHostiles,
        idleSpawns
    };
}

function countBootstrappingColonies() {
    if (typeof Game === 'undefined' || !Game.rooms) return 0;
    const heap = getHeap();
    let count = 0;
    for (const rn in Game.rooms) {
        const r = Game.rooms[rn];
        if (!r || !r.controller || !r.controller.my) continue;
        const rs = heap.rooms ? heap.rooms[rn] : null;
        const snap = getColonySnapshot(rn, r, rs);
        if (snap.rcl < 4 || snap.spawns === 0 || snap.towers === 0) {
            count++;
        }
    }
    return count;
}

function syncEmpireMissions() {
    if (typeof Game === 'undefined' || !Game.rooms) return {};
    const heap = getHeap();
    const cfg = getConfig();
    if (!heap.state) heap.state = (typeof Memory !== 'undefined' ? Memory : {});
    if (!heap.state.missions) heap.state.missions = { bootstrap: {} };
    if (!heap.state.missions.bootstrap) heap.state.missions.bootstrap = {};
    const bootstrapMissions = heap.state.missions.bootstrap;

    const colonies = {};
    const colonyNames = [];
    const localHarvesters = {};

    if (Game.creeps) {
        for (const cName in Game.creeps) {
            const c = Game.creeps[cName];
            if (!c) continue;
            const role = (c.memory && c.memory.role) || (c.heap && c.heap.role);
            if (role === 'harvester') {
                const col = (c.memory && c.memory.colony) || (c.room && c.room.name);
                if (col) localHarvesters[col] = (localHarvesters[col] || 0) + 1;
            }
        }
    }

    for (const rn in Game.rooms) {
        const r = Game.rooms[rn];
        if (!r || !r.controller || !r.controller.my) continue;
        const rs = heap.rooms ? heap.rooms[rn] : null;
        const snap = getColonySnapshot(rn, r, rs);
        snap.localHarvesters = localHarvesters[rn] || 0;
        colonies[rn] = snap;
        colonyNames.push(rn);
    }

    const targets = {};
    for (let i = 0; i < colonyNames.length; i++) {
        const rn = colonyNames[i];
        const snap = colonies[rn];
        if (snap.rcl < 3 || snap.spawns === 0 || (snap.rcl >= 3 && snap.towers === 0) || (snap.rcl < 4 && snap.localHarvesters < 2 && snap.spawns === 0)) {
            targets[rn] = { roomName: rn, isOwned: true, snap };
        }
    }

    const memExpTarget = (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.expansionTarget)
        ? Memory.empire.expansionTarget
        : ((heap.state && heap.state.empire && heap.state.empire.expansionTarget) || null);
    if (memExpTarget && !colonies[memExpTarget]) {
        const gclLevel = (Game.gcl && Game.gcl.level) ? Game.gcl.level : 1;
        const maxCol = cfg.maxColonies !== undefined ? cfg.maxColonies : 10;
        const maxBoot = cfg.maxBootstrappingColonies !== undefined ? cfg.maxBootstrappingColonies : 1;
        const bucket = (Game.cpu && Game.cpu.bucket !== undefined) ? Game.cpu.bucket : 10000;
        const bucketFloor = cfg.cpuBucketFloor !== undefined ? cfg.cpuBucketFloor : 8000;
        const cpuTarget = cfg.cpuTarget !== undefined ? cfg.cpuTarget : 15;
        const cpuHeadroom = cfg.expansionCpuHeadroom !== undefined ? cfg.expansionCpuHeadroom : 3.0;
        const cpuOk = heap.cpuMean50 === undefined || heap.cpuMean50 <= (cpuTarget - cpuHeadroom);
        if (countBootstrappingColonies() < maxBoot && colonyNames.length < Math.min(gclLevel, maxCol) && bucket >= bucketFloor && cpuOk) {
            targets[memExpTarget] = { roomName: memExpTarget, isOwned: false, snap: null };
        }
    }

    for (const existingTarget in bootstrapMissions) {
        if (!targets[existingTarget]) {
            delete bootstrapMissions[existingTarget];
        }
    }

    // Index all living + currently spawning bootstrap creeps per target room
    const countsByTarget = {};
    const ensureTargetCounts = (tRoom) => {
        if (!countsByTarget[tRoom]) {
            countsByTarget[tRoom] = {
                haveClaimer: 0,
                havePioneers: 0,
                haveEscorts: 0,
                bySponsor: {}
            };
        }
        return countsByTarget[tRoom];
    };
    const ensureSponsorCounts = (tCounts, sponsorRoom) => {
        if (!tCounts.bySponsor[sponsorRoom]) {
            tCounts.bySponsor[sponsorRoom] = {
                spawningBootstrap: 0,
                livePioneers: 0,
                liveEscorts: 0
            };
        }
        return tCounts.bySponsor[sponsorRoom];
    };

    const seenSpawningNames = {};
    const recordBootstrapUnit = (role, subRole, tRoom, sponsorRoom, isSpawning) => {
        if (!tRoom) return;
        const tc = ensureTargetCounts(tRoom);
        const sc = sponsorRoom ? ensureSponsorCounts(tc, sponsorRoom) : null;
        if (role === 'claimer') {
            tc.haveClaimer++;
            if (isSpawning && sc) sc.spawningBootstrap++;
        } else if (role === 'pioneer') {
            tc.havePioneers++;
            if (sc) {
                if (isSpawning) sc.spawningBootstrap++;
                else sc.livePioneers++;
            }
        } else if (role === 'defender' && subRole === 'ESCORT') {
            tc.haveEscorts++;
            if (sc) {
                if (isSpawning) sc.spawningBootstrap++;
                else sc.liveEscorts++;
            }
        }
    };

    if (Game.creeps) {
        for (const cName in Game.creeps) {
            const c = Game.creeps[cName];
            if (!c) continue;
            const role = (c.memory && c.memory.role) || (c.heap && c.heap.role);
            if (role !== 'claimer' && role !== 'pioneer' && role !== 'defender') continue;
            const subRole = (c.memory && c.memory.subRole) || (c.heap && c.heap.subRole);
            if (role === 'defender' && subRole !== 'ESCORT') continue;
            if (c.spawning) seenSpawningNames[c.name] = true;
            const tRoom = (c.memory && c.memory.targetRoom) || (c.heap && c.heap.targetRoom) || (role !== 'defender' ? memExpTarget : null);
            const sponsorRoom = (c.memory && c.memory.colony) || (c.room && c.room.name) || null;
            recordBootstrapUnit(role, subRole, tRoom, sponsorRoom, !!c.spawning);
        }
    }

    if (Game.spawns) {
        for (const sName in Game.spawns) {
            const sp = Game.spawns[sName];
            if (!sp || !sp.spawning || !sp.spawning.name) continue;
            const crName = sp.spawning.name;
            if (seenSpawningNames[crName]) continue;
            const spMem = (typeof Memory !== 'undefined' && Memory.creeps && Memory.creeps[crName]) ||
                (heap.creeps && heap.creeps[crName]) || null;
            if (!spMem) continue;
            const role = spMem.role;
            const subRole = spMem.subRole;
            if (role !== 'claimer' && role !== 'pioneer' && !(role === 'defender' && subRole === 'ESCORT')) continue;
            const tRoom = spMem.targetRoom || (role !== 'defender' ? memExpTarget : null);
            const sponsorRoom = spMem.colony || (sp.room && sp.room.name) || null;
            recordBootstrapUnit(role, subRole, tRoom, sponsorRoom, true);
        }
    }

    const minSponsorRcl = cfg.minSponsorRcl !== undefined ? cfg.minSponsorRcl : 4;
    const minSponsorEnergy = cfg.minSponsorEnergy !== undefined ? cfg.minSponsorEnergy : 100000;
    const maxColDist = cfg.maxColonyDistance !== undefined ? cfg.maxColonyDistance : 7;

    for (const tRoom in targets) {
        const entry = targets[tRoom];
        const snap = entry.snap;
        const isOwned = entry.isOwned;
        const tc = countsByTarget[tRoom] || { haveClaimer: 0, havePioneers: 0, haveEscorts: 0, bySponsor: {} };

        const wantClaimer = isOwned ? 0 : 1;
        const wantPioneers = (!isOwned || (snap && snap.spawns === 0))
            ? 4
            : ((snap && (snap.rcl < 3 || snap.towers === 0 || snap.localHarvesters < 2)) ? 2 : 0);
        const wantEscorts = (!snap || snap.towers === 0) ? 2 : 0;

        let closestSponsor = null;
        let closestDist = Infinity;
        let closestEnergy = -1;
        const sponsorList = [];

        for (let i = 0; i < colonyNames.length; i++) {
            const cn = colonyNames[i];
            if (cn === tRoom) continue;
            const cs = colonies[cn];
            if (cs.rcl < minSponsorRcl || cs.storageEnergy < minSponsorEnergy || cs.armedHostiles > 0) continue;
            const dist = getRoomLinearDistSafe(cn, tRoom);
            if (dist > maxColDist) continue;

            if (dist < closestDist || (dist === closestDist && cs.storageEnergy > closestEnergy)) {
                closestDist = dist;
                closestEnergy = cs.storageEnergy;
                closestSponsor = cn;
            }
            sponsorList.push({
                roomName: cn,
                idleSpawns: cs.idleSpawns,
                score: cs.storageEnergy / Math.max(1, dist)
            });
        }

        sponsorList.sort((a, b) => {
            const idleA = a.idleSpawns > 0 ? 1 : 0;
            const idleB = b.idleSpawns > 0 ? 1 : 0;
            if (idleB !== idleA) return idleB - idleA;
            return b.score - a.score;
        });

        const eligibleSponsors = [];
        for (let i = 0; i < sponsorList.length; i++) {
            eligibleSponsors.push(sponsorList[i].roomName);
        }

        bootstrapMissions[tRoom] = {
            targetRoom: tRoom,
            isOwned,
            wantClaimer,
            wantPioneers,
            wantEscorts,
            haveClaimer: tc.haveClaimer,
            havePioneers: tc.havePioneers,
            haveEscorts: tc.haveEscorts,
            closestSponsor,
            eligibleSponsors,
            bySponsor: tc.bySponsor,
            updatedAt: Game.time
        };
    }

    return bootstrapMissions;
}

function evaluateEmpireQrf() {
    const heap = getHeap();
    if (typeof Game === 'undefined' || !Game.rooms) {
        heap.qrfTarget = null;
        heap.qrfSponsors = [];
        heap.qrfThreatCount = 0;
        return null;
    }

    const cfg = getConfig();
    const localDefenders = {};
    if (Game.creeps) {
        for (const cName in Game.creeps) {
            const c = Game.creeps[cName];
            if (!c) continue;
            const role = (c.memory && c.memory.role) || (c.heap && c.heap.role);
            if (role !== 'defender') continue;
            const subRole = (c.memory && c.memory.subRole) || (c.heap && c.heap.subRole);
            if (subRole === 'ESCORT' || subRole === 'QRF') continue;
            const col = (c.memory && c.memory.colony) || (c.room && c.room.name);
            const tRoom = (c.memory && c.memory.targetRoom) || col;
            if (col && tRoom === col) {
                localDefenders[col] = (localDefenders[col] || 0) + 1;
            }
        }
    }

    const colonies = [];
    let bestTarget = null;
    let bestPriority = -1;
    let bestArmed = 0;

    for (const rn in Game.rooms) {
        const r = Game.rooms[rn];
        if (!r || !r.controller || !r.controller.my) continue;
        const rs = heap.rooms ? heap.rooms[rn] : null;
        const snap = getColonySnapshot(rn, r, rs);
        colonies.push(snap);

        const locDef = localDefenders[rn] || 0;
        if (snap.armedHostiles > 0 && (snap.rcl < 4 || (locDef < snap.armedHostiles && snap.towers < 2))) {
            const prio = (snap.rcl < 4 ? 1000 : 0) + snap.armedHostiles * 10 - snap.rcl;
            if (prio > bestPriority) {
                bestPriority = prio;
                bestTarget = rn;
                bestArmed = snap.armedHostiles;
            }
        }
    }

    if (!bestTarget) {
        heap.qrfTarget = null;
        heap.qrfSponsors = [];
        heap.qrfThreatCount = 0;
        return null;
    }

    const minSponsorRcl = cfg.minSponsorRcl !== undefined ? cfg.minSponsorRcl : 4;
    const minQrfEnergy = cfg.siegeTier3Energy !== undefined ? cfg.siegeTier3Energy : 50000;
    const maxColDist = cfg.maxColonyDistance !== undefined ? cfg.maxColonyDistance : 7;

    const sponsors = [];
    for (let i = 0; i < colonies.length; i++) {
        const cs = colonies[i];
        if (cs.roomName === bestTarget) continue;
        if (cs.rcl < minSponsorRcl || cs.storageEnergy < minQrfEnergy || cs.armedHostiles > 0) continue;
        const dist = getRoomLinearDistSafe(cs.roomName, bestTarget);
        if (dist > maxColDist) continue;
        sponsors.push({ roomName: cs.roomName, dist, storageEnergy: cs.storageEnergy });
    }

    sponsors.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return b.storageEnergy - a.storageEnergy;
    });

    heap.qrfTarget = bestTarget;
    heap.qrfThreatCount = bestArmed;
    heap.qrfSponsors = [];
    for (let i = 0; i < sponsors.length && i < 2; i++) {
        heap.qrfSponsors.push(sponsors[i].roomName);
    }
    return bestTarget;
}

function evaluateColonyHealth() {
    if (typeof Game !== 'undefined' && Game.time % 50 !== 0) return;
    const heap = getHeap();
    let energyAvailable = 0;
    let energyCapacity = 0;
    for (const roomName in heap.rooms) {
        const roomState = heap.rooms[roomName];
        if (!roomState) continue;
        const spawns = roomState.spawns || [];
        for (let s = 0; s < spawns.length; s++) {
            energyAvailable += spawns[s].store[RESOURCE_ENERGY] || 0;
            energyCapacity += spawns[s].store.getCapacity(RESOURCE_ENERGY) || 300;
        }
        const extensions = roomState.extensions || [];
        for (let e = 0; e < extensions.length; e++) {
            energyAvailable += extensions[e].store[RESOURCE_ENERGY] || 0;
            energyCapacity += extensions[e].store.getCapacity(RESOURCE_ENERGY) || 50;
        }
    }

    if (Game.time % 50 === 0) {
        let totalCreeps = 0;
        if (Game.creeps) {
            totalCreeps = Object.keys(Game.creeps).length;
        }
        log(2, `[DEBUG] [COLONY_HEALTH] Tick ${Game.time} | Creeps: ${totalCreeps} | Energy: ${energyAvailable}/${energyCapacity}`);
    }
}

// --- RAWMEMORY ASYNCHRONOUS SEGMENT PAGER ---
const SEGMENT_BUFFER = {
    requested: new Set()
};

function requestSegment(segmentId) {
    if (segmentId < 0 || segmentId > 99) return;
    SEGMENT_BUFFER.requested.add(segmentId);
}

function getSegmentData(segmentId) {
    if (typeof RawMemory === 'undefined' || !RawMemory.segments) return null;
    if (typeof RawMemory.segments[segmentId] === 'undefined') return null;
    return RawMemory.segments[segmentId];
}

function setSegmentData(segmentId, data) {
    if (typeof RawMemory === 'undefined' || !RawMemory.segments) return;
    if (segmentId < 0 || segmentId > 99) return;
    RawMemory.segments[segmentId] = typeof data === 'string' ? data : JSON.stringify(data);
    SEGMENT_BUFFER.requested.add(segmentId);
}

function flushSegmentPager() {
    if (typeof RawMemory === 'undefined' || !RawMemory.setActiveSegments) return;
    if (SEGMENT_BUFFER.requested.size === 0) return;
    const requestedArray = Array.from(SEGMENT_BUFFER.requested).slice(0, 10);
    RawMemory.setActiveSegments(requestedArray);
    SEGMENT_BUFFER.requested.clear();
}

function canSearchPath(priority = 0) {
    if (priority >= 10) return true;
    if (!global.heap) global.heap = {};
    if (global.heap.lastPathTick !== Game.time) {
        global.heap.lastPathTick = Game.time;
        global.heap.pathCallsThisTick = 0;
    }
    if (global.heap.pathCallsThisTick >= 4) return false;
    global.heap.pathCallsThisTick++;
    return true;
}

function getAllStructures(roomState) {
    if (!roomState) return [];
    if (roomState._allStructsCached && roomState._allStructsTick === Game.time) {
        return roomState._allStructsCached;
    }
    const list = []
        .concat(roomState.spawns || [])
        .concat(roomState.extensions || [])
        .concat(roomState.containers || [])
        .concat(roomState.towers || [])
        .concat(roomState.links || [])
        .concat(roomState.labs || [])
        .concat(roomState.ramparts || [])
        .concat(roomState.roads || []);

    if (roomState.storage) list.push(roomState.storage);
    if (roomState.terminal) list.push(roomState.terminal);
    if (roomState.factory) list.push(roomState.factory);
    if (roomState.nuker) list.push(roomState.nuker);
    if (roomState.powerSpawns) list.push(...roomState.powerSpawns);
    if (roomState.extractor) list.push(roomState.extractor);
    if (roomState.observer) list.push(roomState.observer);

    const hasHS = !!(roomState.hostileStructures && roomState.hostileStructures.length > 0);
    const hasWalls = !!(roomState.walls && roomState.walls.length > 0);
    if (hasHS && hasWalls) {
        const seen = new Set();
        for (let i = 0; i < list.length; i++) {
            if (list[i] && list[i].id) seen.add(list[i].id);
        }
        const hs = roomState.hostileStructures;
        for (let i = 0; i < hs.length; i++) {
            if (hs[i] && (!hs[i].id || !seen.has(hs[i].id))) {
                if (hs[i].id) seen.add(hs[i].id);
                list.push(hs[i]);
            }
        }
        const wl = roomState.walls;
        for (let i = 0; i < wl.length; i++) {
            if (wl[i] && (!wl[i].id || !seen.has(wl[i].id))) {
                if (wl[i].id) seen.add(wl[i].id);
                list.push(wl[i]);
            }
        }
    } else if (hasHS) {
        const hs = roomState.hostileStructures;
        for (let i = 0; i < hs.length; i++) list.push(hs[i]);
    } else if (hasWalls) {
        const wl = roomState.walls;
        for (let i = 0; i < wl.length; i++) list.push(wl[i]);
    }

    roomState._allStructsCached = list;
    roomState._allStructsTick = (typeof Game !== 'undefined' && Game.time) ? Game.time : 0;
    return list;
}

function recordEnergyTransfer(roomName, targetId, amount) {
    if (!global.heap || !global.heap.staticRooms || !global.heap.staticRooms[roomName]) return;
    const sRoom = global.heap.staticRooms[roomName];

    if (sRoom.extensionIds && sRoom.extensionEnergy) {
        const eIdx = sRoom.extensionIds.indexOf(targetId);
        if (eIdx !== -1) {
            const room = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[roomName] : null;
            const rcl = (room && room.controller) ? room.controller.level : 1;
            const cap = rcl >= 8 ? 200 : (rcl >= 7 ? 100 : 50);
            sRoom.extensionEnergy[eIdx] = Math.min(cap, (sRoom.extensionEnergy[eIdx] || 0) + amount);
            if (sRoom.extensionEnergy[eIdx] >= cap && sRoom.extDirtyMask) {
                sRoom.extDirtyMask[eIdx >> 5] &= ~(1 << (eIdx & 31));
            }
            return;
        }
    }
    if (sRoom.spawnIds && sRoom.spawnEnergy) {
        const sIdx = sRoom.spawnIds.indexOf(targetId);
        if (sIdx !== -1) {
            sRoom.spawnEnergy[sIdx] = Math.min(300, (sRoom.spawnEnergy[sIdx] || 0) + amount);
        }
    }
}

function recordSpawnEnergyDeduction(roomName, cost) {
    if (!global.heap || !global.heap.staticRooms || !global.heap.staticRooms[roomName]) return;
    const sRoom = global.heap.staticRooms[roomName];
    const coreCount = sRoom.coreExtCount || 0;
    const totalExts = sRoom.extensionIds ? sRoom.extensionIds.length : 0;
    let remaining = cost;

    // 1. Deduct from 15 Core Extensions first (indices 0 .. coreCount - 1)
    if (sRoom.extensionEnergy && coreCount > 0) {
        for (let i = 0; i < coreCount && remaining > 0; i++) {
            const avail = sRoom.extensionEnergy[i];
            if (avail > 0) {
                const deduct = Math.min(avail, remaining);
                sRoom.extensionEnergy[i] -= deduct;
                remaining -= deduct;
                if (sRoom.extDirtyMask) sRoom.extDirtyMask[i >> 5] |= (1 << (i & 31));
            }
        }
    }
    // 2. Deduct from Spawns second
    if (remaining > 0 && sRoom.spawnEnergy) {
        for (let i = 0; i < sRoom.spawnEnergy.length && remaining > 0; i++) {
            const avail = sRoom.spawnEnergy[i];
            if (avail > 0) {
                const deduct = Math.min(avail, remaining);
                sRoom.spawnEnergy[i] -= deduct;
                remaining -= deduct;
            }
        }
    }
    // 3. Deduct from Outer Extensions last (indices coreCount .. totalExts - 1)
    if (remaining > 0 && sRoom.extensionEnergy) {
        for (let i = coreCount; i < totalExts && remaining > 0; i++) {
            const avail = sRoom.extensionEnergy[i];
            if (avail > 0) {
                const deduct = Math.min(avail, remaining);
                sRoom.extensionEnergy[i] -= deduct;
                remaining -= deduct;
                if (sRoom.extDirtyMask) sRoom.extDirtyMask[i >> 5] |= (1 << (i & 31));
            }
        }
    }
}

// --- TICK-SLICED COROUTINE TASK SCHEDULER ---
const TASK_HANDLERS = {};

function registerTaskHandler(kind, fn) {
    TASK_HANDLERS[kind] = fn;
}

function scheduleTask(kind, data, dedupKey) {
    const heap = getHeap();
    if (!heap.taskQueue) heap.taskQueue = [];
    if (!heap.taskDedup) heap.taskDedup = new Set();
    if (dedupKey) {
        if (heap.taskDedup.has(dedupKey)) return false;
        heap.taskDedup.add(dedupKey);
    }
    heap.taskQueue.push({ kind: kind, step: 0, data: data || {}, dedupKey: dedupKey || null });
    return true;
}

function runTasks(cpuBudget) {
    const heap = getHeap();
    const queue = heap.taskQueue;
    if (!queue || queue.length === 0) return;
    const budget = cpuBudget !== undefined ? cpuBudget : 2.5;
    const start = (typeof Game !== 'undefined' && Game.cpu) ? Game.cpu.getUsed() : 0;
    let processed = 0;
    const maxOps = queue.length;
    while (queue.length > 0 && processed < maxOps) {
        if (processed > 0 && typeof Game !== 'undefined' && Game.cpu && (Game.cpu.getUsed() - start) >= budget) break;
        const task = queue.shift();
        const handler = TASK_HANDLERS[task.kind];
        let done = true;
        if (handler) {
            try {
                done = handler(task) !== false;
            } catch (e) {
                done = true;
            }
        }
        if (done) {
            if (task.dedupKey && heap.taskDedup) heap.taskDedup.delete(task.dedupKey);
        } else {
            queue.push(task);
        }
        processed++;
    }
}

// --- SEGMENT-BACKED STATIC TERRAIN COMPRESSION (SEGMENTS 20..79) ---
function hashRoomName(roomName) {
    let h = 2166136261;
    for (let i = 0; i < roomName.length; i++) {
        h ^= roomName.charCodeAt(i);
        h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
}

function saveRoomTerrainSegment(roomName, terrain) {
    if (!roomName || !terrain) return null;
    const heap = getHeap();
    if (!heap.staticTerrainCache) heap.staticTerrainCache = {};
    if (heap.staticTerrainCache[roomName]) return heap.staticTerrainCache[roomName];

    const grid = new Uint8Array(2500);
    // Pack 4 tiles per base-64 safe char (2 bits each) -> 625 chars
    let packed = '';
    for (let i = 0; i < 2500; i += 3) {
        const t0 = terrain.get(Math.floor(i / 50), i % 50) & 3;
        const t1 = (i + 1 < 2500) ? (terrain.get(Math.floor((i + 1) / 50), (i + 1) % 50) & 3) : 0;
        const t2 = (i + 2 < 2500) ? (terrain.get(Math.floor((i + 2) / 50), (i + 2) % 50) & 3) : 0;
        grid[i] = t0;
        if (i + 1 < 2500) grid[i + 1] = t1;
        if (i + 2 < 2500) grid[i + 2] = t2;
        packed += String.fromCharCode(64 + (t0 | (t1 << 2) | (t2 << 4)));
    }
    heap.staticTerrainCache[roomName] = grid;

    const segId = 20 + (hashRoomName(roomName) % 60);
    const raw = getSegmentData(segId);
    let obj = {};
    if (raw) {
        try { obj = JSON.parse(raw); } catch (e) { obj = {}; }
    }
    if (!obj[roomName]) {
        obj[roomName] = packed;
        setSegmentData(segId, JSON.stringify(obj));
    }
    return grid;
}

function getStaticTerrainBytes(roomName) {
    const heap = getHeap();
    if (!heap.staticTerrainCache) heap.staticTerrainCache = {};
    if (heap.staticTerrainCache[roomName]) return heap.staticTerrainCache[roomName];

    const segId = 20 + (hashRoomName(roomName) % 60);
    const raw = getSegmentData(segId);
    if (raw) {
        try {
            const obj = JSON.parse(raw);
            const packed = obj && obj[roomName];
            if (packed && packed.length >= 834) {
                const grid = new Uint8Array(2500);
                let idx = 0;
                for (let c = 0; c < packed.length && idx < 2500; c++) {
                    const v = packed.charCodeAt(c) - 64;
                    grid[idx++] = v & 3;
                    if (idx < 2500) grid[idx++] = (v >> 2) & 3;
                    if (idx < 2500) grid[idx++] = (v >> 4) & 3;
                }
                heap.staticTerrainCache[roomName] = grid;
                return grid;
            }
        } catch (e) { /* fall through to live terrain */ }
    } else {
        requestSegment(segId);
    }

    const room = (typeof Game !== 'undefined' && Game.rooms) ? Game.rooms[roomName] : null;
    const terrain = (room && room.getTerrain) ? room.getTerrain()
        : (typeof Game !== 'undefined' && Game.map && Game.map.getRoomTerrain ? Game.map.getRoomTerrain(roomName) : null);
    if (terrain) return saveRoomTerrainSegment(roomName, terrain);
    return null;
}

// --- O(1) TYPEDARRAY REMOTE THREAT ZONING ---
function getRemoteSlot(roomName) {
    const heap = getHeap();
    if (!heap.remoteSlotMap) heap.remoteSlotMap = {};
    if (heap.remoteSlotMap[roomName] !== undefined) return heap.remoteSlotMap[roomName];
    const next = heap.remoteSlotCount || 0;
    if (next >= 256) return hashRoomName(roomName) & 255;
    heap.remoteSlotMap[roomName] = next;
    heap.remoteSlotCount = next + 1;
    return next;
}

function recordRemoteThreatTick(roomName, hasArmedHostile) {
    const heap = getHeap();
    if (!heap.remoteThreatTicks) heap.remoteThreatTicks = new Uint16Array(256);
    if (!heap.remoteClearTicks) heap.remoteClearTicks = new Uint8Array(256);
    if (!heap.remoteExclusionUntil) heap.remoteExclusionUntil = new Int32Array(256);
    if (!heap.remoteExclusionMask) heap.remoteExclusionMask = new Uint32Array(8);
    const slot = getRemoteSlot(roomName);
    if (hasArmedHostile) {
        heap.remoteClearTicks[slot] = 0;
        if (heap.remoteThreatTicks[slot] < 65000) heap.remoteThreatTicks[slot]++;
        if (heap.remoteThreatTicks[slot] > 50) {
            heap.remoteExclusionUntil[slot] = Game.time + 300;
            heap.remoteExclusionMask[slot >> 5] |= (1 << (slot & 31));
            heap.routeExitCache = {};
        }
    } else {
        if (heap.remoteClearTicks[slot] < 25) heap.remoteClearTicks[slot]++;
        if (heap.remoteClearTicks[slot] >= 20) heap.remoteThreatTicks[slot] = 0;
        if (heap.remoteExclusionUntil[slot] <= Game.time) {
            heap.remoteExclusionMask[slot >> 5] &= ~(1 << (slot & 31));
        }
    }
}

function clearRemoteThreat(roomName) {
    const heap = getHeap();
    if (!heap || !heap.remoteSlotMap) return;
    const slot = heap.remoteSlotMap[roomName];
    if (slot !== undefined) {
        if (heap.remoteExclusionMask) heap.remoteExclusionMask[slot >> 5] &= ~(1 << (slot & 31));
        if (heap.remoteThreatTicks) heap.remoteThreatTicks[slot] = 0;
        if (heap.remoteClearTicks) heap.remoteClearTicks[slot] = 25;
        if (heap.remoteExclusionUntil) heap.remoteExclusionUntil[slot] = 0;
    }
    if (heap.remoteRooms && heap.remoteRooms[roomName]) heap.remoteRooms[roomName].safe = true;
    if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].threat) {
        delete Memory.rooms[roomName].threat;
    }
}

function isRemoteExcluded(roomName) {
    const heap = getHeap();
    if (!heap || !heap.remoteSlotMap || !heap.remoteExclusionMask || !heap.remoteExclusionUntil) return false;
    const slot = heap.remoteSlotMap[roomName];
    if (slot === undefined) return false;
    if ((heap.remoteExclusionMask[slot >> 5] & (1 << (slot & 31))) === 0) return false;
    if (heap.remoteExclusionUntil[slot] <= Game.time) {
        heap.remoteExclusionMask[slot >> 5] &= ~(1 << (slot & 31));
        if (heap.remoteThreatTicks) heap.remoteThreatTicks[slot] = 0;
        if (heap.remoteClearTicks) heap.remoteClearTicks[slot] = 25;
        if (heap.remoteRooms && heap.remoteRooms[roomName]) heap.remoteRooms[roomName].safe = true;
        if (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].threat) {
            delete Memory.rooms[roomName].threat;
        }
        return false;
    }
    return true;
}

// --- IMPERIAL BLAST SHIELD ERROR TELEMETRY ---
function reportSubsystemError(systemName, error, roomName) {
    if (!error) return;
    const heap = (typeof global !== 'undefined') ? (global.heap || (global.heap = {})) : {};
    if (!heap.errorLog) heap.errorLog = {};

    const stack = error.stack || error.message || String(error);
    let hash = 0;
    const str = `${systemName}:${stack}`;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    const hashKey = (hash >>> 0).toString(16);
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    const entry = heap.errorLog[hashKey];

    if (entry && (now - entry.lastTick) < 100) {
        entry.count++;
        entry.lastTick = now;
    } else {
        heap.errorLog[hashKey] = {
            system: systemName,
            room: roomName || null,
            stack: stack.slice(0, 300),
            firstTick: now,
            lastTick: now,
            count: 1
        };
        log(1, `[BLAST SHIELD] ⚠️ Subsystem Error in [${systemName}${roomName ? ':' + roomName : ''}]: ${stack.slice(0, 200)}`);

        if (typeof Game !== 'undefined' && Game.notify) {
            const lastNotify = heap._lastErrorNotify || 0;
            if (now - lastNotify >= 1800) {
                heap._lastErrorNotify = now;
                Game.notify(`[TIB BLAST SHIELD] Error in ${systemName} at tick ${now}:\n${stack.slice(0, 500)}`);
            }
        }
    }

    if (typeof Memory !== 'undefined') {
        if (!Memory.empire) Memory.empire = {};
        if (!Memory.empire.errors) Memory.empire.errors = {};
        Memory.empire.errors[hashKey] = {
            system: systemName,
            message: error.message || String(error),
            stack: stack.slice(0, 2000),
            count: ((Memory.empire.errors[hashKey] && Memory.empire.errors[hashKey].count) || 0) + 1,
            lastTick: now
        };
        if (heap) heap.forceMemoryFlush = true;
        markMemoryDirty();
    }

    // Colony-Scoped Maintenance Mode Guard: >= 5 errors in one tick triggers 100-tick maintenance mode
    if (roomName) {
        if (!heap.roomErrors) heap.roomErrors = {};
        if (heap.roomErrors[roomName] && heap.roomErrors[roomName].tick === now) {
            heap.roomErrors[roomName].count++;
        } else {
            heap.roomErrors[roomName] = { tick: now, count: 1 };
        }

        if (heap.roomErrors[roomName].count >= 5) {
            if (!heap.maintenanceMode) heap.maintenanceMode = {};
            heap.maintenanceMode[roomName] = now + 100;
            log(1, `[BLAST SHIELD] 🚨 Room ${roomName} exceeded 5 errors in tick ${now}! Engaging MAINTENANCE_MODE for 100 ticks.`);
        }
    }
}

module.exports = {
    calcBodyPower,
    calcRoomHostilePower,
    calcUnitPower,
    canSearchPath,
    cleanupMemory,
    clearRemoteThreat,
    countBootstrappingColonies,
    evaluateColonyHealth,
    evaluateEmpireQrf,
    flushSegmentPager,
    getAllStructures,
    getBoostMult,
    getEffectiveFreeCapacity,
    getEffectiveStore,
    getExecutionMode,
    getRemoteSlot,
    getRoomIntel,
    getRoomThreatPower,
    getSegmentData,
    getStaticTerrainBytes,
    isFriendlyOrEmpireRoom,
    isRemoteExcluded,
    recordCombatEvents,
    recordEnergyTransfer,
    recordRemoteThreatTick,
    recordSpawnEnergyDeduction,
    registerIntent,
    registerTaskHandler,
    reportSubsystemError,
    requestSegment,
    reserveTransfer,
    reserveWithdraw,
    resetTickLedger,
    resolveMyUsername,
    ROLE_ID,
    runTasks,
    safeSuicide,
    scanGlobalState,
    scanRoom,
    scheduleTask,
    setSegmentData,
    syncEmpireMissions,
    updateRoomThreatIntel,
    createCreepHeap,
    markMemoryDirty
};