const { BASE_LAYOUT_STAMP } = require('../constants/baseLayout');

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

        for (const [structureType, offsets] of BASE_LAYOUT_STAMP.entries()) {
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
            worker: 15,
            harvester: 0,
            domesticHauler: 0
        };

        if (rcl === 1) {
            reqs.worker = 15;
            reqs.harvester = 0;
            reqs.domesticHauler = 0;
        } else if (rcl === 2) {
            reqs.worker = 15;
            reqs.harvester = 2; // Generally 1 per source
            reqs.domesticHauler = 2;
        } else if (rcl === 3) {
            reqs.worker = 10;
            reqs.harvester = 2;
            reqs.domesticHauler = 2;
        } else if (rcl >= 4) {
            reqs.worker = 6;
            reqs.harvester = 2;
            reqs.domesticHauler = 2;
        }

        return reqs;
    }
}

module.exports = BootstrapPlanner;
