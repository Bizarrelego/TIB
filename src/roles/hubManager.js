const TrafficManager = require('../traffic/trafficManager');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const hubManagers = roomCreeps.get('hubManager');
    if (!hubManagers || hubManagers.length === 0) return;

    for (let i = 0; i < hubManagers.length; i++) {
        const creep = hubManagers[i];

        try {
            if (TrafficManager && TrafficManager.checkPipeline && TrafficManager.checkPipeline(creep.id)) continue;

            const state = creep.heap.state;
            const targetId = creep.heap.targetId;

            if (!state || !targetId) continue;

            const target = Game.getObjectById(targetId);
            if (!target) continue;

            if (state === 'empty_link' || state === 'empty_storage' || state === 'empty_terminal') {
                if (TrafficManager && TrafficManager.registerWithdraw) {
                    TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY);
                } else {
                    creep.withdraw(target, RESOURCE_ENERGY);
                }
            } else if (state === 'fill_link' || state === 'fill_storage' || state === 'fill_terminal') {
                if (TrafficManager && TrafficManager.registerTransfer) {
                    TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY);
                } else {
                    creep.transfer(target, RESOURCE_ENERGY);
                }
            }
        } catch (e) {
            console.log(`[hubManager Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };