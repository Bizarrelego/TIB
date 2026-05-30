/**
 * The Heart - SpawnManager
 * Spawns creeps based on a strict, hardcoded RCL 1 census limit.
 */

function run(roomName) {
  // Retrieve the room state
  if (!global.State || !global.State.rooms || !global.State.rooms.has(roomName)) return;

  const roomState = global.State.rooms.get(roomName);
  const spawns = roomState.spawns;

  if (!spawns || spawns.length === 0) return;

  const spawn = spawns[0]; // Just use the first spawn for now
  if (spawn.spawning) return;

  // Count living creeps by their role for this colony
  const counts = {
    harvester: 0,
    hauler: 0,
    upgrader: 0
  };

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.memory.colony === roomName) {
      if (counts[creep.memory.role] !== undefined) {
        counts[creep.memory.role]++;
      }
    }
  }

  // Census limits
  const census = {
    harvester: 2,
    hauler: 2,
    upgrader: 2
  };

  // Hardcoded bodies
  const bodies = {
    harvester: [WORK, WORK, MOVE], // 250
    hauler: [CARRY, CARRY, MOVE, MOVE], // 200
    upgrader: [WORK, CARRY, MOVE, MOVE] // 250
  };

  // Check which role to spawn
  let roleToSpawn = null;

  if (counts.harvester < census.harvester) {
    roleToSpawn = 'harvester';
  } else if (counts.hauler < census.hauler) {
    roleToSpawn = 'hauler';
  } else if (counts.upgrader < census.upgrader) {
    roleToSpawn = 'upgrader';
  }

  if (roleToSpawn) {
    const body = bodies[roleToSpawn];
    const newName = roleToSpawn + '_' + Game.time;
    spawn.spawnCreep(body, newName, {
      memory: { role: roleToSpawn, colony: roomName }
    });
  }
}

module.exports = {
  run
};
