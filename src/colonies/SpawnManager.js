// IMPROVEMENT: Replaces hardcoded limits with dynamic source/site calculations.
// IMPROVEMENT: Introduces strict Emergency Recovery to prevent colony death spirals.
// IMPROVEMENT: Optimizes body generation to balance WORK/MOVE fatigue ratios.

class SpawnManager {
    static run(roomOrName) {
        const room = typeof roomOrName === 'string' ? Game.rooms[roomOrName] : roomOrName;
        if (!room) return;

        // O(1) filter for available spawns
        const spawns = room.find(FIND_MY_SPAWNS);
        let availableSpawn = null;
        for (let i = 0; i < spawns.length; i++) {
            if (!spawns[i].spawning) {
                availableSpawn = spawns[i];
                break;
            }
        }
        if (!availableSpawn) return;

        // Use GlobalStateScanner cache if available, else O(N) fallback
        let creeps = [];
        if (global.Tick && global.Tick.creepsByRoom && global.Tick.creepsByRoom[room.name]) {
            creeps = global.Tick.creepsByRoom[room.name];
        } else {
            creeps = room.find(FIND_MY_CREEPS);
        }

        const counts = this.getCensus(creeps);
        const needs = this.calculateNeeds(room);

        const energyAvailable = room.energyAvailable;
        const energyCapacity = room.energyCapacityAvailable;

        // 1. EMERGENCY RECOVERY: Bypass capacity checks to save a dying colony
        if (counts.harvester === 0) {
            if (energyAvailable >= 200) this.executeSpawn(availableSpawn, 'harvester', room.name, energyAvailable);
            return;
        }
        if (counts.hauler === 0) {
            if (energyAvailable >= 100) this.executeSpawn(availableSpawn, 'hauler', room.name, energyAvailable);
            return;
        }

        // 2. STANDARD SPAWNING: Wait for full energy capacity to spawn maximum size creeps
        if (energyAvailable < energyCapacity) return;

        if (counts.harvester < needs.harvester) {
            this.executeSpawn(availableSpawn, 'harvester', room.name, energyCapacity);
            return;
        }
        if (counts.hauler < needs.hauler) {
            this.executeSpawn(availableSpawn, 'hauler', room.name, energyCapacity);
            return;
        }
        if (counts.upgrader < needs.upgrader) {
            this.executeSpawn(availableSpawn, 'upgrader', room.name, energyCapacity);
            return;
        }
        if (counts.builder < needs.builder) {
            this.executeSpawn(availableSpawn, 'builder', room.name, energyCapacity);
            return;
        }
    }

    static getCensus(creeps) {
        const counts = { harvester: 0, hauler: 0, upgrader: 0, builder: 0 };
        for (let i = 0; i < creeps.length; i++) {
            const role = creeps[i].memory.role;
            if (counts[role] !== undefined) counts[role]++;
        }
        return counts;
    }

    static calculateNeeds(room) {
        const sourceCount = room.find(FIND_SOURCES).length;
        const sitesCount = room.find(FIND_MY_CONSTRUCTION_SITES).length;
        const rcl = room.controller.level;

        // Scale down worker counts as creep sizes increase with RCL
        const harvesterMultiplier = rcl < 3 ? 2 : 1; 
        const haulerMultiplier = rcl < 4 ? 2 : 1;

        return {
            harvester: sourceCount * harvesterMultiplier,
            hauler: sourceCount * haulerMultiplier,
            upgrader: rcl === 8 ? 1 : 2, // Hard cap at RCL 8 to save CPU/Energy
            builder: sitesCount > 0 ? (sitesCount > 10 ? 3 : 2) : 0
        };
    }

    static executeSpawn(spawn, role, roomName, energy) {
        const body = this.getBody(role, energy);
        if (body.length === 0) return; 

        const name = role + '_' + Game.time;
        
        // Inline memory allocation to avoid external function call overhead
        const result = spawn.spawnCreep(body, name, { 
            memory: { role: role, room: roomName } 
        });

        if (result === OK) {
            // Optimistically update V8 Heap tick cache to prevent duplicate spawning in the same tick
            if (global.Tick && global.Tick.creepsByRoom && global.Tick.creepsByRoom[roomName]) {
                global.Tick.creepsByRoom[roomName].push({ memory: { role: role } });
            }
        }
    }

    static getBody(role, energy) {
        const body = [];
        let cost = 0;

        if (role === 'harvester') {
            body.push(WORK, CARRY, MOVE);
            cost = 200;
            let workParts = 1;
            
            // Max out at 5 WORK parts (source fully drained in 300 ticks)
            while (cost + 100 <= energy && workParts < 5) {
                body.unshift(WORK);
                cost += 100;
                workParts++;
            }
            
            // Calculate required MOVE parts to not be completely paralyzed
            let moveNeeded = Math.ceil((workParts + 1) / 2) - 1; 
            while (cost + 50 <= energy && moveNeeded > 0) {
                body.push(MOVE);
                cost += 50;
                moveNeeded--;
            }
            return body;
        }

        if (role === 'hauler') {
            body.push(CARRY, MOVE);
            cost = 100;
            // 2 CARRY : 1 MOVE ratio is optimal for roads
            while (cost + 150 <= energy && body.length < 48) {
                body.unshift(CARRY, CARRY);
                body.push(MOVE);
                cost += 150;
            }
            return body;
        }

        if (role === 'builder' || role === 'upgrader') {
            body.push(WORK, CARRY, MOVE);
            cost = 200;
            // 1 WORK : 1 CARRY : 1 MOVE ratio
            while (cost + 200 <= energy && body.length < 48) {
                body.unshift(WORK, CARRY);
                body.push(MOVE);
                cost += 200;
            }
            return body;
        }

        return [WORK, CARRY, MOVE];
    }
}
module.exports = SpawnManager;