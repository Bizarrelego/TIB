const { BASE_LAYOUT_STAMP } = require('../constants/baseLayout');
const earlyGameConstructionPlanner = require('./earlyGameConstructionPlanner');

class BootstrapPlanner {
    /**
     * Integrates with ConstructionManager to queue new construction sites
     * according to the bootstrap plan based on hardcoded offsets.
     *
     * @param {Room} room
     * @param {Map} plannerState
     */
    static planStructures(room, plannerState) {
        if (!room || !room.controller || !plannerState) return;
        const rcl = room.controller.level;
        if (rcl > 4) return;

        const anchor = plannerState.get('anchor') || room.controller.pos; // Assuming anchor or controller pos
        if (!anchor) return;

        const plannedStructures = plannerState.get('plannedStructures') || new Map();
        if (!plannerState.has('plannedStructures')) {
            plannerState.set('plannedStructures', plannedStructures);
        }

        const structuresMap = global.State.structuresByRoom.get(room.name) || new Map();
        const sites = global.State.sitesByRoom.get(room.name) || [];

        // Fast-Start Heuristic: Prioritize placing Containers near Controller and Sources immediately
        const terrain = Game.map.getRoomTerrain(room.name);
        const fastStartTargets = [];
        if (room.controller) fastStartTargets.push(room.controller);
        const sources = global.State.sourcesByRoom.get(room.name) || [];
        for (const s of sources) fastStartTargets.push(s);

        for (const target of fastStartTargets) {
            let placed = false;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const px = target.pos.x + dx;
                    const py = target.pos.y + dy;

                    if (px < 1 || px > 48 || py < 1 || py > 48) continue;
                    if (terrain.get(px, py) === TERRAIN_MASK_WALL) continue;

                    let occupied = false;
                    const existingContainers = structuresMap.get(STRUCTURE_CONTAINER) || new Map();
                    for (const struct of existingContainers.values()) {
                        if (struct.pos.x === px && struct.pos.y === py) occupied = true;
                    }
                    if (!occupied) {
                        for (const site of sites) {
                            if (site.pos.x === px && site.pos.y === py) occupied = true;
                        }
                    }

                    const id = `container-${px}-${py}`;
                    if (!occupied && !plannedStructures.has(id)) {
                        plannedStructures.set(id, {
                            pos: new RoomPosition(px, py, room.name),
                            type: STRUCTURE_CONTAINER,
                            id: id
                        });
                        placed = true;
                        break;
                    } else if (plannedStructures.has(id) || occupied) {
                         placed = true;
                         break;
                    }
                }
                if (placed) break;
            }
        }

        if (rcl === 2) {
            const spawns = structuresMap.get(STRUCTURE_SPAWN);
            const spawn = spawns && spawns.size > 0 ? spawns.values().next().value : null;

            if (spawn) {
                const extensionPositions = earlyGameConstructionPlanner.getRCL2ExtensionPositions(spawn.pos, room.name);

                for (const pos of extensionPositions) {
                    const px = pos.x;
                    const py = pos.y;

                    let occupied = false;
                    const existingExtensions = structuresMap.get(STRUCTURE_EXTENSION) || new Map();
                    for (const struct of existingExtensions.values()) {
                        if (struct.pos.x === px && struct.pos.y === py) occupied = true;
                    }
                    if (!occupied) {
                        for (const site of sites) {
                            if (site.pos.x === px && site.pos.y === py) occupied = true;
                        }
                    }

                    const id = `early-ext-${px}-${py}`;
                    if (!occupied && !plannedStructures.has(id)) {
                        plannedStructures.set(id, {
                            pos: new RoomPosition(px, py, room.name),
                            type: STRUCTURE_EXTENSION,
                            id: id
                        });
                    }
                }
            }
        }

        for (const [structureType, offsets] of BASE_LAYOUT_STAMP.entries()) {
            if (structureType === STRUCTURE_EXTENSION && rcl < 3) continue;

            const limits = CONTROLLER_STRUCTURES[structureType];
            const limit = limits ? (limits[rcl] || 0) : 0;

            if (limit === 0 && structureType !== STRUCTURE_ROAD && structureType !== STRUCTURE_CONTAINER) continue;

            const existingStructs = structuresMap.get(structureType) || new Map();
            let currentCount = existingStructs.size;
            for (let i = 0; i < sites.length; i++) {
                if (sites[i].structureType === structureType) currentCount++;
            }

            // For structures bounded by RCL
            if (structureType !== STRUCTURE_ROAD && structureType !== STRUCTURE_CONTAINER && currentCount >= limit) continue;

            let placedThisType = 0;

            for (let i = 0; i < offsets.length; i++) {
                // If we reach the limit for this RCL, stop placing this type
                if (structureType !== STRUCTURE_ROAD && structureType !== STRUCTURE_CONTAINER && (currentCount + placedThisType) >= limit) break;

                const dx = offsets[i][0];
                const dy = offsets[i][1];

                const plannedX = anchor.x + dx;
                const plannedY = anchor.y + dy;

                if (plannedX < 1 || plannedX > 48 || plannedY < 1 || plannedY > 48) continue;

                // Simple check if position is blocked by terrain
                const terrain = Game.map.getRoomTerrain(room.name);
                if (terrain.get(plannedX, plannedY) === TERRAIN_MASK_WALL) continue;

                const id = `${structureType}-${plannedX}-${plannedY}`;

                // Only add if not already in plannedStructures, not already built, and not a site
                if (!plannedStructures.has(id)) {
                    let occupied = false;

                    for (const struct of existingStructs.values()) {
                        if (struct.pos.x === plannedX && struct.pos.y === plannedY) {
                            occupied = true;
                            break;
                        }
                    }
                    if (!occupied) {
                        for (let s = 0; s < sites.length; s++) {
                            if (sites[s].structureType === structureType && sites[s].pos.x === plannedX && sites[s].pos.y === plannedY) {
                                occupied = true;
                                break;
                            }
                        }
                    }

                    if (!occupied) {
                        plannedStructures.set(id, {
                            pos: new RoomPosition(plannedX, plannedY, room.name),
                            type: structureType,
                            id: id
                        });
                        placedThisType++;
                    }
                }
            }
        }
    }

    /**
     * Bootstraps the pioneer creeps dispatched to a target room.
     * Calculates harvest and build targets and assigns them directly to the pioneer's heap.
     * @param {string} roomName
     * @param {Creep[]} pioneers
     */
    static runPioneerAssignments(roomName, pioneers) {
        if (!pioneers || pioneers.length === 0) return;

        const room = Game.rooms[roomName];
        if (!room) return; // Wait for vision

        const sources = global.State.sourcesByRoom.get(roomName) || [];
        const sites = global.State.sitesByRoom.get(roomName) || [];

        let targetSite = sites.length > 0 ? sites[0] : null;
        if (!targetSite && room.controller && room.controller.level < 2) {
            targetSite = room.controller;
        }

        for (const creep of pioneers) {
            if (!creep.heap) creep.heap = {};

            // State management
            if (creep.heap.state === 'harvesting' && creep.store.getFreeCapacity() === 0) {
                creep.heap.state = 'building';
                creep.heap.targetId = null;
            } else if (creep.heap.state !== 'harvesting' && creep.store[RESOURCE_ENERGY] === 0) {
                creep.heap.state = 'harvesting';
                creep.heap.targetId = null;
            } else if (!creep.heap.state) {
                creep.heap.state = 'harvesting';
            }

            if (creep.heap.state === 'harvesting') {
                if (!creep.heap.targetId && sources.length > 0) {
                    // Simple assignment to first source, could be optimized to closest
                    creep.heap.targetId = sources[0].id;
                }
            } else {
                if (targetSite) {
                    creep.heap.targetId = targetSite.id;
                } else {
                    creep.heap.targetId = null;
                }
            }
        }
    }

    /**
     * Provides suggestions for initial creep roles and counts to spawnManager
     * during early RCL progression.
     *
     * @param {Room} room
     * @returns {Object} Requirements for early game
     */
    static getCreepRequirements(room) {
        if (!room || !room.controller) return { worker: 0, harvester: 0, domesticHauler: 0 };
        const rcl = room.controller.level;

        let reqs = {
            worker: 1,
            harvester: 0,
            domesticHauler: 0,
            upgrader: 0
        };

        if (rcl === 1) {
            reqs.worker = 1;
            reqs.harvester = 2;
            reqs.domesticHauler = 2;
            reqs.upgrader = 2;
        } else if (rcl === 2) {
            reqs.worker = 2;
            reqs.harvester = 2; // Generally 1 per source
            reqs.domesticHauler = 2;
            reqs.upgrader = 4;
        } else if (rcl === 3) {
            reqs.worker = 4;
            reqs.harvester = 2;
            reqs.domesticHauler = 2;
            reqs.upgrader = 3;
        } else if (rcl >= 4) {
            reqs.worker = 4;
            reqs.harvester = 2;
            reqs.domesticHauler = 2;
            reqs.upgrader = 2;
        }

        return reqs;
    }
}

module.exports = BootstrapPlanner;
