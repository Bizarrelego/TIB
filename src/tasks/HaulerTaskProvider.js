/**
 * Module responsible for assigning tasks to haulers.
 * @module HaulerTaskProvider
 */
const { getHaulerDeliveryTarget } = require('../utils/HaulerUtility');
const { getHash } = require('../utils/HashUtility');

/**
 * Returns a hauling task.
 *
 * @param {object} creep The creep requesting a task.
 * @param {object} globalState The global state object.
 * @returns {object|null} The task object containing targetId, actionIntent, and destinationId, or null.
 */
function getHaulingTask(creep, globalState) {
    if (!globalState || !globalState.rooms) return null;

    const roomName = creep.memory.colony;
    if (!roomName) return null;

    const roomState = globalState.rooms.get(roomName);
    if (!roomState) return null;

    let targetId = null;
    let actionIntent = null;
    let destinationId = null;

    const creepsToIterate = globalState.creeps || Game.creeps;

    const deliveryResult = getHaulerDeliveryTarget(roomName, roomState, creep.name);
    if (deliveryResult && deliveryResult.target) {
        destinationId = deliveryResult.target.id;
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        // Needs to pick up energy

        // 1. Scavenging (Ruins, Tombstones) natively
        const validRuins = (roomState.ruins || []).filter(r => r.store && r.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
        if (validRuins.length > 0) {
            const index = getHash(creep.name, validRuins.length);
            targetId = validRuins[index].id;
            actionIntent = 'withdraw';
            return { targetId, actionIntent, destinationId };
        }

        const validTombstones = (roomState.tombstones || []).filter(t => t.store && t.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
        if (validTombstones.length > 0) {
            const index = getHash(creep.name, validTombstones.length);
            targetId = validTombstones[index].id;
            actionIntent = 'withdraw';
            return { targetId, actionIntent, destinationId };
        }

        // 2. Hashed assignment of a harvester's drop pile
        const harvesters = [];

        let creepValues = [];
        if (creepsToIterate instanceof Map) {
            creepValues = Array.from(creepsToIterate.values());
        } else if (typeof creepsToIterate === 'object') {
            creepValues = Object.values(creepsToIterate);
        }

        for (const c of creepValues) {
            if (c.memory.colony === roomName && c.memory.role === 'harvester') {
                harvesters.push(c);
            }
        }

        if (harvesters.length > 0) {
            const index = getHash(creep.name, harvesters.length);
            const targetHarvester = harvesters[index];

            if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
                for (const drop of roomState.droppedEnergy) {
                    if (drop.amount > 0 && drop.pos.x === targetHarvester.pos.x && drop.pos.y === targetHarvester.pos.y) {
                        targetId = drop.id;
                        actionIntent = 'pickup';
                        break;
                    }
                }
            }
        }

        // 3. Fallback to generic dropped energy if no harvester drop pile matched
        if (!targetId && roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
            const validDrops = roomState.droppedEnergy.filter(d => d.amount > 0);
            if (validDrops.length > 0) {
                const index = getHash(creep.name, validDrops.length);
                targetId = validDrops[index].id;
                actionIntent = 'pickup';
            }
        }

    } else {
        // Full or has energy, needs to deliver
        if (deliveryResult && deliveryResult.target) {
            targetId = deliveryResult.target.id;
            actionIntent = deliveryResult.intent;
        }
    }

    if (targetId && actionIntent) {
        return { targetId, actionIntent, destinationId };
    }

    return null;
}

module.exports = {
    getHaulingTask
};
