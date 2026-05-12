const LogisticsManager = {
    run(roomName) {
        const room = Game.rooms[roomName];
        if (!room || !global.State.structuresByRoom.has(roomName)) return;

        const structures = global.State.structuresByRoom.get(roomName);
        const creeps = global.State.creepsByRoom.get(roomName);

        // Categorize needs strictly O(n) without room.find()
        const spawnsAndExtensions = [];
        const towers = [];
        let storage = null;

        for (const struct of structures.values()) {
            if (!struct.isActive || !struct.isActive()) continue;

            if ((struct.structureType === 'spawn' || struct.structureType === 'extension') && struct.store.getFreeCapacity('energy') > 0) {
                spawnsAndExtensions.push(struct);
            } else if (struct.structureType === 'tower' && struct.store.getFreeCapacity('energy') > 200) {
                towers.push(struct);
            } else if (struct.structureType === 'storage') {
                storage = struct;
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
        for (const filler of fastFillers) {
            if (spawnsAndExtensions.length > 0) {
                const target = spawnsAndExtensions.shift();
                filler.heap.targetId = target.id;
                filler.heap.task = 'fill_spawn';
            } else if (towers.length > 0) {
                const target = towers.shift();
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
