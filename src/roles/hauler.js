module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap) {
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

    if (intent === 'pickup' || intent === 'haul_pickup') {
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        creep.heap.state = 'idle';
        return;
      }

      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        let result;
        if (target.store !== undefined) {
          result = creep.withdraw(target, RESOURCE_ENERGY);
        } else {
          result = creep.pickup(target);
        }

        if (result !== OK && result !== ERR_NOT_IN_RANGE) {
          creep.heap.state = 'idle';
        }
      }

      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        creep.heap.state = 'idle';
      }

    } else if (intent === 'transfer' || intent === 'haul_deliver') {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        creep.heap.state = 'idle';
        return;
      }

      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        const result = creep.transfer(target, RESOURCE_ENERGY);
        if (result === ERR_FULL || (result !== OK && result !== ERR_NOT_IN_RANGE)) {
          creep.heap.state = 'idle';
        }
      }

      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        creep.heap.state = 'idle';
      }

    } else {
      creep.heap.state = 'idle';
    }
  }
};
