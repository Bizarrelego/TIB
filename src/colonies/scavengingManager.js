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
        if (!global.State || !global.State.creepsByRoom) return;

        const roomName = room.name;
        const buckets = new Array(101);
        let targetsFound = false;

        // 1. Process Ruins
        if (global.State.ruinsByRoom && global.State.ruinsByRoom.has(roomName)) {
            const ruins = global.State.ruinsByRoom.get(roomName);
            for (const ruin of ruins.values()) {
                if (ruin.store) {
                    const amount = ruin.store.getUsedCapacity();
                    if (amount > 0) {
                        let priority = Math.min(100, Math.floor(amount / 20));
                        if (ruin.ticksToDecay && ruin.ticksToDecay < 200) priority = Math.min(100, priority + 40);
                        const bucket = buckets[priority] = buckets[priority] || [];
                        bucket.push(ruin);
                        targetsFound = true;
                    }
                }
            }
        }

        // 2. Process Tombstones
        if (global.State.tombstonesByRoom && global.State.tombstonesByRoom.has(roomName)) {
            const tombstones = global.State.tombstonesByRoom.get(roomName);
            for (const tombstone of tombstones.values()) {
                if (tombstone.store) {
                    const amount = tombstone.store.getUsedCapacity();
                    if (amount > 0) {
                        let priority = Math.min(100, Math.floor(amount / 20));
                        if (tombstone.ticksToDecay && tombstone.ticksToDecay < 200) priority = Math.min(100, priority + 40);
                        const bucket = buckets[priority] = buckets[priority] || [];
                        bucket.push(tombstone);
                        targetsFound = true;
                    }
                }
            }
        }

        // 3. Process Dropped Resources
        if (global.State.droppedByRoom && global.State.droppedByRoom.has(roomName)) {
            const dropped = global.State.droppedByRoom.get(roomName);
            for (const drop of dropped.values()) {
                if (drop.amount > 0 && (!drop.resourceType || drop.resourceType === RESOURCE_ENERGY)) {
                    let priority = Math.min(100, Math.floor(drop.amount / 20));
                    const bucket = buckets[priority] = buckets[priority] || [];
                    bucket.push(drop);
                    targetsFound = true;
                }
            }
        }

        if (!targetsFound) return;

        const targets = [];
        for (let i = 100; i >= 0; i--) {
            if (buckets[i]) {
                for (let j = 0; j < buckets[i].length; j++) {
                    targets.push(buckets[i][j]);
                }
            }
        }

        const roomCreeps = global.State.creepsByRoom.get(roomName);
        if (!roomCreeps) return;

        const haulers = roomCreeps.get('hauler') || [];
        const domesticHaulers = roomCreeps.get('domesticHauler') || [];
        const allHaulers = [...haulers, ...domesticHaulers];

        if (allHaulers.length === 0) return;

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            let targetState = null;
            
            // Identify target type and extract resource info
            if (target instanceof Resource || target.amount !== undefined) {
                targetState = { resourceType: target.resourceType || RESOURCE_ENERGY, amount: target.amount };
            } else if (target.store) {
                for (const resourceType in target.store) {
                    const amount = target.store[resourceType];
                    if (amount > 0) {
                        targetState = { resourceType, amount };
                        break; 
                    }
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

                // Ensure heap exists using Map() per memory proxy design pattern
                if (!creep.heap) {
                    creep.heap = new Map();
                } else if (!(creep.heap instanceof Map)) {
                    // Normalize to Map if it's currently a standard object
                    const newHeap = new Map();
                    for (const key in creep.heap) {
                        newHeap.set(key, creep.heap[key]);
                    }
                    creep.heap = newHeap;
                }

                // Skip if already transferring or explicitly picking up a different target (that wasn't just assigned)
                const state = creep.heap.get('state');
                if (state === 'transfer') continue;

                const amountToWithdraw = Math.min(creepVirtualState.free, availableAmount);
                if (amountToWithdraw <= 0) continue;

                let status;
                if (target instanceof Resource || target.amount !== undefined) {
                    status = TrafficManager.registerPickup(creep, target, resType, amountToWithdraw);
                    if (status === OK) {
                        TrafficManager.lockPipeline(creep.name, creep.id, target.id, resType, amountToWithdraw, 'PICKUP');
                    }
                } else {
                    status = TrafficManager.registerWithdraw(creep, target, resType, amountToWithdraw);
                    if (status === OK) {
                        TrafficManager.lockPipeline(creep.name, creep.id, target.id, resType, amountToWithdraw, 'WITHDRAW');
                    }
                }

                if (status === OK) {
                    creep.heap.set('state', 'pickup');
                    creep.heap.set('dropId', target.id);
                    creep.heap.set('resourceType', resType);

                    availableAmount -= amountToWithdraw;
                    if (availableAmount <= 0) break; // Target depleted
                }
            }
        }
    }
};

module.exports = scavengingManager;
