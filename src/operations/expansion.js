/**
 * @file expansion.js
 * @description Manages expansion operations including early poaching, remote denial, and auto-claim.
 */

function runEarlyPoaching() {
    // Scaffold: Logic to target weak neighbors and kill remote harvesters
    // Collect dropped energy to boost early game economy.
    // Uses global.State.intel to find neighbors with hostiles/structures but low threat
}

function runRemoteDenial() {
    // Scaffold: Deploy 150-energy decoy creeps to park on enemy construction sites
    // Designed to block builds and kite defenders to drain CPU
    // Uses global.State.intel to track enemy construction activities
}

function runAutoClaim() {
    // Scaffold: GCL check and pathing to ideal target room
    if (!global.State || !global.State.intel) return;

    // Check GCL against owned rooms
    let ownedRooms = 0;
    const myRooms = [];
    for (const roomName in Game.rooms) {
        if (Game.rooms[roomName].controller && Game.rooms[roomName].controller.my) {
            ownedRooms++;
            myRooms.push(roomName);
        }
    }

    if (Game.gcl.level <= ownedRooms) {
        return; // No GCL available to claim
    }

    let bestTarget = null;
    let bestScore = -Infinity;

    for (const [roomName, intel] of global.State.intel.entries()) {
        if (!intel.hostile && !intel.owner && !intel.reservation && intel.expansionScore > 0) {

            // Basic range check: needs to be near an owned room
            let inRange = false;
            for (const myRoom of myRooms) {
                // Rough linear distance
                const distance = Game.map.getRoomLinearDistance(myRoom, roomName);
                if (distance > 0 && distance <= 3) {
                    inRange = true;
                    break;
                }
            }

            if (inRange && intel.expansionScore > bestScore) {
                bestScore = intel.expansionScore;
                bestTarget = roomName;
            }
        }
    }

    if (bestTarget) {
        global.State.expansionTargetRoom = bestTarget;
        if (!Memory.expansionTargetRoom || Memory.expansionTargetRoom !== bestTarget) {
            Memory.expansionTargetRoom = bestTarget;
            console.log(`[ExpansionManager] Selected new expansion target: ${bestTarget} with score ${bestScore}`);
        }
    }
}

module.exports = function expansionManager() {
    try {
        if (Game.time % 100 === 0) {
            runEarlyPoaching();
            runRemoteDenial();
            runAutoClaim();
        }
    } catch (e) {
        console.error(`[ExpansionManager Error] ${e.stack}`);
    }
};
