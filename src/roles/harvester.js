module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap || !creep.heap.targetId) {
      if (!creep.heap) creep.heap = { state: 'idle', targetId: null, actionIntent: null };
      return;
    }

    const target = Game.getObjectById(creep.heap.targetId);
    if (!target) {
      return;
    }

    if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target);
    }
  }
};
