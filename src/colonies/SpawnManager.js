// src/colonies/SpawnManager.js
const { RouteDistanceCalculator } = require('../lib/SystemLib');
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
            case 'fastfiller': {
                let carry = 1;
                let cost = 100;
                while (cost + 50 <= energyCapacity && carry < 4) { carry++; cost += 50; }
                return this.buildArray(0, carry, 1);
            }
            case 'filler': return this.generateHauler(energyCapacity);
            case 'remoteharvester': return this.generateHarvester(energyCapacity);
            case 'remotehauler': return this.generateHauler(energyCapacity);
            case 'reserver': return this.generateReserver(energyCapacity);
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

    static generateReserver(energy) {
        let claims = 1;
        let moves = 1;
        if (energy >= 1300) { claims = 2; moves = 2; }
        const body = new Array(claims + moves);
        let idx = 0;
        for (let i = 0; i < claims; i++) body[idx++] = CLAIM;
        for (let i = 0; i < moves; i++) body[idx++] = MOVE;
        return body;
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
            3: { harvester: 2, hauler: 3, upgrader: 4, builder: 3 },
            4: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
            5: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
            6: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
            7: { harvester: 2, hauler: 2, upgrader: 3, builder: 1 },
            8: { harvester: 2, hauler: 2, upgrader: 1, builder: 1 }
        };
    }

    static getAllLimits(rcl, roomState, roomName, energyCapacity) {
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
                // const extraHaulers = Math.min(4, Math.floor(looseEnergy / 1500));
                // limits.hauler += extraHaulers; // Deprecated by dynamic hauler assignment
            }

            if (roomState.storage && roomState.storage.my) {
                limits.filler = 1;
                limits.repairman = 1;

                if (roomState.extensionsCount && roomState.extensionsCount >= 5) {
                    limits.fastfiller = Math.min(4, Math.floor(roomState.extensionsCount / 5));
                }

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
            }
            if (rcl >= 4 && outposts.length > 0) {
                limits.reserver = outposts.length;
            }
        }

        // --- Dynamic Hauler Sizing & Dedication ---
        limits.haulerQueue = [];
        limits.hauler = 0; 
        limits.remotehauler = 0;

        const colony = global.State?.colonies?.get(roomName);
        if (colony && colony.sources && colony.sources.length > 0) {
            for (let i = 0; i < colony.sources.length; i++) {
                const source = colony.sources[i];
                const distance = RouteDistanceCalculator.getDistance(source.id, source.pos, roomName);
                
                // Math: 10 energy/tick generation. Round trip = 2*distance.
                // Required capacity = 20 * distance.
                // 1 CARRY = 50 capacity. So we need Math.ceil((20 * distance) / 50) = Math.ceil(distance * 0.4)
                // We use Math.ceil(distance * 0.5) for a 20% pathing buffer.
                const requiredCarry = Math.ceil(distance * 0.5);
                
                // 150 energy buys [CARRY, CARRY, MOVE] which is 2 CARRY parts
                const requiredEnergy = Math.ceil(requiredCarry / 2) * 150;
                
                const cappedEnergy = Math.min(requiredEnergy, energyCapacity || 300);
                // Math.max(1) ensures we always spawn at least 1 hauler if energy is low
                const neededCount = Math.max(1, Math.ceil(requiredEnergy / cappedEnergy));
                
                const isRemote = source.pos.roomName !== roomName;
                const roleName = isRemote ? 'remotehauler' : 'hauler';
                
                limits[roleName] += neededCount;
                
                limits.haulerQueue.push({
                    role: roleName,
                    targetSource: source.id,
                    targetRoom: source.pos.roomName,
                    count: neededCount,
                    energy: cappedEnergy
                });
            }
        } else {
            limits.hauler = this.CENSUS_BY_RCL[rcl]?.hauler || 2;
        }
        // ------------------------------------------

        let needsScout = false;
        // Initiates passive intel ingestion at RCL 2 to prepare for early remote expansion.
        if (rcl >= 2 && roomName) {
            const queue = [{ name: roomName, depth: 0 }];
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
                                queue.push({ name: adjRoom, depth: current.depth + 1 });
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
    static run(spawn, colony) {
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
            // Evaluates the combined needs of the core room and outposts
            targetCensus = CensusCalculator.getAllLimits(rcl, roomState, roomName, energyCapacity);
            global.Cache.tickTargetCensus.set(roomName, targetCensus);
        }

        let censusData = global.Cache.tickCensus.get(roomName);
        if (!censusData) {
            const currentCensus = {};
            const actualCensus = {};
            let rawBootstrapperCount = 0;
            
            // Replaced flat Game.creeps loop with Colony scope iteration
            const creeps = colony.creeps;
            for (let i = 0; i < creeps.length; i++) {
                const c = creeps[i];
                const role = c.memory.role;

                actualCensus[role] = (actualCensus[role] || 0) + 1;
                if (role === 'bootstrapper') rawBootstrapperCount++;

                // Fixes Generation Die-offs by triggering replacement spawns before the current workforce expires, ensuring zero downtime on critical infrastructure.
                if (!c.spawning && c.ticksToLive !== undefined && c.ticksToLive < 75) {
                    continue;
                }

                currentCensus[role] = (currentCensus[role] || 0) + 1;
            }
            censusData = { currentCensus, actualCensus, rawBootstrapperCount };
            global.Cache.tickCensus.set(roomName, censusData);
        }

        const { currentCensus, actualCensus, rawBootstrapperCount } = censusData;

        const getCount = (role) => currentCensus[role] || 0;
        const getActualCount = (role) => actualCensus[role] || 0;

        const harvesterCount = getCount('harvester');
        const haulerCount = getCount('hauler');
        
        const actualHarvesterCount = getActualCount('harvester');
        const actualHaulerCount = getActualCount('hauler');
        const needsHaulers = (targetCensus['hauler'] || 0) > 0;

        // Emergency Protocol
        if (actualHarvesterCount === 0 && (actualHaulerCount === 0 || !needsHaulers) && getActualCount('bootstrapper') === 0 && rawBootstrapperCount === 0) {
            this.executeSpawn(spawn, 'bootstrapper', EMERGENCY_BODY);
            return;
        }

        if (actualHarvesterCount === 0 && (actualHaulerCount === 0 || !needsHaulers) && (targetCensus['harvester'] || 0) > 0) {
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
            'harvester', 'filler', 'hauler', 'bootstrapper', 'fastfiller', 'defender', 'upgrader', 'builder',
            'scout', 'repairman', 'remoteharvester', 'remotehauler', 'reserver',
            'meleeCreep', 'rangerCreep', 'medicCreep'
        ];

        for (let i = 0; i < spawnPriority.length; i++) {
            const role = spawnPriority[i];
            const limit = targetCensus[role] || 0;
            const current = getCount(role);

            if (current < limit) {
                // Prevents economic cannibalism by completely halting all energy sinks (upgraders/builders) until the energy-gathering workforce is at 100% capacity.
                if (role === 'builder' || role === 'upgrader' || role === 'scout') {
                    if (harvesterCount < (targetCensus['harvester'] || 0) || haulerCount < (targetCensus['hauler'] || 0)) {
                        continue;
                    }
                }

                if ((role === 'hauler' || role === 'remotehauler') && targetCensus.haulerQueue) {
                    let spawned = false;
                    for (let j = 0; j < targetCensus.haulerQueue.length; j++) {
                        const req = targetCensus.haulerQueue[j];
                        if (req.role !== role) continue;
                        
                        let activeCount = 0;
                        for (let k = 0; k < roomState.creeps.length; k++) {
                            const c = roomState.creeps[k];
                            if (c.memory.role === role && c.memory.targetSource === req.targetSource && (c.spawning || c.ticksToLive >= 75)) {
                                activeCount++;
                            }
                        }
                        
                        if (activeCount < req.count) {
                            const body = CreepBodyBuilder.getBody('hauler', req.energy);
                            this.executeSpawn(spawn, role, body, { targetSource: req.targetSource, targetRoom: req.targetRoom });
                            spawned = true;
                            break;
                        }
                    }
                    if (spawned) return;
                } else {
                    const bodyParts = CreepBodyBuilder.getBody(role, energyCapacity);
                    if (!bodyParts || bodyParts.length === 0) continue;

                    let cost = 0;
                    for (let j = 0; j < bodyParts.length; j++) {
                        cost += BODYPART_COST[bodyParts[j]];
                    }

                    if (spawn.room.energyAvailable >= cost) {
                        this.executeSpawn(spawn, role, bodyParts);
                        return;
                    } else {
                        // Strict abort: Do not skip to lower priority roles if we are missing a higher priority one but just lack energy.
                        return;
                    }
                }
            }
        }
    }

    static executeSpawn(spawn, role, bodyParts, extraMemory = {}) {
        if (!bodyParts || bodyParts.length === 0) return;
        const name = role + '_' + Game.time + '_' + Math.floor(Math.random() * 1000);
        const memory = Object.assign({ role: role, colony: spawn.room.name }, extraMemory);
        spawn.spawnCreep(bodyParts, name, { memory: memory });
    }
}

module.exports = SpawnManager;