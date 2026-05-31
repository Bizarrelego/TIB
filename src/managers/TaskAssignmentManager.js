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
          const sourceCounts = new Map();
          sources.forEach(s => sourceCounts.set(s.id, 0));
          for (const cName in Game.creeps) {
              const c = Game.creeps[cName];
              if (c.memory.colony === roomName && c.memory.role === 'harvester' && c.heap && c.heap.targetId) {
                  if (sourceCounts.has(c.heap.targetId)) {
                      sourceCounts.set(c.heap.targetId, sourceCounts.get(c.heap.targetId) + 1);
                  }
              }
          }
          const bestSource = sources.reduce((a, b) => sourceCounts.get(a.id) < sourceCounts.get(b.id) ? a : b);
          creep.heap.targetId = bestSource.id;
          creep.heap.actionIntent = 'harvest';
          creep.heap.state = 'working';
        }
      } else if (role === 'hauler') {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          // Empty hauler - find something to pickup
          // Priority: Ruins > Tombstones > Dropped
          let target = null;

          if (roomState.ruins && roomState.ruins.length > 0) {
            const index = getHash(name, roomState.ruins.length);
            target = roomState.ruins[index];
          } else if (roomState.tombstones && roomState.tombstones.length > 0) {
            const index = getHash(name, roomState.tombstones.length);
            target = roomState.tombstones[index];
          } else if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
            const index = getHash(name, roomState.droppedEnergy.length);
            target = roomState.droppedEnergy[index];
          }

          if (target) {
            creep.heap.targetId = target.id;
            creep.heap.actionIntent = 'haul_pickup';
            creep.heap.state = 'working';
          }
        } else {
          // Full hauler - deliver
          const spawns = roomState.spawns;
          let target = null;

          if (spawns && spawns.length > 0) {
            const spawn = spawns[0];
            if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
              target = spawn;
            }
          }

          if (!target) {
            const upgraders = [];
            for (const cName in Game.creeps) {
              const c = Game.creeps[cName];
              if (c.memory.colony === roomName && c.memory.role === 'upgrader') {
                upgraders.push(c);
              }
            }
            if (upgraders.length > 0) {
              const index = getHash(name, upgraders.length);
              target = upgraders[index];
            } else {
              target = roomState.controller;
            }
          }

          if (target) {
            creep.heap.targetId = target.id;
            creep.heap.actionIntent = 'haul_deliver';
            creep.heap.state = 'working';
          }
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
