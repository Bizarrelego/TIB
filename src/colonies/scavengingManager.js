const TrafficManager = require('../traffic/trafficManager');

/**
 * @file scavengingManager.js
 * @description Responsible for identifying and prioritizing energy and resources available in ruins and tombstones.
 * Assigns haulers or other available creeps to scavenge these resources before they decay.
 */
const scavengingManager = {
    /**
     * Executes the scavenging logic for a given room.
     * @param {Room} room The room to execute logic in.
     */
    run(room) {
        if (!global.State || !global.State.ruinsByRoom || !global.State.tombstonesByRoom || !global.State.creepsByRoom) {
            return;
        }

        const roomName = room.name;
        const ruins = global.State.ruinsByRoom.get(roomName) || [];
        const tombstones = global.State.tombstonesByRoom.get(roomName) || [];

        const targets = [];

        for (let i = 0; i < ruins.length; i++) {
            const ruin = ruins[i];
            if (ruin.store) {
                const totalUsed = ruin.store.getUsedCapacity();
                if (totalUsed > 0) {
                    targets.push(ruin);
                }
            }
        }

        for (let i = 0; i < tombstones.length; i++) {
            const tombstone = tombstones[i];
            if (tombstone.store) {
                const totalUsed = tombstone.store.getUsedCapacity();
                if (totalUsed > 0) {
                    targets.push(tombstone);
                }
            }
        }

        if (targets.length === 0) return;

        const roomCreeps = global.State.creepsByRoom.get(roomName);
        if (!roomCreeps) return;

        const haulers = roomCreeps.get('hauler') || [];
        const domesticHaulers = roomCreeps.get('domesticHauler') || [];
        const allHaulers = [...haulers, ...domesticHaulers];

        if (allHaulers.length === 0) return;

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            let targetState = null;
            // Iterate over all resource types in the store
            for (const resourceType in target.store) {
                const amount = target.store[resourceType];
                if (amount > 0) {
                    targetState = { resourceType, amount };
                    break; // Just pick the first available resource for now
                }
            }

            if (!targetState) continue;

            const resType = targetState.resourceType;
            let availableAmount = targetState.amount;

            for (let j = 0; j < allHaulers.length; j++) {
                const creep = allHaulers[j];

                // Skip fatigued creeps, or creeps with a locked pipeline
                if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                // Only consider creeps that have free capacity and are not explicitly assigned to something else
                const creepVirtualState = TrafficManager.getVirtualState(creep, resType);
                if (creepVirtualState.free <= 0) continue;

                // Ensure heap exists
                if (!(creep.heap instanceof Map) && !creep.heap) {
                    creep.heap = {};
                }

                // Skip if already transferring or explicitly picking up a different target (that wasn't just assigned)
                const state = creep.heap instanceof Map ? creep.heap.get('state') : creep.heap.state;
                if (state === 'transfer') continue;

                const amountToWithdraw = Math.min(creepVirtualState.free, availableAmount);
                if (amountToWithdraw <= 0) continue;

                const status = TrafficManager.registerWithdraw(creep, target, resType, amountToWithdraw);

                if (status === OK) {
                    TrafficManager.lockPipeline(creep.name, creep.id, target.id, resType, amountToWithdraw, 'WITHDRAW');

                    if (creep.heap instanceof Map) {
                        creep.heap.set('state', 'pickup');
                        creep.heap.set('dropId', target.id);
                        creep.heap.set('resourceType', resType);
                    } else {
                        creep.heap.state = 'pickup';
                        creep.heap.dropId = target.id;
                        creep.heap.resourceType = resType;
                    }

                    availableAmount -= amountToWithdraw;
                    if (availableAmount <= 0) break; // Target depleted
                }
            }
        }
    }
};

module.exports = scavengingManager;
