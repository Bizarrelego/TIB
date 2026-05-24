const { wrapManager } = require('../utils/ManagerErrorBoundary');
const StorageManager = require('../managers/StorageManager');
const SpawnQueueManager = require('../managers/SpawnQueueManager');
const HarassmentManager = require('../operations/HarassmentManager');

/**
 * @file RCL4HubManager.js
 * @description Manages RCL 4 specific behaviors: centralizing economy to Storage, maximizing remote source yields (reservers), and poaching operations.
 */

/**
 * Runs the RCL 4 Hub Manager logic for a given room.
 * @param {Room} room - The room to process.
 */
function run(room) {
    if (!room.controller || !room.controller.my || room.controller.level !== 4) return;

    try {
        // Ensure Storage is constructed
        StorageManager.run(room);

        // Route Energy to Storage / End primary room drop-mining
        if (room.memory.dropMining !== false) {
            room.memory.dropMining = false;
        }

        // Deploy reservers to remote mining rooms to increase source capacity
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        const reservers = roomCreeps ? (roomCreeps.get('reserver') || []) : [];
        const exits = Game.map.describeExits(room.name);

        if (exits) {
            for (const direction in exits) {
                const targetRoomName = exits[direction];

                // Determine if we need a reserver for this room
                // Check if we already have one
                let hasReserver = false;
                for (let i = 0; i < reservers.length; i++) {
                    if (reservers[i].memory.targetRoom === targetRoomName) {
                        hasReserver = true;
                        break;
                    }
                }

                if (!hasReserver && SpawnQueueManager.getQueuedCount(room.name, 'reserver', targetRoomName) === 0) {
                    // Cost for CLAIM (600) + MOVE (50) = 650. RCL 4 max energy is 1300. We can do 2xCLAIM 2xMOVE for 1300.
                    const cost = room.energyCapacityAvailable >= 1300 ? 1300 : 650;
                    const body = room.energyCapacityAvailable >= 1300 ? [CLAIM, CLAIM, MOVE, MOVE] : [CLAIM, MOVE];

                    if (room.energyCapacityAvailable >= cost) {
                        SpawnQueueManager.requestSpawn(room.name, 'reserver', body, 'reserver_' + Game.time, {
                            memory: { role: 'reserver', colony: room.name, targetRoom: targetRoomName, claimFlag: false }
                        }, cost);
                    }
                }
            }
        }

        // Coordinate fast attack squads and reroute remote haulers to steal dropped energy
        // HarassmentManager naturally processes all rooms to find loot and deploy squads.
        if (typeof HarassmentManager === 'function') {
            HarassmentManager();
        } else if (HarassmentManager && typeof HarassmentManager.run === 'function') {
            HarassmentManager.run();
        }

    } catch (e) {
        console.log(`[RCL4HubManager Error] Room ${room.name}: ${e.stack}`);
    }
}

module.exports = {
    run: wrapManager(run, 'RCL4HubManager')
};
