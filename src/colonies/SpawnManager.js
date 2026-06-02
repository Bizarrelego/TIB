/**
 * Top-Down, V8-Optimized Spawn Manager
 * Hardcoded Census Framework for RCL 1-2 Bootstrapping
 */

const createMemoryTemplate = (role, roomName) => ({
    role: role,
    room: roomName
});

class SpawnManager {
    static run(roomOrName) {
        const roomObj = typeof roomOrName === 'string' ? Game.rooms[roomOrName] : roomOrName;
        if (!roomObj) return;

        const roomState = global.State?.rooms?.get(roomObj.name);
        
        const spawns = roomState?.spawns || roomObj.find(FIND_MY_SPAWNS);
        if (!spawns || spawns.length === 0) return;

        const spawn = spawns[0];
        if (spawn.spawning !== null) return;

        const creepCounts = roomState?.creepCounts || SpawnManager.fallbackScanner(roomObj);
        
        // CENSUS CONSTANTS
        const LIMIT_HARVESTERS = 4;
        const LIMIT_HAULERS = 5;
        const LIMIT_UPGRADERS = 3;
        const LIMIT_BUILDERS = 5;

        const isEmergency = (creepCounts.harvester || 0) === 0 || (creepCounts.hauler || 0) === 0;
        const energyAvailable = roomObj.energyAvailable;
        const energyCapacity = roomObj.energyCapacityAvailable;
        
        const spawnEnergy = isEmergency ? Math.max(300, energyAvailable) : energyCapacity;
        
        if (energyAvailable < spawnEnergy) return;

        if ((creepCounts.harvester || 0) < LIMIT_HARVESTERS) {
            SpawnManager.executeSpawn(spawn, 'harvester', roomObj.name, spawnEnergy);
            return;
        }

        if ((creepCounts.hauler || 0) < LIMIT_HAULERS) {
            SpawnManager.executeSpawn(spawn, 'hauler', roomObj.name, spawnEnergy);
            return;
        }

        if ((creepCounts.upgrader || 0) < LIMIT_UPGRADERS) {
            SpawnManager.executeSpawn(spawn, 'upgrader', roomObj.name, spawnEnergy);
            return;
        }

        if (roomState && roomState.constructionSites && roomState.constructionSites.length > 0) {
            if ((creepCounts.builder || 0) < LIMIT_BUILDERS) {
                SpawnManager.executeSpawn(spawn, 'builder', roomObj.name, spawnEnergy);
                return;
            }
        }
    }

    static executeSpawn(spawn, role, roomName, energy) {
        const body = SpawnManager.getBody(role, energy);
        if (body.length === 0) return; 

        const name = role + '_' + Game.time;
        const memory = createMemoryTemplate(role, roomName);

        const result = spawn.spawnCreep(body, name, { memory });

        if (result === OK) {
            const roomState = global.State?.rooms?.get(roomName);
            if (roomState) {
                if (!roomState.creepCounts) {
                    roomState.creepCounts = { harvester: 0, hauler: 0, upgrader: 0, builder: 0, scout: 0 };
                }
                roomState.creepCounts[role] = (roomState.creepCounts[role] || 0) + 1;
            }
        }
    }

    static getBody(role, energy) {
        let body = [];
        let cost = 0;

        if (role === 'harvester') {
            body = [WORK, CARRY, MOVE];
            cost = 200;
            let workParts = 1;
            
            while (cost + 100 <= energy && workParts < 5) {
                body.unshift(WORK);
                cost += 100;
                workParts++;
            }
            if (cost + 50 <= energy) {
                body.push(MOVE);
                cost += 50;
            }
            return body;
        }

        if (role === 'hauler') {
            body = [CARRY, MOVE];
            cost = 100;
            while (cost + 150 <= energy && body.length < 30) {
                body.unshift(CARRY, CARRY);
                body.push(MOVE);
                cost += 150;
            }
            return body;
        }

        if (role === 'builder' || role === 'upgrader') {
            body = [WORK, CARRY, MOVE];
            cost = 200;
            while (cost + 200 <= energy && body.length < 30) {
                body.unshift(WORK, CARRY);
                body.push(MOVE);
                cost += 200;
            }
            return body;
        }

        return [WORK, CARRY, MOVE];
    }

    static fallbackScanner(roomObj) {
        const counts = { harvester: 0, hauler: 0, upgrader: 0, builder: 0, scout: 0 };
        const creeps = roomObj.find(FIND_MY_CREEPS);
        
        for (let i = 0; i < creeps.length; i++) {
            const role = creeps[i].memory.role;
            if (counts[role] !== undefined) {
                counts[role]++;
            }
        }
        return counts;
    }
}

module.exports = SpawnManager;