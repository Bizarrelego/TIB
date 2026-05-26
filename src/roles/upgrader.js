const TrafficManager = require('../traffic/trafficManager');
const movement = require('../utils/movement');



// Upgraders must be static. Move once, then stay forever.
function run(creep, room) {
    if (room.memory.haltUpgrades) return;

    try {
        if (creep.fatigue > 0) return;

        const state = creep.heap.state;
        const target = Game.getObjectById(creep.heap.energyTargetId || creep.heap.targetId);

        if (!state || !target) return; // Do nothing if brain did not assign task

        if (state === 'withdraw') {
            if (creep.pos.isNearTo(target)) {
                if (target.amount !== undefined) {
                    TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY);
                } else {
                    TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY);
                }
            } else {
                movement.moveTo(creep, target);
            }
        } else if (state === 'upgrade') {
            if (creep.pos.inRangeTo(target, 3)) {
                TrafficManager.registerUpgrade(creep, target);
            } else {
                movement.moveTo(creep, target, { range: 3 });
            }
        } else if (state === 'build') {
            if (creep.pos.inRangeTo(target, 3)) {
                TrafficManager.registerBuild(creep, target);
            } else {
                movement.moveTo(creep, target, { range: 3 });
            }
        }
    } catch (e) {
        console.log(`[Upgrader Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
    }
}

module.exports = { run };