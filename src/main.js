/**
 * Main execution loop for the Screeps bot.
 */

const GlobalStateScanner = require('./state/GlobalStateScanner');
const SpawnManager = require('./colonies/SpawnManager');
const TaskAssignmentManager = require('./managers/TaskAssignmentManager');

const roleMiner = require('./roles/miner');
const roleHauler = require('./roles/hauler');
const roleUpgrader = require('./roles/upgrader');

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

  for (const roomName in Game.rooms) {
    // Log source and spawn counts
    if (global.State.rooms && global.State.rooms.has(roomName)) {
      const roomState = global.State.rooms.get(roomName);
      console.log(`Room ${roomName} - Sources: ${roomState.sources.length}, Spawns: ${roomState.spawns.length}`);
    }

    // Run TaskAssignmentManager
    TaskAssignmentManager.run(roomName);
  }

  for (const roomName in Game.rooms) {
    // Run SpawnManager
    SpawnManager.run(roomName);
  }

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const role = creep.memory.role;

    if (role === 'harvester') {
      roleMiner.run(creep);
    } else if (role === 'hauler') {
      roleHauler.run(creep);
    } else if (role === 'upgrader') {
      roleUpgrader.run(creep);
    }
  }
};
