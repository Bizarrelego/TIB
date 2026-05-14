/* global STRUCTURE_FACTORY */
/**
 * @file resourceUtils.js
 * @description Utility functions for finding and filtering resources or structures using global.State (0-CPU native polling).
 */

const TrafficManager = require('../traffic/trafficManager');

/**
 * Gets structures of given types in a room that have free capacity for the specified resource.
 * @param {string} roomName - The name of the room.
 * @param {string[]} structureTypes - Array of structure types to search for (e.g., [STRUCTURE_SPAWN, STRUCTURE_EXTENSION]).
 * @param {string} [resourceType=RESOURCE_ENERGY] - The resource type to check capacity for.
 * @returns {Structure[]} Array of structures with free capacity.
 */
function getStructuresWithFreeCapacity(roomName, structureTypes, resourceType = RESOURCE_ENERGY) {
    const results = [];
    const roomStructures = global.State.structuresByRoom.get(roomName);
    if (!roomStructures) return results;

    for (let i = 0; i < structureTypes.length; i++) {
        const type = structureTypes[i];
        const typeMap = roomStructures.get(type);
        if (typeMap) {
            for (const structure of typeMap.values()) {
                if (structure.store && TrafficManager.getVirtualState(structure, resourceType).free > 0) {
                    results.push(structure);
                }
            }
        }
    }
    return results;
}

/**
 * Gets structures of given types in a room that have used capacity for the specified resource.
 * @param {string} roomName - The name of the room.
 * @param {string[]} structureTypes - Array of structure types to search for.
 * @param {string} [resourceType=RESOURCE_ENERGY] - The resource type to check capacity for.
 * @returns {Structure[]} Array of structures with used capacity.
 */
function getStructuresWithUsedCapacity(roomName, structureTypes, resourceType = RESOURCE_ENERGY) {
    const results = [];
    const roomStructures = global.State.structuresByRoom.get(roomName);
    if (!roomStructures) return results;

    for (let i = 0; i < structureTypes.length; i++) {
        const type = structureTypes[i];
        const typeMap = roomStructures.get(type);
        if (typeMap) {
            for (const structure of typeMap.values()) {
                if (structure.store && TrafficManager.getVirtualState(structure, resourceType).used > 0) {
                    results.push(structure);
                }
            }
        }
    }
    return results;
}

/**
 * Finds the nearest energy source (dropped energy, ruins, tombstones, containers, storage, links) to a given position.
 * @param {RoomPosition} pos - The position to search from.
 * @param {string} roomName - The name of the room.
 * @param {number} [minAmount=0] - The minimum amount of energy required.
 * @returns {Resource|Structure|Tombstone|Ruin|null} The nearest energy source, or null if none found.
 */
function findNearestEnergySource(pos, roomName, minAmount = 0) {
    let nearest = null;
    let minDistance = Infinity;

    const checkTarget = (t, amount) => {
        if (amount <= minAmount) return;
        const dist = Math.max(Math.abs(pos.x - t.pos.x), Math.abs(pos.y - t.pos.y));
        if (dist < minDistance) {
            minDistance = dist;
            nearest = t;
        }
    };

    // Dropped Energy
    let dropped = [];
    if (global.State.droppedEnergyByRoom && global.State.droppedEnergyByRoom.has(roomName)) {
        dropped = global.State.droppedEnergyByRoom.get(roomName) || [];
    } else if (global.State.droppedByRoom && global.State.droppedByRoom.has(roomName)) {
        dropped = global.State.droppedByRoom.get(roomName) || [];
    }

    for (let i = 0; i < dropped.length; i++) {
        const resource = dropped[i];
        if (resource.resourceType === undefined || resource.resourceType === RESOURCE_ENERGY) {
            const virtualState = TrafficManager.getVirtualState(resource, resource.resourceType || RESOURCE_ENERGY);
            checkTarget(resource, virtualState.used);
        }
    }

    // Tombstones
    const tombstones = (global.State.tombstonesByRoom && global.State.tombstonesByRoom.get(roomName)) || [];
    for (let i = 0; i < tombstones.length; i++) {
        const tombstone = tombstones[i];
        if (tombstone.store) {
            const virtualState = TrafficManager.getVirtualState(tombstone, RESOURCE_ENERGY);
            checkTarget(tombstone, virtualState.used);
        }
    }

    // Ruins
    const ruins = (global.State.ruinsByRoom && global.State.ruinsByRoom.get(roomName)) || [];
    for (let i = 0; i < ruins.length; i++) {
        const ruin = ruins[i];
        if (ruin.store) {
            const virtualState = TrafficManager.getVirtualState(ruin, RESOURCE_ENERGY);
            checkTarget(ruin, virtualState.used);
        }
    }

    // Structures (Containers, Storage, Links)
    const sources = getStructuresWithUsedCapacity(roomName, [STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_LINK], RESOURCE_ENERGY);
    for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        const virtualState = TrafficManager.getVirtualState(source, RESOURCE_ENERGY);
        checkTarget(source, virtualState.used);
    }

    return nearest;
}

/**
 * Finds the nearest energy sink (spawns, extensions, towers, etc.) to a given position.
 * @param {RoomPosition} pos - The position to search from.
 * @param {string} roomName - The name of the room.
 * @param {number} [minFreeCapacity=0] - The minimum free capacity required.
 * @returns {Structure|null} The nearest energy sink, or null if none found.
 */
function findNearestEnergySink(pos, roomName, minFreeCapacity = 0) {
    let nearest = null;
    let minDistance = Infinity;

    const sinks = getStructuresWithFreeCapacity(roomName, [
        STRUCTURE_SPAWN,
        STRUCTURE_EXTENSION,
        STRUCTURE_TOWER,
        STRUCTURE_LAB,
        STRUCTURE_STORAGE,
        STRUCTURE_TERMINAL,
        STRUCTURE_LINK,
        STRUCTURE_FACTORY,
        STRUCTURE_POWER_SPAWN
    ], RESOURCE_ENERGY);

    for (let i = 0; i < sinks.length; i++) {
        const sink = sinks[i];
        const virtualState = TrafficManager.getVirtualState(sink, RESOURCE_ENERGY);
        const free = virtualState.free;
        if (free <= minFreeCapacity) continue;

        const dist = Math.max(Math.abs(pos.x - sink.pos.x), Math.abs(pos.y - sink.pos.y));
        if (dist < minDistance) {
            minDistance = dist;
            nearest = sink;
        }
    }

    return nearest;
}

module.exports = {
    getStructuresWithFreeCapacity,
    getStructuresWithUsedCapacity,
    findNearestEnergySource,
    findNearestEnergySink
};
