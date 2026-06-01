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

    // Stationary movement logic: only move to designated upgrade spot
    if (creep.heap.standPos) {
      const roomName = creep.heap.standPos.roomName || creep.room.name;
      if (creep.pos.x !== creep.heap.standPos.x || creep.pos.y !== creep.heap.standPos.y || creep.pos.roomName !== roomName) {
        creep.moveTo(new RoomPosition(creep.heap.standPos.x, creep.heap.standPos.y, roomName));
      }
    }

    // Auto-pickup logic for energy dropped on exact tile
    let validPickupTarget = false;
    if (creep.heap.pickupTargetId) {
      const drop = Game.getObjectById(creep.heap.pickupTargetId);
      if (drop && creep.pos.getRangeTo(drop) <= 1) {
        creep.pickup(drop);
        validPickupTarget = true;
      }
    }

    const intent = creep.heap.actionIntent;

    if (intent === 'pickup') {
      if (creep.pos.getRangeTo(target) > 1) {
        if (!creep.heap.standPos) creep.moveTo(target);
      } else {
        const res = creep.pickup(target);
        if (res !== OK && res !== ERR_NOT_IN_RANGE) {
          creep.heap.state = 'idle';
        }
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 || !Game.getObjectById(creep.heap.targetId)) {
          creep.heap.state = 'idle';
        }
      }
    } else if (intent === 'upgradeController') {
      if (creep.pos.getRangeTo(target) > 3) {
        if (!creep.heap.standPos) creep.moveTo(target, { range: 3 });
      } else {
        const res = creep.upgradeController(target);
        if (res !== OK && res !== ERR_NOT_ENOUGH_RESOURCES && res !== ERR_NOT_IN_RANGE) {
          creep.heap.state = 'idle';
        }

        // Idle if empty and no pickup available
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 && !validPickupTarget) {
          creep.heap.state = 'idle';
        }
      }
    } else {
      creep.heap.state = 'idle';
    }
  }
};
