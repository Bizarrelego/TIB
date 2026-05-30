/**
 * Main execution loop for the Screeps bot.
 */

const GlobalStateScanner = require('./state/GlobalStateScanner');
const SpawnManager = require('./managers/SpawnManager');
const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const RoleManager = require('./managers/RoleManager');

module.exports.loop = function () {
  require('./constants');

  // Clean up dead creep memory
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
    }
  }

  global.tickCache = new Map();

  // Build global state
  GlobalStateScanner.run();

  // Log source and spawn counts for the first visible room
  const firstRoomName = Object.keys(Game.rooms)[0];
  if (firstRoomName && global.State.rooms && global.State.rooms.has(firstRoomName)) {
    const roomState = global.State.rooms.get(firstRoomName);
    console.log(`Room ${firstRoomName} - Sources: ${roomState.sources.length}, Spawns: ${roomState.spawns.length}`);
  }

  // Run SpawnManager
  SpawnManager.run();

  // Run TaskAssignmentManager
  TaskAssignmentManager.run();

  // Execute Creep Roles
  RoleManager.run();
};
