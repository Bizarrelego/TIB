const TrafficManager = require('../traffic/trafficManager');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const hubManagers = roomCreeps.get('hubManager');
    if (!hubManagers || hubManagers.length === 0) return;

    for (let i = 0; i < hubManagers.length; i++) {
        const creep = hubManagers[i];

        try {
            // Stationary execution only - NO movement logic allowed.
            if (TrafficManager && TrafficManager.checkPipeline && TrafficManager.checkPipeline(creep.id)) continue;

            const storage = room.storage;
            if (!storage) continue;

            const linkCache = global.State.linkCache ? global.State.linkCache.get(room.name) : null;
            if (!linkCache || !linkCache.hubLinkId) continue;

            const hubLink = Game.getObjectById(linkCache.hubLinkId);
            if (!hubLink) continue;

            // 0-CPU Stationary Transfer Logic
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                if (hubLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    if (TrafficManager && TrafficManager.registerWithdraw) {
                        TrafficManager.registerWithdraw(creep, hubLink, RESOURCE_ENERGY);
                    } else {
                        creep.withdraw(hubLink, RESOURCE_ENERGY);
                    }
                }
            } else {
                if (storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    if (TrafficManager && TrafficManager.registerTransfer) {
                        TrafficManager.registerTransfer(creep, storage, RESOURCE_ENERGY);
                    } else {
                        creep.transfer(storage, RESOURCE_ENERGY);
                    }
                }
            }
        } catch (e) {
            console.log(`[hubManager Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };