const CreepCensusUtility = require('../utilities/CreepCensusUtility');
const CreepBodies = require('../config/CreepBodies');

class SpawnManager {
    static run() {
        this.spawnCreeps();
    }

    static spawnCreeps() {
        const census = CreepCensusUtility.getCensus();

        // Hardcoded integer limits for phase RCL 1-2 Bootstrapping
        const LIMITS = {
            harvester: 3,
            hauler: 3,
            upgrader: 2
        };

        for (const spawnName in Game.spawns) {
            const spawn = Game.spawns[spawnName];

            if (spawn.spawning) continue;

            const roomName = spawn.room.name;
            const energyAvailable = spawn.room.energyAvailable;
            // Early exit if we don't have enough to spawn even the smallest creep (250)
            if (energyAvailable < 250) continue;

            if (census.harvester < LIMITS.harvester) {
                this.executeSpawn(spawn, 'harvester', roomName);
                break;
            } else if (census.hauler < LIMITS.hauler) {
                this.executeSpawn(spawn, 'hauler', roomName);
                break;
            } else if (census.upgrader < LIMITS.upgrader) {
                this.executeSpawn(spawn, 'upgrader', roomName);
                break;
            }
        }
    }

    static executeSpawn(spawn, role, roomName) {
        const body = CreepBodies.get(role);
        if (!body || body.length === 0) return;

        const name = role + '_' + Game.time;
        spawn.spawnCreep(body, name, {
            memory: { role: role, colony: roomName }
        });
    }
}

module.exports = SpawnManager;
