const Profiler = require('../utils/profiler');
const STRUCTURE_PRIORITIES = require('../constants/structurePriorities');

const MAX_CONSTRUCTION_SITES = 5;

module.exports = {
    /**
     * Translates planned structures into actual ConstructionSites.
     * Enforces batched construction limits and structure priorities.
     *
     * @param {Room} room - The room object to run the construction manager for.
     * @returns {void}
     */
    run: Profiler.wrap('ConstructionManager.run', function(room) {
        try {
            // Get current active sites
            const sites = global.State.sitesByRoom.get(room.name) || [];

            const plannerState = global.State.roomPlanner && global.State.roomPlanner.get(room.name);
            if (!plannerState) return;

            const plannedStructures = plannerState.get('plannedStructures');
            if (!plannedStructures || plannedStructures.size === 0) return;

            const rcl = room.controller ? room.controller.level : 0;
            const structuresMap = global.State.structuresByRoom.get(room.name) || new Map();

            // Recompute current counts to respect limits
            const currentCounts = new Map();
            for (const [sType, sMap] of structuresMap.entries()) {
                currentCounts.set(sType, sMap.size);
            }
            for (let i = 0; i < sites.length; i++) {
                const sType = sites[i].structureType;
                currentCounts.set(sType, (currentCounts.get(sType) || 0) + 1);
            }

            // Filter out invalid or completed planned structures, and sort by priority
            let toBuild = [];
            for (const plannedStruct of plannedStructures.values()) {
                if (!plannedStruct || !plannedStruct.pos || !plannedStruct.type) continue;
                let limit = 0;
                if (plannedStruct.type === STRUCTURE_ROAD) {
                    limit = 2500;
                } else if (plannedStruct.type === STRUCTURE_CONTAINER) {
                    limit = 5; // CONTROLLER_STRUCTURES doesn't limit containers strictly by RCL like others, global max 5
                } else if (CONTROLLER_STRUCTURES[plannedStruct.type]) {
                    limit = CONTROLLER_STRUCTURES[plannedStruct.type][rcl] || 0;
                }

                const currentCount = currentCounts.get(plannedStruct.type) || 0;

                // Extra check: Filter out if there's already a site or structure at this exact position
                let alreadyOccupied = false;
                const existingStructsMap = structuresMap.get(plannedStruct.type);
                if (existingStructsMap) {
                    for (const struct of existingStructsMap.values()) {
                        if (struct.pos.x === plannedStruct.pos.x && struct.pos.y === plannedStruct.pos.y) {
                            alreadyOccupied = true;
                            break;
                        }
                    }
                }
                if (!alreadyOccupied) {
                    for (let i = 0; i < sites.length; i++) {
                        if (sites[i].pos.x === plannedStruct.pos.x && sites[i].pos.y === plannedStruct.pos.y) {
                            if (sites[i].structureType === plannedStruct.type) {
                                alreadyOccupied = true;
                            }
                            break;
                        }
                    }
                }

                if (!alreadyOccupied && (currentCount < limit || plannedStruct.type === STRUCTURE_ROAD)) {
                    toBuild.push(plannedStruct);
                }
            }

            toBuild.sort((a, b) => {
                const pA = STRUCTURE_PRIORITIES.get(a.type) || STRUCTURE_PRIORITIES.get('default');
                const pB = STRUCTURE_PRIORITIES.get(b.type) || STRUCTURE_PRIORITIES.get('default');
                return pB - pA; // Descending order
            });

            // Sort existing sites ascending by priority to find lowest priority site easily
            const activeSitesSorted = [...sites].sort((a, b) => {
                const pA = STRUCTURE_PRIORITIES.get(a.structureType) || STRUCTURE_PRIORITIES.get('default');
                const pB = STRUCTURE_PRIORITIES.get(b.structureType) || STRUCTURE_PRIORITIES.get('default');
                return pA - pB; // Ascending order
            });

            // Iterate and create construction sites
            let sitesCreated = 0;
            let currentActiveSites = sites.length;

            for (let i = 0; i < toBuild.length; i++) {
                if (sitesCreated >= 3) break; // Create up to 3 per tick to spread CPU cost

                const structToBuild = toBuild[i];

                if (currentActiveSites >= MAX_CONSTRUCTION_SITES) {
                    if (activeSitesSorted.length > 0) {
                        const lowestSite = activeSitesSorted[0];
                        const plannedPriority = STRUCTURE_PRIORITIES.get(structToBuild.type) || STRUCTURE_PRIORITIES.get('default');
                        const lowestPriority = STRUCTURE_PRIORITIES.get(lowestSite.structureType) || STRUCTURE_PRIORITIES.get('default');

                        // Pause the lowest priority site if the planned one is strictly more important
                        if (plannedPriority > lowestPriority) {
                            if (lowestSite.remove() === OK) {
                                // Add back to planned structures to resume later
                                const newId = 'paused_' + Math.floor(Math.random() * 1000000);
                                plannedStructures.set(newId, {
                                    pos: { x: lowestSite.pos.x, y: lowestSite.pos.y },
                                    type: lowestSite.structureType
                                });
                                activeSitesSorted.shift(); // Remove from our sorted array
                                currentActiveSites--;
                            } else {
                                break; // Failed to remove, break out
                            }
                        } else {
                            break; // No higher priority replacements possible
                        }
                    } else {
                        break;
                    }
                }

                // Re-check limits as we might have added same type in this loop
                let limit = 0;
                if (structToBuild.type === STRUCTURE_ROAD) {
                    limit = 2500;
                } else if (structToBuild.type === STRUCTURE_CONTAINER) {
                    limit = 5;
                } else if (CONTROLLER_STRUCTURES[structToBuild.type]) {
                    limit = CONTROLLER_STRUCTURES[structToBuild.type][rcl] || 0;
                }

                const currentCount = currentCounts.get(structToBuild.type) || 0;

                if (currentCount >= limit && structToBuild.type !== STRUCTURE_ROAD) continue;

                const res = room.createConstructionSite(structToBuild.pos.x, structToBuild.pos.y, structToBuild.type);
                if (res === OK || res === ERR_INVALID_TARGET) {
                    if (structToBuild.id) {
                        plannedStructures.delete(structToBuild.id);
                    }
                }

                if (res === OK) {
                    sitesCreated++;
                    currentActiveSites++;
                    currentCounts.set(structToBuild.type, currentCount + 1);
                }
            }
        } catch (e) {
            console.log(`[ConstructionManager Error] Room ${room.name}: ${e.stack}`);
        }
    })
};
