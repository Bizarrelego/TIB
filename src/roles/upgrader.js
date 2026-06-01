module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap || !creep.heap.targetId || !creep.heap.actionIntent) {
      if (creep.heap) creep.heap.state = 'idle';
      return;
    }

    const target = Game.getObjectById(creep.heap.targetId);
    if (!target) {
      creep.heap.state = 'idle';
      return;
    }

    const intent = creep.heap.actionIntent;

    if (intent === 'upgradeController') {
      creep.upgradeController(target);
    } else if (intent === 'pickup') {
      creep.pickup(target);
    }

    creep.heap.state = 'idle';
  }
};
