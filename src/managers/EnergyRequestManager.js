/**
 * @file EnergyRequestManager.js
 * @description Scans the room, identifies all structures needing energy (requests) and sources of energy (supplies),
 * and prioritizes them for top-down task assignments to haulers.
 */

const resourceUtils = require('../utils/resourceUtils');

class EnergyRequestManager {
    static init() {
        // EnergyRequestManager is an on-demand virtual ledger that recalculates state via global getters.
        // No per-tick caches need clearing at this time.
    }

    /**
     * Tracks source regeneration and skips logic for harvesters assigned to empty sources.
     * Iterates over all rooms and sources via global.State.sourcesByRoom.
     */
    static handleSourceSleep() {
        if (!Memory.sources) {
            Memory.sources = {};
        }

        if (!global.State.sourcesByRoom) return;

        for (const [roomName, sources] of global.State.sourcesByRoom.entries()) {
            for (let i = 0; i < sources.length; i++) {
                const source = sources[i];

                if (source.energy === 0) {
                    if (!Memory.sources[source.id]) {
                        Memory.sources[source.id] = {};
                    }
                    if (!Memory.sources[source.id].wakeTick) {
                        Memory.sources[source.id].wakeTick = Game.time + source.ticksToRegeneration;
                    }
                } else if (Memory.sources[source.id] && Memory.sources[source.id].wakeTick && Game.time >= Memory.sources[source.id].wakeTick) {
                    delete Memory.sources[source.id].wakeTick;
                }

                if (Memory.sources[source.id] && Memory.sources[source.id].wakeTick && Game.time < Memory.sources[source.id].wakeTick) {
                    // Source is sleeping, filter out its harvesters
                    const roomCreeps = global.State.creepsByRoom.get(roomName);
                    if (roomCreeps) {
                        const harvesters = roomCreeps.get('harvester');
                        if (harvesters) {
                            const awakeHarvesters = harvesters.filter(c => !c.heap || c.heap.targetId !== source.id);
                            roomCreeps.set('harvester', awakeHarvesters);
                        }
                    }
                }
            }
        }
    }

    /**
     * Identifies and prioritizes structures that need energy in the room.
     * Higher priority number means more urgent.
     * @param {string} roomName - The name of the room.
     * @returns {Array<{target: Structure, priority: number, amount: number}>} Prioritized list of energy requests.
     */
    static getEnergyRequests(roomName) {
        const room = Game.rooms[roomName];
        const hasStorage = room && room.storage && room.storage.isActive();
        const buckets = new Array(101);

        const spawns = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_SPAWN]);
        const extensions = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_EXTENSION]);
        const towers = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_TOWER]);
        const labs = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_LAB]);
        const storage = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_STORAGE]);
        const terminal = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_TERMINAL]);
        const factory = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_FACTORY]);
        const powerSpawn = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_POWER_SPAWN]);

        // Priority 100: Spawns and Extensions
        for (let i = 0; i < spawns.length; i++) {
            const bucket = buckets[100] = buckets[100] || [];
            bucket.push({ target: spawns[i], amount: spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }
        for (let i = 0; i < extensions.length; i++) {
            const bucket = buckets[100] = buckets[100] || [];
            bucket.push({ target: extensions[i], amount: extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }

        // Priority 90: Towers with > 500 missing energy
        for (let i = 0; i < towers.length; i++) {
            const tower = towers[i];
            const free = tower.store.getFreeCapacity(RESOURCE_ENERGY);
            const priority = free > 500 ? 90 : 80;
            const bucket = buckets[priority] = buckets[priority] || [];
            bucket.push({ target: tower, amount: free });
        }

        // Priority 80: Controller Container
        const controller = room ? room.controller : null;
        if (controller) {
            const containers = resourceUtils.getStructuresWithFreeCapacity(roomName, [STRUCTURE_CONTAINER]);
            const priority = hasStorage ? 90 : 80;
            for (let i = 0; i < containers.length; i++) {
                if (containers[i].pos.inRangeTo(controller, 3)) {
                    const bucket = buckets[priority] = buckets[priority] || [];
                    bucket.push({ target: containers[i], amount: containers[i].store.getFreeCapacity(RESOURCE_ENERGY) });
                }
            }
        }

        // Priority 60: Labs
        for (let i = 0; i < labs.length; i++) {
            const bucket = buckets[60] = buckets[60] || [];
            bucket.push({ target: labs[i], amount: labs[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }

        // Priority 50: Power Spawn
        for (let i = 0; i < powerSpawn.length; i++) {
            const bucket = buckets[50] = buckets[50] || [];
            bucket.push({ target: powerSpawn[i], amount: powerSpawn[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }

        // Priority 40: Factory
        for (let i = 0; i < factory.length; i++) {
            if (factory[i].store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
                const bucket = buckets[40] = buckets[40] || [];
                bucket.push({ target: factory[i], amount: Math.min(10000 - factory[i].store.getUsedCapacity(RESOURCE_ENERGY), factory[i].store.getFreeCapacity(RESOURCE_ENERGY)) });
            }
        }

        // Priority 20: Terminal (up to 50k)
        for (let i = 0; i < terminal.length; i++) {
            const term = terminal[i];
            const energy = term.store.getUsedCapacity(RESOURCE_ENERGY);
            if (energy < 50000) {
                const bucket = buckets[20] = buckets[20] || [];
                bucket.push({ target: term, amount: 50000 - energy });
            }
        }

        // Priority 10: Storage
        const storagePriority = hasStorage ? 100 : 10;
        for (let i = 0; i < storage.length; i++) {
            const bucket = buckets[storagePriority] = buckets[storagePriority] || [];
            bucket.push({ target: storage[i], amount: storage[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }

        // Flatten bucked queue O(1)
        const flattened = [];
        for (let i = 100; i >= 0; i--) {
            if (buckets[i]) {
                for (let j = 0; j < buckets[i].length; j++) {
                    flattened.push(buckets[i][j]);
                }
            }
        }
        
        return flattened;
    }

    /**
     * Identifies and prioritizes energy sources in the room.
     * Higher priority number means it should be picked up first.
     * @param {string} roomName - The name of the room.
     * @returns {Array<{target: Resource|Structure|Tombstone|Ruin, priority: number, amount: number}>} Prioritized list of energy supplies.
     */
    static getEnergySupplies(roomName) {
        const room = Game.rooms[roomName];
        const hasStorage = room && room.storage && room.storage.isActive();
        const buckets = new Array(101);

        // Containers (Priority 100 if Source Container with > 200 energy)
        const containers = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_CONTAINER]);
        const sources = global.State.sourcesByRoom ? global.State.sourcesByRoom.get(roomName) || [] : [];
        for (let i = 0; i < containers.length; i++) {
            const container = containers[i];
            const amount = container.store.getUsedCapacity(RESOURCE_ENERGY);

            let isSourceContainer = false;
            for (let j = 0; j < sources.length; j++) {
                if (container.pos.inRangeTo(sources[j], 2)) {
                    isSourceContainer = true;
                    break;
                }
            }

            if (isSourceContainer && amount > 200) {
                const bucket = buckets[100] = buckets[100] || [];
                bucket.push({ target: container, amount: amount });
            } else {
                // Priority 70: other containers
                const priority = amount > 1500 ? 75 : 70;
                const bucket = buckets[priority] = buckets[priority] || [];
                bucket.push({ target: container, amount: amount });
            }
        }

        // Dropped Energy via DroppedResourceManager
        const DroppedResourceManager = require('./DroppedResourceManager');
        const prioritizedDrops = DroppedResourceManager.getPrioritizedDroppedResources(roomName);
        for (let i = 0; i < prioritizedDrops.length; i++) {
            const drop = prioritizedDrops[i];
            const bucket = buckets[drop.priority] = buckets[drop.priority] || [];
            bucket.push(drop);
        }

        // Tombstones and Ruins (Priority 85)
        let tombstones = (global.State.tombstonesByRoom && global.State.tombstonesByRoom.get(roomName)) || [];
        if (tombstones instanceof Map) tombstones = Array.from(tombstones.values());
        for (let i = 0; i < tombstones.length; i++) {
            const tombstone = tombstones[i];
            if (tombstone.store) {
                const amount = tombstone.store.getUsedCapacity(RESOURCE_ENERGY);
                if (amount > 0) {
                    const bucket = buckets[85] = buckets[85] || [];
                    bucket.push({ target: tombstone, amount: amount });
                }
            }
        }

        let ruins = (global.State.ruinsByRoom && global.State.ruinsByRoom.get(roomName)) || [];
        if (ruins instanceof Map) ruins = Array.from(ruins.values());
        for (let i = 0; i < ruins.length; i++) {
            const ruin = ruins[i];
            if (ruin.store) {
                const amount = ruin.store.getUsedCapacity(RESOURCE_ENERGY);
                if (amount > 0) {
                    const bucket = buckets[85] = buckets[85] || [];
                    bucket.push({ target: ruin, amount: amount });
                }
            }
        }

        // Links (only withdraw from non-hub links if needed, though usually haulers don't withdraw from hub links directly unless acting as hubManager)
        // Usually haulers shouldn't empty links, that's up to hubManager or dedicated link management, but we'll include it at low priority
        const links = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_LINK]);
        for (let i = 0; i < links.length; i++) {
             // Let's deprioritize links for general haulers to avoid conflicts with hubManager/upgrader link logic
            const link = links[i];
            const amount = link.store.getUsedCapacity(RESOURCE_ENERGY);
            const bucket = buckets[30] = buckets[30] || [];
            bucket.push({ target: link, amount: amount });
        }

        // Terminal (if it has excess energy, we can use it)
        const terminal = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_TERMINAL]);
        for (let i = 0; i < terminal.length; i++) {
            const term = terminal[i];
            const energy = term.store.getUsedCapacity(RESOURCE_ENERGY);
            if (energy > 55000) {
                const bucket = buckets[20] = buckets[20] || [];
                bucket.push({ target: term, amount: energy - 50000 });
            }
        }

        // Storage (always available as a low priority source if nothing else is)
        const storage = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_STORAGE]);
        const storagePriority = hasStorage ? 100 : 10;
        for (let i = 0; i < storage.length; i++) {
            const store = storage[i];
            const amount = store.store.getUsedCapacity(RESOURCE_ENERGY);
            const bucket = buckets[storagePriority] = buckets[storagePriority] || [];
            bucket.push({ target: store, amount: amount });
        }

        // Flatten bucked queue O(1)
        const flattened = [];
        for (let i = 100; i >= 0; i--) {
            if (buckets[i]) {
                for (let j = 0; j < buckets[i].length; j++) {
                    flattened.push(buckets[i][j]);
                }
            }
        }
        
        return flattened;
    }
}

module.exports = EnergyRequestManager;
