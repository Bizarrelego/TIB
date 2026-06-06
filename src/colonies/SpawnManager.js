const CreepCensusUtility = require('../utilities/CreepCensusUtility');
const CreepBodyUtility = require('../utilities/CreepBodyUtility');
const RoleCensusLimitUtility = require('../utilities/RoleCensusLimitUtility');

class SpawnManager {
    static run() {
        this.spawnCreeps();
    }

    static spawnCreeps() {
        const census = CreepCensusUtility.getCensus();

        // Hardcoded integer limits for phase RCL 1-2 Bootstrapping
        const LIMITS = RoleCensusLimitUtility.getAllLimits();

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
        const body = CreepBodyUtility.getBody(role);
        if (!body || body.length === 0) return;

        const name = role + '_' + Game.time;
        spawn.spawnCreep(body, name, {
            memory: { role: role, colony: roomName }
        });
    }
}

module.exports = SpawnManager;
