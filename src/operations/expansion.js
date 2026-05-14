const Profiler = require('../utils/profiler');
/**
 * @file expansion.js
 * @description Manages expansion operations including early poaching, remote denial, and auto-claim.
 */

const SpawnQueueManager = require('../managers/SpawnQueueManager');

function getAdjacentRooms(roomName) {
    const coords = roomName.match(/([WE])([0-9]+)([NS])([0-9]+)/);
    let hDir = coords[1];
    let x = parseInt(coords[2], 10);
    let vDir = coords[3];
    let y = parseInt(coords[4], 10);
    const neighbors = [];

    const getNextCoord = (dir, val, delta) => {
        let newVal = val + delta;
        if (newVal < 0) {
            newVal = Math.abs(newVal) - 1;
            dir = dir === 'W' ? 'E' : (dir === 'E' ? 'W' : (dir === 'N' ? 'S' : 'N'));
        }
        return dir + newVal;
    };

    neighbors.push(getNextCoord(hDir, x, 0) + getNextCoord(vDir, y, -1));
    neighbors.push(getNextCoord(hDir, x, 1) + getNextCoord(vDir, y, 0));
    neighbors.push(getNextCoord(hDir, x, 0) + getNextCoord(vDir, y, 1));
    neighbors.push(getNextCoord(hDir, x, -1) + getNextCoord(vDir, y, 0));

    return neighbors;
}

function getRoomDistance(room1, room2) {
    const c1 = room1.match(/([WE])([0-9]+)([NS])([0-9]+)/);
    const c2 = room2.match(/([WE])([0-9]+)([NS])([0-9]+)/);

    const x1 = c1[1] === 'W' ? -parseInt(c1[2], 10) : parseInt(c1[2], 10) + 1;
    const y1 = c1[3] === 'N' ? -parseInt(c1[4], 10) : parseInt(c1[4], 10) + 1;
    const x2 = c2[1] === 'W' ? -parseInt(c2[2], 10) : parseInt(c2[2], 10) + 1;
    const y2 = c2[3] === 'N' ? -parseInt(c2[4], 10) : parseInt(c2[4], 10) + 1;

    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

/**
 * Runs early poaching operations to kill remote harvesters and steal energy from weak neighbors.
 * @returns {void}
 */
function runEarlyPoaching() {
    if (!global.State || !global.State.intel) return;

    // Logic to target weak neighbors and kill remote harvesters
    // Collect dropped energy to boost early game economy.
    // For now, look for unseen/unowned rooms with energy
    for (const [roomName, controller] of global.State.controllersByRoom.entries()) {
        if (!controller || !controller.my) continue;

        const room = controller.room;
        if (room.energyCapacityAvailable < 400) continue; // Basic gating

        const neighbors = getAdjacentRooms(roomName);
        for (let i = 0; i < neighbors.length; i++) {
            const neighborRoom = neighbors[i];
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
        for (const [roomName, controller] of global.State.controllersByRoom.entries()) {
            const room = controller.room;
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

    const myRooms = [];
    if (global.State.controllersByRoom) {
        for (const controller of global.State.controllersByRoom.values()) {
            if (controller && controller.my && controller.room) {
                myRooms.push(controller.room);
            }
        }
    }
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

            const dist = getRoomDistance(room.name, bestTarget);
            if (dist < minRoute) {
                minRoute = dist;
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
