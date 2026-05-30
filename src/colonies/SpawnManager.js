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
  const counts = new Map([
    ['harvester', 0],
    ['hauler', 0],
    ['upgrader', 0]
  ]);

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.memory.colony === roomName) {
      const role = creep.memory.role;
      if (counts.has(role)) {
        counts.set(role, counts.get(role) + 1);
      }
    }
  }

  // Census limits
  const census = new Map([
    ['harvester', 2],
    ['hauler', 2],
    ['upgrader', 2]
  ]);

  // Hardcoded bodies
  const bodies = new Map([
    ['harvester', [WORK, WORK, MOVE]], // 250
    ['hauler', [CARRY, CARRY, MOVE, MOVE]], // 200
    ['upgrader', [WORK, CARRY, MOVE, MOVE]] // 250
  ]);

  // Check which role to spawn
  let roleToSpawn = null;

  if (counts.get('harvester') < census.get('harvester')) {
    roleToSpawn = 'harvester';
  } else if (counts.get('hauler') < census.get('hauler')) {
    roleToSpawn = 'hauler';
  } else if (counts.get('upgrader') < census.get('upgrader')) {
    roleToSpawn = 'upgrader';
  }

  if (roleToSpawn) {
    const body = bodies.get(roleToSpawn);
    const newName = roleToSpawn + '_' + Game.time;
    spawn.spawnCreep(body, newName, {
      memory: { role: roleToSpawn, colony: roomName }
    });
  }
}

module.exports = {
  run
};
