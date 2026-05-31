/**
 * Utility for finding delivery targets for haulers.
 * Resolves Issue 1525.
 */
const { getHash } = require('./HashUtility');

function getHaulerDeliveryTarget(roomName, roomState, creepName) {
    // Prioritize spawns with free capacity
    if (roomState.spawns && roomState.spawns.length > 0) {
        const spawn = roomState.spawns[0];
        if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            return { target: spawn, intent: 'transfer' };
        }
    }

    // Fallback to upgrader drop-piles
    const upgraders = [];
    const stateObj = global.state || global.State;
    const creepsToIterate = stateObj && stateObj.creeps ? stateObj.creeps : Game.creeps;

    for (const cName in creepsToIterate) {
        const c = creepsToIterate[cName];
        if (c.memory.colony === roomName && c.memory.role === 'upgrader') {
            upgraders.push(c);
        }
    }

    if (upgraders.length > 0) {
        const index = getHash(creepName, upgraders.length);
        return { target: upgraders[index], intent: 'drop' };
    }

    // Fallback to controller if no upgrader
    if (roomState.controller) {
        return { target: roomState.controller, intent: 'drop' };
    }

    return { target: null, intent: null };
}

module.exports = {
    getHaulerDeliveryTarget
};
