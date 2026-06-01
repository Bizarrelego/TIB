/**
 * The Brain - TaskAssignmentManager
 * Assigns deterministic intents to idle creeps reading strictly from global.state.
 */
const { getOptimalHarvesterTarget } = require('../utils/HarvesterUtility');
const { getHaulerDeliveryTarget } = require('../utils/HaulerUtility');
const { getScavengingTarget } = require('../utils/ScavengingUtility');
const { getUpgraderTask } = require('../tasks/UpgraderTaskProvider');

function run(roomName) {
  // Use global.state exactly as instructed, fallback to global.State
  const stateObj = global.state || global.State;
  if (!stateObj) return;

  if (!stateObj.rooms || !stateObj.rooms.has(roomName)) return;
  const roomState = stateObj.rooms.get(roomName);

  const creepsToIterate = stateObj.creeps || Game.creeps;

  for (const name in creepsToIterate) {
    const creep = creepsToIterate[name];
    if (creep.memory.colony !== roomName) continue;

    // Safely initialize creep.heap
    if (!creep.heap) {
      creep.heap = new Map([
        ['state', 'idle'],
        ['targetId', null],
        ['actionIntent', null]
      ]);
    } else if (!(creep.heap instanceof Map)) {
        const old = creep.heap;
        creep.heap = new Map([
            ['state', old.state || 'idle'],
            ['targetId', old.targetId || null],
            ['actionIntent', old.actionIntent || null],
            ['pickupTargetId', old.pickupTargetId || null],
            ['sleepUntil', old.sleepUntil || null],
            ['standPos', old.standPos || null],
            ['path', old.path || null]
        ]);
    }

    if (creep.heap.get('state') === 'idle') {
      const role = creep.memory.role;

      if (role === 'harvester') {
        const bestSource = getOptimalHarvesterTarget(roomName, roomState.sources);
        if (bestSource) {
          creep.heap.set('targetId', bestSource.id);
          creep.heap.set('actionIntent', 'harvest');
          creep.heap.set('state', 'assigned');
        }
      } else if (role === 'hauler') {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          // Hauler is empty, needs to pick up energy
          const result = getScavengingTarget(roomState, name);
          if (result && result.target) {
            creep.heap.set('targetId', result.target.id);
            creep.heap.set('actionIntent', result.intent);
            creep.heap.set('state', 'assigned');
          }
        } else {
          // Hauler has energy, needs to deliver
          const result = getHaulerDeliveryTarget(roomName, roomState, name);
          if (result && result.target) {
            creep.heap.set('targetId', result.target.id);
            creep.heap.set('actionIntent', result.intent);
            creep.heap.set('state', 'assigned');
          }
        }
      } else if (role === 'upgrader') {
        const task = getUpgraderTask(creep, stateObj);
        if (task) {
          creep.heap.set('targetId', task.targetId);
          creep.heap.set('actionIntent', task.actionIntent);
          if (task.pickupTargetId) {
             creep.heap.set('pickupTargetId', task.pickupTargetId);
          }
          creep.heap.set('state', 'assigned');
        }
      }
    }

    // Runtime verification
    if (creep.heap && creep.heap.get('actionIntent')) {
      console.log(`[Task Check] ${creep.name} | Intent: ${creep.heap.get('actionIntent')} | TargetID: ${creep.heap.get('targetId')}`);
    }
  }
}

module.exports = {
  run
};
