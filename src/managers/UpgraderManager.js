const LinkManager = require('./LinkManager');

class UpgraderManager {
    /**
     * Determines the optimal number of upgraders needed for the room.
     * @param {Room} room
     * @returns {number}
     */
    static getDesiredCount(room) {
        if (room.memory && room.memory.haltUpgrades) return 0;
        if (!room.controller || room.controller.level < 5) return 0;

        // Base logic: 1 upgrader if links are present.
        // Scale up if we have excess storage.
        const structures = global.State.structuresByRoom.get(room.name);
        const storages = structures ? structures.get(STRUCTURE_STORAGE) : null;
        const storage = storages && storages.length > 0 ? storages[0] : null;

        if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 50000) {
            return 2; // Add more upgraders if we have surplus energy
        }

        return 1;
    }

    /**
     * Finds optimal static positions for upgraders near a controller and source.
     * @param {Room} room
     * @returns {{positions: RoomPosition[], sourceId: string|null}}
     */
    static getOptimalParkPositions(room) {
        if (!room.controller) return { positions: [], sourceId: null };

        const controller = room.controller;
        const cLink = LinkManager.getControllerLink(room.name);
        let bestSource = cLink;

        if (!bestSource) {
            // Fallback to controller container
            const structures = global.State.structuresByRoom.get(room.name);
            const containers = structures ? structures.get(STRUCTURE_CONTAINER) || [] : [];
            for (let i = 0; i < containers.length; i++) {
                if (containers[i].pos.inRangeTo(controller, 3)) {
                    bestSource = containers[i];
                    break;
                }
            }
        }

        const validPositions = [];
        if (bestSource) {
            // Find spots adjacent to both controller and the source
            // Or adjacent to source and within 3 of controller
            const terrain = Game.map.getRoomTerrain(room.name);
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const x = bestSource.pos.x + dx;
                    const y = bestSource.pos.y + dy;
                    if (x < 1 || x > 48 || y < 1 || y > 48) continue;

                    if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                        const pos = new RoomPosition(x, y, room.name);
                        if (pos.inRangeTo(controller, 3)) {
                            validPositions.push(pos);
                        }
                    }
                }
            }
        }

        if (validPositions.length === 0) {
            // Just somewhere near the controller
            validPositions.push(new RoomPosition(controller.pos.x + 1, controller.pos.y + 1, room.name)); // Simplified fallback
        }

        return { positions: validPositions, sourceId: bestSource ? bestSource.id : null };
    }

    /**
     * Executes upgrader management loop
     * @param {Room} room
     */
    static run(room) {
        if (room.memory && room.memory.haltUpgrades) return;
        if (!room.controller || !room.controller.my) return;

        try {
            const upgraders = global.State.creepsByRoom.get(room.name)?.get('upgrader') || [];
            if (upgraders.length === 0) return;

            // Deficit-Driven Execution / Tick Slicing
            if (!global.State.upgraderManagerLastExecution) global.State.upgraderManagerLastExecution = new Map();
            if (!global.State.upgraderManagerLastCount) global.State.upgraderManagerLastCount = new Map();

            const lastExecution = global.State.upgraderManagerLastExecution.get(room.name) || 0;
            const lastCount = global.State.upgraderManagerLastCount.get(room.name) || 0;
            const currentCount = upgraders.length;

            let forceRun = false;
            if (currentCount !== lastCount) {
                forceRun = true;
            } else {
                for (let i = 0; i < upgraders.length; i++) {
                    // Check if an upgrader needs a new task or just completed one
                    if (!upgraders[i].heap.state || !upgraders[i].heap.targetId || (upgraders[i].heap.state === 'upgrade' && upgraders[i].store.getUsedCapacity() === 0)) {
                        forceRun = true;
                        break;
                    }
                }
            }

            if (!forceRun && Game.time - lastExecution < 5) return; // Fallback execution every 5 ticks

            global.State.upgraderManagerLastExecution.set(room.name, Game.time);
            global.State.upgraderManagerLastCount.set(room.name, currentCount);

            const optimalData = this.getOptimalParkPositions(room);

            for (let i = 0; i < upgraders.length; i++) {
                const creep = upgraders[i];

                // Assign distinct positions if available
                if (optimalData.positions.length > 0) {
                    creep.heap.parkPos = optimalData.positions[i % optimalData.positions.length];
                }

                if (optimalData.sourceId) {
                    creep.heap.sourceId = optimalData.sourceId;
                }

                // Explicit energy target assignment
                let energyTargetId = null;
                const storage = room.storage;
                if (storage && storage.isActive()) {
                    energyTargetId = storage.id;
                } else {
                    const dropped = global.State.droppedByRoom.get(room.name);
                    if (dropped) {
                        for (const drop of dropped.values()) {
                            if (drop.resourceType === RESOURCE_ENERGY && creep.heap.parkPos && drop.pos.x === creep.heap.parkPos.x && drop.pos.y === creep.heap.parkPos.y) {
                                energyTargetId = drop.id;
                                break;
                            }
                        }
                    }
                }
                creep.heap.energyTargetId = energyTargetId;

                if (creep.store.getUsedCapacity() === 0) {
                    creep.heap.state = 'withdraw';
                } else if (creep.heap.overrideTask === 'build') {
                    const sites = global.State.sitesByRoom.get(room.name);
                    if (sites && sites.length > 0) {
                        creep.heap.targetId = sites[0].id;
                        creep.heap.state = 'build';
                    } else {
                        creep.heap.targetId = room.controller.id;
                        creep.heap.state = 'upgrade';
                    }
                } else {
                    creep.heap.targetId = room.controller.id;
                    creep.heap.state = 'upgrade';
                }

                }
        } catch (e) {
            console.log(`[UpgraderManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
}

module.exports = UpgraderManager;
