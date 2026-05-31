/**
 * Main execution loop for the Screeps bot.
 */

const GlobalStateScanner = require('./state/GlobalStateScanner');
const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const SpawnManager = require('./colonies/SpawnManager');
const MemoryCleanupManager = require('./managers/MemoryCleanupManager');

const roleHarvester = require('./roles/harvester');
const roleHauler = require('./roles/hauler');
const roleUpgrader = require('./roles/upgrader');

module.exports.loop = function () {
  global.tickCache = new Map();

  require('./constants');

  // Clean up dead creep memory
  MemoryCleanupManager.run();

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

    // Run SpawnManager
    SpawnManager.run(roomName);
  }

  // Execute Creep Roles
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.spawning) continue;
    if (creep.fatigue > 0) continue;

    // Strict heap initialization check
    if (!creep.heap) {
        creep.heap = { state: 'idle', targetId: null, actionIntent: null };
    }

    // Execute matching muscle layer
    try {
        if (creep.memory.role === 'harvester') {
            require('./roles/harvester').run(creep);
        } else if (creep.memory.role === 'hauler') {
            require('./roles/hauler').run(creep);
        } else if (creep.memory.role === 'upgrader') {
            require('./roles/upgrader').run(creep);
        }
    } catch (e) {
        console.log(`Error executing creep ${name}: ${e.message}`);
    }
  }
};
