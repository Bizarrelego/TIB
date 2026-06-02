const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const SpawnManager = require('./colonies/SpawnManager');
const GlobalStateScanner = require('./state/GlobalStateScanner');
const MemoryCleanupManager = require('./managers/MemoryCleanupManager');
const IntelManager = require('./managers/IntelManager');

const RoleExecutor = require('./managers/RoleExecutor');

module.exports.loop = function () {
    // 1. Initialize transient tick cache
    global.tickCache = new Map();

    // 2. Scan state and populate global.State (GlobalStateScanner.run() must be at the very beginning)
    GlobalStateScanner.run();

    IntelManager.run();

    const stateObj = global.State || global.state;

    // 3. Spawning (The Heart) - SpawnManager.run() is called after GlobalStateScanner
    if (stateObj && stateObj.rooms) {
        for (const [roomName, roomState] of stateObj.rooms.entries()) {
            SpawnManager.run(roomName);
        }
    }

    // 4. Task Assignment (The Brain) - TaskAssignmentManager.run() is called after SpawnManager
    TaskAssignmentManager.run();

    // 5. Execute Muscle (Creep Roles) - RoleExecutor.run() is called after TaskAssignmentManager
    Object.values(Game.creeps).forEach(creep => {
        if (creep.spawning) return;
        if (creep.fatigue > 0) return;

        // Revert to standard object per latest strict PR requirement
        if (!creep.heap || creep.heap instanceof Map || typeof creep.heap !== 'object') {
            creep.heap = { state: 'idle', targetId: null, actionIntent: null };
        }

        RoleExecutor.run(creep);
    });

    // 6. Clear stale memory for dead creeps - MemoryCleanupManager.run() is called at the end of each tick
    MemoryCleanupManager.run();
};
