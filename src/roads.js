// src/roads.js
// Dynamic PathFinder Arterial Highway Routing, Interroom Networks & Gated Road Site Placement
const { GRID_EMPTY, GRID_ROAD, GRID_WALL, GRID_CONTAINER } = require('./constants');
const { getRoomBlueprint, FAST_FILLER_POSITIONS } = require('./bunker');
const { getAllStructures } = require('./state');

function getRoadCostMatrix(room, blueprintArg) {
    if (typeof PathFinder === 'undefined' || !PathFinder.CostMatrix || !room) {
        return null;
    }
    const heap = (typeof global !== 'undefined') ? (global.heap || (global.heap = {})) : null;
    const roomState = heap && heap.rooms ? heap.rooms[room.name] : null;
    const structures = roomState ? getAllStructures(roomState) : (room.find ? (room.find(FIND_STRUCTURES) || []) : []);
    const now = typeof Game !== 'undefined' ? Game.time : 0;
    const blueprint = blueprintArg || ((room.controller && room.controller.my) ? getRoomBlueprint(room) : null);
    const bpVersion = (blueprint && blueprint._version) ? blueprint._version : 0;

    if (heap && !blueprintArg) {
        if (!heap.roadCostMatrices) heap.roadCostMatrices = {};
        const cached = heap.roadCostMatrices[room.name];
        if (cached && now < cached.expires && cached.structCount === structures.length && cached.bpVersion === bpVersion) {
            return cached.matrix;
        }
    }

    const matrix = new PathFinder.CostMatrix();
    const terrain = room.getTerrain ? room.getTerrain() : (room.terrain || null);
    const baseGrid = blueprint && blueprint.baseGrid ? blueprint.baseGrid : null;
    const anchor = blueprint && blueprint.anchor ? blueprint.anchor : null;
    const hubCenter = room.storage
        ? room.storage.pos
        : ((blueprint && blueprint.storage && blueprint.storage[0]) ? blueprint.storage[0] : null);

    for (let x = 0; x < 50; x++) {
        for (let y = 0; y < 50; y++) {
            const t = terrain ? terrain.get(x, y) : 0;
            const gVal = baseGrid ? baseGrid[y * 50 + x] : GRID_EMPTY;
            if ((t & 1) > 0 || gVal === GRID_WALL) {
                matrix.set(x, y, 255);
            } else if (baseGrid) {
                if (gVal === GRID_ROAD) {
                    matrix.set(x, y, 1);
                } else if (gVal !== GRID_EMPTY && gVal !== GRID_CONTAINER) {
                    matrix.set(x, y, 255);
                } else {
                    const inCoreNoPave = anchor && Math.max(Math.abs(x - anchor.x), Math.abs(y - anchor.y)) <= 4;
                    const inHubNoPave = hubCenter && Math.max(Math.abs(x - hubCenter.x), Math.abs(y - hubCenter.y)) <= 4;
                    if (inCoreNoPave || inHubNoPave) {
                        matrix.set(x, y, 25);
                    } else {
                        matrix.set(x, y, (t & 2) > 0 ? 20 : 8);
                    }
                }
            } else {
                matrix.set(x, y, (t & 2) > 0 ? 20 : 8);
            }
        }
    }

    for (let i = 0; i < structures.length; i++) {
        const s = structures[i];
        if (!s || !s.pos) continue;
        if (s.structureType === STRUCTURE_ROAD) {
            // baseGrid is authoritative in home rooms; only boost live roads in unplotted/remote rooms
            if (!baseGrid && matrix.get(s.pos.x, s.pos.y) < 255) {
                matrix.set(s.pos.x, s.pos.y, 1);
            }
        } else if (s.structureType !== STRUCTURE_CONTAINER && (s.structureType !== STRUCTURE_RAMPART || !s.my)) {
            matrix.set(s.pos.x, s.pos.y, 255);
        }
    }

    if (heap && !blueprintArg) {
        heap.roadCostMatrices[room.name] = { matrix, structCount: structures.length, bpVersion, expires: now + 25 };
    }
    return matrix;
}

function planRoadNetwork(room, blueprintArg) {
    if (!room) return null;
    const blueprint = blueprintArg || getRoomBlueprint(room);
    if (!blueprint || !blueprint.anchor) return blueprint;

    const roomState = global.heap && global.heap.rooms ? global.heap.rooms[room.name] : null;
    const spawns = (roomState && roomState.spawns) || (room.find ? room.find(FIND_MY_SPAWNS) : []);
    const hubX = spawns.length > 0 ? spawns[0].pos.x : blueprint.anchor.x;
    const hubY = spawns.length > 0 ? spawns[0].pos.y : blueprint.anchor.y;
    const spawnPos = room.getPositionAt ? room.getPositionAt(hubX, hubY) : { x: hubX, y: hubY };
    const bunkerX = room.storage ? room.storage.pos.x : blueprint.anchor.x;
    const bunkerY = room.storage ? room.storage.pos.y : blueprint.anchor.y;
    const bunkerPos = room.getPositionAt ? room.getPositionAt(bunkerX, bunkerY) : { x: bunkerX, y: bunkerY };

    const sources = (roomState && roomState.sources) || room.sources || (room.find ? room.find(FIND_SOURCES) : []);
    const controller = room.controller;
    const minerals = room.minerals || (room.find ? room.find(FIND_MINERALS) : []);
    const mineral = minerals.length > 0 ? minerals[0] : null;

    if (!Array.isArray(blueprint.roads)) blueprint.roads = [];
    if (!Array.isArray(blueprint.containers)) blueprint.containers = [];
    if (!Array.isArray(blueprint.links)) blueprint.links = [];

    const rcl = controller ? controller.level : 1;
    const outpostsList = (typeof Memory !== 'undefined' && Memory.rooms && Memory.rooms[room.name] && Array.isArray(Memory.rooms[room.name].outposts))
        ? Memory.rooms[room.name].outposts
        : [];
    const cacheSig = `${rcl}:${outpostsList.join(',')}`;
    const heap = (typeof global !== 'undefined') ? (global.heap || (global.heap = {})) : null;
    if (heap && !heap.roadPlanCache) heap.roadPlanCache = {};
    const cachedPlan = heap ? heap.roadPlanCache[room.name] : null;
    const now = typeof Game !== 'undefined' ? Game.time : 0;

    let multiRoomPaths = [];
    if (!blueprintArg && cachedPlan && cachedPlan.sig === cacheSig && now < cachedPlan.expires) {
        multiRoomPaths = cachedPlan.multiRoomPaths;
    } else {
        const roadSet = new Set(blueprint.roads.map(r => r.x + ':' + r.y));
        const containerSet = new Set(blueprint.containers.map(c => c.x + ':' + c.y));
        const linkSet = new Set(blueprint.links.map(l => l.x + ':' + l.y));

        const matrix = getRoadCostMatrix(room, blueprint);
        const pfOpts = {
            plainCost: 8,
            swampCost: 20,
            roomCallback: () => matrix || new PathFinder.CostMatrix(),
            maxRooms: 1
        };

        function addRoadPath(path) {
            if (!path || !path.length || blueprint.baseGrid) return;
            for (let i = 0; i < path.length; i++) {
                const pt = path[i];
                if (pt.roomName && pt.roomName !== room.name) continue;
                if (pt.x >= 1 && pt.x <= 48 && pt.y >= 1 && pt.y <= 48) {
                    const key = pt.x + ':' + pt.y;
                    if (!roadSet.has(key)) {
                        roadSet.add(key);
                        blueprint.roads.push({ x: pt.x, y: pt.y });
                    }
                }
            }
        }

        blueprint.arterialRoads = [];
        function addArterialPath(path) {
            if (!path || !path.length) return;
            addRoadPath(path);
            for (let i = 0; i < path.length; i++) {
                const pt = path[i];
                if (pt.x >= 1 && pt.x <= 48 && pt.y >= 1 && pt.y <= 48) {
                    blueprint.arterialRoads.push({ x: pt.x, y: pt.y });
                }
            }
        }

        // 0. Connect Spawn1 <-> Bunker Hub (critical when Spawn1 is separated from Bunker anchor)
        if (Math.max(Math.abs(spawnPos.x - bunkerPos.x), Math.abs(spawnPos.y - bunkerPos.y)) > 2) {
            const bridge = PathFinder.search(spawnPos, { pos: bunkerPos, range: 1 }, pfOpts);
            addArterialPath(bridge.path || []);
        }

        // 1. Arterial Highways: Bunker Hub -> Each Source
        for (let s = 0; s < sources.length; s++) {
            const src = sources[s];
            const searchBunker = PathFinder.search(bunkerPos, { pos: src.pos, range: 1 }, pfOpts);
            const path = searchBunker.path || [];
            addArterialPath(path);

            if (path.length > 0) {
                const cPos = path[path.length - 1];
                const cKey = cPos.x + ':' + cPos.y;
                if (!containerSet.has(cKey)) {
                    containerSet.add(cKey);
                    blueprint.containers.push({ x: cPos.x, y: cPos.y });
                }

                if (path.length >= 2 && controller && controller.level >= 5) {
                    const lPos = path[path.length - 2];
                    const lKey = lPos.x + ':' + lPos.y;
                    if (!linkSet.has(lKey)) {
                        linkSet.add(lKey);
                        blueprint.links.push({ x: lPos.x, y: lPos.y });
                    }
                }
            }
        }

        // 2. Arterial Highway: Bunker Hub -> Controller
        if (controller) {
            const search = PathFinder.search(bunkerPos, { pos: controller.pos, range: 2 }, pfOpts);
            const path = search.path || [];
            addArterialPath(path);

            if (path.length > 0) {
                const cPos = path[path.length - 1];
                const cKey = cPos.x + ':' + cPos.y;
                if (!containerSet.has(cKey)) {
                    containerSet.add(cKey);
                    blueprint.containers.push({ x: cPos.x, y: cPos.y });
                }
            }
        }

        // 3. Arterial Highway: Bunker Hub -> Mineral (RCL >= 6)
        if (mineral && controller && controller.level >= 6) {
            const search = PathFinder.search(bunkerPos, { pos: mineral.pos, range: 1 }, pfOpts);
            addArterialPath(search.path || []);
        }

        // 4. Interroom Arterial Highways: Bunker Hub -> Active Remote Outposts & Intra-Remote Roads (RCL >= 3)
        if (rcl >= 3 && outpostsList.length > 0) {
            for (let o = 0; o < outpostsList.length; o++) {
                const outName = outpostsList[o];
                const outState = global.heap && global.heap.remoteRooms ? global.heap.remoteRooms[outName] : null;
                if (!outState || outState.safe === false || !Array.isArray(outState.sources)) continue;

                for (let s = 0; s < outState.sources.length; s++) {
                    const srcInfo = outState.sources[s];
                    if (!srcInfo) continue;
                    const dest = (typeof RoomPosition !== 'undefined') ? new RoomPosition(srcInfo.x, srcInfo.y, outName) : { x: srcInfo.x, y: srcInfo.y, roomName: outName };
                    const multiSearch = PathFinder.search(bunkerPos, { pos: dest, range: 1 }, {
                        plainCost: 8,
                        swampCost: 20,
                        maxRooms: 4,
                        roomCallback: (rName) => {
                            const rObj = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[rName] : null;
                            return rObj ? (getRoadCostMatrix(rObj) || new PathFinder.CostMatrix()) : new PathFinder.CostMatrix();
                        }
                    });
                    if (multiSearch && !multiSearch.incomplete && multiSearch.path && multiSearch.path.length > 0) {
                        addRoadPath(multiSearch.path);
                        multiRoomPaths.push({ outName, path: multiSearch.path, srcInfo });
                    }
                }
            }
        }

        if (heap && !blueprintArg) {
            heap.roadPlanCache[room.name] = { sig: cacheSig, multiRoomPaths, expires: now + 500 };
        }
    }

    // 5. Place Domestic & Remote Road Construction Sites (RCL >= 3)
    if (rcl >= 3 && room.createConstructionSite && roomState) {
        // Auto-prune non-blueprint junk road construction sites when baseGrid is authoritative
        const roadSites = (roomState.constructionSites || []).filter(s => s.structureType === STRUCTURE_ROAD);
        if (roadSites.length > 0 && blueprint && blueprint.anchor) {
            if (blueprint.baseGrid) {
                for (let i = 0; i < roadSites.length; i++) {
                    const rs = roadSites[i];
                    if (blueprint.baseGrid[rs.pos.y * 50 + rs.pos.x] !== GRID_ROAD) {
                        rs.remove();
                    }
                }
            } else {
                const validRoads = new Set((blueprint.arterialRoads || []).map(r => r.x + ':' + r.y));
                for (let i = 0; i < (blueprint.roads || []).length; i++) {
                    validRoads.add(blueprint.roads[i].x + ':' + blueprint.roads[i].y);
                }
                for (let m = 0; m < multiRoomPaths.length; m++) {
                    const p = multiRoomPaths[m].path || [];
                    for (let i = 0; i < p.length; i++) {
                        if (!p[i].roomName || p[i].roomName === room.name) validRoads.add(p[i].x + ':' + p[i].y);
                    }
                }
                if (Array.isArray(FAST_FILLER_POSITIONS)) {
                    FAST_FILLER_POSITIONS.forEach(p => validRoads.add((blueprint.anchor.x + p.dx) + ':' + (blueprint.anchor.y + p.dy)));
                }
                for (let i = 0; i < roadSites.length; i++) {
                    const rs = roadSites[i];
                    if (!validRoads.has(rs.pos.x + ':' + rs.pos.y)) {
                        rs.remove();
                    }
                }
            }
        }

        const containersBuilt = (roomState.containers || []).length;
        const activeSites = (roomState.constructionSites || []).length;
        const activeRoadSites = (roomState.constructionSites || []).filter(s => s.structureType === STRUCTURE_ROAD).length;

        // Place ONLY domestic arterial highway roads when no baseGrid exists (bunker.js owns home GRID_ROAD placement)
        if (!blueprint.baseGrid && containersBuilt >= sources.length && activeSites < 8 && activeRoadSites < 2) {
            let placed = 0;
            const targetRoads = (blueprint.arterialRoads && blueprint.arterialRoads.length > 0) ? blueprint.arterialRoads : blueprint.roads;
            for (let i = 0; i < targetRoads.length && (activeRoadSites + placed) < 2 && (activeSites + placed) < 8; i++) {
                const pt = targetRoads[i];
                if (room.createConstructionSite(pt.x, pt.y, STRUCTURE_ROAD) === OK) {
                    placed++;
                }
            }
        }

        // Place Remote Outpost Roads & Remote Source Containers inside visible outposts!
        for (let m = 0; m < multiRoomPaths.length; m++) {
            const { outName, path } = multiRoomPaths[m];
            const outRoom = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[outName] : null;
            if (!outRoom || !outRoom.createConstructionSite) continue;

            const outState = global.heap && global.heap.rooms ? global.heap.rooms[outName] : null;
            const outSites = (outState && outState.constructionSites) || (outRoom.find ? outRoom.find(FIND_MY_CONSTRUCTION_SITES) : []);
            let outActive = outSites.length;
            if (outActive >= 4) continue;

            // Dynamic Remote Mining ROI Gate:
            // Do not build remote containers/roads unless colony has achieved RCL 4+
            // AND either the room is reserved (doubling source energy) OR colony storage has >= 20k energy.
            // Early outposts perform containerless drop-mining for pure profit with zero road decay overhead!
            const myUser = room.controller.owner ? room.controller.owner.username : null;
            const isReserved = outRoom.controller && outRoom.controller.reservation &&
                (!myUser || outRoom.controller.reservation.username === myUser);
            const hasSurplusEnergy = roomState.storage && roomState.storage.store && (roomState.storage.store[RESOURCE_ENERGY] || 0) >= 20000;
            const meetsRoiThreshold = (rcl >= 4) && (isReserved || hasSurplusEnergy);
            if (!meetsRoiThreshold) continue;

            // Remote Source Container at final step next to source (path[path.length - 1])
            const lastPt = path[path.length - 1];
            if (lastPt && lastPt.roomName === outName && lastPt.x > 1 && lastPt.x < 48 && lastPt.y > 1 && lastPt.y < 48) {
                const hasCnt = outState && outState.containers
                    ? outState.containers.some(c => c.pos.x === lastPt.x && c.pos.y === lastPt.y)
                    : false;
                if (!hasCnt && outRoom.createConstructionSite(lastPt.x, lastPt.y, STRUCTURE_CONTAINER) === OK) {
                    outActive++;
                }
            }

            // Remote Roads along the hauler route (extend up to inner border tiles 1..48)
            let outPlaced = 0;
            for (let p = 0; p < path.length && outPlaced < 3 && (outActive + outPlaced) < 4; p++) {
                const pt = path[p];
                if (pt.roomName !== outName) continue;
                if (pt.x < 1 || pt.x > 48 || pt.y < 1 || pt.y > 48) continue;
                if (outRoom.createConstructionSite(pt.x, pt.y, STRUCTURE_ROAD) === OK) {
                    outPlaced++;
                }
            }
        }
    }

    return blueprint;
}

module.exports = {
    getRoadCostMatrix,
    planRoadNetwork
};
