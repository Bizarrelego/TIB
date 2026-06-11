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
            case 'pioneer': return this.generatePioneer(energyCapacity);
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
            case 'mineralminer': return this.generateMiner(energyCapacity);
            case 'hubmanager': return this.generateHubManager(energyCapacity);
            case 'mineralhauler': return this.generateHauler(energyCapacity);
            case 'claimer': return this.generateClaimer(energyCapacity);
            case 'scientist': return this.generateScientist(energyCapacity);
            case 'defender': return [TOUGH, MOVE, ATTACK, MOVE];
            case 'meleeCreep': return this.generateMelee(energyCapacity);
            case 'rangerCreep': return this.generateRanger(energyCapacity);
            case 'medicCreep': return this.generateMedic(energyCapacity);
            case 'skguard': return this.generateSKGuard(energyCapacity);
            case 'skminer': return this.generateSKMiner(energyCapacity);
            case 'skhauler': return this.generateSKHauler(energyCapacity);
            default: return [WORK, CARRY, MOVE];
        }
    }

    static generateSKGuard(energy) {
        // Paladin Body: [TOUGH, ATTACK, MOVE, HEAL]
        // Base cost: 10 + 80 + 50 + 250 = 390
        // Need high move ratio. Max cost for 50 parts is around 5000.
        // We'll aim for a balanced block of: 1 TOUGH, 4 ATTACK, 6 MOVE, 1 HEAL = 10 + 320 + 300 + 250 = 880.
        const blockCost = 880;
        let blocks = Math.floor(energy / blockCost);
        if (blocks > 4) blocks = 4; // 4 blocks = 48 parts
        if (blocks < 1) return [MOVE, ATTACK, HEAL, MOVE]; // Emergency
        
        const body = new Array(blocks * 12);
        let idx = 0;
        for (let i = 0; i < blocks; i++) body[idx++] = TOUGH;
        for (let i = 0; i < blocks * 4; i++) body[idx++] = ATTACK;
        for (let i = 0; i < blocks * 6; i++) body[idx++] = MOVE;
        for (let i = 0; i < blocks; i++) body[idx++] = HEAL;
        return body;
    }

    static generateSKMiner(energy) {
        // SK sources have 4000 capacity per 300 ticks (~13.33/tick)
        // Requires 7 WORK parts to fully drain in time.
        // Body: 7 WORK, 1 CARRY, 4 MOVE = 700 + 50 + 200 = 950 energy.
        if (energy >= 950) {
            return this.buildArray(7, 1, 4);
        }
        return this.generateMiner(energy); // fallback
    }

    static generateSKHauler(energy) {
        // Massive hauler, 2 CARRY : 1 MOVE. 
        let carry = 1, move = 1;
        let cost = 100;
        while (cost + 150 <= energy && (carry + move + 3) <= 50) {
            carry += 2;
            move += 1;
            cost += 150;
        }
        return this.buildArray(0, carry, move);
    }

    static generateHarvester(energy) {
        let work = 1, carry = 1, move = 1;
        let cost = 200;
        // Cap at 6 WORK, 1 CARRY, 3 MOVE
        while (cost + 100 <= energy && work < 6) { work++; cost += 100; }
        while (cost + 50 <= energy && move < 3) { move++; cost += 50; }
        return this.buildArray(work, carry, move);
    }

    static generateHauler(energy) {
        // Pure CARRY/MOVE 1:1, capped at 50 parts
        let carry = 1, move = 1;
        let cost = 100;
        while (cost + 100 <= energy && (carry + move + 2) <= 50) { 
            carry += 1; 
            move += 1; 
            cost += 100; 
        }
        return this.buildArray(0, carry, move);
    }

    static generateUpgrader(energy) {
        let work = 1, carry = 1, move = 1;
        let cost = 200;
        // Cap at 15 WORK, 1 CARRY, 3 MOVE
        while (cost + 100 <= energy && work < 15) { work++; cost += 100; }
        while (cost + 50 <= energy && move < 3) { move++; cost += 50; }
        return this.buildArray(work, carry, move);
    }

    static generateBuilder(energy) {
        let work = 1, carry = 1, move = 1;
        let cost = 200;
        while (cost + 200 <= energy && (work + carry + move + 3) <= 50) { work++; carry++; move++; cost += 200; }
        while (cost + 50 <= energy && (work + carry + move + 1) <= 50) { carry++; cost += 50; }
        return this.buildArray(work, carry, move);
    }

    static generatePioneer(energy) {
        let work = 1, carry = 1, move = 1;
        let cost = 200;
        // Basically a builder/bootstrapper that can walk far
        while (cost + 200 <= energy && (work + carry + move + 3) <= 50) { work++; carry++; move++; cost += 200; }
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

    static generateHubManager(energy) {
        // HubManager is stationary. It needs 1 MOVE and max CARRY.
        let carry = 1;
        let move = 1;
        let cost = 100;
        // Cap at 16 CARRY parts (800 capacity) to cover the 800 link transfer size.
        while (cost + 50 <= energy && carry < 16 && (carry + move + 1) <= 50) { carry++; cost += 50; }
        return this.buildArray(0, carry, move);
    }

    static generateClaimer(_energy) {
        // Claimer just needs to claim the room.
        return [CLAIM, MOVE];
    }

    static generateScientist(energy) {
        // Scientist needs to carry compounds. 1 MOVE, some CARRY.
        let carry = 1, move = 1;
        let cost = 100;
        while (cost + 100 <= energy && carry < 10 && (carry + move + 2) <= 50) { carry++; move++; cost += 100; }
        return this.buildArray(0, carry, move);
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
    static getAllLimits(rcl, roomState, roomName, energyCapacity) {
        // Base limits with 0 default, completely dynamically generated
        const limits = {
            harvester: 0,
            hauler: 0,
            upgrader: 0,
            builder: 0,
            filler: 0,
            fastfiller: 0,
            mineralminer: 0,
            mineralhauler: 0,
            hubmanager: 0,
            scientist: 0,
            pioneer: 0,
            claimer: 0
        };

        if (roomState) {
            // 1. Dynamic Harvesters
            if (roomState.sources) {
                limits.harvester = roomState.sources.length;
            }

            // 2. Dynamic Haulers
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

            let haulerBase = 1;
            if (roomState.storage && roomState.terminal && roomState.linkCount > 0) {
                // If fully linked, we might not need haulers at all for sources
                haulerBase = 0;
            }
            
            // Add 1 hauler per 1500 loose energy, max 4
            let dynamicHaulers = Math.floor(looseEnergy / 1500);
            limits.hauler = Math.min(4, haulerBase + dynamicHaulers);

            // Siege Response
            const isUnderSiege = roomState.hostileCount > 0;
            if (isUnderSiege && roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 20000) {
                limits.hauler = Math.max(limits.hauler, 2);
            }

            // 3. Dynamic Upgraders
            limits.upgrader = 1; // Base to prevent downgrade
            
            if (roomState.storage && roomState.storage.my) {
                limits.filler = 1;

                if (roomState.extensionsCount && roomState.extensionsCount >= 5) {
                    limits.fastfiller = Math.min(4, Math.floor(roomState.extensionsCount / 5));
                }

                const storageEnergy = roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY);
                if (storageEnergy > 300000) {
                    limits.upgrader = 4;
                } else if (storageEnergy > 200000) {
                    limits.upgrader = 3;
                } else if (storageEnergy > 100000) {
                    limits.upgrader = 2;
                }
            }

            if (roomState.terminal && roomState.terminal.my) {
                const terminalEnergy = roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY);
                if (terminalEnergy > 50000) {
                    limits.upgrader += 1;
                }
            }

            if (roomState.extractor && roomState.mineral && roomState.mineral.mineralAmount > 0) {
                limits.mineralminer = 1;
                limits.mineralhauler = 1;
            }

            if (roomState.storage && roomState.terminal && roomState.linkCount > 0) {
                limits.hubmanager = 1;
            }

            if (roomState.labs && roomState.labs.length > 0) {
                limits.scientist = 1;
            }

            // Emergency Storage Protocol
            if (rcl >= 4 && (!roomState.storage || !roomState.storage.my)) {
                limits.upgrader = 1;
                limits.builder = 4;
            }

            // Expansion Pioneer Limits
            if (Memory.empire && Memory.empire.colonizeRoom && Memory.empire.colonizeSourceColony === roomName) {
                limits.claimer = 1;
                limits.pioneer = 4;
            }

            // 4. Dynamic Builders
            let canAffordBuilders = false;
            
            // 1. Bootstrapping (No storage)
            if (!roomState.storage || !roomState.storage.my) {
                canAffordBuilders = true;
            } else {
                const storageEnergy = roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY);
                
                // 2. Energy Surplus
                if (storageEnergy > 30000) {
                    canAffordBuilders = true;
                } else {
                    // 3. Critical Repairs
                    let hasCriticalRepairs = false;
                    for (let i = 0; i < roomState.rampartCount; i++) {
                        if (roomState.ramparts[i].hits < 5000) {
                            hasCriticalRepairs = true;
                            break;
                        }
                    }
                    if (!hasCriticalRepairs && roomState.repairTargetCount > 0) {
                        for (let i = 0; i < roomState.repairTargetCount; i++) {
                            const target = roomState.repairTargets[i];
                            if ((target.structureType === STRUCTURE_WALL || target.structureType === STRUCTURE_RAMPART) && target.hits < 5000) {
                                hasCriticalRepairs = true;
                                break;
                            }
                        }
                    }

                    if (hasCriticalRepairs) {
                        canAffordBuilders = true;
                    } else if (roomState.constructionSiteCount > 0 && storageEnergy > 10000) {
                        // 4. Practical exception for construction sites
                        canAffordBuilders = true;
                    }
                }
            }

            if (!canAffordBuilders) {
                limits.builder = 0;
            }
        }

        if (roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
            const outposts = Memory.rooms[roomName].outposts;
            let remoteSources = 0;
            let neededReservers = 0;
            let neededRemoteBuilders = 0;
            
            for (let i = 0; i < outposts.length; i++) {
                const outpostName = outposts[i];
                const adjMem = Memory.rooms[outpostName];
                const outpostState = global.State?.rooms?.get(outpostName);
                
                const isSKRoom = adjMem && adjMem.roomType === 'sk';

                if (adjMem && adjMem.sources) {
                    if (isSKRoom) {
                        // 1 SKMiner per source, plus 1 SKGuard (Paladin) for the whole room
                        limits.skminer = (limits.skminer || 0) + adjMem.sources.length;
                        limits.skguard = (limits.skguard || 0) + 1;
                    } else {
                        remoteSources += adjMem.sources.length;
                    }
                }

                // Reserver Logic (Skip for SK rooms as they lack controllers to reserve)
                if (!isSKRoom && rcl >= 4 && adjMem && adjMem.controller && (!adjMem.controller.owner)) {
                    // Only reserve if reservation is low (< 1000) or missing
                    if (!adjMem.controller.reservation || adjMem.controller.reservation.ticksToEnd < 1500) {
                        neededReservers++;
                    }
                }

                // Remote Builder (Janitor) Logic
                if (outpostState && outpostState.constructionSiteCount > 0) {
                    neededRemoteBuilders += Math.min(2, Math.ceil(outpostState.constructionSiteCount / 5));
                }
            }
            if (remoteSources > 0) {
                limits.remoteharvester = remoteSources;
                limits.remotehauler = remoteSources;
            }
            if (neededReservers > 0) {
                limits.reserver = neededReservers;
            }
            if (neededRemoteBuilders > 0) {
                limits.remotebuilder = neededRemoteBuilders;
            }
        }

        // --- Dynamic Hauler Sizing & Dedication ---
        limits.haulerQueue = [];
        limits.remotehauler = 0;

        const colony = global.State?.colonies?.get(roomName);
        if (colony && colony.sources && colony.sources.length > 0) {
            for (let i = 0; i < colony.sources.length; i++) {
                const source = colony.sources[i];
                const distance = RouteDistanceCalculator.getDistance(source.id, source.pos, roomName);
                
                // Math: 10 energy/tick generation (regular) or ~13 (SK). Round trip = 2*distance.
                const isSKRoom = Memory.rooms[source.pos.roomName] && Memory.rooms[source.pos.roomName].roomType === 'sk';
                const energyPerTick = isSKRoom ? 13.33 : 10;
                
                const requiredCarry = Math.ceil(distance * 2 * energyPerTick / 50 * 1.2); // 20% pathing buffer
                
                // 150 energy buys [CARRY, CARRY, MOVE] which is 2 CARRY parts
                const requiredEnergy = Math.ceil(requiredCarry / 2) * 150;
                
                const cappedEnergy = Math.min(requiredEnergy, energyCapacity || 300);
                // Math.max(1) ensures we always spawn at least 1 hauler if energy is low
                const neededCount = Math.max(1, Math.ceil(requiredEnergy / cappedEnergy));
                
                const isRemote = source.pos.roomName !== roomName;
                let roleName = 'hauler';
                if (isRemote) {
                    roleName = isSKRoom ? 'skhauler' : 'remotehauler';
                }
                
                limits[roleName] = (limits[roleName] || 0) + neededCount;
                
                limits.haulerQueue.push({
                    role: roleName,
                    targetSource: source.id,
                    targetRoom: source.pos.roomName,
                    count: neededCount,
                    energy: cappedEnergy
                });
            }
        } else {
            limits.hauler = Math.max(limits.hauler, 2);
        }
        // ------------------------------------------

        if (Memory.empire && Memory.empire.colonizeRoom) {
            limits.claimer = 1;
        }

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
        
        let hasObserver = false;
        if (roomState && roomState.observers && roomState.observers.length > 0) {
            hasObserver = true;
        }
        limits.scout = (needsScout && !hasObserver) ? 1 : 0;

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
        
        // Expansion defense logic
        if (!hostilesFound && Memory.empire && Memory.empire.colonizeRoom && Memory.empire.colonizeSourceColony === roomName) {
            const expState = global.State?.rooms?.get(Memory.empire.colonizeRoom);
            if (expState && expState.hostiles && expState.hostileCount > 0) {
                hostilesFound = true;
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
                let preSpawnThreshold = 75;
                if (role === 'skguard' || role === 'skminer') preSpawnThreshold = 300;
                
                if (!c.spawning && c.ticksToLive !== undefined && c.ticksToLive < preSpawnThreshold) {
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
            const currentEnergy = spawn.room.energyAvailable;
            const body = currentEnergy >= 300 ? CreepBodyBuilder.getBody('harvester', currentEnergy) : EMERGENCY_BODY;
            this.executeSpawn(spawn, 'harvester', body);
            return;
        }
        if (harvesterCount >= 1 && haulerCount === 0 && (targetCensus['hauler'] || 0) > 0) {
            const currentEnergy = spawn.room.energyAvailable;
            const body = currentEnergy >= 300 ? CreepBodyBuilder.getBody('hauler', currentEnergy) : EMERGENCY_BODY;
            this.executeSpawn(spawn, 'hauler', body);
            return;
        }

        // Prevents economic stalling by ensuring early-game scouts yield the spawn queue to critical energy-generating roles.
        const spawnPriority = [
            'hubmanager', 'harvester', 'filler', 'hauler', 'bootstrapper', 'skguard', 'mineralhauler', 'fastfiller', 'defender', 'upgrader', 'builder',
            'mineralminer', 'claimer', 'pioneer', 'scout', 'scientist', 'skminer', 'skhauler', 'remoteharvester', 'remotehauler', 'reserver',
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