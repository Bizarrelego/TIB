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
      return;
    }

    if (creep.pos.getRangeTo(target) > 1) {
      creep.moveTo(target);
    } else {
      creep.harvest(target);
    }
  }
};
