const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const SpawnManager = require('./managers/SpawnManager');
const GlobalStateScanner = require('./state/GlobalStateScanner');
const MemoryCleanupManager = require('./managers/MemoryCleanupManager');

const harvesterRole = require('./roles/harvester');
const haulerRole = require('./roles/hauler');
const upgraderRole = require('./roles/upgrader');

module.exports.loop = function () {
    // 1. Initialize transient tick cache
    global.tickCache = new Map();

    // 2. Clear stale memory for dead creeps
    MemoryCleanupManager.run();

    // 3. Scan state and populate global.State
    GlobalStateScanner.run();

    const stateObj = global.State || global.state;

    // 4. Brain and Heart logic for each room
    if (stateObj && stateObj.rooms) {
        for (const [roomName, roomState] of stateObj.rooms.entries()) {
            // Task Assignment (The Brain)
            TaskAssignmentManager.run(roomName);

            // Spawning (The Heart)
            SpawnManager.run(roomName);
        }
    }

    // 5. Execute Muscle (Creep Roles)
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];

        // Fatigue check in roles, but skip spawning entirely here
        if (creep.spawning) continue;

        // Revert to standard object per latest strict PR requirement
        if (!creep.heap || creep.heap instanceof Map || typeof creep.heap !== 'object') {
            creep.heap = { state: 'idle', targetId: null, actionIntent: null };
        }

        const role = creep.memory.role;
        if (role === 'harvester') {
            harvesterRole.run(creep);
        } else if (role === 'hauler') {
            haulerRole.run(creep);
        } else if (role === 'upgrader') {
            upgraderRole.run(creep);
        }
    }
};
