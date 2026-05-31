/**
 * The Architect - BasePlanner
 * Places exactly 5 extensions at hardcoded offsets when RCL 2 is reached.
 */

function run(roomName) {
  if (Game.time % 100 !== 0) return;

  const room = Game.rooms[roomName];
  if (!room || !room.controller || room.controller.level < 2) return;

  if (!global.State || !global.State.rooms || !global.State.rooms.has(roomName)) return;

  const roomState = global.State.rooms.get(roomName);
  const spawns = roomState.spawns;

  if (!spawns || spawns.length === 0) return;

  const spawn = spawns[0];

  const offsets = [
    { x: 0, y: -2 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: -2, y: 0 },
    { x: 2, y: 0 }
  ];

  for (const offset of offsets) {
    room.createConstructionSite(spawn.pos.x + offset.x, spawn.pos.y + offset.y, STRUCTURE_EXTENSION);
  }
}

module.exports = {
  run
};
