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
    let result = OK;

    if (intent === 'pickup') {
      result = creep.pickup(target);
    } else if (intent === 'upgradeController') {
      result = creep.upgradeController(target);
    } else {
      creep.heap.state = 'idle';
      return;
    }

    // Set idle if action completes or fails
    if (result !== OK) {
      creep.heap.state = 'idle';
    } else {
       creep.heap.state = 'idle';
    }
  }
};
