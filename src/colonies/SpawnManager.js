/**
 * Top-Down, V8-Optimized Spawn Manager
 * Aggressive RCL1 Bootstrapping
 */

// V8 Optimization: Constant references avoid array allocation overhead during tick execution.
const RCL1_BODIES = {
    harvester: [WORK, WORK, CARRY, MOVE], // 300 energy
    hauler: [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 300 energy
    upgrader: [WORK, CARRY, CARRY, MOVE, MOVE], // 300 energy
    scout: [MOVE] // 50 energy
};

// V8 Optimization: Monomorphic object shape.
// By defining all properties a creep might ever use at spawn time,
// V8 assigns them a single hidden class. DO NOT add properties later via creep.memory.newProp = X.
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
        // Fix: Normalize input so it handles both string names and Room objects.
        const roomObj = typeof roomOrName === 'string' ? Game.rooms[roomOrName] : roomOrName;
        if (!roomObj) return;

        const roomState = global.State?.rooms?.get(roomObj.name);
        
        // Retrieve spawns from heap cache map. Avoid roomObj.find to save CPU.
        const spawns = roomState?.spawns || roomObj.find(FIND_MY_SPAWNS);
        if (!spawns || spawns.length === 0) return;

        const spawn = spawns[0];
        
        // Early exit: Do not run logic if spawn is busy.
        if (spawn.spawning !== null) return;

        const energyAvailable = roomObj.energyAvailable;
        
        // Aggressive RCL1 cutoff: Do not calculate dynamically. Wait for exactly 300.
        if (energyAvailable < 300) return;

        // Heap-based role counting. 
        // DO NOT use Game.creeps.filter() - it creates new arrays and triggers GC.
        const creepCounts = roomState?.creepCounts || SpawnManager.fallbackScanner(roomObj);

        // Top-down aggressive priority logic. No stored queue in Memory.
        // 1. Harvesters: Dedicated miners. 1 per source. Assume 2 sources.
        if ((creepCounts.harvester || 0) < 2) {
            SpawnManager.executeSpawn(spawn, 'harvester', roomObj.name);
            return;
        }

        // 2. Haulers: Move dropped energy to spawn.
        if ((creepCounts.hauler || 0) < 3) {
            SpawnManager.executeSpawn(spawn, 'hauler', roomObj.name);
            return;
        }

        // 3. Upgraders: Burn energy into the controller.
        if ((creepCounts.upgrader || 0) < 4) {
            SpawnManager.executeSpawn(spawn, 'upgrader', roomObj.name);
            return;
        }

        // 4. Scouts: Expand vision network if IntelManager queues targets.
        // Limit to 1 scout globally for now to prevent over-spawning.
        if (global.State.scoutQueue && global.State.scoutQueue.length > 0) {
            const scoutCount = global.State?.creepCounts?.scout || SpawnManager.fallbackScanner(roomObj).scout || 0;
            if (scoutCount < 1) {
                SpawnManager.executeSpawn(spawn, 'scout', roomObj.name);
                return;
            }
        }
    }

    /**
     * Fallback only. Your GlobalStateScanner MUST handle this counting.
     * @param {Room} roomObj
     */
    static fallbackScanner(roomObj) {
        const counts = { harvester: 0, hauler: 0, upgrader: 0, scout: 0 };
        const creeps = roomObj.find(FIND_MY_CREEPS);
        
        // Tight loop, no higher-order functions.
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