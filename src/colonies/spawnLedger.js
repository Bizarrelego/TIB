/**
 * @class SpawnLedger
 * @description Tracks energy reservations per tick to ensure multiple spawns in one room do not exceed room.energyAvailable.
 */
class SpawnLedger {
    /**
     * @param {Room} room The room to track energy for.
     */
    constructor(room) {
        this.availableEnergy = room.energyAvailable;
        this.roomName = room.name;
    }

    /**
     * Gets the currently available energy in the room.
     * @returns {number} The available energy.
     */
    getAvailableEnergy() {
        return this.availableEnergy;
    }

    /**
     * Checks if the given spawn is currently busy spawning a creep.
     * @param {StructureSpawn} spawn The spawn structure to check.
     * @returns {boolean} True if the spawn is busy, false otherwise.
     */
    isSpawnBusy(spawn) {
        return spawn.spawning !== null && spawn.spawning !== undefined;
    }

    /**
     * Checks if a spawn request can be afforded.
     * @param {number} cost The cost of the creep to spawn.
     * @returns {boolean} True if affordable.
     */
    canSpawn(cost) {
        return this.availableEnergy >= cost;
    }

    /**
     * Reserves energy cost from the ledger for the tick.
     * @param {number} amount The energy amount to reserve.
     */
    reserveEnergy(amount) {
        this.availableEnergy -= amount;
    }

    /**
     * Requests a spawn, reserving energy cost if successful.
     * @param {StructureSpawn} spawn The spawn structure to use.
     * @param {Array<string>} body The creep body array.
     * @param {string} name The creep name.
     * @param {Object} opts The spawn options.
     * @param {number} cost The cost of the creep.
     * @returns {number} The error code from spawnCreep.
     */
    requestSpawn(spawn, body, name, opts, cost) {
        if (!this.isSpawnBusy(spawn)) {
            if (opts && opts.memory) {
                opts.memory = {
                    ...opts.memory,
                    role: opts.memory.role,
                    colony: opts.memory.colony
                };
            }
            const result = spawn.spawnCreep(body, name, opts);
            if (result === OK) {
                this.reserveEnergy(cost);
            }
            return result;
        }
        return ERR_BUSY;
    }

    /**
     * Checks if a minimum link network is present in the room.
     * @param {Room} room The room to check.
     * @returns {boolean} True if network exists.
     */
    isLinkNetworkPresent(room) {
        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (structuresMap) {
            const links = structuresMap.get(STRUCTURE_LINK) || [];
            return links.length >= 2;
        }
        return false;
    }

    /**
     * Calculates the target Fast Filler count.
     * Fast fillers active if room.storage exists OR active STRUCTURE_CONTAINER exactly at anchor [0,0] coordinate.
     * @param {Room} room
     * @returns {number}
     */
    calculateFastFillerTarget(room) {
        let storageExists = false;
        if (room.storage && room.storage.isActive()) {
            storageExists = true;
        }

        let coreContainerExists = false;
        if (!storageExists) {
            const plannerState = global.State.roomPlanner ? global.State.roomPlanner.get(room.name) : null;
            if (plannerState && plannerState.has('anchor')) {
                const anchor = plannerState.get('anchor');
                if (anchor) {
                    const structures = global.State.structuresByRoom.get(room.name);
                    const containers = structures ? structures.get(STRUCTURE_CONTAINER) || [] : [];
                    for (const container of containers) {
                        if (container.pos.x === anchor.x && container.pos.y === anchor.y && container.isActive()) {
                            coreContainerExists = true;
                            break;
                        }
                    }
                }
            }
        }

        if (storageExists || coreContainerExists) {
            return 2;
        }
        return 0;
    }

    /**
     * Checks if there's at least one active source container.
     * @param {Room} room
     * @returns {boolean}
     */
    hasActiveSourceContainer(room) {
        const structures = global.State.structuresByRoom.get(room.name);
        const containers = structures ? structures.get(STRUCTURE_CONTAINER) || [] : [];
        if (containers.length === 0) return false;

        const sources = global.State.sourcesByRoom.get(room.name) || [];
        for (const container of containers) {
            for (const source of sources) {
                if (container.pos.isNearTo(source)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Mathematically forces the minimum worker target count.
     * Ends swarm logic at RCL 2 once basic infrastructure is built.
     * @param {Room} room The room.
     * @returns {number} The target worker count.
     */
    calculateWorkerTarget(room) {
        if (room.controller && room.controller.level >= 2 && this.hasActiveSourceContainer(room)) {
            return 2; // Strictly for building/maintenance once infrastructure is established
        }

        if (room.controller && room.controller.level < 3) {
            return Math.max(8, Math.ceil(this.calculateSourceCaps() * 1.5));
        }
        return 2; // Default minimum
    }

    /**
     * Caps the harvester target based on RCL and living workers.
     * @param {Room} _room The room.
     * @param {number} _workerCount The number of living workers.
     * @returns {number} The target harvester count.
     */
    calculateHarvesterTarget(_room, _workerCount) {
        return this.calculateSourceCaps();
    }

    /**
     * Calculates the target Upgrader count.
     * @param {Room} room
     * @param {number} harvesterCount
     * @returns {number}
     */
    calculateUpgraderTarget(room, harvesterCount) {
        if (room.controller && room.controller.level >= 2 && this.hasActiveSourceContainer(room)) {
            // Shift population capacity to upgraders based on dynamic income math
            const energyPerTick = harvesterCount * 2;
            const upkeep = 1;
            return Math.max(1, energyPerTick - upkeep);
        }
        return 0;
    }

    /**
     * Calculates the maximum number of walkable tiles around all sources in the room.
     * @returns {number}
     */
    calculateSourceCaps() {
        let totalWalkable = 0;

        if (global.State && global.State.sourceWalkableTiles) {
            const roomTiles = global.State.sourceWalkableTiles.get(this.roomName);
            if (roomTiles) {
                for (const count of roomTiles.values()) {
                    totalWalkable += count;
                }
                return totalWalkable;
            }
        }

        const sources = global.State.sourcesByRoom.get(this.roomName) || [];
        return sources.length;
    }
}

module.exports = SpawnLedger;
