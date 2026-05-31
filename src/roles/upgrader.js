module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap || !creep.heap.targetId) {
      if (!creep.heap) creep.heap = { state: 'idle', targetId: null, actionIntent: null };
      creep.heap.state = 'idle';
      return;
    }

    const target = Game.getObjectById(creep.heap.targetId);
    if (!target) {
      creep.heap.state = 'idle';
      return;
    }

    if (creep.pos.getRangeTo(target) > 3) {
      creep.moveTo(target, { range: 3 });
    } else {
      creep.upgradeController(target);
    }
  }
};
