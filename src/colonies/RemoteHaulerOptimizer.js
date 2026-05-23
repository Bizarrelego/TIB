/**
 * @file RemoteHaulerOptimizer.js
 * @description Dynamically calculates the optimal CARRY parts for remote haulers based on distance, energy decay, and generation rate.
 */

const haulerSizing = require('./haulerSizing');

/**
 * @class RemoteHaulerOptimizer
 */
class RemoteHaulerOptimizer {
    /**
     * Calculates the optimal hauler body based on decay, distance, and energy generation.
     * @param {string} roomName The home room name.
     * @param {string} sourceId The ID of the remote source.
     * @param {string} storageId The ID of the storage structure in the home room.
     * @returns {string[]} The recommended creep body array.
     */
    static calculateOptimalHaulerBody(roomName, sourceId, storageId) {
        let sourceRoomName = null;

        if (global.State && global.State.sourcesByRoom) {
            for (const [rName, sources] of global.State.sourcesByRoom.entries()) {
                if (sources) {
                    for (let i = 0; i < sources.length; i++) {
                        if (sources[i].id === sourceId) {
                            sourceRoomName = rName;
                            break;
                        }
                    }
                }
                if (sourceRoomName) break;
            }
        }

        // If we can't find the source room, fallback to 100 distance (2 rooms away)
        const pathLength = sourceRoomName ? Game.map.getRoomLinearDistance(roomName, sourceRoomName) * 50 : 100;

        let droppedEnergy = 0;
        if (sourceRoomName && global.State && global.State.droppedByRoom && global.State.droppedByRoom.has(sourceRoomName)) {
            const droppedMap = global.State.droppedByRoom.get(sourceRoomName);
            if (droppedMap) {
                const iterator = droppedMap.values();
                let next = iterator.next();
                while (!next.done) {
                    const drop = next.value;
                    if (drop.resourceType === RESOURCE_ENERGY) {
                        droppedEnergy += drop.amount;
                    }
                    next = iterator.next();
                }
            }
        }

        let energyPerTick = 5;
        if (sourceRoomName && global.State && global.State.intel) {
            const intel = global.State.intel.get(sourceRoomName);
            if (intel && intel.reservation) {
                energyPerTick = 10;
            }
        }

        const requiredCarry = haulerSizing.getRequiredCarryParts(pathLength, droppedEnergy, energyPerTick);
        const energyCapacity = Game.rooms[roomName] ? Game.rooms[roomName].energyCapacityAvailable : 300;

        return haulerSizing.calculateBody(energyCapacity, requiredCarry);
    }
}

module.exports = RemoteHaulerOptimizer;
