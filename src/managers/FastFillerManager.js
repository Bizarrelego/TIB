function run(room) {
    try {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const fastFillers = roomCreeps.get('fastFiller');
        if (!fastFillers || fastFillers.length === 0) return;

        const structures = global.State.structuresByRoom.get(room.name);
        if (!structures) return;

        // 1. Determine Park Position (if Storage exists)
        let parkPos = null;
        const storages = structures.get(STRUCTURE_STORAGE) || [];
        if (storages.length > 0) {
            const storage = storages[0];
            parkPos = { x: storage.pos.x + 1, y: storage.pos.y, roomName: room.name };
        } else {
            const spawns = global.State.spawnsByRoom.get(room.name);
            if (spawns && spawns.length > 0) {
                parkPos = { x: spawns[0].pos.x + 1, y: spawns[0].pos.y, roomName: room.name };
            }
        }

        // 2. Identify Needs
        const needyStructures = [];
        const spawns = structures.get(STRUCTURE_SPAWN) || [];
        for (let i = 0; i < spawns.length; i++) {
            if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                needyStructures.push(spawns[i]);
            }
        }

        const extensions = structures.get(STRUCTURE_EXTENSION) || [];
        for (let i = 0; i < extensions.length; i++) {
            if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                needyStructures.push(extensions[i]);
            }
        }

        const needsEmergencyRefill = needyStructures.length > 0 && storages.length > 0 && (spawns.every(s => s.store.getUsedCapacity(RESOURCE_ENERGY) === 0));

        // 3. Assign Targets to Creeps
        for (let i = 0; i < fastFillers.length; i++) {
            const creep = fastFillers[i];
            creep.heap = creep.heap || {};

            if (parkPos) {
                creep.heap.parkPos = parkPos;
            }

            // Determine state
            if (creep.heap.state !== 'filling' && creep.heap.state !== 'emptying') {
                creep.heap.state = 'emptying';
            }
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.state = 'filling';
            } else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.state = 'emptying';
            }

            // Clear old targets
            creep.heap.transferTargetId = null;
            creep.heap.withdrawTargetId = null;

            if (creep.heap.state === 'emptying') {
                // Find nearest needy structure
                let target = null;
                for (let j = 0; j < needyStructures.length; j++) {
                    const struct = needyStructures[j];
                    if (struct.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.isNearTo(struct)) {
                        target = struct;
                        break;
                    }
                }

                // If nothing near, just assign first needy structure so it knows there's work,
                // even though fastFiller won't move to it (handled in fastFiller.js)
                if (!target && needyStructures.length > 0) {
                    target = needyStructures[0];
                }

                if (target) {
                    creep.heap.transferTargetId = target.id;
                }
            } else {
                // Filling (Withdrawing from Storage)
                if (storages.length > 0 && storages[0].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    if (room.memory.restrictStorageOutflow && !needsEmergencyRefill) {
                        // Skip assignment to respect DEFCON
                    } else {
                        creep.heap.withdrawTargetId = storages[0].id;
                    }
                }
            }
        }
    } catch (e) {
        console.log(`[FastFillerManager Error] Room ${room.name}: ${e.stack}`);
    }
}

module.exports = { run };
