module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap) creep.heap = { state: 'idle', targetId: null, actionIntent: null };

    if (!creep.heap.targetId) {
      creep.heap.state = 'idle';
      return;
    }

    const target = Game.getObjectById(creep.heap.targetId);
    if (!target) {
      creep.heap.state = 'idle';
      return;
    }

    const intent = creep.heap.actionIntent;

    if (intent === 'pickup') {
      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        creep.pickup(target);
        creep.heap.state = 'idle';
      }
    } else if (intent === 'withdraw') {
      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        creep.withdraw(target, RESOURCE_ENERGY);
        creep.heap.state = 'idle';
      }
    } else if (intent === 'transfer') {
      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        creep.transfer(target, RESOURCE_ENERGY);
        creep.heap.state = 'idle';
      }
    } else if (intent === 'drop') {
      if (creep.pos.getRangeTo(target) > 0) {
        creep.moveTo(target);
      } else {
        creep.drop(RESOURCE_ENERGY);
        creep.heap.state = 'idle';
      }
    } else {
      creep.heap.state = 'idle';
    }
  }
};
