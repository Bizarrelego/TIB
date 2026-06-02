/**
 * Top-Down, V8-Optimized Spawn Manager
 * Aggressive RCL1 Bootstrapping
 */

// V8 Optimization: Constant references avoid array allocation overhead during tick execution.
const RCL1_BODIES = {
    harvester: [WORK, WORK, CARRY, MOVE], // 300 energy
    hauler: [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE], // 300 energy
    upgrader: [WORK, CARRY, CARRY, MOVE, MOVE] // 300 energy
};

// V8 Optimization: Monomorphic object shape.
// By defining all properties a creep might ever use at spawn time,
// V8 assigns them a single hidden class. DO NOT add properties later via creep.memory.newProp = X.
const createMemoryTemplate = (role, roomName) => ({
    role: role,
    room: roomName,
    taskId: 0,
    targetId: null,
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
        const creepCounts = roomState?.creepCounts || this.fallbackScanner(roomObj);

        // Top-down aggressive priority logic. No stored queue in Memory.
        // 1. Harvesters: Dedicated miners. 1 per source. Assume 2 sources.
        if ((creepCounts.harvester || 0) < 2) {
            this.executeSpawn(spawn, 'harvester', roomObj.name);
            return;
        }

        // 2. Haulers: Move dropped energy to spawn.
        if ((creepCounts.hauler || 0) < 3) {
            this.executeSpawn(spawn, 'hauler', roomObj.name);
            return;
        }

        // 3. Upgraders: Burn energy into the controller.
        if ((creepCounts.upgrader || 0) < 4) {
            this.executeSpawn(spawn, 'upgrader', roomObj.name);
            return;
        }
    }

    /**
     * Handles the actual spawning execution and heap updates.
     * @param {StructureSpawn} spawn
     * @param {string} role
     * @param {string} roomName
     */
    static executeSpawn(spawn, role, roomName) {
        const body = RCL1_BODIES[role];
        
        // Fast string concatenation. Avoids UUID generation overhead.
        const name = role + '_' + Game.time;
        const memory = createMemoryTemplate(role, roomName);

        const result = spawn.spawnCreep(body, name, { memory });

        if (result === OK) {
            // Optimistically update heap state to prevent duplicate spawning 
            // in the same tick if you expand to multiple spawns.
            const roomState = global.State?.rooms?.get(roomName);
            if (roomState) {
                if (!roomState.creepCounts) {
                    roomState.creepCounts = { harvester: 0, hauler: 0, upgrader: 0 };
                }
                roomState.creepCounts[role] = (roomState.creepCounts[role] || 0) + 1;
            }
        }
    }

    /**
     * Fallback only. Your GlobalStateScanner MUST handle this counting.
     * @param {Room} roomObj
     */
    static fallbackScanner(roomObj) {
        const counts = { harvester: 0, hauler: 0, upgrader: 0 };
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