/**
 * The Brain - TaskAssignmentManager
 * Assigns deterministic intents to idle creeps reading strictly from global.State.
 */
const { getOptimalHarvesterTarget } = require('../utils/HarvesterUtility');
const { getHaulerDeliveryTarget } = require('../utils/HaulerUtility');
const { getScavengingTarget } = require('../utils/ScavengingUtility');

function run(roomName) {
  if (!global.State || !global.State.rooms || !global.State.rooms.has(roomName)) return;

  const roomState = global.State.rooms.get(roomName);

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.memory.colony !== roomName) continue;

    // Safely initialize creep.heap
    if (!creep.heap) {
      creep.heap = { state: 'idle', targetId: null, actionIntent: null };
    }

    if (creep.heap.state === 'seeking_target') {
      const role = creep.memory.role;

      if (role === 'harvester') {
        const bestSource = getOptimalHarvesterTarget(roomName, roomState.sources);
        if (bestSource) {
          creep.heap.targetId = bestSource.id;
          creep.heap.actionIntent = 'harvest';
          creep.heap.state = 'assigned';
        }
      } else if (role === 'hauler') {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          // Hauler is empty, needs to pick up energy
          const result = getScavengingTarget(roomState, name);
          if (result && result.target) {
            creep.heap.targetId = result.target.id;
            creep.heap.actionIntent = result.intent;
            creep.heap.state = 'assigned';
          }
        } else {
          // Hauler has energy, needs to deliver
          const result = getHaulerDeliveryTarget(roomName, roomState, name);
          if (result && result.target) {
            creep.heap.targetId = result.target.id;
            creep.heap.actionIntent = result.intent;
            creep.heap.state = 'assigned';
          }
        }
      } else if (role === 'upgrader') {
        const controller = roomState.controller;
        if (controller) {
          creep.heap.targetId = controller.id;
          creep.heap.actionIntent = 'upgrade';
          creep.heap.state = 'assigned';
        }
      }
    }

    // Runtime verification
    if (creep.heap && creep.heap.actionIntent) {
      console.log(`[Task Check] ${creep.name} | Intent: ${creep.heap.actionIntent} | TargetID: ${creep.heap.targetId}`);
    }
  }
}

module.exports = {
  run
};
