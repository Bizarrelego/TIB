/**
 * @file RemoteEconomyManager.js
 * @description Executes Top-Down Assignment for remote economy roles.
 */

module.exports = {
    /**
     * Evaluates room state and assigns target sources and containers directly to creep memory/heap.
     * @param {Room} room
     */
    run(room) {
        let colonyRemoteHarvesters = [];
        let colonyRemoteHaulers = [];

        // Gather all creeps globally that belong to this colony
        for (const roomCreeps of global.State.creepsByRoom.values()) {
            const rHarvesters = roomCreeps.get('remoteHarvester');
            if (rHarvesters) {
                for (let i = 0; i < rHarvesters.length; i++) {
                    if (rHarvesters[i].memory.colony === room.name) colonyRemoteHarvesters.push(rHarvesters[i]);
                }
            }

            const rHaulers = roomCreeps.get('remoteHauler');
            if (rHaulers) {
                for (let i = 0; i < rHaulers.length; i++) {
                    if (rHaulers[i].memory.colony === room.name) colonyRemoteHaulers.push(rHaulers[i]);
                }
            }
        }

        if (colonyRemoteHarvesters.length > 0) {
            for (const creep of colonyRemoteHarvesters) {
                if (!creep.memory.targetSourceId && creep.room.name === creep.memory.targetRoom) {
                    const roomSources = global.State.sourcesByRoom.get(creep.room.name) || [];
                    const assignedSources = colonyRemoteHarvesters.map(c => c.memory.targetSourceId).filter(id => id);

                    for (const src of roomSources) {
                        if (!assignedSources.includes(src.id)) {
                            creep.memory.targetSourceId = src.id;
                            break;
                        }
                    }
                }
            }
        }

        if (colonyRemoteHaulers.length > 0) {
            for (const creep of colonyRemoteHaulers) {
                if (!creep.memory.containerId && creep.room.name === creep.memory.remoteRoom) {
                    const structuresMap = global.State.structuresByRoom.get(creep.room.name);
                    if (structuresMap) {
                        const containers = structuresMap.get(STRUCTURE_CONTAINER) || [];
                        if (containers.length > 0) {
                            // Assign hauler to the container with the highest energy
                            let bestContainer = containers[0];
                            let maxEnergy = bestContainer.store ? bestContainer.store.getUsedCapacity('energy') : 0;

                            for (let i = 1; i < containers.length; i++) {
                                const energy = containers[i].store ? containers[i].store.getUsedCapacity('energy') : 0;
                                if (energy > maxEnergy) {
                                    bestContainer = containers[i];
                                    maxEnergy = energy;
                                }
                            }
                            creep.memory.containerId = bestContainer.id;
                        }
                    }
                }
            }
        }
    }
};
