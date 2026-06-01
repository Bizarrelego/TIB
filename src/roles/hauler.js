module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap) {
        creep.heap = new Map([['state', 'idle'], ['targetId', null], ['actionIntent', null]]);
    } else if (!(creep.heap instanceof Map)) {
        const old = creep.heap;
        creep.heap = new Map([
            ['state', old.state || 'idle'],
            ['targetId', old.targetId || null],
            ['actionIntent', old.actionIntent || null]
        ]);
    }

    if (!creep.heap.get('targetId')) {
      creep.heap.set('state', 'idle');
      return;
    }

    const target = Game.getObjectById(creep.heap.get('targetId'));
    if (!target) {
      creep.heap.set('state', 'idle');
      return;
    }

    const intent = creep.heap.get('actionIntent');

    if (intent === 'pickup') {
      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        creep.pickup(target);
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 || !Game.getObjectById(creep.heap.get('targetId'))) {
          creep.heap.set('state', 'idle');
        }
      }
    } else if (intent === 'withdraw') {
      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        creep.withdraw(target, RESOURCE_ENERGY);
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 || !Game.getObjectById(creep.heap.get('targetId'))) {
          creep.heap.set('state', 'idle');
        }
      }
    } else if (intent === 'transfer') {
      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_FULL) {
          creep.heap.set('state', 'idle');
        } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          creep.heap.set('state', 'idle');
        }
      }
    } else if (intent === 'drop') {
      if (creep.pos.getRangeTo(target) > 0) {
        creep.moveTo(target);
      } else {
        creep.drop(RESOURCE_ENERGY);
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          creep.heap.set('state', 'idle');
        }
      }
    } else {
      creep.heap.set('state', 'idle');
    }
  }
};
