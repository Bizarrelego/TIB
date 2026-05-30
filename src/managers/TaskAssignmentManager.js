/**
 * The Brain - TaskAssignmentManager
 * Assigns deterministic intents to idle creeps reading strictly from global.State.
 */

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
          // Use creep's name or some index to distribute them evenly
          // A simple hash of the name
          let hash = 0;
          for (let i = 0; i < name.length; i++) {
            hash += name.charCodeAt(i);
          }
          const index = hash % sources.length;

          creep.heap.targetId = sources[index].id;
          creep.heap.actionIntent = 'harvest';
          creep.heap.state = 'working';
        }
      } else if (role === 'hauler') {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          // Empty hauler - find something to pickup
          // Priority: Ruins > Tombstones > Dropped
          let target = null;

          if (roomState.ruins && roomState.ruins.length > 0) {
            target = roomState.ruins[0];
          } else if (roomState.tombstones && roomState.tombstones.length > 0) {
            target = roomState.tombstones[0];
          } else if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
            target = roomState.droppedEnergy[0];
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
            target = roomState.controller;
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
  }
}

module.exports = {
  run
};
