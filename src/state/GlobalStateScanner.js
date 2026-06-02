/**
 * Module responsible for building the global state object by scanning rooms.
 * This is the ONLY file allowed to use native room.find() methods.
 * @module GlobalStateScanner
 */

/**
 * Scans all visible rooms and populates the global state object with O(1) arrays.
 *
 * @returns {void}
 */
function run() {
  if (!global.State) {
    global.State = { rooms: new Map() };
  }

  // Ensure rooms Map exists within global.State
  if (!global.State.rooms || !(global.State.rooms instanceof Map)) {
    global.State.rooms = new Map();
  }

  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];

    const sources = room.find(FIND_SOURCES);
    const spawns = room.find(FIND_MY_SPAWNS);
    const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
      filter: (resource) => resource.resourceType === RESOURCE_ENERGY
    });
    const ruins = room.find(FIND_RUINS, {
      filter: (ruin) => ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });
    const tombstones = room.find(FIND_TOMBSTONES, {
      filter: (tombstone) => tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    });

    const controller = room.controller;

    global.State.rooms.set(roomName, {
      sources,
      spawns,
      droppedEnergy,
      ruins,
      tombstones,
      controller,
      // V8 Optimization: Pre-allocate standard role counters to maintain monomorphism 
      // in the V8 engine when updating these properties later.
      creepCounts: { harvester: 0, hauler: 0, upgrader: 0 }
    });
  }

  // Global pass over Game.creeps to populate counts.
  // Avoids room.find(FIND_MY_CREEPS) array allocation and native-to-JS bridge overhead.
  const creepNames = Object.keys(Game.creeps);
  for (let i = 0; i < creepNames.length; i++) {
    const creep = Game.creeps[creepNames[i]];
    // Rely on memory first for consistent intent, fallback to actual room if transitioning.
    const roomName = creep.memory.room || creep.room.name;
    const role = creep.memory.role;

    const roomState = global.State.rooms.get(roomName);
    if (roomState && role) {
      if (roomState.creepCounts[role] !== undefined) {
        roomState.creepCounts[role]++;
      } else {
        // Handle edge-case roles dynamically if they exist outside the standard 3
        roomState.creepCounts[role] = 1;
      }
    }
  }
}

module.exports = {
  run
};