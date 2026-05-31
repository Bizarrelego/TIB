/**
 * Module responsible for assigning tasks to stationary upgraders.
 * @module UpgraderTaskProvider
 */

/**
 * Returns an upgrader task.
 *
 * @param {object} creep The creep requesting a task.
 * @param {object} globalState The global state object.
 * @returns {object|null} The task object containing targetId, actionIntent, and optionally pickupTargetId, or null if no controller is found.
 */
function getUpgraderTask(creep, globalState) {
  if (!globalState || !globalState.rooms) return null;

  const roomName = creep.memory.colony;
  if (!roomName) return null;

  const roomState = globalState.rooms.get(roomName);
  if (!roomState || !roomState.controller) return null;

  const task = {
    targetId: roomState.controller.id,
    actionIntent: 'upgradeController'
  };

  if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
    for (const drop of roomState.droppedEnergy) {
      if (drop.amount > 0 && drop.pos.x === creep.pos.x && drop.pos.y === creep.pos.y) {
        task.pickupTargetId = drop.id;
        break;
      }
    }
  }

  return task;
}

module.exports = {
  getUpgraderTask
};
