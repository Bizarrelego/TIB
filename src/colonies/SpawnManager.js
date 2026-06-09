// src/colonies/SpawnManager.js
const EMERGENCY_BODY = [WORK, CARRY, MOVE];

class CreepBodyBuilder {
    static getBody(role, energyCapacity) {
        energyCapacity = energyCapacity || 300;
        
        switch (role) {
            case 'harvester': return this.generateHarvester(energyCapacity);
            case 'hauler': return this.generateHauler(energyCapacity);
            case 'upgrader': return this.generateUpgrader(energyCapacity);
            case 'builder': return this.generateBuilder(energyCapacity);
            case 'bootstrapper': return [WORK, CARRY, MOVE];
            case 'filler': return this.generateHauler(energyCapacity);
            case 'remoteharvester': return this.generateHarvester(energyCapacity);
            case 'remotehauler': return this.generateHauler(energyCapacity);
            case 'scout': return [MOVE];
            case 'repairman': return [WORK, CARRY, MOVE, MOVE];
            case 'defender': return [TOUGH, MOVE, ATTACK, MOVE];
            case 'meleeCreep': return this.generateMelee(energyCapacity);
            case 'rangerCreep': return this.generateRanger(energyCapacity);
            case 'medicCreep': return this.generateMedic(energyCapacity);
            default: return [WORK, CARRY, MOVE];
        }
    }

    static generateHarvester(energy) {
        let work = 1, carry = 1, move = 1;
        let cost = 200;
        while (cost + 100 <= energy && work < 5) { work++; cost += 100; }
        if (cost + 50 <= energy && move < 2 && work < 5) { move++; cost += 50; }
        return this.buildArray(work, carry, move);
    }

    static generateHauler(energy) {
        let carry = 1, move = 1;
        let cost = 100;
        while (cost + 150 <= energy && (carry + move + 3) <= 50) { carry += 2; move += 1; cost += 150; }
        if (cost + 50 <= energy && (carry + move + 1) <= 50) { carry += 1; cost += 50; }
        return this.buildArray(0, carry, move);
    }

    static generateUpgrader(energy) {
        let work = 1, carry = 1, move = 1;
        let cost = 200;
        const maxWork = 15;
        while (cost + 100 <= energy && work < maxWork && (work + carry + move + 1) <= 50) {
            work++; cost += 100;
            if (work % 5 === 0) {
                if (cost + 50 <= energy && (work + carry + move + 1) <= 50) { carry++; cost += 50; }
                if (cost + 50 <= energy && (work + carry + move + 1) <= 50) { move++; cost += 50; }
            }
        }
        return this.buildArray(work, carry, move);
    }

    static generateBuilder(energy) {
        let work = 1, carry = 1, move = 1;
        let cost = 200;
        while (cost + 200 <= energy && (work + carry + move + 3) <= 50) { work++; carry++; move++; cost += 200; }
        while (cost + 50 <= energy && (work + carry + move + 1) <= 50) { carry++; cost += 50; }
        return this.buildArray(work, carry, move);
    }

    static generateMelee(energy) {
        const body = [];
        let cost = 0;
        const blockCost = BODYPART_COST[TOUGH] * 2 + BODYPART_COST[ATTACK] * 2 + BODYPART_COST[MOVE] * 2;
        body.push(TOUGH, TOUGH, ATTACK, ATTACK, MOVE, MOVE);
        cost += blockCost;
        while (cost + blockCost <= energy && body.length + 6 <= 50) {
            body.push(TOUGH, TOUGH, ATTACK, ATTACK, MOVE, MOVE);
            cost += blockCost;
        }
        return body;
    }

    static generateRanger(energy) {
        const body = [];
        let cost = 0;
        const blockCost = BODYPART_COST[TOUGH] + BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
        body.push(TOUGH, RANGED_ATTACK, MOVE);
        cost += blockCost;
        while (cost + blockCost <= energy && body.length + 3 <= 50) {
            body.push(TOUGH, RANGED_ATTACK, MOVE);
            cost += blockCost;
        }
        return body;
    }

    static generateMedic(energy) {
        const body = [];
        let cost = 0;
        const blockCost = BODYPART_COST[MOVE] + BODYPART_COST[HEAL];
        body.push(MOVE, HEAL);
        cost += blockCost;
        while (cost + blockCost <= energy && body.length + 2 <= 50) {
            body.push(MOVE, HEAL);
            cost += blockCost;
        }
        return body;
    }

    static buildArray(work, carry, move) {
        const body = [];
        for (let i = 0; i < work; i++) body.push(WORK);
        for (let i = 0; i < carry; i++) body.push(CARRY);
        for (let i = 0; i < move; i++) body.push(MOVE);
        return body;
    }
}

class CensusCalculator {
    static get CENSUS_BY_RCL() {
        return {
            1: { harvester: 2, hauler: 4, upgrader: 3, builder: 0 },
            2: { harvester: 2, hauler: 4, upgrader: 4, builder: 3 },
            3: { harvester: 2, hauler: 3, upgrader: 5, builder: 3 },
            4: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
            5: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
            6: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
            7: { harvester: 2, hauler: 2, upgrader: 3, builder: 1 },
            8: { harvester: 2, hauler: 2, upgrader: 1, builder: 1 }
        };
    }

    static getAllLimits(rcl, roomState, roomName) {
        const limits = Object.assign({}, this.CENSUS_BY_RCL[rcl] || this.CENSUS_BY_RCL[4]);

        if (roomState) {
            let looseEnergy = 0;
            if (roomState.droppedEnergy) {
                for (let i = 0; i < roomState.droppedEnergy.length; i++) looseEnergy += roomState.droppedEnergy[i].amount;
            }
            if (roomState.sourceContainers) {
                for (let i = 0; i < roomState.sourceContainers.length; i++) looseEnergy += roomState.sourceContainers[i].store.getUsedCapacity(RESOURCE_ENERGY);
            }

            if (looseEnergy > 1500) {
                const extraHaulers = Math.min(4, Math.floor(looseEnergy / 1500));
                limits.hauler += extraHaulers;
            }

            if (roomState.storage && roomState.storage.my) {
                limits.filler = 1;
                limits.repairman = 1;
            }

            // Emergency Storage Protocol
            if (rcl >= 4) {
                if (!roomState.storage || !roomState.storage.my) {
                    limits.upgrader = 1;
                    limits.builder = 4;
                }
            }
        }

        if (roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
            const outposts = Memory.rooms[roomName].outposts;
            let remoteSources = 0;
            for (let i = 0; i < outposts.length; i++) {
                const adjMem = Memory.rooms[outposts[i]];
                if (adjMem && adjMem.sources) {
                    remoteSources += adjMem.sources.length;
                }
            }
            if (remoteSources > 0) {
                limits.remoteharvester = remoteSources;
                limits.remotehauler = remoteSources * 2;
            }
        }

        limits.scout = (global.State && global.State.scoutQueue && global.State.scoutQueue.length > 0) ? 1 : 0;

        let hostilesFound = false;
        if (roomState && roomState.hostiles && roomState.hostiles.length > 0) hostilesFound = true;
        if (!hostilesFound && roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
            const outposts = Memory.rooms[roomName].outposts;
            for (let i = 0; i < outposts.length; i++) {
                const outpostState = global.State?.rooms?.get(outposts[i]);
                if (outpostState && outpostState.hostiles && outpostState.hostiles.length > 0) {
                    hostilesFound = true;
                    break;
                }
            }
        }
        limits.defender = hostilesFound ? 1 : 0;

        const hasOffensiveQueue = global.State && global.State.militaryQueue && global.State.militaryQueue.length > 0;
        if (hostilesFound) {
            limits.meleeCreep = Math.min(2, (limits.meleeCreep || 0) + 1);
            limits.rangerCreep = Math.min(2, (limits.rangerCreep || 0) + 1);
            limits.medicCreep = Math.min(2, (limits.medicCreep || 0) + 1);
        }

        if (rcl >= 4 && hasOffensiveQueue) {
            limits.meleeCreep = Math.min(2, (limits.meleeCreep || 0) + 1);
            limits.rangerCreep = Math.min(2, (limits.rangerCreep || 0) + 1);
            limits.medicCreep = Math.min(2, (limits.medicCreep || 0) + 1);
        }

        return limits;
    }
}

class SpawnManager {
    static run(spawn) {
        if (spawn.spawning) return;
        
        // Throttle declarative census diffing to save CPU
        if (Game.time % 10 !== 0) return;

        const roomName = spawn.room.name;
        const energyCapacity = spawn.room.energyCapacityAvailable;
        const rcl = spawn.room.controller ? spawn.room.controller.level : 1;
        const roomState = global.State?.rooms?.get(roomName);

        const targetCensus = CensusCalculator.getAllLimits(rcl, roomState, roomName);

        const currentCensus = {};
        let rawBootstrapperCount = 0;
        for (const name in Game.creeps) {
            const c = Game.creeps[name];
            if (c.memory.colony === roomName || c.memory.room === roomName) {
                const role = c.memory.role;
                
                // Pre-emptive spawning logic based on TTL
                if (!c.spawning && c.ticksToLive !== undefined && c.ticksToLive < 50) {
                    continue;
                }

                currentCensus[role] = (currentCensus[role] || 0) + 1;
                if (role === 'bootstrapper') rawBootstrapperCount++;
            }
        }

        const getCount = (role) => currentCensus[role] || 0;

        const harvesterCount = getCount('harvester');
        const haulerCount = getCount('hauler');
        const bootstrapperCount = getCount('bootstrapper');

        // Emergency Protocol
        if (harvesterCount === 0 && haulerCount === 0 && bootstrapperCount === 0 && rawBootstrapperCount === 0) {
            this.executeSpawn(spawn, 'bootstrapper', EMERGENCY_BODY);
            return;
        }

        if (harvesterCount === 0 && haulerCount === 0 && (targetCensus['harvester'] || 0) > 0) {
            if (rawBootstrapperCount < 2) {
                this.executeSpawn(spawn, 'bootstrapper', EMERGENCY_BODY);
                return;
            }
        }

        if (harvesterCount === 0 && (targetCensus['harvester'] || 0) > 0) {
            const body = energyCapacity >= 300 ? CreepBodyBuilder.getBody('harvester', energyCapacity) : EMERGENCY_BODY;
            this.executeSpawn(spawn, 'harvester', body);
            return;
        }
        if (harvesterCount >= 1 && haulerCount === 0 && (targetCensus['hauler'] || 0) > 0) {
            const body = energyCapacity >= 300 ? CreepBodyBuilder.getBody('hauler', energyCapacity) : EMERGENCY_BODY;
            this.executeSpawn(spawn, 'hauler', body);
            return;
        }

        const spawnPriority = [
            'filler', 'harvester', 'hauler', 'upgrader', 'builder', 
            'repairman', 'remoteharvester', 'remotehauler', 
            'defender', 'meleeCreep', 'rangerCreep', 'medicCreep', 'scout'
        ];

        for (let i = 0; i < spawnPriority.length; i++) {
            const role = spawnPriority[i];
            const limit = targetCensus[role] || 0;
            const current = getCount(role);

            if (current < limit) {
                const bodyParts = CreepBodyBuilder.getBody(role, energyCapacity);
                if (!bodyParts || bodyParts.length === 0) continue;
                
                const cost = bodyParts.reduce((total, part) => total + BODYPART_COST[part], 0);

                if (spawn.room.energyAvailable >= cost) {
                    this.executeSpawn(spawn, role, bodyParts);
                }
                return; // Stop processing further limits until this high-priority creep is spawned
            }
        }
    }

    static executeSpawn(spawn, role, bodyParts) {
        const name = role + '_' + Game.time + '_' + Math.floor(Math.random() * 1000);
        spawn.spawnCreep(bodyParts, name, { memory: { role: role, colony: spawn.room.name } });
    }
}

module.exports = SpawnManager;