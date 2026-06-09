const CreepCensusUtility = require('../utilities/CreepCensusUtility');
const CreepBodyUtility = require('../utilities/CreepBodyUtility');
const RoleCensusLimitUtility = require('../utilities/RoleCensusLimitUtility');
const CreepSpawnRequestUtility = require('../utilities/CreepSpawnRequestUtility');
const SpawnQueueUtility = require('../utilities/SpawnQueueUtility');
const SpawnRequestPrioritizationUtility = require('../utilities/SpawnRequestPrioritizationUtility');

// Emergency bootstrap body — cheapest possible functional creep (200 energy)
const EMERGENCY_BODY = [WORK, CARRY, MOVE];

class SpawnManager {
    static run(spawn) {
        // Clear the queue at the start of each tick to prevent duplicate accumulation
        SpawnQueueUtility.clear();

        this.enqueueSpawnRequests(spawn);
        this.processSpawnQueue(spawn);
    }

    static enqueueSpawnRequests(spawn) {
        const activeCounts = CreepCensusUtility.getCensus();
        const queuedCounts = SpawnQueueUtility.getRoleCounts();
        const roomName = spawn.room.name;
        const energyCapacity = spawn.room.energyCapacityAvailable;
        const rcl = spawn.room.controller ? spawn.room.controller.level : 1;
        const roomState = global.State?.rooms?.get(roomName);
        const limits = RoleCensusLimitUtility.getAllLimits(rcl, roomState, roomName) || {};

        const getCount = (role) => {
            const active = (activeCounts && typeof activeCounts.has === 'function' && activeCounts.has(role)) ? activeCounts.get(role) : 0;
            const queued = (queuedCounts && typeof queuedCounts.has === 'function' && queuedCounts.has(role)) ? queuedCounts.get(role) : 0;
            return active + queued;
        };

        const harvesterCount = getCount('harvester');
        const haulerCount = getCount('hauler');
        const bootstrapperCount = getCount('bootstrapper');

        // Total colony collapse: use raw Game.creeps count (not ghost census) to prevent spawning too many
        let rawBootstrapperCount = 0;
        for (const name in Game.creeps) {
            const c = Game.creeps[name];
            if (c.memory.colony === roomName && c.memory.role === 'bootstrapper') {
                rawBootstrapperCount++;
            }
        }

        // Emergency Protocol: If ALL economy roles are gone, kickstart with minimal bootstrappers
        if (harvesterCount === 0 && haulerCount === 0 && bootstrapperCount === 0 && rawBootstrapperCount === 0) {
            CreepSpawnRequestUtility.requestCreep(roomName, 'bootstrapper', EMERGENCY_BODY);
            return;
        }

        // Fix: Hard block economy queues until at least two bootstrappers exist
        if (harvesterCount === 0 && haulerCount === 0 && (limits['harvester'] || 0) > 0) {
            // Hard-cap at 2 using the RAW count to prevent TTL ghosting from over-spawning
            if (rawBootstrapperCount < 2) {
                CreepSpawnRequestUtility.requestCreep(roomName, 'bootstrapper', EMERGENCY_BODY);
                return; // Do not allow harvesters to queue
            }
        }

        // Emergency bootstrap: spawn minimal body harvester when 0 harvesters exist
        if (harvesterCount === 0 && (limits['harvester'] || 0) > 0) {
            const body = energyCapacity >= 300 ? CreepBodyUtility.getBody('harvester', energyCapacity) : EMERGENCY_BODY;
            CreepSpawnRequestUtility.requestCreep(roomName, 'harvester', body);
            return;
        }
        // Ensure at least 1 hauler before filling other roles
        if (harvesterCount >= 1 && haulerCount === 0 && (limits['hauler'] || 0) > 0) {
            const body = energyCapacity >= 300 ? CreepBodyUtility.getBody('hauler', energyCapacity) : EMERGENCY_BODY;
            CreepSpawnRequestUtility.requestCreep(roomName, 'hauler', body);
            return;
        }

        // Standard queueing for remaining limits
        for (const role in limits) {
            const limit = limits[role];
            const totalCount = getCount(role);

            if (totalCount < limit) {
                const missingCount = limit - totalCount;
                const bodyParts = CreepBodyUtility.getBody(role, energyCapacity);

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