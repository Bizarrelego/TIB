/**
 * Top-Down, V8-Optimized Spawn Manager
 * Algorithmic Body Generation & Dynamic Scaling
 */

const createMemoryTemplate = (role, roomName) => ({
    role: role,
    room: roomName,
    taskId: 0,
    targetId: null,
    targetRoom: null,
    scavenging: 0,
    state: 0
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
        
        // Dynamic limits based on room state
        const maxHarvesters = roomState?.sources ? roomState.sources.length : 2;
        
        // Emergency check: If core economy is dead, spawn immediately with available energy.
        const isEmergency = (creepCounts.harvester || 0) === 0 || (creepCounts.hauler || 0) === 0;
        const energyAvailable = roomObj.energyAvailable;
        const energyCapacity = roomObj.energyCapacityAvailable;
        
        const spawnEnergy = isEmergency ? Math.max(300, energyAvailable) : energyCapacity;
        
        if (energyAvailable < spawnEnergy) return;

        // 1. Harvesters (1 per source)
        if ((creepCounts.harvester || 0) < maxHarvesters) {
            SpawnManager.executeSpawn(spawn, 'harvester', roomObj.name, spawnEnergy);
            return;
        }

        // 2. Haulers
        if ((creepCounts.hauler || 0) < 3) {
            SpawnManager.executeSpawn(spawn, 'hauler', roomObj.name, spawnEnergy);
            return;
        }

        // 3. Builders (Only if sites exist)
        if (roomState && roomState.constructionSites && roomState.constructionSites.length > 0) {
            if ((creepCounts.builder || 0) < 2) {
                SpawnManager.executeSpawn(spawn, 'builder', roomObj.name, spawnEnergy);
                return;
            }
        }

        // 4. Upgraders
        if ((creepCounts.upgrader || 0) < 3) {
            SpawnManager.executeSpawn(spawn, 'upgrader', roomObj.name, spawnEnergy);
            return;
        }

        // 5. Scouts
        if (global.State.scoutQueue && global.State.scoutQueue.length > 0) {
            const scoutCount = roomState?.creepCounts?.scout || SpawnManager.fallbackScanner(roomObj).scout || 0;
            if (scoutCount < 1) {
                SpawnManager.executeSpawn(spawn, 'scout', roomObj.name, 50);
                return;
            }
        }
    }

    static executeSpawn(spawn, role, roomName, energy) {
        const body = SpawnManager.getBody(role, energy);
        if (body.length === 0) return; // Failsafe

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

    /**
     * Algorithmically generates the largest optimal body for the given energy.
     */
    static getBody(role, energy) {
        if (role === 'scout') return [MOVE];

        let body = [];
        let cost = 0;

        if (role === 'harvester') {
            body = [WORK, CARRY, MOVE];
            cost = 200; // CORRECTED BASE COST: 100(WORK) + 50(CARRY) + 50(MOVE) = 200
            let workParts = 1;
            
            // Maximize WORK parts up to 5 (optimal for a 3000 capacity source)
            while (cost + 100 <= energy && workParts < 5) {
                body.unshift(WORK);
                cost += 100;
                workParts++;
            }
            // Add one extra MOVE if affordable to speed up transit to the source
            if (cost + 50 <= energy) {
                body.push(MOVE);
                cost += 50;
            }
            return body;
        }

        if (role === 'hauler') {
            body = [CARRY, MOVE];
            cost = 100;
            // 2 CARRY per 1 MOVE is optimal for road/plains hauling
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
            // Balanced parts
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