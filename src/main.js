const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const SpawnManager = require('./colonies/SpawnManager');
const GlobalStateScanner = require('./state/GlobalStateScanner');
const MemoryCleanupManager = require('./managers/MemoryCleanupManager');
const IntelManager = require('./managers/IntelManager');

const RoleExecutor = require('./managers/RoleExecutor');

module.exports.loop = function () {
    // 1. Initialize transient tick cache
    global.tickCache = new Map();

    // 2. Clear stale memory for dead creeps
    MemoryCleanupManager.run();

    // 3. Scan state and populate global.State
    GlobalStateScanner.run();

    IntelManager.run();

    const stateObj = global.State || global.state;

    // 4. Heart and Brain logic for each room
    if (stateObj && stateObj.rooms) {
        for (const [roomName, roomState] of stateObj.rooms.entries()) {
            // Spawning (The Heart)
            SpawnManager.run(roomName);

            // Task Assignment (The Brain)
            TaskAssignmentManager.run(roomName);
        }
    }

    // 5. Execute Muscle (Creep Roles)
    Object.values(Game.creeps).forEach(creep => {
        if (creep.spawning) return;
        if (creep.fatigue > 0) return;

        // Revert to standard object per latest strict PR requirement
        if (!creep.heap || creep.heap instanceof Map || typeof creep.heap !== 'object') {
            creep.heap = { state: 'idle', targetId: null, actionIntent: null };
        }

        RoleExecutor.run(creep);
    });
};
