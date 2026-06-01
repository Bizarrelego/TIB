module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap || creep.heap instanceof Map || typeof creep.heap !== 'object') {
        creep.heap = { state: 'idle', targetId: null, actionIntent: null };
    }

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
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 || !Game.getObjectById(creep.heap.targetId)) {
          creep.heap.state = 'idle';
        }
      }
    } else if (intent === 'withdraw') {
      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        creep.withdraw(target, RESOURCE_ENERGY);
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 || !Game.getObjectById(creep.heap.targetId)) {
          creep.heap.state = 'idle';
        }
      }
    } else if (intent === 'transfer') {
      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_FULL) {
          creep.heap.state = 'idle';
        } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          creep.heap.state = 'idle';
        }
      }
    } else if (intent === 'drop') {
      if (creep.pos.getRangeTo(target) > 0) {
        creep.moveTo(target);
      } else {
        creep.drop(RESOURCE_ENERGY);
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          creep.heap.state = 'idle';
        }
      }
    } else {
      creep.heap.state = 'idle';
    }
  }
};
