// src/colonies/SpawnManager.js
const { RouteDistanceCalculator } = require('../lib/SystemLib');
const EMERGENCY_BODY = [WORK, CARRY, MOVE];

class CreepBodyBuilder {
    static getBody(role, energyCapacity, extraArgs = {}) {
        energyCapacity = energyCapacity || 300;

        switch (role) {
            case 'filler': return this.generateFiller(energyCapacity);
            case 'fastfiller': return this.generateFastfiller(energyCapacity);
            case 'hauler': return this.generateHauler(energyCapacity);
            case 'upgrader': return this.generateUpgrader(energyCapacity);
            case 'builder': return this.generateBuilder(energyCapacity);
            case 'pioneer': return this.generatePioneer(energyCapacity);
            case 'bootstrapper': return [WORK, CARRY, MOVE];
            case 'harvester': return this.generateHarvester(energyCapacity);
            case 'remoteharvester': return this.generateRemoteHarvester(energyCapacity, extraArgs.isReserved);
            case 'remotehauler': return this.generateRemoteHauler(energyCapacity);
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
    
    static generateRemoteHarvester(energy, isReserved) {
        const workNeeded = isReserved ? 5 : 3;
        
        let work = workNeeded;
        let carry = 1;
        let move = Math.ceil(workNeeded / 2); // 1 MOVE per 2 WORK to maintain 1 tile/tick on roads
        
        let cost = (work * 100) + (carry * 50) + (move * 50);
        
        // Fallback for extreme low energy
        if (energy < cost) {
             work = Math.floor((energy - 100) / 100);
             if (work < 1) work = 1;
             move = Math.ceil(work / 2);
        }
        
        return this.buildArray(work, carry, move);
    }

    static generateHauler(energy) {
        // Core haulers follow the same math: 2 CARRY, 1 MOVE
        let carry = 0, move = 0;
        let cost = 0;
        
        if (energy < 150) {
            return this.buildArray(0, 1, 1);
        }
        
        while (cost + 150 <= energy && (carry + move + 3) <= 50) { 
            carry += 2; 
            move += 1; 
            cost += 150; 
        }
        return this.buildArray(0, carry, move);
    }

    static generateRemoteHauler(energy) {
        // Tigga Mathematical Hauler Builder: 2 CARRY, 1 MOVE blocks
        // Base cost per block: 150 energy. 1 WORK part strictly omitted to follow pure mathematical logic.
        let carry = 0, move = 0;
        let cost = 0;
        
        if (energy < 150) {
            return this.buildArray(0, 1, 1);
        }

        while (cost + 150 <= energy && (carry + move + 3) <= 50) { 
            carry += 2; 
            move += 1; 
            cost += 150; 
        }
        return this.buildArray(0, carry, move);
    }

    static generateFastfiller(energy) {
        // Fastfillers are static. Max CARRY, exactly 1 MOVE.
        // Needs to hold as much as possible to buffer transfers.
        let carry = Math.floor((energy - 50) / 50);
        if (carry > 30) carry = 30; // Max 1500 capacity is plenty
        if (carry < 1) carry = 1;
        return this.buildArray(0, carry, 1);
    }

    static generateFiller(energy) {
        let carry = Math.floor(energy / 100);
        if (carry > 25) carry = 25;
        if (carry < 1) carry = 1;
        return this.buildArray(0, carry, carry);
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
            
            let haulerBase = 1;
            if (roomState.coreContainers && roomState.coreContainerCount > 0) {
                for (let i = 0; i < roomState.coreContainerCount; i++) {
                    const c = roomState.coreContainers[i];
                    if (c && c.store.getUsedCapacity(RESOURCE_ENERGY) < 500) {
                        haulerBase++;
                    }
                }
            } else {
                if (roomState.controllerContainers && roomState.controllerContainers.length > 0) {
                    for (let i = 0; i < roomState.controllerContainers.length; i++) {
                        const c = roomState.controllerContainers[i];
                        if (c && c.store.getUsedCapacity(RESOURCE_ENERGY) < 500) {
                            haulerBase++;
                        }
                    }
                }
            }
            
            if (roomState.storage && roomState.terminal && roomState.linkCount > 0) {
                // If fully linked, we might not need haulers at all for sources
                haulerBase = 0;
            }
            
            // Add 1 hauler per 1500 loose energy, max 4
            let dynamicHaulers = Math.floor(looseEnergy / 1500);
            limits.hauler = Math.min(4, haulerBase + dynamicHaulers);

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

            if (roomState.storage && roomState.storage.my) {
                limits.filler = 1;
                if (roomState.extensionsCount && roomState.extensionsCount >= 5) {
                    limits.fastfiller = Math.min(4, Math.floor(roomState.extensionsCount / 5));
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

            // --- Tigga-Style Dynamic Energy Cascading ---
            // 1. Calculate Theoretical Max Income
            let totalIncome = roomState.sources ? roomState.sources.length * 10 : 0;
            if (Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
                const outposts = Memory.rooms[roomName].outposts;
                for (let i = 0; i < outposts.length; i++) {
                    const outpostName = outposts[i];
                    const adjMem = Memory.rooms[outpostName];
                    if (adjMem && adjMem.sources) {
                        const isSKRoom = adjMem.roomType === 'sk';
                        totalIncome += adjMem.sources.length * (isSKRoom ? 13.33 : 10);
                    }
                }
            }

            // 2. Fixed Overhead Extraction (Energy cost per tick of base roles)
            let fixedOverhead = 0;
            fixedOverhead += limits.harvester * (200 / 1500);
            fixedOverhead += limits.hauler * (300 / 1500);
            fixedOverhead += limits.filler * (300 / 1500);
            fixedOverhead += limits.fastfiller * (200 / 1500);
            // Military/Remote overhead is handled implicitly since they draw from outposts, but let's buffer 10%
            fixedOverhead += (totalIncome * 0.1); 

            let variableBudget = Math.max(0, totalIncome - fixedOverhead);

            // 3. Storage-Driven Scaling Multiplier
            let storageMultiplier = 1.0;
            if (roomState.storage && roomState.storage.my) {
                const storageEnergy = roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY);
                if (storageEnergy > 500000) storageMultiplier = 3.0;      // Explosive scaling
                else if (storageEnergy > 300000) storageMultiplier = 2.0; // Surplus
                else if (storageEnergy > 100000) storageMultiplier = 1.5; // Healthy
                else if (storageEnergy < 20000) storageMultiplier = 0.5;  // Starving
            } else {
                // Bootstrapping: Swarm if loose energy is everywhere
                if (looseEnergy > 2000) storageMultiplier = 2.0;
            }

            variableBudget *= storageMultiplier;

            // Average upgrader/builder costs ~5 energy/tick in usage (depends on WORK parts and RCL)
            const workerConsumptionRate = Math.min(10, rcl * 1.5); 

            // 4. Calculate Builders
            let neededBuilders = 0;
            let hasCriticalRepairs = false;
            for (let i = 0; i < roomState.rampartCount; i++) {
                if (roomState.ramparts[i].hits < 5000) { hasCriticalRepairs = true; break; }
            }
            if (!hasCriticalRepairs && roomState.repairTargetCount > 0) {
                for (let i = 0; i < roomState.repairTargetCount; i++) {
                    const target = roomState.repairTargets[i];
                    if ((target.structureType === STRUCTURE_WALL || target.structureType === STRUCTURE_RAMPART) && target.hits < 5000) {
                        hasCriticalRepairs = true; break;
                    }
                }
            }
            if (hasCriticalRepairs) neededBuilders = 1;
            else if (roomState.constructionSiteCount > 0) {
                neededBuilders = Math.min(3, Math.ceil(roomState.constructionSiteCount / 5));
            }

            // Route budget to builders first
            let affordableBuilders = Math.floor(variableBudget / workerConsumptionRate);
            limits.builder = Math.max(limits.builder || 0, Math.min(neededBuilders, affordableBuilders));

            variableBudget -= (limits.builder * workerConsumptionRate);

            // 5. Zero-Waste Upgraders (Remaining budget is dumped entirely into upgrading)
            let affordableUpgraders = Math.floor(Math.max(0, variableBudget) / workerConsumptionRate);
            limits.upgrader = Math.max(1, limits.upgrader || 0, affordableUpgraders); // Always 1 to prevent downgrade
        }

        if (roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
            const outposts = Memory.rooms[roomName].outposts;
            let neededRemoteHarvesters = 0;
            let neededReservers = 0;
            let neededRemoteBuilders = 0;
            let totalRemoteHaulerCarryNeeded = 0;
            let totalSKHaulerCarryNeeded = 0;
            
            limits.remoteHarvesterQueue = [];
            limits.reserverQueue = [];
            
            for (let i = 0; i < outposts.length; i++) {
                const outpostName = outposts[i];
                const adjMem = Memory.rooms[outpostName];
                const outpostState = global.State?.rooms?.get(outpostName);
                
                // Military Preemption
                let isContested = false;
                if (adjMem && adjMem.hostiles) {
                    if (adjMem.hostiles.creeps > 0 || adjMem.hostiles.towers > 0 || adjMem.hostiles.invaderCore) {
                        isContested = true;
                    }
                }
                
                // If contested, skip economic deployment entirely
                if (isContested) {
                    continue;
                }

                const isSKRoom = adjMem && adjMem.roomType === 'sk';

                if (adjMem && adjMem.sources) {
                    // Calculate Route Length
                    let distanceRooms = 1;
                    const route = Game.map.findRoute(roomName, outpostName);
                    if (route !== ERR_NO_PATH) {
                        distanceRooms = route.length;
                    }
                    const roundTripDistance = distanceRooms * 100;
                    
                    let isReserved = false;
                    if (adjMem.controller && adjMem.controller.reservation && (adjMem.controller.reservation.username === 'Bizarrelego' || adjMem.controller.reservation.username === 'Blake') && adjMem.controller.reservation.ticksToEnd > 0) {
                        isReserved = true;
                    }
                    
                    if (isSKRoom) {
                        limits.skminer = (limits.skminer || 0) + adjMem.sources.length;
                        limits.skguard = (limits.skguard || 0) + 1;
                        // SK rooms generate roughly 15 energy/tick including minerals
                        const carryNeeded = Math.ceil((roundTripDistance * 15) / 50) * adjMem.sources.length;
                        totalSKHaulerCarryNeeded += carryNeeded;
                    } else {
                        const energyPerTick = isReserved ? 10 : 5;
                        for (let j = 0; j < adjMem.sources.length; j++) {
                            neededRemoteHarvesters++;
                            limits.remoteHarvesterQueue.push({
                                role: 'remoteharvester',
                                targetRoom: outpostName,
                                targetSource: adjMem.sources[j].id,
                                isReserved: isReserved
                            });
                        }
                        const carryNeeded = Math.ceil((roundTripDistance * energyPerTick) / 50) * adjMem.sources.length;
                        totalRemoteHaulerCarryNeeded += carryNeeded;
                    }
                }

                // Reserver Logic (Skip for SK rooms as they lack controllers to reserve)
                if (!isSKRoom && rcl >= 3 && adjMem && adjMem.controller && (!adjMem.controller.owner)) {
                    // Only reserve if reservation is low (< 1000) or missing
                    if (!adjMem.controller.reservation || adjMem.controller.reservation.ticksToEnd < 1500) {
                        limits.reserverQueue.push({
                            role: 'reserver',
                            targetRoom: outpostName
                        });
                    }
                }

                // Remote Builder (Janitor) Logic
                if (outpostState && outpostState.constructionSiteCount > 0) {
                    neededRemoteBuilders += Math.min(2, Math.ceil(outpostState.constructionSiteCount / 5));
                }
            }
            
            if (neededRemoteHarvesters > 0) {
                limits.remoteharvester = neededRemoteHarvesters;
                
                // Calculate how many haulers we need based on max carry parts per hauler
                // generateRemoteHauler base cost is 250 (1 WORK, 1 CARRY, 2 MOVE). Each extra CARRY/MOVE pair is 100.
                let maxExtraCarry = Math.floor((energyCapacity - 250) / 100);
                if (maxExtraCarry < 0) maxExtraCarry = 0;
                let maxCarryPerHauler = 1 + maxExtraCarry;
                if (maxCarryPerHauler > 24) maxCarryPerHauler = 24; // 1W, 24C, 25M = 50 parts
                
                limits.remotehauler = Math.ceil(totalRemoteHaulerCarryNeeded / maxCarryPerHauler);
            }
            
            if (totalSKHaulerCarryNeeded > 0) {
                // generateSKHauler base cost is 100 (1 CARRY, 1 MOVE). Each extra 2 CARRY/1 MOVE is 150.
                let maxExtraPairs = Math.floor((energyCapacity - 100) / 150);
                if (maxExtraPairs < 0) maxExtraPairs = 0;
                let maxSKCarryPerHauler = 1 + (maxExtraPairs * 2);
                if (maxSKCarryPerHauler > 33) maxSKCarryPerHauler = 33; // 33 CARRY, 17 MOVE = 50 parts
                
                limits.skhauler = Math.ceil(totalSKHaulerCarryNeeded / maxSKCarryPerHauler);
            }
            
            limits.reserver = limits.reserverQueue.length;
            if (neededRemoteBuilders > 0) limits.remotebuilder = neededRemoteBuilders;
        }

        // --- Dynamic Hauler Sizing & Dedication ---
        limits.haulerQueue = [];
        limits.remotehauler = 0;

        const colony = global.State?.colonies?.get(roomName);
        if (colony && colony.sources && colony.sources.length > 0) {
            for (let i = 0; i < colony.sources.length; i++) {
                const source = colony.sources[i];
                const distance = RouteDistanceCalculator.getDistance(source.id, source.pos, roomName);
                
                // --- Tigga Mathematical Hauler Sizing ---
                // m = round trips before 1500-tick lifetime expires
                const m = Math.floor(750 / distance);
                
                // n = required capacity multiplier (each n = 100 carry capacity = 2 CARRY, 1 MOVE)
                const n = Math.ceil(distance / 5);
                
                // Base cost: each n costs 150 energy
                const requiredEnergy = n * 150;
                
                const cappedEnergy = Math.min(requiredEnergy, energyCapacity || 300);
                const neededCount = Math.max(1, Math.ceil(requiredEnergy / cappedEnergy));
                
                const isRemote = source.pos.roomName !== roomName;
                const isSKRoom = Memory.rooms[source.pos.roomName] && Memory.rooms[source.pos.roomName].roomType === 'sk';
                
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
            // Defensive scaling
            let defensiveThreat = 0;
            if (roomState && roomState.hostiles) {
                for (let i = 0; i < roomState.hostiles.length; i++) {
                    const body = roomState.hostiles[i].body;
                    if (body) {
                        for (let j = 0; j < body.length; j++) {
                            const type = body[j].type;
                            if (type === ATTACK) defensiveThreat += 30;
                            else if (type === RANGED_ATTACK) defensiveThreat += 10;
                            else if (type === HEAL) defensiveThreat += 12;
                        }
                    }
                }
            }
            const singleCreepCapacity = Math.max(150, Math.floor((energyCapacity || 300) / 130) * 30);
            const defensiveSquads = Math.max(1, Math.ceil((defensiveThreat * 1.5) / singleCreepCapacity));
            
            limits.meleeCreep = (limits.meleeCreep || 0) + defensiveSquads;
            limits.rangerCreep = (limits.rangerCreep || 0) + defensiveSquads;
            limits.medicCreep = (limits.medicCreep || 0) + defensiveSquads;
        }

        if (rcl >= 4 && hasOffensiveQueue) {
            const threatIndex = global.State.militaryQueue[0].threatIndex || 0;
            
            // Estimate single creep max DPS at current RCL energy capacity
            const singleCreepCapacity = Math.floor((energyCapacity || 300) / 130) * 30;
            // Add a 50% buffer to strictly exceed the threat
            const offensiveSquads = Math.max(1, Math.ceil((threatIndex * 1.5) / singleCreepCapacity));

            limits.meleeCreep = (limits.meleeCreep || 0) + offensiveSquads;
            limits.rangerCreep = (limits.rangerCreep || 0) + offensiveSquads;
            limits.medicCreep = (limits.medicCreep || 0) + offensiveSquads;
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

                // Fixes Generation Die-offs by dynamically calculating precisely when to spawn the replacement
                let spawnTime = c.body.length * 3;
                let travelTime = 15; // default local buffer
                if (c.memory.targetSource && Memory.sources && Memory.sources[c.memory.targetSource] && Memory.sources[c.memory.targetSource].distance) {
                    travelTime = Memory.sources[c.memory.targetSource].distance;
                } else if (c.memory.targetRoom) {
                    travelTime = 50;
                }
                let preSpawnThreshold = spawnTime + travelTime;
                
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
            const currentEnergy = Math.max(spawn.room.energyAvailable, 100); // Ensure at least 1 CARRY/MOVE can spawn
            const body = CreepBodyBuilder.getBody('hauler', currentEnergy);
            this.executeSpawn(spawn, 'hauler', body);
            return;
        }

        // Prevents economic stalling by mathematically ranking missing roles instead of using static arrays.
        let spawnRequests = [];
        
        const standardRoles = ['hubmanager', 'harvester', 'filler', 'bootstrapper', 'skguard', 'mineralhauler', 'fastfiller', 'defender', 'upgrader', 'builder', 'mineralminer', 'claimer', 'pioneer', 'scout', 'scientist', 'skminer', 'skhauler', 'meleeCreep', 'rangerCreep', 'medicCreep'];
        
        let hasCriticalRepairs = false;
        if (roomState.rampartCount > 0) {
            for (let i = 0; i < roomState.rampartCount; i++) {
                if (roomState.ramparts[i].hits < 5000) { hasCriticalRepairs = true; break; }
            }
        }
        if (!hasCriticalRepairs && roomState.repairTargetCount > 0) {
            for (let i = 0; i < roomState.repairTargetCount; i++) {
                const target = roomState.repairTargets[i];
                if ((target.structureType === STRUCTURE_WALL || target.structureType === STRUCTURE_RAMPART) && target.hits < 5000) {
                    hasCriticalRepairs = true; break;
                }
            }
        }

        const getScore = (role, current, req = null) => {
            if (role === 'bootstrapper') return 950;
            if (role === 'harvester') return current === 0 ? 900 : 800 - current * 10;
            if (role === 'hauler') return current === 0 ? 850 : 750 - current * 10;
            if (role === 'hubmanager') return current === 0 ? 880 : 600;
            if (role === 'fastfiller' || role === 'filler') {
                const energyRatio = spawn.room.energyCapacityAvailable > 0 ? spawn.room.energyAvailable / spawn.room.energyCapacityAvailable : 1;
                return 800 + (1 - energyRatio) * 100;
            }
            if (role === 'defender' || role === 'skguard') {
                if (roomState.hostiles && roomState.hostileCount > 0) return 1000;
                return 700;
            }
            if (role === 'meleeCreep' || role === 'rangerCreep' || role === 'medicCreep') return 650;
            if (role === 'remoteharvester') {
                let distance = (Memory.sources && req && req.targetSource && Memory.sources[req.targetSource]) ? Memory.sources[req.targetSource].distance : 50;
                return 500 - distance;
            }
            if (role === 'remotehauler') {
                let distance = (Memory.sources && req && req.targetSource && Memory.sources[req.targetSource]) ? Memory.sources[req.targetSource].distance : 50;
                let bonus = 0;
                if (req && req.targetRoom) {
                    const targetState = global.State?.rooms?.get(req.targetRoom);
                    if (targetState && targetState.droppedEnergy) {
                        for(let i=0; i<targetState.droppedEnergyCount; i++) {
                            if (targetState.droppedEnergy[i] && targetState.droppedEnergy[i].amount > 500) bonus += 50;
                        }
                    }
                }
                return 450 - distance + bonus;
            }
            if (role === 'reserver') return 400;
            if (role === 'upgrader' || role === 'builder') {
                if (role === 'builder' && hasCriticalRepairs && harvesterCount >= 1 && haulerCount >= 1) return 800;
                return 300 - current * 5;
            }
            if (role === 'scout') return 200;
            return 100;
        };

        // 1. Gather Standard Roles
        for (let i = 0; i < standardRoles.length; i++) {
            const role = standardRoles[i];
            const limit = targetCensus[role] || 0;
            const current = getCount(role);
            if (current < limit) {
                spawnRequests.push({ role, score: getScore(role, current), isQueue: false });
            }
        }

        // 2. Gather Queue Roles
        const queues = [
            { array: targetCensus.haulerQueue, roleCheck: ['hauler', 'remotehauler'] },
            { array: targetCensus.remoteHarvesterQueue, roleCheck: ['remoteharvester'] },
            { array: targetCensus.reserverQueue, roleCheck: ['reserver'] }
        ];
        
        for (let q = 0; q < queues.length; q++) {
            const qData = queues[q];
            if (!qData.array) continue;
            for (let j = 0; j < qData.array.length; j++) {
                const req = qData.array[j];
                if (!qData.roleCheck.includes(req.role)) continue;
                
                let activeCount = 0;
                for (let k = 0; k < roomState.creeps.length; k++) {
                    const c = roomState.creeps[k];
                    if (c.memory.role === req.role) {
                        let match = false;
                        if (req.role === 'reserver' && c.memory.targetRoom === req.targetRoom) match = true;
                        else if (req.role !== 'reserver' && c.memory.targetSource === req.targetSource) match = true;

                        if (match) {
                            let spawnTime = c.body.length * 3;
                            let travelTime = 50;
                            if (req.role !== 'reserver' && Memory.sources && Memory.sources[req.targetSource] && Memory.sources[req.targetSource].distance) {
                                travelTime = Memory.sources[req.targetSource].distance;
                            } else if (req.role === 'reserver') {
                                const route = Game.map.findRoute(spawn.room.name, req.targetRoom);
                                if (route !== ERR_NO_PATH) travelTime = route.length * 50;
                            }
                            let preSpawnThreshold = spawnTime + travelTime;
                            if (c.spawning || c.ticksToLive >= preSpawnThreshold) {
                                activeCount++;
                            }
                        }
                    }
                }
                
                const targetLimit = (req.role === 'remoteharvester' || req.role === 'reserver') ? 1 : req.count;
                if (activeCount < targetLimit) {
                    spawnRequests.push({ role: req.role, score: getScore(req.role, activeCount, req), isQueue: true, req });
                }
            }
        }

        spawnRequests.sort((a, b) => b.score - a.score);

        for (let i = 0; i < spawnRequests.length; i++) {
            const request = spawnRequests[i];
            const role = request.role;

            // Prevents economic cannibalism by completely halting all energy sinks (upgraders/builders) until the energy-gathering workforce is at 100% capacity.
            if (role === 'builder' || role === 'upgrader' || role === 'scout') {
                if (role === 'builder' && hasCriticalRepairs) {
                    // Bypass
                } else if (harvesterCount < (targetCensus['harvester'] || 0) || haulerCount < (targetCensus['hauler'] || 0)) {
                    continue;
                }
            }

            if (request.isQueue) {
                const req = request.req;
                let body;
                let extraMem = { targetSource: req.targetSource, targetRoom: req.targetRoom };
                
                if (role === 'remoteharvester') {
                    body = CreepBodyBuilder.getBody(role, energyCapacity, { targetRoom: req.targetRoom, isReserved: req.isReserved });
                } else if (role === 'reserver') {
                    body = CreepBodyBuilder.getBody(role, energyCapacity);
                } else {
                    body = CreepBodyBuilder.getBody(role, req.energy);
                }
                
                if (!body || body.length === 0) continue;
                
                let cost = 0;
                for (let j = 0; j < body.length; j++) cost += BODYPART_COST[body[j]];
                
                if (spawn.room.energyAvailable >= cost) {
                    this.executeSpawn(spawn, role, body, extraMem);
                    return;
                } else {
                    if ((role === 'hauler' || role === 'remotehauler' || role === 'remoteharvester' || role === 'harvester' || role === 'skhauler' || role === 'skminer') && spawn.room.energyAvailable >= 300) {
                        let scaledBody;
                        if (role === 'remoteharvester') {
                            scaledBody = CreepBodyBuilder.getBody(role, spawn.room.energyAvailable, { targetRoom: req.targetRoom, isReserved: req.isReserved });
                        } else {
                            scaledBody = CreepBodyBuilder.getBody(role, spawn.room.energyAvailable);
                        }
                        if (scaledBody && scaledBody.length > 0) {
                            let scaledCost = 0;
                            for (let j = 0; j < scaledBody.length; j++) scaledCost += BODYPART_COST[scaledBody[j]];
                            if (spawn.room.energyAvailable >= scaledCost) {
                                this.executeSpawn(spawn, role, scaledBody, extraMem);
                                return;
                            }
                        }
                    }
                    return;
                }
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
                    if ((role === 'hauler' || role === 'harvester') && spawn.room.energyAvailable >= 300) {
                        const scaledBody = CreepBodyBuilder.getBody(role, spawn.room.energyAvailable);
                        if (scaledBody && scaledBody.length > 0) {
                            let scaledCost = 0;
                            for (let j = 0; j < scaledBody.length; j++) scaledCost += BODYPART_COST[scaledBody[j]];
                            if (spawn.room.energyAvailable >= scaledCost) {
                                this.executeSpawn(spawn, role, scaledBody);
                                return;
                            }
                        }
                    }
                    // Strict abort: Do not skip to lower priority roles if we are missing a higher priority one but just lack energy.
                    return;
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