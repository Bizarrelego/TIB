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
            const links = structuresMap.get(STRUCTURE_LINK);
            return links ? links.size >= 2 : false;
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
                    if (structures) {
                        const containers = structures.get(STRUCTURE_CONTAINER);
                        if (containers) {
                            for (const container of containers.values()) {
                                if (container.pos.x === anchor.x && container.pos.y === anchor.y && container.isActive()) {
                                    coreContainerExists = true;
                                    break;
                                }
                            }
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
        if (!structures) return false;
        const containers = structures.get(STRUCTURE_CONTAINER);
        if (!containers || containers.size === 0) return false;

        const sources = global.State.sourcesByRoom.get(room.name) || [];
        for (const container of containers.values()) {
            for (const source of sources) {
                if (container.pos.isNearTo(source)) {
                    return true;
                }
            }
        }
        return false;
    }
}

module.exports = SpawnLedger;
