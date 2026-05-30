/**
 * Main execution loop for the Screeps bot.
 */

const GlobalStateScanner = require('./state/GlobalStateScanner');

module.exports.loop = function () {
  // Clean up dead creep memory
  for (const name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
    }
  }

  // Build global state
  GlobalStateScanner.run();

  // Log source and spawn counts for the first visible room
  const firstRoomName = Object.keys(Game.rooms)[0];
  if (firstRoomName && global.State.rooms[firstRoomName]) {
    const roomState = global.State.rooms[firstRoomName];
    console.log(`Room ${firstRoomName} - Sources: ${roomState.sources.length}, Spawns: ${roomState.spawns.length}`);
  }

  // Run SpawnManager
  // Run TaskAssignmentManager
  // Execute Creep Roles
};
