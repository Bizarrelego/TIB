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
      controller
    });
  }
}

module.exports = {
  run
};
