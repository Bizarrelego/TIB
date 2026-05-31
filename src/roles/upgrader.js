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

    const actionIntent = creep.heap.actionIntent;

    if (creep.heap.pickupId) {
      const drop = Game.getObjectById(creep.heap.pickupId);
      if (drop) {
        creep.pickup(drop);
      }
    }

    if (actionIntent === 'upgrade') {
      if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 3 });
      }
    } else if (actionIntent === 'build') {
      if (creep.build(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { range: 3 });
      }

      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        creep.heap.state = 'idle';
      }
    }
  }
};
