/**
 * Top-Down, V8-Optimized Spawn Manager
 * Aggressive RCL1/RCL2 Bootstrapping
 */

// V8 Optimization: Monomorphic object shape.
const createMemoryTemplate = (role, roomName) => ({
    role: role,
    room: roomName,
    taskId: 0,
    targetId: null,
    targetRoom: null, // REQUIRED FOR SCOUTING
    scavenging: 0,
    state: 0
});

class SpawnManager {
    /**
     * Executes aggressive spawning logic for a given room.
     * @param {Room|string} roomOrName
     */
    static run(roomOrName) {
        // Normalize input so it handles both string names and Room objects from _.forEach
        const roomObj = typeof roomOrName === 'string' ? Game.rooms[roomOrName] : roomOrName;
        if (!roomObj) return;

        const roomState = global.State?.rooms?.get(roomObj.name);
        
        const spawns = roomState?.spawns || roomObj.find(FIND_MY_SPAWNS);
        if (!spawns || spawns.length === 0) return;

        const spawn = spawns[0];
        if (spawn.spawning !== null) return;

        const energyAvailable = roomObj.energyAvailable;
        const energyCapacity = roomObj.energyCapacityAvailable;
        
        // Wait for max capacity (300 at RCL1, 550 at RCL2) to spawn optimal creeps
        if (energyAvailable < Math.min(energyCapacity, 550)) return;

        const creepCounts = roomState?.creepCounts || SpawnManager.fallbackScanner(roomObj);

        // 1. Harvesters
        if ((creepCounts.harvester || 0) < 2) {
            SpawnManager.executeSpawn(spawn, 'harvester', roomObj.name, energyCapacity);
            return;
        }

        // 2. Haulers
        if ((creepCounts.hauler || 0) < 3) {
            SpawnManager.executeSpawn(spawn, 'hauler', roomObj.name, energyCapacity);
            return;
        }

        // 3. Builders (Only if sites exist)
        if (roomState && roomState.constructionSites && roomState.constructionSites.length > 0) {
            if ((creepCounts.builder || 0) < 2) {
                SpawnManager.executeSpawn(spawn, 'builder', roomObj.name, energyCapacity);
                return;
            }
        }

        // 4. Upgraders
        if ((creepCounts.upgrader || 0) < 4) {
            SpawnManager.executeSpawn(spawn, 'upgrader', roomObj.name, energyCapacity);
            return;
        }

        // 5. Scouts
        if (global.State.scoutQueue && global.State.scoutQueue.length > 0) {
            // FIX: Look at roomState, not global.State, to prevent infinite spawning when scouts leave the room.
            const scoutCount = roomState?.creepCounts?.scout || SpawnManager.fallbackScanner(roomObj).scout || 0;
            if (scoutCount < 1) { // 1 scout per colony is perfectly optimal for maintaining intel.
                SpawnManager.executeSpawn(spawn, 'scout', roomObj.name, energyCapacity);
                return;
            }
        }
    }

    /**
     * Handles the actual spawning execution and heap updates.
     * @param {StructureSpawn} spawn
     * @param {string} role
     * @param {string} roomName
     * @param {number} energyCapacity
     */
    static executeSpawn(spawn, role, roomName, energyCapacity) {
        const body = SpawnManager.getBody(role, energyCapacity);
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
     * Dynamically generates the largest body possible for the current RCL.
     */
    static getBody(role, energyCapacity) {
        if (role === 'scout') return [MOVE];

        if (energyCapacity >= 550) { // RCL 2
            switch (role) {
                case 'harvester': return [WORK, WORK, WORK, CARRY, MOVE, MOVE];
                case 'hauler': return [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                case 'builder':
                case 'upgrader': return [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
            }
        }

        // RCL 1 Default (300 Energy)
        switch (role) {
            case 'harvester': return [WORK, WORK, CARRY, MOVE];
            case 'hauler': return [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
            case 'builder':
            case 'upgrader': return [WORK, CARRY, CARRY, MOVE, MOVE];
        }
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