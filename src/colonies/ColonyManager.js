const SpawnManager = require('./SpawnManager');
const TaskAssignmentManager = require('../managers/TaskAssignmentManager');

class ColonyManager {
    static run() {
        SpawnManager.run();
        TaskAssignmentManager.run();
    }
}

module.exports = ColonyManager;
