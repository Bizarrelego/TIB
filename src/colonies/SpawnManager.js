const CreepCensusUtility = require('../utilities/CreepCensusUtility');
const CreepBodyUtility = require('../utilities/CreepBodyUtility');
const RoleCensusLimitUtility = require('../utilities/RoleCensusLimitUtility');
const CreepSpawnRequestUtility = require('../utilities/CreepSpawnRequestUtility');
const SpawnQueueUtility = require('../utilities/SpawnQueueUtility');
const SpawnRequestPrioritizationUtility = require('../utilities/SpawnRequestPrioritizationUtility');

class SpawnManager {
    static run(spawn) {
        this.enqueueSpawnRequests(spawn);
        this.processSpawnQueue(spawn);
    }

    static enqueueSpawnRequests(spawn) {
        const activeCounts = CreepCensusUtility.getCensus();
        const queuedCounts = SpawnQueueUtility.getRoleCounts();
        const limits = RoleCensusLimitUtility.getAllLimits() || {};
        const roomName = spawn.room.name;

        const getCount = (role) => {
            const active = (activeCounts && typeof activeCounts.has === 'function' && activeCounts.has(role)) ? activeCounts.get(role) : 0;
            const queued = (queuedCounts && typeof queuedCounts.has === 'function' && queuedCounts.has(role)) ? queuedCounts.get(role) : 0;
            return active + queued;
        };

        const harvesterCount = getCount('harvester');
        const haulerCount = getCount('hauler');

        // Bootstrap sequence: Force 1 Harvester, then 1 Hauler before queueing anything else
        if (harvesterCount === 0 && (limits['harvester'] || 0) > 0) {
            CreepSpawnRequestUtility.requestCreep(roomName, 'harvester', CreepBodyUtility.getBody('harvester'));
            return; 
        }
        if (harvesterCount >= 1 && haulerCount === 0 && (limits['hauler'] || 0) > 0) {
            CreepSpawnRequestUtility.requestCreep(roomName, 'hauler', CreepBodyUtility.getBody('hauler'));
            return;
        }

        // Standard queueing for remaining limits
        for (const role in limits) {
            const limit = limits[role];
            const totalCount = getCount(role);

            if (totalCount < limit) {
                const missingCount = limit - totalCount;
                const bodyParts = CreepBodyUtility.getBody(role);

                if (bodyParts && bodyParts.length > 0) {
                    for (let i = 0; i < missingCount; i++) {
                        CreepSpawnRequestUtility.requestCreep(roomName, role, bodyParts);
                    }
                }
            }
        }
    }

    static processSpawnQueue(spawn) {
        if (spawn.spawning) return;

        const queue = SpawnQueueUtility.getQueue();
        const request = SpawnRequestPrioritizationUtility.getPrioritizedSpawnRequest(queue);

        if (!request) return;

        const cost = request.bodyParts.reduce((cost, part) => cost + BODYPART_COST[part], 0);

        if (spawn.room.energyAvailable >= cost) {
            const name = request.role + '_' + Game.time + '_' + Math.floor(Math.random() * 1000);

            const plainMemory = {};
            for (const [key, value] of request.memory) {
                plainMemory[key] = value;
            }

            const result = spawn.spawnCreep(request.bodyParts, name, { memory: plainMemory });
            
            // Only remove from queue if the spawn successfully initiated
            if (result === OK) {
                SpawnQueueUtility.remove(request);
            }
        }
    }
}

module.exports = SpawnManager;