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

    if (creep.heap.actionIntent === 'haul_pickup') {
      let result;
      if (creep.pos.getRangeTo(target) > 1) {
        creep.moveTo(target);
      } else {
        if (target instanceof Resource) {
          result = creep.pickup(target);
        } else {
          result = creep.withdraw(target, RESOURCE_ENERGY);
        }
      }

      const isTargetEmpty = target instanceof Resource ? (target.amount === 0) : (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0);
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 || isTargetEmpty) {
        creep.heap.state = 'idle';
      }
    } else if (creep.heap.actionIntent === 'haul_deliver') {
      let result;
      if (target instanceof StructureController) {
        if (creep.pos.getRangeTo(target) > 3) {
          creep.moveTo(target);
        } else {
          result = creep.drop(RESOURCE_ENERGY);
        }
      } else {
        if (creep.pos.getRangeTo(target) > 1) {
          creep.moveTo(target);
        } else {
          result = creep.transfer(target, RESOURCE_ENERGY);
        }
      }

      const isTargetFull = target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 || isTargetFull) {
        creep.heap.state = 'idle';
      }
    }
  }
};
