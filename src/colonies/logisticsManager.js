const LogisticsManager = {
    run(roomName) {
        if (!global.State.structuresByRoom.has(roomName)) return;

        const structures = global.State.structuresByRoom.get(roomName) || new Map();
        const creeps = global.State.creepsByRoom.get(roomName) || new Map();

        // Categorize needs strictly O(n) without live API calls
        const spawnsAndExtensions = [];
        const towers = [];
        let storage = null;

        // Note: The structure cache in global.State must contain these properties
        for (const struct of structures.values()) {
            if (!struct.isActive) continue;

            // Assuming freeCapacity is populated externally, e.g. from discoveryManager properties
            if ((struct.structureType === 'spawn' || struct.structureType === 'extension') && struct.store && struct.store.getFreeCapacity('energy') > 0) {
                spawnsAndExtensions.push(struct);
            } else if (struct.structureType === 'tower' && struct.store && struct.store.getFreeCapacity('energy') > 200) {
                towers.push(struct);
            } else if (struct.structureType === 'storage') {
                storage = struct;
            }
        }

        const haulers = [];
        const fastFillers = [];

        for (const cachedCreep of creeps.values()) {
            // Live fatigue check directly from creepLookup
            const liveCreep = global.State.creepLookup.get(cachedCreep.name);
            if (!liveCreep || liveCreep.fatigue > 0) continue;

            if (!liveCreep.heap) liveCreep.heap = {};
            if (liveCreep.memory.role === 'hauler' && !liveCreep.heap.targetId) {
                haulers.push(liveCreep);
            } else if (liveCreep.memory.role === 'fastFiller' && !liveCreep.heap.targetId) {
                fastFillers.push(liveCreep);
            }
        }

        // Top-Down Assignment: Assign targets directly to heap
        let spawnIndex = 0;
        let towerIndex = 0;
        for (const filler of fastFillers) {
            if (spawnIndex < spawnsAndExtensions.length) {
                const target = spawnsAndExtensions[spawnIndex++];
                filler.heap.targetId = target.id;
                filler.heap.task = 'fill_spawn';
            } else if (towerIndex < towers.length) {
                const target = towers[towerIndex++];
                filler.heap.targetId = target.id;
                filler.heap.task = 'fill_tower';
            }
        }

        for (const hauler of haulers) {
            if (storage) {
                hauler.heap.targetId = storage.id;
                hauler.heap.task = 'store_energy';
            }
        }
    }
};

module.exports = LogisticsManager;
