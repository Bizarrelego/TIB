const movement = require('../utils/movement');

module.exports = {
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const fastFillers = roomCreeps.get('fastFiller');
        if (!fastFillers) return;

        const structures = global.State.structuresByRoom.get(room.name);
        if (!structures) return;

        const storages = structures.get(STRUCTURE_STORAGE) || [];
        const storage = storages.length > 0 ? storages[0] : null;

        if (!storage) return; // fastFiller relies on Storage

        for (const creep of fastFillers) {
            try {
                if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                    // Withdraw from Storage
                    if (storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        const result = creep.withdraw(storage, RESOURCE_ENERGY);
                        if (result === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, storage);
                        }
                    }
                } else {
                    // Fill adjacent or near Spawns/Extensions
                    let target = null;
                    const spawns = structures.get(STRUCTURE_SPAWN) || [];
                    for (let i = 0; i < spawns.length; i++) {
                        if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            target = spawns[i];
                            break;
                        }
                    }

                    if (!target) {
                        const extensions = structures.get(STRUCTURE_EXTENSION) || [];
                        for (let i = 0; i < extensions.length; i++) {
                            if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                target = extensions[i];
                                break;
                            }
                        }
                    }

                    if (target) {
                        const result = creep.transfer(target, RESOURCE_ENERGY);
                        if (result === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        }
                    } else {
                        // Park near storage if nothing to do
                        if (!creep.pos.inRangeTo(storage, 1)) {
                            movement.moveTo(creep, storage);
                        }
                    }
                }
            } catch (e) {
                console.log(`[fastFiller Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
