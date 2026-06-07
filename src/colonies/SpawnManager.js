const CreepCensusUtility = require('../utilities/CreepCensusUtility');
const CreepBodyUtility = require('../utilities/CreepBodyUtility');
const RoleCensusLimitUtility = require('../utilities/RoleCensusLimitUtility');
const CreepSpawnRequestUtility = require('../utilities/CreepSpawnRequestUtility');
const SpawnQueueUtility = require('../utilities/SpawnQueueUtility');

class SpawnManager {
    static run() {
        this.enqueueSpawnRequests();
        this.processSpawnQueue();
    }

    static enqueueSpawnRequests() {
        const activeCounts = CreepCensusUtility.getCensus();
        const queuedCounts = SpawnQueueUtility.getRoleCounts();
        const limits = RoleCensusLimitUtility.getAllLimits();

        const spawnValues = Object.values(Game.spawns);
        if (spawnValues.length === 0) return;
        const roomName = spawnValues[0].room.name;

        // Queue new spawn requests for any missing creeps
        for (const role in limits) {
            const limit = limits[role];
            const totalCount = (activeCounts[role] || 0) + (queuedCounts[role] || 0);

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

    static processSpawnQueue() {
        for (const spawnName in Game.spawns) {
            const spawn = Game.spawns[spawnName];

            if (spawn.spawning) continue;

            const request = SpawnQueueUtility.dequeue();
            if (!request) break;

            const cost = request.bodyParts.reduce((cost, part) => cost + BODYPART_COST[part], 0);

            if (spawn.room.energyAvailable >= cost) {
                const name = request.role + '_' + Game.time + '_' + Math.floor(Math.random() * 1000);
                spawn.spawnCreep(request.bodyParts, name, {
                    memory: request.memory
                });
            } else {
                // If we can't spawn the next creep, put it back at the front of the queue
                // We break because we want to maintain the queue order
                SpawnQueueUtility.unshift(request);
                break;
            }
        }
    }
}

module.exports = SpawnManager;
