/**
 * The Brain - TaskAssignmentManager
 * Assigns deterministic intents to idle creeps reading strictly from global.State.
 */
const { getHash } = require('../utils/HashUtility');

function run(roomName) {
  // Retrieve the room state
  if (!global.State || !global.State.rooms || !global.State.rooms.has(roomName)) return;

  const roomState = global.State.rooms.get(roomName);

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.memory.colony !== roomName) continue;

    // Safely initialize creep.heap
    if (!creep.heap) {
      creep.heap = { state: 'idle', targetId: null, actionIntent: null };
    }

    if (creep.heap.state === 'idle') {
      const role = creep.memory.role;

      if (role === 'harvester') {
        const sources = roomState.sources;
        if (sources && sources.length > 0) {
          const sourceCounts = {};
          sources.forEach(s => sourceCounts[s.id] = 0);
          Object.values(Game.creeps).forEach(c => {
              if (c.memory.role === 'harvester' && c.heap && c.heap.targetId) {
                  if (sourceCounts[c.heap.targetId] !== undefined) sourceCounts[c.heap.targetId]++;
              }
          });
          const bestSource = sources.reduce((a, b) => sourceCounts[a.id] < sourceCounts[b.id] ? a : b);
          creep.heap.targetId = bestSource.id;
          creep.heap.actionIntent = 'harvest';
          creep.heap.state = 'working';
        }
      } else if (role === 'hauler') {
        // Hauler (Empty) - Pickup State
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            const drops = roomState.droppedEnergy;
            if (drops && drops.length > 0) {
                creep.heap.targetId = drops[0].id;
                creep.heap.actionIntent = 'haul_pickup';
                creep.heap.state = 'working';
            }
        }
        // Hauler (Full) - Deliver State
        else {
            const spawn = roomState.spawns && roomState.spawns.length > 0 ? roomState.spawns[0] : null;
            if (spawn && spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = spawn.id;
            } else {
                const controller = roomState.controller;
                if (controller) creep.heap.targetId = controller.id;
            }
            creep.heap.actionIntent = 'haul_deliver';
            creep.heap.state = 'working';
        }
      } else if (role === 'upgrader') {
        const controller = roomState.controller;
        if (controller) {
          creep.heap.targetId = controller.id;
          creep.heap.actionIntent = 'upgrade';
          creep.heap.state = 'working';
        }
      }
    }

    // Runtime verification as requested
    if (creep.heap && creep.heap.actionIntent) {
        console.log(`[Task Check] ${creep.name} | Intent: ${creep.heap.actionIntent} | TargetID: ${creep.heap.targetId}`);
    }
  }
}

module.exports = {
  run
};
