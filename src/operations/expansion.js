const Profiler = require('../utils/profiler');
/**
 * @file expansion.js
 * @description Manages expansion operations including early poaching, remote denial, and auto-claim.
 */

const SpawnQueueManager = require('../managers/SpawnQueueManager');

/**
 * Runs early poaching operations to kill remote harvesters and steal energy from weak neighbors.
 * @returns {void}
 */
function runEarlyPoaching() {
    if (!global.State || !global.State.intel) return;

    // Logic to target weak neighbors and kill remote harvesters
    // Collect dropped energy to boost early game economy.
    // For now, look for unseen/unowned rooms with energy
    for (const [roomName, room] of Object.entries(Game.rooms)) {
        if (!room.controller || !room.controller.my) continue;

        if (room.energyCapacityAvailable < 400) continue; // Basic gating

        const exits = Game.map.describeExits(roomName);
        if (!exits) continue;

        for (const dir in exits) {
            const neighborRoom = exits[dir];
            const intel = global.State.intel.get(neighborRoom);
            if (intel && !intel.hostile && intel.type === 'regular' && intel.owner === null) {
                // Check if we already have poachers
                let poachers = 0;
                for (const creeps of global.State.creepsByRoom.values()) {
                    const rHarvs = creeps.get('remoteHarvester') || [];
                    for (const c of rHarvs) {
                        if (c.memory.colony === roomName && c.memory.poaching === true && c.memory.targetRoom === neighborRoom) poachers++;
                    }
                }

                if (poachers < 1) {
                    const body = [WORK, CARRY, MOVE, MOVE];
                    const cost = 200;
                    SpawnQueueManager.requestSpawn(roomName, 'remoteHarvester', body, 'poacher_' + Game.time, {
                        memory: { role: 'remoteHarvester', colony: roomName, targetRoom: neighborRoom, poaching: true, targetSourceId: null }
                    }, cost);

                    const haulerBody = [CARRY, CARRY, MOVE, MOVE];
                    SpawnQueueManager.requestSpawn(roomName, 'remoteHauler', haulerBody, 'poachHauler_' + Game.time, {
                        memory: { role: 'remoteHauler', colony: roomName, remoteRoom: neighborRoom, homeRoom: roomName, containerId: null }
                    }, 200);
                }
            }
        }
    }
}

/**
 * Executes remote denial by deploying 1MOVE decoys onto enemy construction sites.
 * Designed to block building and kite defenders to drain CPU.
 * @returns {void}
 */
function runRemoteDenial() {
    // Scaffold: Deploy 150-energy decoy creeps to park on enemy construction sites
    // Designed to block builds and kite defenders to drain CPU
    if (!global.State || !global.State.intel) return;

    let targetRoom = null;
    for (const [rName, intel] of global.State.intel.entries()) {
        if (intel.hostile && intel.type === 'regular') {
            const roomSites = global.State.sitesByRoom.get(rName) || [];
            if (roomSites.length > 0) {
                targetRoom = rName;
                break;
            }
        }
    }

    if (targetRoom) {
        // Find a room to spawn the decoy
        for (const roomName of Object.keys(Game.rooms)) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my && room.energyCapacityAvailable >= 50) {
                let decoys = 0;
                for (const creeps of global.State.creepsByRoom.values()) {
                    const roomDecoys = creeps.get('decoy') || [];
                    for (const c of roomDecoys) {
                        if (c.memory.targetRoom === targetRoom) decoys++;
                    }
                }

                if (decoys < 1) {
                    SpawnQueueManager.requestSpawn(roomName, 'decoy', [MOVE], 'decoy_' + Game.time, {
                        memory: { role: 'decoy', colony: roomName, targetRoom: targetRoom }
                    }, 50);
                    break;
                }
            }
        }
    }
}

/**
 * Evaluates intel and automatically launches claim operations based on GCL and room expansion scores.
 * @returns {void}
 */
function runAutoClaim() {
    // Auto-claim operations launch around RCL 8 usually, but we check GCL
    if (!global.State || !global.State.intel) return;

    const myRooms = Object.values(Game.rooms).filter(r => r.controller && r.controller.my);
    if (myRooms.length >= Game.gcl.level) return; // Cannot claim

    let bestTarget = null;
    let highestScore = -1;

    for (const [rName, intel] of global.State.intel.entries()) {
        if (!intel.hostile && intel.type === 'regular' && intel.expansionScore > highestScore && intel.owner === null) {
            highestScore = intel.expansionScore;
            bestTarget = rName;
        }
    }

    if (bestTarget) {
        // Find closest my room
        let closestRoom = myRooms[0];
        let minRoute = Infinity;

        for (const room of myRooms) {
            if (room.energyCapacityAvailable < 650) continue; // Need CLAIM+MOVE

            const route = Game.map.findRoute(room.name, bestTarget);
            if (route !== ERR_NO_PATH && route.length < minRoute) {
                minRoute = route.length;
                closestRoom = room;
            }
        }

        if (closestRoom && minRoute < Infinity) {
            let reservers = 0;
            for (const creeps of global.State.creepsByRoom.values()) {
                const roomReservers = creeps.get('reserver') || [];
                for (const c of roomReservers) {
                    if (c.memory.targetRoom === bestTarget && c.memory.claimFlag) reservers++;
                }
            }

            if (reservers < 1) {
                const body = closestRoom.energyCapacityAvailable >= 1300 ? [CLAIM, CLAIM, MOVE, MOVE] : [CLAIM, MOVE];
                const cost = closestRoom.energyCapacityAvailable >= 1300 ? 1300 : 650;

                SpawnQueueManager.requestSpawn(closestRoom.name, 'reserver', body, 'claimer_' + Game.time, {
                    memory: { role: 'reserver', colony: closestRoom.name, targetRoom: bestTarget, claimFlag: true }
                }, cost);
            }
        }
    }
}

/**
 * Main expansion loop to evaluate room targets and deploy auto-claimers.
 * @returns {void}
 */
module.exports = Profiler.wrap('expansionManager', function expansionManager() {
    try {
        if (Game.time % 100 === 0) {
            runEarlyPoaching();
            runRemoteDenial();
            runAutoClaim();
        }
    } catch (e) {
        console.error(`[ExpansionManager Error] ${e.stack}`);
    }
});
