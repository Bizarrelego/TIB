// src/traffic.js
// Top-Down Global Path Cache, CostMatrix Cache & ATC Traffic Engine (Chain + 1-Tick Swap + Shove)
const { calcDistance, getDirectionTo, profLap, profCount, packPos, unpackPos, hasSlowMoveRatio } = require('./constants');
const { getAllStructures, canSearchPath, getStaticTerrainBytes, ROLE_ID } = require('./state');
const { FAST_FILLER_POSITIONS } = require('./bunker');

const MAX_ROOM_CREEPS = 250;
const trafficGrid = new Int32Array(2500);
const trafficCreepList = new Array(MAX_ROOM_CREEPS);
const trafficNextSteps = new Int32Array(MAX_ROOM_CREEPS);
const trafficResolvedIntents = new Int32Array(MAX_ROOM_CREEPS);
const trafficPriorityScore = new Int32Array(MAX_ROOM_CREEPS);
const trafficVisited = new Uint8Array(MAX_ROOM_CREEPS);
const trafficSortedIndices = new Uint16Array(MAX_ROOM_CREEPS);
const trainLocks = new Uint8Array(2500);

const ROLE_PRIORITY_TABLE = new Uint8Array(32);
const COMBAT_ROLE_IDS = new Set();
ROLE_PRIORITY_TABLE.fill(2);
if (ROLE_ID) {
    for (const rKey of ['defender', 'raider', 'outpostDefender', 'skGuard', 'skHealer', 'drainer', 'teamWrecker', 'teamHealer', 'bankAttacker', 'bankHealer', 'quad', 'assassin', 'hunter', 'pest']) {
        if (ROLE_ID[rKey] !== undefined) COMBAT_ROLE_IDS.add(ROLE_ID[rKey]);
    }
    if (ROLE_ID.quad !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.quad] = 12;
    if (ROLE_ID.defender !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.defender] = 10;
    if (ROLE_ID.outpostDefender !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.outpostDefender] = 10;
    if (ROLE_ID.skGuard !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.skGuard] = 10;
    if (ROLE_ID.skHealer !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.skHealer] = 10;
    if (ROLE_ID.drainer !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.drainer] = 10;
    if (ROLE_ID.teamWrecker !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.teamWrecker] = 10;
    if (ROLE_ID.teamHealer !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.teamHealer] = 10;
    if (ROLE_ID.bankAttacker !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.bankAttacker] = 10;
    if (ROLE_ID.bankHealer !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.bankHealer] = 10;
    if (ROLE_ID.raider !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.raider] = 9;
    if (ROLE_ID.pioneer !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.pioneer] = 8;
    if (ROLE_ID.harvester !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.harvester] = 8;
    if (ROLE_ID.mineralMiner !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.mineralMiner] = 8;
    if (ROLE_ID.claimer !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.claimer] = 7;
    if (ROLE_ID.reserver !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.reserver] = 7;
    if (ROLE_ID.upgrader !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.upgrader] = 6;
    if (ROLE_ID.fastFiller !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.fastFiller] = 6;
    if (ROLE_ID.hauler !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.hauler] = 5;
    if (ROLE_ID.remoteHauler !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.remoteHauler] = 5;
    if (ROLE_ID.remoteMiner !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.remoteMiner] = 5;
    if (ROLE_ID.bankHauler !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.bankHauler] = 5;
    if (ROLE_ID.praiser !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.praiser] = 5;
    if (ROLE_ID.assassin !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.assassin] = 10;
    if (ROLE_ID.scavenger !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.scavenger] = 5;
    if (ROLE_ID.hunter !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.hunter] = 9;
    if (ROLE_ID.pest !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.pest] = 8;
    if (ROLE_ID.builder !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.builder] = 4;
    if (ROLE_ID.janitor !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.janitor] = 4;
    if (ROLE_ID.distributor !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.distributor] = 3;
    if (ROLE_ID.filler !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.filler] = 2;
    if (ROLE_ID.scout !== undefined) ROLE_PRIORITY_TABLE[ROLE_ID.scout] = 1;
}

function getCreepRoleId(creep) {
    if (creep.heap && creep.heap.roleId !== undefined) return creep.heap.roleId;
    if (!creep.memory || !creep.memory.role) return 255;
    const r = creep.memory.role;
    if (ROLE_ID && ROLE_ID[r] !== undefined) return ROLE_ID[r];
    const rl = r.toLowerCase();
    for (const k in ROLE_ID) {
        if (k.toLowerCase() === rl) return ROLE_ID[k];
    }
    return 255;
}

function ensureTrafficHeap() {
    if (typeof global === 'undefined') return {};
    if (!global.heap) global.heap = {};
    if (!global.heap.costMatrices) global.heap.costMatrices = {};
    if (!global.heap.activeCostMatrices) global.heap.activeCostMatrices = {};
    if (!global.heap.pathCache) global.heap.pathCache = {};
    return global.heap;
}

function isOnControllerDock(creep, rState) {
    if (!creep || !rState) return false;
    const cPos = rState.controllerContainer ? rState.controllerContainer.pos : rState.controllerContainerPos;
    if (cPos && creep.pos.x === cPos.x && creep.pos.y === cPos.y) return true;
    const dock = rState.controllerDockTiles;
    if (dock) {
        const packed = creep.pos.x * 50 + creep.pos.y;
        if (dock[0] === packed || dock[1] === packed) return true;
    }
    return false;
}

function getTrafficPriority(creep) {
    if (!creep) return 0;

    // Power Creep (Operator): Priority 150
    if (creep.powers !== undefined || creep.className !== undefined) {
        return 150;
    }

    if (!creep.memory) return 0;

    const roleId = getCreepRoleId(creep);
    const room = creep.room;
    const heap = ensureTrafficHeap();
    const rState = (room && heap.rooms) ? heap.rooms[room.name] : null;

    // FastFiller Slot Eviction Penalty (-2): Non-fastFiller creeps must never sit on the 4 fastFiller slots
    if (roleId !== 3 && room && typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[room.name] && Memory.rooms[room.name].anchor && Array.isArray(FAST_FILLER_POSITIONS)) {
        const anc = Memory.rooms[room.name].anchor;
        for (let f = 0; f < FAST_FILLER_POSITIONS.length; f++) {
            if (creep.pos.x === anc.x + FAST_FILLER_POSITIONS[f].dx && creep.pos.y === anc.y + FAST_FILLER_POSITIONS[f].dy) {
                return -2;
            }
        }
    }

    // Controller Loading Dock Eviction Penalty (-2): Upgraders/Builders/Pioneers must never block dock or container tile
    if ((roleId === 5 || roleId === 6 || roleId === 10) && isOnControllerDock(creep, rState)) {
        return -2;
    }

    // Spawn Runway Obstruction Penalty (-2):
    // Any creep standing at range 1 of a spawn without an active delivery/transfer intent must yield immediately!
    if (room) {
        const spawns = (rState && rState.spawns) || (room.find ? room.find(FIND_MY_SPAWNS) : []);
        for (let s = 0; s < spawns.length; s++) {
            if (calcDistance(creep.pos, spawns[s].pos) <= 1) {
                const isDelivering = creep.heap && creep.heap.actionIntent === 'transfer' && creep.heap.targetId === spawns[s].id;
                if (!isDelivering) {
                    return -2;
                }
            }
        }
    }

    // Stationary Anchors (Priority 255): Fast-Filler (3), Miner/Harvester (0), Upgrader (5), Mineral Miner (11), Deposit Miner (15)
    // Defer Priority 255 until creep is strictly inPosition. In transit, assign Priority 140.
    if (roleId === 0 || roleId === 3 || roleId === 5 || roleId === 11 || roleId === 15) {
        if (creep.heap && creep.heap.inPosition === true) {
            return 255;
        }
        // En route transit priority (140): pushes haulers/builders (4-5), yields to Operators (150) and stationed anchors (250-255)
        return 140;
    }

    // Stationary Pioneer Miner in position: Immovable Anchor (Priority 250)
    if (roleId === 10 && creep.heap && creep.heap.subRole === 'PIONEER_MINER' && creep.heap.inPosition) {
        return 250;
    }

    // Loaded Delivery Priority (60): Haulers/RemoteHaulers/Distributors carrying energy push cleanly through lower priority
    if ((roleId === 1 || roleId === 12 || roleId === 4) && creep.store && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && (!creep.heap || creep.heap.working !== false)) {
        return 60;
    }

    // Operation Phoenix Builders (State 4): Immovable Anchor (Priority 200) while rebuilding Spawn1
    if (roleId === 6 && room && room.memory && room.memory.phoenix === 4) {
        return 200;
    }

    // 1. Spawning Clearance: Newly spawned creeps leaving the spawn have absolute highest priority
    if (creep.ticksToLive >= 1498) {
        return 15;
    }

    // 2. Idle creeps yield immediately
    if (creep.heap && creep.heap.actionIntent === 'idle') {
        return -1;
    }

    // Pioneers carrying energy exiting dead ends have top right-of-way (roleId 10 = pioneer)
    if (roleId === 10 && creep.store && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        return 9;
    }
    return (roleId < 32) ? ROLE_PRIORITY_TABLE[roleId] : 2;
}

function isCreepStationaryLocked(creep) {
    if (!creep) return false;
    const roleId = getCreepRoleId(creep);
    const room = creep.room;
    const heap = ensureTrafficHeap();
    const rState = (room && heap.rooms) ? heap.rooms[room.name] : null;

    // Never lock upgraders/builders/pioneers standing on the controller loading dock
    if ((roleId === 5 || roleId === 6 || roleId === 10) && isOnControllerDock(creep, rState)) {
        return false;
    }

    // Creeps with anchor roles are ONLY locked if creep.heap.inPosition === true
    if (roleId === 0 || roleId === 3 || roleId === 5 || roleId === 11 || roleId === 15 || roleId === 10) {
        return !!(creep.heap && creep.heap.inPosition === true);
    }

    if (creep.heap && creep.heap.inPosition === true) return true;
    if (creep.heap && creep.heap.locked) return true;

    // Working-Area Protection:
    // Creeps actively performing an in-place action (harvest, upgrade, build, repair)
    // without a registered move intent are locked in place and protected from shoves/swaps
    if (creep.heap && !creep.heap.nextStep && creep.heap.inPosition === true) {
        const intent = creep.heap.actionIntent;
        if (intent === 'harvest' || intent === 'upgrade' || intent === 'build' || intent === 'repair') {
            return true;
        }
    }
    return false;
}

const HEAVY_MOVE_ROLES = new Set([
    'hauler', 'remoteHauler', 'builder', 'upgrader', 'dismantler', 'pioneer', 'janitor', 'mineralMiner', 'bankHauler', 'depositHarvester'
]);

function getBaseTileCost(terrain, roadGrid, x, y, plainCost, swampCost) {
    if (roadGrid && roadGrid[x * 50 + y] === 1) return 1;
    const swampMask = typeof TERRAIN_MASK_SWAMP !== 'undefined' ? TERRAIN_MASK_SWAMP : 2;
    if (terrain && terrain.get && (terrain.get(x, y) & swampMask) !== 0) return swampCost;
    return plainCost;
}

function getCreepMoveProfile(creep) {
    const role = creep && creep.memory ? creep.memory.role : null;
    if ((role && HEAVY_MOVE_ROLES.has(role)) || hasSlowMoveRatio(creep)) {
        return { key: 'heavy', plainCost: 2, swampCost: 25 };
    }
    return { key: 'combat', plainCost: 2, swampCost: 12 };
}

function getRoomTerrainAndRoadGrid(roomName) {
    const heap = ensureTrafficHeap();
    const room = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[roomName] : null;
    const roomState = heap.rooms ? heap.rooms[roomName] : null;
    const terrain = (room && room.getTerrain)
        ? room.getTerrain()
        : (typeof Game !== 'undefined' && Game.map && Game.map.getRoomTerrain ? Game.map.getRoomTerrain(roomName) : null);
    const roadGrid = roomState && roomState.roadGrid ? roomState.roadGrid : null;
    return { terrain, roadGrid, room, roomState };
}

function stampAdditivePenalty(mat, terrain, roadGrid, x, y, penalty, plainCost, swampCost, onStamp) {
    if (!mat || !mat.get || !mat.set) return;
    const cur = mat.get(x, y);
    if (cur >= 255) return;
    const base = cur > 0 ? cur : getBaseTileCost(terrain, roadGrid, x, y, plainCost, swampCost);
    const next = Math.min(254, base + penalty);
    if (onStamp) onStamp(x, y, next);
    else mat.set(x, y, next);
}

function getTrafficCostMatrix(roomName) {
    const heap = ensureTrafficHeap();
    const room = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[roomName] : null;
    const roomState = heap.rooms ? heap.rooms[roomName] : null;

    if (typeof PathFinder === 'undefined' || !PathFinder.CostMatrix) {
        return { get: () => 0, set: () => {}, clone: function() { return this; } };
    }

    const now = typeof Game !== 'undefined' ? Game.time : 0;
    const perTick = heap.activeCostMatrices[roomName];
    if (perTick && perTick.time === now) {
        return perTick.matrix;
    }

    const structures = roomState
        ? getAllStructures(roomState)
        : (room && room.find ? (room.find(FIND_STRUCTURES) || []) : []);
    const sites = roomState && roomState.constructionSites
        ? roomState.constructionSites
        : (room && room.find ? (room.find(FIND_MY_CONSTRUCTION_SITES) || []) : []);

    const structCount = structures.length;
    const siteCount = sites.length;
    const lastStructId = structCount > 0 ? structures[structCount - 1].id : '';

    let cached = heap.costMatrices[roomName];
    let baseMatrix;

    if (cached && now < cached.expires && cached.structCount === structCount && cached.siteCount === siteCount && cached.lastStructId === lastStructId) {
        baseMatrix = cached.matrix;
    } else {
        baseMatrix = new PathFinder.CostMatrix();
        const tBytes = getStaticTerrainBytes ? getStaticTerrainBytes(roomName) : null;
        if (tBytes) {
            for (let idx = 0; idx < 2500; idx++) {
                if (tBytes[idx] === 1) baseMatrix.set(Math.floor(idx / 50), idx % 50, 255);
                // Leave non-road plains and swamps as 0 so PathFinder applies role-specific plainCost/swampCost
            }
        }
        for (let i = 0; i < structCount; i++) {
            const s = structures[i];
            if (s.structureType === STRUCTURE_ROAD) {
                if (baseMatrix.get(s.pos.x, s.pos.y) < 255) {
                    baseMatrix.set(s.pos.x, s.pos.y, 1);
                }
            } else if (
                s.structureType !== STRUCTURE_CONTAINER &&
                (s.structureType !== STRUCTURE_RAMPART || !s.my)
            ) {
                baseMatrix.set(s.pos.x, s.pos.y, 255);
            }
        }
        for (let i = 0; i < siteCount; i++) {
            const s = sites[i];
            if (
                s.structureType !== STRUCTURE_ROAD &&
                s.structureType !== STRUCTURE_CONTAINER &&
                s.structureType !== STRUCTURE_RAMPART
            ) {
                baseMatrix.set(s.pos.x, s.pos.y, 255);
            }
        }

        // Avoid transit creeps walking across stationary fastFiller slots
        const anchor = (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].anchor) ||
            (roomState && roomState.anchor) || null;
        if (anchor && Array.isArray(FAST_FILLER_POSITIONS)) {
            for (let f = 0; f < FAST_FILLER_POSITIONS.length; f++) {
                const fx = anchor.x + FAST_FILLER_POSITIONS[f].dx;
                const fy = anchor.y + FAST_FILLER_POSITIONS[f].dy;
                if (fx > 0 && fx < 49 && fy > 0 && fy < 49) {
                    if (baseMatrix.get(fx, fy) < 254) {
                        baseMatrix.set(fx, fy, 254);
                    }
                }
            }
        }

        // Spawn Runway Protection: add slight cost (+3) to spawn-adjacent tiles without overwriting swamp cost
        const baseTerrain = (room && room.getTerrain) ? room.getTerrain() : null;
        const baseRoadGrid = roomState && roomState.roadGrid ? roomState.roadGrid : null;
        for (let i = 0; i < structCount; i++) {
            const s = structures[i];
            if (s.structureType === STRUCTURE_SPAWN && s.my) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const sx = s.pos.x + dx;
                        const sy = s.pos.y + dy;
                        if (sx > 0 && sx < 49 && sy > 0 && sy < 49) {
                            if (baseMatrix.get(sx, sy) < 254) {
                                stampAdditivePenalty(baseMatrix, baseTerrain, baseRoadGrid, sx, sy, 3, 2, 25);
                            }
                        }
                    }
                }
            }
        }
        heap.costMatrices[roomName] = {
            matrix: baseMatrix,
            activeMatrix: baseMatrix.clone ? baseMatrix.clone() : baseMatrix,
            dirtyTiles: [],
            structCount: structCount,
            siteCount: siteCount,
            lastStructId: lastStructId,
            expires: now + 20
        };
    }

    // Reuse activeMatrix in place: restore only last tick's modified dynamic tiles instead of cloning 2,500 bytes every tick
    const entry = heap.costMatrices[roomName];
    const activeMatrix = (entry && entry.activeMatrix) ? entry.activeMatrix : (baseMatrix.clone ? baseMatrix.clone() : baseMatrix);
    if (entry && entry.dirtyTiles && entry.dirtyTiles.length > 0) {
        const dt = entry.dirtyTiles;
        for (let d = 0; d < dt.length; d += 3) {
            activeMatrix.set(dt[d], dt[d + 1], dt[d + 2]);
        }
        dt.length = 0;
    }
    const dirtyTiles = entry ? entry.dirtyTiles : null;
    const setDyn = (x, y, val) => {
        if (dirtyTiles) dirtyTiles.push(x, y, baseMatrix.get(x, y));
        activeMatrix.set(x, y, val);
    };

    const roomCreeps = roomState && roomState.creeps ? roomState.creeps : [];
    for (let i = 0; i < roomCreeps.length; i++) {
        const c = roomCreeps[i];
        if (!c) continue;
        if (c.heap && c.heap.inPosition === true) {
            if (activeMatrix.get(c.pos.x, c.pos.y) < 254) {
                setDyn(c.pos.x, c.pos.y, 254);
            }
        }
    }

    // Smart Tactical Avoidance: Route around dangerous armed hostiles (additive so swamp penalty is never overwritten)
    const { terrain: dynTerrain, roadGrid: dynRoadGrid } = getRoomTerrainAndRoadGrid(roomName);
    const armedHostiles = roomState && roomState.armedHostiles ? roomState.armedHostiles : [];
    for (let i = 0; i < armedHostiles.length; i++) {
        const h = armedHostiles[i];
        if (!h || !h.pos) continue;
        const hPos = h.pos;
        const hasAttack = h.getActiveBodyparts && h.getActiveBodyparts(ATTACK) > 0;
        const hasRanged = h.getActiveBodyparts && h.getActiveBodyparts(RANGED_ATTACK) > 0;

        setDyn(hPos.x, hPos.y, 254);

        const threatPenalty = hasAttack ? 45 : (hasRanged ? 25 : 0);
        if (threatPenalty > 0) {
            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                    const nx = hPos.x + dx;
                    const ny = hPos.y + dy;
                    if (nx > 0 && nx < 49 && ny > 0 && ny < 49) {
                        if (activeMatrix.get(nx, ny) < 254) {
                            stampAdditivePenalty(activeMatrix, dynTerrain, dynRoadGrid, nx, ny, threatPenalty, 2, 25, setDyn);
                        }
                    }
                }
            }
        }
    }

    heap.activeCostMatrices[roomName] = { time: now, matrix: activeMatrix };
    return activeMatrix;
}

function getPathKey(originPos, targetPos, range, profileKey) {
    const oRoom = originPos.roomName || '';
    const tRoom = targetPos.roomName || oRoom;
    return `${oRoom}:${originPos.x},${originPos.y}->${tRoom}:${targetPos.x},${targetPos.y}:${range}:${profileKey || 'combat'}`;
}

function toRoomPosition(pos, fallbackRoom) {
    if (typeof RoomPosition !== 'undefined' && !(pos instanceof RoomPosition)) {
        const rName = pos.roomName || (pos.room && pos.room.name) || fallbackRoom || 'W1N1';
        return new RoomPosition(pos.x, pos.y, rName);
    }
    return pos;
}

function getCombatAvoidanceMatrix(roomName, friendlyCost) {
    getTrafficCostMatrix(roomName);
    const heap = ensureTrafficHeap();
    const entry = heap.costMatrices ? heap.costMatrices[roomName] : null;
    const baseStructMat = (entry && entry.matrix) ? entry.matrix : ((heap.activeCostMatrices && heap.activeCostMatrices[roomName]) ? heap.activeCostMatrices[roomName].matrix : null);
    if (!baseStructMat || typeof baseStructMat.clone !== 'function') return baseStructMat;

    // Clone pure structural matrix and add friendly-creep avoidance additively (capped <= 8, strictly below swampCost=12)
    const mat = baseStructMat.clone();
    const { terrain, roadGrid, roomState } = getRoomTerrainAndRoadGrid(roomName);
    const roomCreeps = (roomState && roomState.creeps) || [];
    const penalty = Math.min(8, Math.max(1, friendlyCost !== undefined ? friendlyCost : 6));
    for (let i = 0; i < roomCreeps.length; i++) {
        const c = roomCreeps[i];
        if (!c || !c.pos) continue;
        stampAdditivePenalty(mat, terrain, roadGrid, c.pos.x, c.pos.y, penalty, 2, 12);
    }
    return mat;
}

function findPathTo(originOrCreep, targetPos, range, customMatrix) {
    const destRange = range !== undefined ? range : 1;
    const rawOrigin = originOrCreep.pos || originOrCreep;
    const oRoom = rawOrigin.roomName || (originOrCreep.room && originOrCreep.room.name) || 'W1N1';
    const originPos = toRoomPosition(rawOrigin, oRoom);
    const tPos = targetPos.pos || targetPos;
    const tRoom = tPos.roomName || oRoom;
    const normalizedTarget = toRoomPosition({ x: tPos.x, y: tPos.y, roomName: tRoom }, tRoom);

    const profile = getCreepMoveProfile(originOrCreep);
    const heap = ensureTrafficHeap();
    const key = getPathKey(originPos, normalizedTarget, destRange, profile.key);
    const now = typeof Game !== 'undefined' ? Game.time : 0;

    if (!customMatrix) {
        const cached = heap.pathCache[key];
        if (cached && now < cached.expires && cached.steps && cached.steps.length > 0) {
            return cached.steps;
        }
    }

    const priority = (originOrCreep && originOrCreep.memory) ? getTrafficPriority(originOrCreep) : 0;
    if (!customMatrix && !canSearchPath(priority)) {
        const cached = heap.pathCache[key];
        return cached && cached.steps ? cached.steps : [];
    }

    const r = PathFinder.search(originPos, { pos: normalizedTarget, range: destRange }, {
        plainCost: profile.plainCost,
        swampCost: profile.swampCost,
        roomCallback: customMatrix ? (() => customMatrix) : getTrafficCostMatrix,
        maxRooms: oRoom === tRoom ? 1 : 4
    });

    const rawPath = r.path || [];
    const steps = new Uint32Array(rawPath.length);
    for (let i = 0; i < rawPath.length; i++) {
        steps[i] = packPos(rawPath[i].x, rawPath[i].y, rawPath[i].roomName || originPos.roomName);
    }

    // Evict expired or excess entries when pathCache exceeds 1,000 keys
    if (heap.pathCacheSize === undefined) heap.pathCacheSize = 0;
    if (heap.pathCacheSize >= 1000) {
        let k = 0;
        let kept = 0;
        for (const pk in heap.pathCache) {
            if (heap.pathCache[pk].expires <= now || k < 200) {
                delete heap.pathCache[pk];
            } else {
                kept++;
            }
            k++;
        }
        heap.pathCacheSize = kept;
    }
    if (!heap.pathCache[key]) heap.pathCacheSize++;

    heap.pathCache[key] = {
        steps: steps,
        expires: now + 250
    };

    return steps;
}

function moveCreep(creep, target, range, opts) {
    if (!creep || creep.fatigue > 0) return ERR_TIRED;

    let destRange = range !== undefined ? range : 1;
    const rawTarget = target.pos || target;
    // Defensive Range Floor: construction site targets must never path closer than range 3 to prevent anchor gridlock
    if (destRange < 3 && ((target && target.progressTotal !== undefined) || (creep.memory && creep.memory.role === 'builder' && target && target.structureType && target.hitsMax === undefined))) {
        destRange = 3;
    }
    const targetPos = {
        x: rawTarget.x,
        y: rawTarget.y,
        roomName: rawTarget.roomName || creep.pos.roomName || (creep.room && creep.room.name)
    };
    const sameRoom = !targetPos.roomName || targetPos.roomName === creep.pos.roomName;
    const dist = sameRoom ? calcDistance(creep.pos, targetPos) : Infinity;

    if (dist <= destRange) {
        if (creep.heap) {
            creep.heap._pathKey = null;
            creep.heap._targetSig = null;
            creep.heap._stepIdx = 0;
            creep.heap.path = null;
            creep.heap.pathBuffer = null;
        }
        return OK;
    }

    if (!creep.heap) creep.heap = {};
    const cHeap = creep.heap;
    cHeap._targetPos = targetPos;
    cHeap._destRange = destRange;

    // Direct 1-Step Adjacency Fast-Path
    if (sameRoom && dist === destRange + 1) {
        const room = Game.rooms[creep.pos.roomName];
        const terrain = room && room.getTerrain ? room.getTerrain() : null;
        const matrix = (opts && opts.costMatrix) || getTrafficCostMatrix(creep.pos.roomName);
        let bestTile = null;
        let bestScore = Infinity;

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = creep.pos.x + dx;
                const ny = creep.pos.y + dy;

                if (nx < 0 || nx > 49 || ny < 0 || ny > 49) continue;

                // Allow stepping onto border tiles (0/49) ONLY when targetPos itself is an exit tile
                if ((nx === 0 || nx === 49 || ny === 0 || ny === 49) &&
                    targetPos.x !== 0 && targetPos.x !== 49 && targetPos.y !== 0 && targetPos.y !== 49) {
                    continue;
                }

                if (calcDistance({ x: nx, y: ny }, targetPos) > destRange) continue;

                if (terrain && terrain.get(nx, ny) === TERRAIN_MASK_WALL) continue;

                let tileCost = matrix && matrix.get ? matrix.get(nx, ny) : 0;
                if (tileCost === 255 || (tileCost === 254 && getCreepRoleId(creep) !== 3)) continue;
                if (tileCost === 0) {
                    const prof = getCreepMoveProfile(creep);
                    const rSt = global.heap && global.heap.rooms ? global.heap.rooms[creep.pos.roomName] : null;
                    tileCost = getBaseTileCost(terrain, rSt ? rSt.roadGrid : null, nx, ny, prof.plainCost, prof.swampCost);
                }

                if (tileCost < bestScore) {
                    bestScore = tileCost;
                    bestTile = { x: nx, y: ny, roomName: creep.pos.roomName };
                }
            }
        }

        if (bestTile) {
            cHeap.nextStep = bestTile;
            return OK;
        }
    }

    const targetSig = `${targetPos.roomName || ''}:${targetPos.x},${targetPos.y}:${destRange}`;
    let steps = null;

    const customMat = opts && opts.costMatrix ? opts.costMatrix : null;
    if (!customMat && cHeap._targetSig === targetSig && (cHeap.pathBuffer || cHeap.path) && ((cHeap.pathBuffer && cHeap.pathBuffer.length > 0) || (cHeap.path && cHeap.path.length > 0))) {
        steps = cHeap.pathBuffer || cHeap.path;
    } else {
        const key = getPathKey(creep.pos, targetPos, destRange);
        steps = findPathTo(creep.pos, targetPos, destRange, customMat);
        cHeap._targetSig = targetSig;
        cHeap._pathKey = key;
        cHeap._stepIdx = 0;
        if (steps instanceof Uint32Array) {
            cHeap.pathBuffer = steps;
            cHeap.path = null;
        } else {
            cHeap.path = steps;
            cHeap.pathBuffer = null;
        }
    }

    if (!steps || !steps.length) return ERR_NO_PATH;

    const isPacked = steps instanceof Uint32Array;

    // Synchronize _stepIdx with current creep position
    let idx = cHeap._stepIdx || 0;
    for (let s = idx; s < steps.length; s++) {
        const sx = isPacked ? (steps[s] & 0x3F) : steps[s].x;
        const sy = isPacked ? ((steps[s] >>> 6) & 0x3F) : steps[s].y;
        if (sx === creep.pos.x && sy === creep.pos.y) {
            idx = s + 1;
            break;
        }
    }

    // If step[0] is adjacent to creep.pos, idx 0 IS the next step to walk onto!
    if (idx === 0 && steps.length > 0) {
        const s0x = isPacked ? (steps[0] & 0x3F) : steps[0].x;
        const s0y = isPacked ? ((steps[0] >>> 6) & 0x3F) : steps[0].y;
        if (s0x === creep.pos.x && s0y === creep.pos.y) {
            idx = 1;
        }
    }

    // If off-path, compute fresh path from current position
    let offPath = false;
    if (idx < steps.length) {
        const curX = isPacked ? (steps[idx] & 0x3F) : steps[idx].x;
        const curY = isPacked ? ((steps[idx] >>> 6) & 0x3F) : steps[idx].y;
        if (Math.max(Math.abs(creep.pos.x - curX), Math.abs(creep.pos.y - curY)) > 1) {
            offPath = true;
        }
    }

    if (offPath) {
        const key = getPathKey(creep.pos, targetPos, destRange);
        steps = findPathTo(creep.pos, targetPos, destRange, customMat);
        cHeap._targetSig = targetSig;
        cHeap._pathKey = key;
        cHeap._stepIdx = 0;
        if (steps instanceof Uint32Array) {
            cHeap.pathBuffer = steps;
            cHeap.path = null;
        } else {
            cHeap.path = steps;
            cHeap.pathBuffer = null;
        }
        idx = 0;
        const repacked = steps instanceof Uint32Array;
        while (idx < steps.length) {
            const rx = repacked ? (steps[idx] & 0x3F) : steps[idx].x;
            const ry = repacked ? ((steps[idx] >>> 6) & 0x3F) : steps[idx].y;
            if (rx === creep.pos.x && ry === creep.pos.y) {
                idx++;
            } else {
                break;
            }
        }
    }

    cHeap._stepIdx = idx;

    if (idx >= steps.length) {
        // Direct adjacency fallback when 1 tile outside destRange
        if (sameRoom && dist === destRange + 1) {
            const dx = Math.sign(targetPos.x - creep.pos.x);
            const dy = Math.sign(targetPos.y - creep.pos.y);
            cHeap.nextStep = { x: creep.pos.x + dx, y: creep.pos.y + dy, roomName: creep.room.name };
            return OK;
        }

        return ERR_NO_PATH;
    }

    const nextStep = (steps instanceof Uint32Array) ? unpackPos(steps[idx]) : steps[idx];

    // If nextStep is blocked by a terrain wall or an impassable structure (e.g. a 1-step path that omits the origin), route around it!
    const room = Game.rooms[creep.pos.roomName];
    const terrain = room && room.getTerrain ? room.getTerrain() : null;
    const matrix = customMat || getTrafficCostMatrix(creep.pos.roomName);

    if ((terrain && terrain.get(nextStep.x, nextStep.y) === TERRAIN_MASK_WALL) ||
        (matrix && matrix.get && matrix.get(nextStep.x, nextStep.y) === 255)) {
        let bestAlt = null;
        let bestScore = Infinity;
        const rSt = global.heap && global.heap.rooms ? global.heap.rooms[creep.pos.roomName] : null;
        const roadGrid = rSt ? rSt.roadGrid : null;
        const prof = getCreepMoveProfile(creep);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const ax = creep.pos.x + dx;
                const ay = creep.pos.y + dy;

                if (ax < 0 || ax > 49 || ay < 0 || ay > 49) continue;

                if (terrain && terrain.get(ax, ay) === TERRAIN_MASK_WALL) continue;

                if (matrix && matrix.get && matrix.get(ax, ay) === 255) continue;

                const d = calcDistance({ x: ax, y: ay }, nextStep);
                const tCost = getBaseTileCost(terrain, roadGrid, ax, ay, prof.plainCost, prof.swampCost);
                const score = d * 10 + tCost;

                if (score < bestScore) {
                    bestScore = score;
                    bestAlt = { x: ax, y: ay, roomName: creep.pos.roomName };
                }
            }
        }

        if (bestAlt) {
            cHeap.nextStep = bestAlt;
            return OK;
        }
    }

    cHeap.nextStep = {
        x: nextStep.x,
        y: nextStep.y,
        roomName: nextStep.roomName || targetPos.roomName || creep.room.name
    };

    return OK;
}

const MAX_SEARCH_DEPTH = 8;
const trafficStack = new Int16Array(MAX_SEARCH_DEPTH);
const targetStack = new Int16Array(MAX_SEARCH_DEPTH);
const branchStack = new Int8Array(MAX_SEARCH_DEPTH);
const DIRS_50 = [-51, -50, -49, -1, 1, 49, 50, 51];

// Zero-GC Iterative Bounded-Depth (Max Depth 8) Traffic Chain Solver
function solveTrafficChain(rootCreepIdx, rootTargetPacked, minScore, terrain, matrix) {
    let depth = 0;
    trafficVisited[rootCreepIdx] = 1; // Cycle detection mask for chain root
    trafficStack[0] = rootCreepIdx;
    targetStack[0] = rootTargetPacked;
    branchStack[0] = 0;

    while (depth >= 0 && depth < MAX_SEARCH_DEPTH) {
        const cIdx = trafficStack[depth];
        const tPacked = targetStack[depth];
        const tx = tPacked % 50;
        const ty = Math.floor(tPacked / 50);

        if (tx < 0 || tx > 49 || ty < 0 || ty > 49 ||
            (terrain.get && terrain.get(tx, ty) === TERRAIN_MASK_WALL) ||
            (matrix.get && matrix.get(tx, ty) === 255)) {
            depth--;
            continue;
        }

        const blockerIdx = trafficGrid[tPacked];
        if (blockerIdx === -1) {
            // Empty walkable tile reached! Unwind and commit chain intents
            for (let d = depth - 1; d >= 0; d--) {
                const mover = trafficStack[d];
                const dest = targetStack[d];
                trafficResolvedIntents[mover] = dest;
                trafficGrid[dest] = mover;
            }
            return true;
        }

        const blocker = trafficCreepList[blockerIdx];
        if (!blocker || blocker.fatigue > 0 || trafficVisited[blockerIdx] ||
            trafficPriorityScore[blockerIdx] >= 255 || minScore < trafficPriorityScore[blockerIdx] || isCreepStationaryLocked(blocker)) {
            depth--;
            continue;
        }

        trafficVisited[blockerIdx] = 1;
        const branch = branchStack[depth];

        // Branch 0: Try blocker's intended move first
        if (branch === 0) {
            branchStack[depth] = 1;
            const bTarget = trafficNextSteps[blockerIdx];
            if (bTarget >= 0 && bTarget !== tPacked) {
                depth++;
                if (depth < MAX_SEARCH_DEPTH) {
                    trafficStack[depth] = blockerIdx;
                    targetStack[depth] = bTarget;
                    branchStack[depth] = 0;
                    continue;
                } else {
                    depth--;
                }
            }
        }

        // Branch 1..8: Try adjacent shove tiles
        if (branch >= 1 && branch <= 8) {
            let shoved = false;
            for (let d = branch - 1; d < 8; d++) {
                branchStack[depth] = d + 2;
                const altPacked = tPacked + DIRS_50[d];
                if (altPacked < 0 || altPacked >= 2500) continue;
                if (blocker.heap && blocker.heap._prevPos === altPacked) continue;
                const ax = altPacked % 50;
                const ay = Math.floor(altPacked / 50);
                if (ax <= 0 || ax >= 49 || ay <= 0 || ay >= 49) continue;
                if (terrain.get && terrain.get(ax, ay) === TERRAIN_MASK_WALL) continue;
                if (matrix.get && matrix.get(ax, ay) === 255) continue;

                if (trafficGrid[altPacked] === -1) {
                    trafficResolvedIntents[blockerIdx] = altPacked;
                    trafficGrid[altPacked] = blockerIdx;
                    trafficGrid[tPacked] = -1;
                    for (let prev = depth - 1; prev >= 0; prev--) {
                        const m = trafficStack[prev];
                        const dst = targetStack[prev];
                        trafficResolvedIntents[m] = dst;
                        trafficGrid[dst] = m;
                    }
                    shoved = true;
                    break;
                }
            }
            if (shoved) return true;
        }

        // Branch 9: Corridor push in reverse direction away from pusher
        if (branch === 9) {
            branchStack[depth] = 10;
            const pusher = trafficCreepList[cIdx];
            if (pusher) {
                const dx = tx - pusher.pos.x;
                const dy = ty - pusher.pos.y;
                const rx = tx + dx;
                const ry = ty + dy;
                if (rx > 0 && rx < 49 && ry > 0 && ry < 49) {
                    const rPacked = (ry * 50) + rx;
                    if ((!terrain.get || terrain.get(rx, ry) !== TERRAIN_MASK_WALL) && (!matrix.get || matrix.get(rx, ry) !== 255)) {
                        depth++;
                        if (depth < MAX_SEARCH_DEPTH) {
                            trafficStack[depth] = blockerIdx;
                            targetStack[depth] = rPacked;
                            branchStack[depth] = 0;
                            continue;
                        } else {
                            depth--;
                        }
                    }
                }
            }
        }

        depth--; // Backtrack
    }

    return false;
}

function resolveRoomTraffic(roomName, creeps) {
    const len = Math.min(creeps.length, MAX_ROOM_CREEPS);
    if (!len) return;

    const room = Game.rooms[roomName];
    const rHeap = ensureTrafficHeap();
    const rState = rHeap.rooms ? rHeap.rooms[roomName] : null;
    const rSpawns = (rState && rState.spawns) || (room && !rState && room.find ? room.find(FIND_MY_SPAWNS) : []);

    let hasMoverOrEvac = false;
    for (let i = 0; i < len; i++) {
        const c = creeps[i];
        if (!c || c.fatigue > 0) continue;
        const hp = c.heap;
        if (hp && hp.nextStep) { hasMoverOrEvac = true; break; }
        if (c.pos.x === 0 || c.pos.x === 49 || c.pos.y === 0 || c.pos.y === 49) { hasMoverOrEvac = true; break; }
        if (rSpawns.length > 0 && !(hp && hp.inPosition === true)) {
            for (let s = 0; s < rSpawns.length; s++) {
                if (calcDistance(c.pos, rSpawns[s].pos) <= 1) { hasMoverOrEvac = true; break; }
            }
            if (hasMoverOrEvac) break;
        }
    }
    if (!hasMoverOrEvac) {
        for (let i = 0; i < len; i++) {
            const c = creeps[i];
            if (c && c.heap) {
                c.heap._lastTickPos = (c.pos.y * 50) + c.pos.x;
                c.heap.stuckTicks = 0;
                c.heap.nextStep = null;
            }
        }
        return;
    }

    trafficGrid.fill(-1);
    trafficNextSteps.fill(-1, 0, len);
    trafficResolvedIntents.fill(-1, 0, len);
    trafficPriorityScore.fill(0, 0, len);
    trainLocks.fill(0);

    const terrain = room && room.getTerrain ? room.getTerrain() : { get: () => 0 };
    profLap('traf:pre');
    const matrix = getTrafficCostMatrix(roomName);
    profLap('traf:costMatrix');

    for (let i = 0; i < len; i++) {
        const creep = creeps[i];
        trafficCreepList[i] = creep;
        const packed = (creep.pos.y * 50) + creep.pos.x;
        trafficGrid[packed] = i;

        const hp = creep.heap;
        const onBorder = (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49);
        if (!onBorder && hp && hp.inPosition === true && !hp.nextStep) {
            const roleId = getCreepRoleId(creep);
            const isStationAnchor = (roleId === 0 || roleId === 3 || roleId === 4 || roleId === 5 || roleId === 11 || roleId === 15);
            if (isStationAnchor && !(roleId === 5 && isOnControllerDock(creep, rState))) {
                trafficPriorityScore[i] = 255;
                trafficNextSteps[i] = -1;
                hp.stuckTicks = 0;
                hp._lastTickPos = packed;
                continue;
            }
        }

        trafficPriorityScore[i] = getTrafficPriority(creep);

        // Border Evacuation: if a creep is on a room border tile (0 or 49) and has no valid exit move, step inward immediately!
        if (creep.fatigue === 0 && onBorder) {
            if (!creep.heap || !creep.heap.nextStep || (creep.heap.nextStep.x === creep.pos.x && creep.heap.nextStep.y === creep.pos.y)) {
                const ix = creep.pos.x === 0 ? 1 : (creep.pos.x === 49 ? 48 : creep.pos.x);
                const iy = creep.pos.y === 0 ? 1 : (creep.pos.y === 49 ? 48 : creep.pos.y);
                let safeStep = null;
                if (!terrain.get || terrain.get(ix, iy) !== TERRAIN_MASK_WALL) {
                    safeStep = { x: ix, y: iy, roomName: roomName };
                } else {
                    for (let dx = -1; dx <= 1 && !safeStep; dx++) {
                        for (let dy = -1; dy <= 1 && !safeStep; dy++) {
                            const ax = creep.pos.x + dx;
                            const ay = creep.pos.y + dy;
                            if (ax > 0 && ax < 49 && ay > 0 && ay < 49 && (!terrain.get || terrain.get(ax, ay) !== TERRAIN_MASK_WALL)) {
                                safeStep = { x: ax, y: ay, roomName: roomName };
                            }
                        }
                    }
                }
                if (safeStep) {
                    if (!creep.heap) creep.heap = {};
                    creep.heap.nextStep = safeStep;
                }
            }
        }

        // Yield-to-Spawn Exit (Priority = -2) & Automated Spawn Runway Evacuation:
        // Any non-locked creep within range 1 of a spawn (especially while actively spawning) yields immediately
        const roleId = getCreepRoleId(creep);
        const isLockedPhoenix = (roleId === 6 && room && room.memory && room.memory.phoenix === 4);
        if (creep.fatigue === 0 && !isCreepStationaryLocked(creep) && roleId !== 3 && !isLockedPhoenix) {
            let blockingSpawn = null;
            for (let s = 0; s < rSpawns.length; s++) {
                if (calcDistance(creep.pos, rSpawns[s].pos) <= 1) {
                    const isDelivering = creep.heap && creep.heap.actionIntent === 'transfer' && creep.heap.targetId === rSpawns[s].id;
                    if (rSpawns[s].spawning) {
                        trafficPriorityScore[i] = -2;
                    }
                    if (!isDelivering && (!creep.heap || !creep.heap.nextStep || rSpawns[s].spawning)) {
                        blockingSpawn = rSpawns[s];
                        break;
                    }
                }
            }
            if (blockingSpawn && (!creep.heap || !creep.heap.nextStep)) {
                let bestEvacTile = null;
                for (let dx = -1; dx <= 1 && !bestEvacTile; dx++) {
                    for (let dy = -1; dy <= 1 && !bestEvacTile; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const ex = creep.pos.x + dx;
                        const ey = creep.pos.y + dy;
                        if (ex <= 1 || ex >= 48 || ey <= 1 || ey >= 48) continue;
                        if (terrain.get && terrain.get(ex, ey) === TERRAIN_MASK_WALL) continue;
                        if (matrix.get && matrix.get(ex, ey) === 255) continue;
                        if (calcDistance({ x: ex, y: ey }, blockingSpawn.pos) >= 2) {
                            bestEvacTile = { x: ex, y: ey, roomName: roomName };
                        }
                    }
                }
                if (bestEvacTile) {
                    if (!creep.heap) creep.heap = {};
                    creep.heap.nextStep = bestEvacTile;
                    trafficPriorityScore[i] = -2;
                }
            }
        }

        if (creep.heap && creep.heap.nextStep && creep.fatigue === 0) {
            const step = creep.heap.nextStep;
            if (!step.roomName || step.roomName === roomName) {
                trafficNextSteps[i] = (step.y * 50) + step.x;
            } else {
                trafficNextSteps[i] = -2; // Leaving room via exit
            }
        } else {
            trafficNextSteps[i] = -1;
        }

        // Track stuckTicks for 3-tick bailout
        if (!creep.heap) creep.heap = {};
        if (creep.heap._lastTickPos === packed && trafficNextSteps[i] >= 0 && creep.fatigue === 0) {
            creep.heap.stuckTicks = (creep.heap.stuckTicks || 0) + 1;
        } else if (creep.heap._lastTickPos !== packed) {
            creep.heap.stuckTicks = 0;
        }
        creep.heap._lastTickPos = packed;
    }

    profLap('traf:setupLoop');
    // 1. 1-Tile Tile Swap Resolution: If A wants B's tile and B wants A's tile (or B is unlocked/on a road corridor), swap in 1 tick!
    const roomStateTraffic = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    const trafficRoadGrid = roomStateTraffic && roomStateTraffic.roadGrid ? roomStateTraffic.roadGrid : null;
    for (let i = 0; i < len; i++) {
        if (trafficResolvedIntents[i] !== -1) continue;
        const nextA = trafficNextSteps[i];
        if (nextA < 0) continue;

        const j = trafficGrid[nextA];
        if (j === -1 || j === i || trafficResolvedIntents[j] !== -1) continue;

        const creepA = trafficCreepList[i];
        const creepB = trafficCreepList[j];
        if (!creepB || creepB.fatigue > 0) continue;

        const origA = (creepA.pos.y * 50) + creepA.pos.x;
        const nextB = trafficNextSteps[j];

        // Case 1a: Mutual swap (A wants B's tile AND B wants A's tile)
        if (nextB === origA) {
            trafficResolvedIntents[i] = nextA;
            trafficResolvedIntents[j] = origA;
            trafficGrid[origA] = j;
            trafficGrid[nextA] = i;
            continue;
        }

        // Case 1b: B has no move intent (idle/waiting), or both are on a road corridor where swapping beats swamp sidestep
        const origAIdx = creepA.pos.x * 50 + creepA.pos.y;
        const origBIdx = creepB.pos.x * 50 + creepB.pos.y;
        const bothOnRoads = !!(trafficRoadGrid && trafficRoadGrid[origAIdx] === 1 && trafficRoadGrid[origBIdx] === 1);
        const canSwapIdle = nextB === -1 && !isCreepStationaryLocked(creepB) && trafficPriorityScore[i] >= trafficPriorityScore[j];
        const canSwapRoadHeadOn = bothOnRoads && nextB !== -1 && trafficGrid[nextB] !== -1 &&
            !isCreepStationaryLocked(creepB) && trafficPriorityScore[i] >= trafficPriorityScore[j];
        if (canSwapIdle || canSwapRoadHeadOn) {
            trafficResolvedIntents[i] = nextA;
            trafficResolvedIntents[j] = origA;
            trafficGrid[origA] = j;
            trafficGrid[nextA] = i;
        }
    }

    // Insertion sort indices by descending priority (zero-allocation vs Array.from)
    for (let i = 0; i < len; i++) trafficSortedIndices[i] = i;
    for (let i = 1; i < len; i++) {
        const keyIdx = trafficSortedIndices[i];
        const keyScore = trafficPriorityScore[keyIdx];
        let j = i - 1;
        while (j >= 0 && trafficPriorityScore[trafficSortedIndices[j]] < keyScore) {
            trafficSortedIndices[j + 1] = trafficSortedIndices[j];
            j--;
        }
        trafficSortedIndices[j + 1] = keyIdx;
    }

    // Train Locking: High priority creeps (priority >= 8) lock their next step tile
    for (let k = 0; k < len; k++) {
        const i = trafficSortedIndices[k];
        const next = trafficNextSteps[i];
        if (next >= 0 && trafficPriorityScore[i] >= 8) {
            trainLocks[next] = 1;
        } else if (next >= 0 && trafficPriorityScore[i] < 8) {
            if (trainLocks[next] === 1) {
                trafficNextSteps[i] = -1;
            }
        }
    }

    profLap('traf:swap');
    // 2. DFS Chain & Shoving Resolution (with locked-creep sidestep fallback)
    for (let k = 0; k < len; k++) {
        const i = trafficSortedIndices[k];
        if (trafficNextSteps[i] === -1 || trafficNextSteps[i] === -2) continue;
        if (trafficResolvedIntents[i] !== -1) continue;

        const targetPacked = trafficNextSteps[i];
        trafficVisited.fill(0, 0, len);
        const ok = solveTrafficChain(i, targetPacked, trafficPriorityScore[i], terrain, matrix);

        if (ok) {
            trafficResolvedIntents[i] = targetPacked;
            const origPacked = (trafficCreepList[i].pos.y * 50) + trafficCreepList[i].pos.x;
            if (trafficGrid[origPacked] === i) trafficGrid[origPacked] = -1;
            trafficGrid[targetPacked] = i;
        } else {
            // Sidestep fallback: if blocked by a locked creep (inPosition === true), step to an open adjacent tile closer/orthogonal to target
            const creep = trafficCreepList[i];
            const tx = targetPacked % 50;
            const ty = Math.floor(targetPacked / 50);

            // ANTI-JITTER: If already within range of non-combat work destination, do not sidestep.
            // Combat roles always sidestep so frontliners spread into adjacent range-1 rampart slots!
            let skipSidestep = false;
            const roleIdNow = getCreepRoleId(creep);
            if (!COMBAT_ROLE_IDS.has(roleIdNow) && creep.heap && creep.heap._targetPos) {
                const cTarget = creep.heap._targetPos;
                const cRange = creep.heap._destRange !== undefined ? creep.heap._destRange : 1;
                if (calcDistance(creep.pos, cTarget) <= cRange + 1) {
                    skipSidestep = true;
                }
            }
            if (skipSidestep) {
                trafficResolvedIntents[i] = -1;
                continue;
            }

            let bestAlt = -1;
            let bestScore = Infinity;
            const dirs = [-51, -50, -49, -1, 1, 49, 50, 51];
            const origPacked = (creep.pos.y * 50) + creep.pos.x;
            const swampMask = typeof TERRAIN_MASK_SWAMP !== 'undefined' ? TERRAIN_MASK_SWAMP : 2;

            for (let d = 0; d < 8; d++) {
                const altPacked = origPacked + dirs[d];
                if (altPacked < 0 || altPacked >= 2500) continue;
                if (creep.heap && creep.heap._prevPos === altPacked) continue; // Anti-oscillation: never step back to previous tile
                const ax = altPacked % 50;
                const ay = Math.floor(altPacked / 50);
                if (ax <= 0 || ax >= 49 || ay <= 0 || ay >= 49) continue;
                const terr = terrain && terrain.get ? terrain.get(ax, ay) : 0;
                if (terr === TERRAIN_MASK_WALL) continue;
                if (matrix.get && matrix.get(ax, ay) === 255) continue;
                if (trafficGrid[altPacked] !== -1) continue;

                const distToIntended = Math.max(Math.abs(ax - tx), Math.abs(ay - ty));
                if (distToIntended <= 1) {
                    const isRoad = !!(trafficRoadGrid && trafficRoadGrid[ax * 50 + ay] === 1);
                    const isSwamp = !isRoad && ((terr & swampMask) !== 0);
                    const terrainPenalty = isRoad ? 0 : (isSwamp ? 50 : 2);
                    const score = terrainPenalty + (distToIntended * 4);
                    if (score < bestScore) {
                        bestScore = score;
                        bestAlt = altPacked;
                    }
                }
            }

            if (bestAlt !== -1) {
                trafficResolvedIntents[i] = bestAlt;
                if (trafficGrid[origPacked] === i) trafficGrid[origPacked] = -1;
                trafficGrid[bestAlt] = i;
            } else {
                trafficResolvedIntents[i] = -1;
            }
        }
    }

    // 2.5 3-Tick "Bailout" Random Step: break stubborn gridlocks when non-stationed creeps stall > 3 ticks
    const tickSeed = (typeof Game !== 'undefined' ? Game.time : 0) & 7;
    for (let i = 0; i < len; i++) {
        if (trafficResolvedIntents[i] >= 0 || trafficNextSteps[i] < 0) continue;
        const c = trafficCreepList[i];
        if (!c || c.fatigue > 0 || !c.heap || !(c.heap.stuckTicks > 3)) continue;
        const rId = getCreepRoleId(c);
        const isStationed = ((rId === 0 || rId === 3 || rId === 5 || rId === 11 || rId === 15 || rId === 10) && c.heap && c.heap.inPosition === true);
        if (isStationed) continue;

        const origPacked = (c.pos.y * 50) + c.pos.x;
        let bailStep = -1;
        for (let d = 0; d < 8; d++) {
            const alt = origPacked + DIRS_50[(d + tickSeed) & 7];
            if (alt < 0 || alt >= 2500) continue;
            const ax = alt % 50;
            const ay = Math.floor(alt / 50);
            if (ax <= 1 || ax >= 48 || ay <= 1 || ay >= 48) continue;
            if (terrain.get && terrain.get(ax, ay) === TERRAIN_MASK_WALL) continue;
            if (matrix.get && matrix.get(ax, ay) === 255) continue;
            const occ = trafficGrid[alt];
            if (occ >= 0 && trafficPriorityScore[occ] >= 255) continue;
            if (occ === -1) { bailStep = alt; break; }
        }
        if (bailStep !== -1) {
            trafficResolvedIntents[i] = bailStep;
            if (trafficGrid[origPacked] === i) trafficGrid[origPacked] = -1;
            trafficGrid[bailStep] = i;
            c.heap.targetId = null;
            c.heap.path = null;
            c.heap.pathBuffer = null;
            c.heap._path = null;
            c.heap._pathKey = null;
            c.heap._targetSig = null;
            c.heap._stepIdx = 0;
            c.heap.stuckTicks = 0;
        }
    }

    profLap('traf:dfs');
    // 3. Execute resolved moves
    for (let i = 0; i < len; i++) {
        const creep = trafficCreepList[i];
        if (!creep) continue;

        let dir = null;
        if (trafficResolvedIntents[i] >= 0) {
            const targetPacked = trafficResolvedIntents[i];
            const tx = targetPacked % 50;
            const ty = Math.floor(targetPacked / 50);
            dir = getDirectionTo(creep.pos, { x: tx, y: ty });
        } else if (trafficNextSteps[i] === -2 && creep.heap && creep.heap.nextStep) {
            dir = getDirectionTo(creep.pos, creep.heap.nextStep);
        }

        if (dir && creep.move) {
            creep.move(dir);
            profCount('mv:' + ((creep.memory && creep.memory.role) || 'x'));
            if (!creep.heap) creep.heap = {};
            creep.heap._prevPos = (creep.pos.y * 50) + creep.pos.x;
        }
        if (creep.heap) {
            creep.heap.nextStep = null;
        }
        trafficCreepList[i] = null;
    }
    profLap('traf:execute');
}

function resolveAllTraffic(roomName) {
    const heap = ensureTrafficHeap();

    if (roomName) {
        const roomState = heap.rooms ? heap.rooms[roomName] : null;
        const creeps = (roomState && roomState.creeps)
            ? roomState.creeps.filter(c => !c.spawning)
            : Object.values(Game.creeps || {}).filter(c => !c.spawning && c.room && c.room.name === roomName);

        if (typeof Game !== 'undefined' && Game.powerCreeps) {
            for (const name in Game.powerCreeps) {
                const pc = Game.powerCreeps[name];
                if (pc && pc.ticksToLive && pc.room && pc.room.name === roomName) {
                    if (creeps.indexOf(pc) === -1) creeps.push(pc);
                }
            }
        }

        resolveRoomTraffic(roomName, creeps);
        return;
    }

    const creepsByRoom = {};
    if (heap.rooms) {
        for (const rName in heap.rooms) {
            const roomState = heap.rooms[rName];
            if (roomState && roomState.creeps && roomState.creeps.length) {
                creepsByRoom[rName] = roomState.creeps.filter(c => !c.spawning);
            }
        }
    }

    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (c.spawning || !c.room) continue;
        const r = c.room.name;

        if (!creepsByRoom[r]) {
            creepsByRoom[r] = [];
            creepsByRoom[r].push(c);
        } else if (creepsByRoom[r].indexOf(c) === -1) {
            creepsByRoom[r].push(c);
        }
    }

    if (typeof Game !== 'undefined' && Game.powerCreeps) {
        for (const name in Game.powerCreeps) {
            const pc = Game.powerCreeps[name];
            if (!pc || !pc.ticksToLive || !pc.room) continue;
            const r = pc.room.name;

            if (!creepsByRoom[r]) {
                creepsByRoom[r] = [];
                creepsByRoom[r].push(pc);
            } else if (creepsByRoom[r].indexOf(pc) === -1) {
                creepsByRoom[r].push(pc);
            }
        }
    }

    for (const rName in creepsByRoom) {
        resolveRoomTraffic(rName, creepsByRoom[rName]);
    }
}

function getLootTotal(store, canStoreMinerals) {
    if (!store) return 0;
    if (!canStoreMinerals) return store[RESOURCE_ENERGY] || 0;
    if (typeof store.getUsedCapacity === 'function') return store.getUsedCapacity() || 0;
    let sum = 0;
    for (const k in store) {
        if (typeof store[k] === 'number') sum += store[k];
    }
    return sum;
}

function withdrawOrPickupLoot(creep, target, canStoreMinerals) {
    if (!creep || !target) return false;
    if (target.amount !== undefined) {
        if (!canStoreMinerals && target.resourceType !== RESOURCE_ENERGY) return false;
        return creep.pickup(target) === OK;
    }
    if (!target.store) return false;
    if (!canStoreMinerals) {
        if ((target.store[RESOURCE_ENERGY] || 0) <= 0) return false;
        return creep.withdraw(target, RESOURCE_ENERGY) === OK;
    }
    const keys = Object.keys(target.store);
    let chosen = null;
    for (let i = 0; i < keys.length; i++) {
        const res = keys[i];
        if (typeof target.store[res] !== 'number' || target.store[res] <= 0) continue;
        if (res !== RESOURCE_ENERGY) { chosen = res; break; }
        if (!chosen) chosen = res;
    }
    if (!chosen) return false;
    return creep.withdraw(target, chosen) === OK;
}

function depositNonEnergyLoot(creep, homeRoom, moveOnly) {
    if (!creep || !creep.store || !homeRoom) return false;
    const totalUsed = typeof creep.store.getUsedCapacity === 'function' ? (creep.store.getUsedCapacity() || 0) : 0;
    const energyUsed = typeof creep.store.getUsedCapacity === 'function' ? (creep.store.getUsedCapacity(RESOURCE_ENERGY) || 0) : (creep.store[RESOURCE_ENERGY] || 0);
    if (totalUsed <= energyUsed) return false;

    const term = homeRoom.terminal;
    const termOk = !!(term && term.store &&
        (typeof term.store.getFreeCapacity === 'function' ? term.store.getFreeCapacity() : 1) > 0 &&
        (typeof term.store.getUsedCapacity === 'function' ? term.store.getUsedCapacity() : 0) < 250000);
    const dest = termOk ? term : homeRoom.storage;
    if (!dest) return false;

    if (calcDistance(creep.pos, dest.pos) > 1) {
        moveCreep(creep, dest.pos, 1);
        return true;
    }
    if (moveOnly) return true;

    for (const res in creep.store) {
        if (res !== RESOURCE_ENERGY && typeof creep.store[res] === 'number' && creep.store[res] > 0) {
            creep.transfer(dest, res);
            return true;
        }
    }
    return false;
}

module.exports = {
    depositNonEnergyLoot,
    findPathTo,
    getBaseTileCost,
    getCombatAvoidanceMatrix,
    getCreepMoveProfile,
    getLootTotal,
    getTrafficCostMatrix,
    moveCreep,
    resolveAllTraffic,
    resolveRoomTraffic,
    withdrawOrPickupLoot
};