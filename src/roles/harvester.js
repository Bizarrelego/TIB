module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap || !creep.heap.targetId) {
      if (!creep.heap || typeof creep.heap !== 'object' || creep.heap instanceof Map) {
         creep.heap = { state: 'idle', targetId: null, actionIntent: null };
      }
      return;
    }

    if (creep.heap.sleepUntil && Game.time < creep.heap.sleepUntil) {
      return;
    }

    const target = Game.getObjectById(creep.heap.targetId);
    if (!target) {
      return;
    }

    if (target.energy === 0) {
      creep.heap.sleepUntil = Game.time + target.ticksToRegeneration;
      creep.heap.state = 'idle';
      return;
    }

    if (creep.heap.targetPos) {
      if (creep.pos.roomName !== creep.heap.targetPos.roomName || creep.pos.x !== creep.heap.targetPos.x || creep.pos.y !== creep.heap.targetPos.y) {
        creep.moveTo(new RoomPosition(creep.heap.targetPos.x, creep.heap.targetPos.y, creep.heap.targetPos.roomName));
        return;
      }
    } else if (creep.pos.getRangeTo(target) > 1) {
      creep.moveTo(target);
      return;
    }

    const result = creep.harvest(target);
    if (result === ERR_NOT_ENOUGH_RESOURCES) {
      creep.heap.state = 'idle';
    }
  }
};
