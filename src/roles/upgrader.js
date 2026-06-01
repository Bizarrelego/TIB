module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap || !creep.heap.get('targetId') || !creep.heap.get('actionIntent')) {
      if (creep.heap) creep.heap.set('state', 'idle');
      return;
    }

    const target = Game.getObjectById(creep.heap.get('targetId'));
    if (!target) {
      creep.heap.set('state', 'idle');
      return;
    }

    // Process optional same-tick pickup task alongside main task
    const pickupTargetId = creep.heap.get('pickupTargetId');
    if (pickupTargetId) {
      const drop = Game.getObjectById(pickupTargetId);
      if (drop) {
        creep.pickup(drop);
      }
    }

    const intent = creep.heap.get('actionIntent');
    let result = OK;

    if (intent === 'upgradeController') {
      result = creep.upgradeController(target);
    } else if (intent === 'pickup' && !pickupTargetId) {
      result = creep.pickup(target);
    }

    if (result !== OK) {
      creep.heap.set('state', 'idle');
    } else {
      creep.heap.set('state', 'idle');
    }
  }
};
