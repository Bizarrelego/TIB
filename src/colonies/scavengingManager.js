const TrafficManager = require('../traffic/trafficManager');

module.exports = {
    /**
     * Globally prioritizes ruins and tombstones for early game energy scavenging
     * overrides target assignments for workers/haulers.
     * @param {Room} room
     */
    run(room) {
        if (!global.State || !global.State.creepsByRoom) return;
        
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        // Collect all haulers and remote haulers from this colony
        const haulers = roomCreeps.get('hauler') || [];
        const remoteHaulers = roomCreeps.get('remoteHauler') || [];
        
        const scavengers = [...haulers, ...remoteHaulers].filter(c => c.store.getFreeCapacity(RESOURCE_ENERGY) > 0);

        if (scavengers.length === 0) return;

        const bestTargetCache = new Map();
        const DroppedResourceManager = require('../managers/DroppedResourceManager');

        const getBestScavengeTarget = (roomName) => {
            if (bestTargetCache.has(roomName)) return bestTargetCache.get(roomName);

            let bestTarget = null;
            let maxEnergy = 0;
            
            const tombstones = global.State.tombstonesByRoom.get(roomName);
            if (tombstones) {
                for (const t of tombstones.values()) {
                    const energy = t.store.getUsedCapacity(RESOURCE_ENERGY);
                    if (energy > maxEnergy) {
                        maxEnergy = energy;
                        bestTarget = t;
                    }
                }
            }

            const ruins = global.State.ruinsByRoom.get(roomName);
            if (ruins) {
                for (const r of ruins.values()) {
                    const energy = r.store.getUsedCapacity(RESOURCE_ENERGY);
                    if (energy > maxEnergy) {
                        maxEnergy = energy;
                        bestTarget = r;
                    }
                }
            }

            const drops = DroppedResourceManager.getPrioritizedDroppedResources(roomName);
            if (drops.length > 0 && drops[0].amount > maxEnergy) {
                bestTarget = drops[0].target;
            }

            bestTargetCache.set(roomName, bestTarget);
            return bestTarget;
        };

        // Assign scavengers to active ruins/tombstones/drops
        for (const creep of scavengers) {
            if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;
            
            // Only interrupt if they are in 'harvest' or 'pickup' mode looking for basic drops
            if (creep.heap.state && creep.heap.state !== 'harvest' && creep.heap.state !== 'pickup' && creep.heap.state !== 'withdraw') continue;

            const target = getBestScavengeTarget(creep.room.name);
            if (target) {
                creep.heap.state = target.amount !== undefined ? 'pickup' : 'withdraw';
                creep.heap.targetId = target.id;
            }
        }
    }
};