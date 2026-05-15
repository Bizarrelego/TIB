/* eslint-disable no-redeclare */
/* global OK */
const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');

/**
 * Executes logic for the labManager role.
 * @param {Room} room - The room object.
 */
function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const labManagers = roomCreeps.get('labManager');
    if (!labManagers || labManagers.length === 0) return;

    for (let i = 0; i < labManagers.length; i++) {
        const creep = labManagers[i];

        try {
            if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue; // Fatigue gating and pipeline check

            const state = creep.heap.state;
            const targetId = creep.heap.targetId;
            const resource = creep.heap.resource;

            if (!state || state === 'idle' || !targetId) continue;

            const target = Game.getObjectById(targetId);
            if (!target) continue;

            if (!creep.pos.isNearTo(target)) {
                movement.moveTo(creep, target.pos);
                continue;
            }

            // Execute logic
            if (state === 'store_wrong' || state === 'store_output' || state === 'fill_input1' || state === 'fill_input2') {
                const amount = Math.min(creep.store[resource] || 0, target.store.getFreeCapacity(resource));
                if (amount > 0) {
                    if (TrafficManager.registerTransfer(creep, target, resource, amount) === OK) {
                        TrafficManager.lockPipeline(creep.name, creep.id, target.id, resource, amount, 'TRANSFER');
                    }
                }
            } else if (state === 'empty_wrong' || state === 'empty_output' || state === 'gather_input1' || state === 'gather_input2') {
                const amount = Math.min(creep.store.getFreeCapacity(), target.store[resource] || 0);
                if (amount > 0) {
                    if (TrafficManager.registerWithdraw(creep, target, resource, amount) === OK) {
                        TrafficManager.lockPipeline(creep.name, creep.id, target.id, resource, amount, 'WITHDRAW');
                    }
                }
            }
        } catch (e) {
            console.log(`[labManager Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
