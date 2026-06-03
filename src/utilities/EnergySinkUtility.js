/**
 * Utility module for identifying structures that require energy.
 * @module EnergySinkUtility
 */

/**
 * Returns an array of StructureSpawn objects in the room that are not at full energy capacity,
 * sorted by fill percentage (lowest first).
 * @param {Room} room
 * @returns {StructureSpawn[]}
 */
function findSpawnsNeedingEnergy(room) {
    if (!room) return [];

    let state;
    if (global.State && global.State.rooms && typeof global.State.rooms.get === 'function') {
        state = global.State.rooms.get(room.name);
    } else if (global.state && global.state.rooms) {
        state = global.state.rooms[room.name];
    }

    if (!state || !state.spawns) return [];

    return state.spawns
        .filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
        .sort((a, b) => (a.store.getUsedCapacity(RESOURCE_ENERGY) / a.store.getCapacity(RESOURCE_ENERGY)) -
                        (b.store.getUsedCapacity(RESOURCE_ENERGY) / b.store.getCapacity(RESOURCE_ENERGY)));
}

/**
 * Returns an array of StructureExtension objects in the room that are not at full energy capacity,
 * sorted by fill percentage (lowest first).
 * @param {Room} room
 * @returns {StructureExtension[]}
 */
function findExtensionsNeedingEnergy(room) {
    if (!room) return [];

    let state;
    if (global.State && global.State.rooms && typeof global.State.rooms.get === 'function') {
        state = global.State.rooms.get(room.name);
    } else if (global.state && global.state.rooms) {
        state = global.state.rooms[room.name];
    }

    if (!state || !state.extensions) return [];

    return state.extensions
        .filter(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
        .sort((a, b) => (a.store.getUsedCapacity(RESOURCE_ENERGY) / a.store.getCapacity(RESOURCE_ENERGY)) -
                        (b.store.getUsedCapacity(RESOURCE_ENERGY) / b.store.getCapacity(RESOURCE_ENERGY)));
}

/**
 * Returns the RoomPosition where upgraders expect energy to be dropped.
 * Defaults to upgrader's position if an upgrader exists, otherwise the controller's position.
 * @param {Room} room
 * @returns {RoomPosition|null}
 */
function findControllerEnergyDropOff(room) {
    if (!room) return null;

    let state;
    if (global.State && global.State.rooms && typeof global.State.rooms.get === 'function') {
        state = global.State.rooms.get(room.name);
    } else if (global.state && global.state.rooms) {
        state = global.state.rooms[room.name];
    }

    // First, try to find an upgrader's position
    const creepNames = Object.keys(Game.creeps);
    for (let i = 0; i < creepNames.length; i++) {
        const creep = Game.creeps[creepNames[i]];
        if (creep.memory.role === 'upgrader' && creep.room.name === room.name) {
            return creep.pos;
        }
    }

    // Fallback to the controller's position
    if (state && state.controller) {
        return state.controller.pos;
    } else if (room.controller) {
        return room.controller.pos;
    }

    return null;
}

module.exports = {
    findSpawnsNeedingEnergy,
    findExtensionsNeedingEnergy,
    findControllerEnergyDropOff
};
