/**
 * Main execution loop for the Screeps bot.
 */

const GlobalStateScanner = require('./state/GlobalStateScanner');
const SpawnManager = require('./colonies/SpawnManager');
const TaskAssignmentManager = require('./managers/TaskAssignmentManager');

const roleHarvester = require('./roles/harvester');
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

  // Execute Creep Roles
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.spawning) continue;
    if (creep.fatigue > 0) continue;

    if (!creep.heap) {
      creep.heap = { state: 'idle', targetId: null, actionIntent: null };
    }

    if (creep.memory.role === 'harvester') {
      roleHarvester.run(creep);
    } else if (creep.memory.role === 'hauler') {
      roleHauler.run(creep);
    } else if (creep.memory.role === 'upgrader') {
      roleUpgrader.run(creep);
    }
  }

  for (const roomName in Game.rooms) {
    // Run SpawnManager
    SpawnManager.run(roomName);
  }

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const role = creep.memory.role;

    if (role === 'harvester') {
      roleHarvester.run(creep);
    } else if (role === 'hauler') {
      roleHauler.run(creep);
    } else if (role === 'upgrader') {
      roleUpgrader.run(creep);
    }
  }
};
