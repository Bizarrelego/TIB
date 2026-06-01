module.exports = {
  run(creep) {
    if (creep.spawning) return;
    if (creep.fatigue > 0) return;

    if (!creep.heap || !creep.heap.get('targetId')) {
      if (!creep.heap) {
         creep.heap = new Map([['state', 'idle'], ['targetId', null], ['actionIntent', null]]);
      }
      return;
    }

    if (creep.heap.has('sleepUntil') && Game.time < creep.heap.get('sleepUntil')) {
      return;
    }

    const target = Game.getObjectById(creep.heap.get('targetId'));
    if (!target) {
      return;
    }

    if (target.energy === 0) {
      creep.heap.set('sleepUntil', Game.time + target.ticksToRegeneration);
      return;
    }

    if (creep.pos.getRangeTo(target) > 1) {
      creep.moveTo(target);
    } else {
      creep.harvest(target);
    }
  }
};
