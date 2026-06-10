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
            // Optimizes spawn cost by locking scouts to a single MOVE part, ensuring negligible impact on the RCL 2 energy budget.
            case 'scout': return [MOVE];
            case 'miner': return this.generateMiner(energyCapacity);
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

    static generateMiner(energy) {
        let work = 1, move = 1;
        let cost = 150;
        while (cost + 100 <= energy && work < 5) { work++; cost += 100; }
        return this.buildArray(work, 0, move);
    }

    static generateMelee(energy) {
        const blockCost = BODYPART_COST[TOUGH] * 2 + BODYPART_COST[ATTACK] * 2 + BODYPART_COST[MOVE] * 2;
        let blocks = Math.floor(energy / blockCost);
        if (blocks > Math.floor(50 / 6)) blocks = Math.floor(50 / 6);
        if (blocks < 1) blocks = 1;

        const body = new Array(blocks * 6);
        let idx = 0;
        for (let i = 0; i < blocks; i++) {
            body[idx++] = TOUGH; body[idx++] = TOUGH;
            body[idx++] = ATTACK; body[idx++] = ATTACK;
            body[idx++] = MOVE; body[idx++] = MOVE;
        }
        return body;
    }

    static generateRanger(energy) {
        const blockCost = BODYPART_COST[TOUGH] + BODYPART_COST[RANGED_ATTACK] + BODYPART_COST[MOVE];
        let blocks = Math.floor(energy / blockCost);
        if (blocks > Math.floor(50 / 3)) blocks = Math.floor(50 / 3);
        if (blocks < 1) blocks = 1;

        const body = new Array(blocks * 3);
        let idx = 0;
        for (let i = 0; i < blocks; i++) {
            body[idx++] = TOUGH;
            body[idx++] = RANGED_ATTACK;
            body[idx++] = MOVE;
        }
        return body;
    }

    static generateMedic(energy) {
        const blockCost = BODYPART_COST[MOVE] + BODYPART_COST[HEAL];
        let blocks = Math.floor(energy / blockCost);
        if (blocks > 25) blocks = 25;
        if (blocks < 1) blocks = 1;

        const body = new Array(blocks * 2);
        let idx = 0;
        for (let i = 0; i < blocks; i++) {
            body[idx++] = MOVE;
            body[idx++] = HEAL;
        }
        return body;
    }

    static buildArray(work, carry, move) {
        const len = work + carry + move;
        const body = new Array(len);
        let idx = 0;
        for (let i = 0; i < work; i++) body[idx++] = WORK;
        for (let i = 0; i < carry; i++) body[idx++] = CARRY;
        for (let i = 0; i < move; i++) body[idx++] = MOVE;
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
                for (let i = 0; i < roomState.droppedEnergyCount; i++) {
                    const drop = roomState.droppedEnergy[i];
                    if (drop && drop.amount) looseEnergy += drop.amount;
                }
            }
            if (roomState.sourceContainers) {
                for (let i = 0; i < roomState.sourceContainerCount; i++) {
                    const container = roomState.sourceContainers[i];
                    if (container && container.store) looseEnergy += container.store.getUsedCapacity(RESOURCE_ENERGY);
                }
            }

            if (looseEnergy > 1500) {
                const extraHaulers = Math.min(4, Math.floor(looseEnergy / 1500));
                limits.hauler += extraHaulers;
            }

            if (roomState.storage && roomState.storage.my) {
                limits.filler = 1;
                limits.repairman = 1;

                const storageEnergy = roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY);
                if (storageEnergy < 50000) {
                    limits.upgrader = Math.min(limits.upgrader, 1);
                } else if (storageEnergy > 300000) {
                    limits.upgrader += 3;
                } else if (storageEnergy > 200000) {
                    limits.upgrader += 2;
                } else if (storageEnergy > 100000) {
                    limits.upgrader += 1;
                }
            }

            if (roomState.terminal && roomState.terminal.my) {
                const terminalEnergy = roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY);
                if (terminalEnergy > 50000) {
                    limits.upgrader += 1;
                    limits.builder += 1;
                }
            }

            if (roomState.extractor && roomState.mineral && roomState.mineral.mineralAmount > 0) {
                limits.miner = 1;
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

        let needsScout = false;
        // Initiates passive intel ingestion at RCL 2 to prepare for early remote expansion.
        if (rcl >= 2 && roomName) {
            const queue = [{name: roomName, depth: 0}];
            let qIdx = 0;
            const visited = new Set([roomName]);
            const threshold = 10000;

            while (qIdx < queue.length) {
                const current = queue[qIdx++];
                
                const mem = Memory.rooms && Memory.rooms[current.name];
                if (!mem || !mem.scoutedAt || (Game.time - mem.scoutedAt) > threshold) {
                    needsScout = true;
                    break;
                }

                if (current.depth < 2) {
                    const exits = Game.map.describeExits(current.name);
                    if (exits) {
                        for (const dir in exits) {
                            const adjRoom = exits[dir];
                            // Skip SK rooms and Sector Centers via fast string parsing (e.g. W4N5)
                            // Sector centers are coordinates containing 4,5,6
                            const strLen = adjRoom.length;
                            let xStr = "", yStr = "";
                            let parsingX = true;
                            for (let i = 1; i < strLen; i++) {
                                const char = adjRoom[i];
                                if (char === 'N' || char === 'S') { parsingX = false; continue; }
                                if (parsingX) xStr += char; else yStr += char;
                            }
                            const x = parseInt(xStr, 10) % 10;
                            const y = parseInt(yStr, 10) % 10;
                            if ((x >= 4 && x <= 6) && (y >= 4 && y <= 6)) continue;
                            
                            if (!visited.has(adjRoom)) {
                                visited.add(adjRoom);
                                queue.push({name: adjRoom, depth: current.depth + 1});
                            }
                        }
                    }
                }
            }
        }
        limits.scout = needsScout ? 1 : 0;

        let hostilesFound = false;
        if (roomState && roomState.hostiles && roomState.hostileCount > 0) hostilesFound = true;
        if (!hostilesFound && roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
            const outposts = Memory.rooms[roomName].outposts;
            for (let i = 0; i < outposts.length; i++) {
                const outpostState = global.State?.rooms?.get(outposts[i]);
                if (outpostState && outpostState.hostiles && outpostState.hostileCount > 0) {
                    hostilesFound = true;
                    break;
                }
            }
        }
        if (hostilesFound) {
            limits.defender = 2; // Priority 0 during an active siege
        }

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

        // Link Transition Protocol
        if (roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].sources) {
            let linkedSources = 0;
            const sourcesData = Memory.rooms[roomName].sources;
            for (const id in sourcesData) {
                if (sourcesData[id] && sourcesData[id].isLinked) {
                    linkedSources++;
                }
            }
            if (linkedSources > 0) {
                limits.hauler = Math.max(0, (limits.hauler || 0) - linkedSources);
            }
        }

        return limits;
    }
}

class SpawnManager {
    static run(spawn) {
        if (spawn.spawning) return;
        
        // Throttle declarative census diffing to save CPU
        if (Game.time % 10 !== 0) return;

        if (!spawn.room.controller || !spawn.room.controller.my) return;

        const roomName = spawn.room.name;
        const energyCapacity = spawn.room.energyCapacityAvailable;
        const rcl = spawn.room.controller ? spawn.room.controller.level : 1;
        const roomState = global.State?.rooms?.get(roomName);

        if (!global.Cache) global.Cache = {};
        if (!global.Cache.tickCensus) global.Cache.tickCensus = new Map();
        if (!global.Cache.tickTargetCensus) global.Cache.tickTargetCensus = new Map();
        if (global.Cache.tickCensusTime !== Game.time) {
            global.Cache.tickCensus.clear();
            global.Cache.tickTargetCensus.clear();
            global.Cache.tickCensusTime = Game.time;
        }

        let targetCensus = global.Cache.tickTargetCensus.get(roomName);
        if (!targetCensus) {
            targetCensus = CensusCalculator.getAllLimits(rcl, roomState, roomName);
            global.Cache.tickTargetCensus.set(roomName, targetCensus);
        }

        let censusData = global.Cache.tickCensus.get(roomName);
        if (!censusData) {
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
            censusData = { currentCensus, rawBootstrapperCount };
            global.Cache.tickCensus.set(roomName, censusData);
        }

        const { currentCensus, rawBootstrapperCount } = censusData;

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

        // Prevents economic stalling by ensuring early-game scouts yield the spawn queue to critical energy-generating roles.
        const spawnPriority = [
            'defender', 'filler', 'harvester', 'hauler', 'upgrader', 'scout', 'builder', 
            'repairman', 'remoteharvester', 'remotehauler', 
            'meleeCreep', 'rangerCreep', 'medicCreep'
        ];

        for (let i = 0; i < spawnPriority.length; i++) {
            const role = spawnPriority[i];
            const limit = targetCensus[role] || 0;
            const current = getCount(role);

            if (current < limit) {
                const bodyParts = CreepBodyBuilder.getBody(role, energyCapacity);
                if (!bodyParts || bodyParts.length === 0) continue;
                
                let cost = 0;
                for (let j = 0; j < bodyParts.length; j++) {
                    cost += BODYPART_COST[bodyParts[j]];
                }

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