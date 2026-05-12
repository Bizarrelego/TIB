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
        // For example, properties populated externally or via RawMemory caches
        for (const structData of structures.values()) {
            if (!structData.isActive) continue;

            if ((structData.structureType === 'spawn' || structData.structureType === 'extension') && structData.freeCapacity > 0) {
                spawnsAndExtensions.push(structData);
            } else if (structData.structureType === 'tower' && structData.freeCapacity > 200) {
                towers.push(structData);
            } else if (structData.structureType === 'storage') {
                storage = structData;
            }
        }

        // Gather logistics creeps (haulers and fastFillers)
        const haulers = [];
        const fastFillers = [];

        for (const creep of creeps.values()) {
            // Intent Maximization & Fatigue Gating Rule
            if (creep.fatigue > 0) continue; // instantly skip logic for that tick

            if (!creep.heap) creep.heap = {}; // Ensure proxy
            if (creep.memory.role === 'hauler' && !creep.heap.targetId) {
                haulers.push(creep);
            } else if (creep.memory.role === 'fastFiller' && !creep.heap.targetId) {
                fastFillers.push(creep);
            }
        }

        // Top-Down Assignment: Assign targets directly to heap
        // FastFillers prioritized for Spawns/Extensions
        // We use index-based traversal instead of .shift() for better performance
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

        // Haulers handle transport from remote/local drops to Storage
        for (const hauler of haulers) {
            if (storage) {
                hauler.heap.targetId = storage.id;
                hauler.heap.task = 'store_energy';
            }
            // If we needed to assign pickup, we'd query global.State.logisticsByRoom
        }
    }
};

module.exports = LogisticsManager;
