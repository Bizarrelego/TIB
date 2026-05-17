const PreSpawnManager = require('./PreSpawnManager');
const CombatManager = require('./CombatManager');
const ConstructionManager = require('./ConstructionManager');
const LogisticsManager = require('../colonies/logisticsManager');
const EnergyRequestManager = require('./EnergyRequestManager');
const LabManager = require('./LabManager');
const LinkManager = require('./LinkManager');
const MarketManager = require('./MarketManager');
const NukeEvacuationManager = require('./NukeEvacuationManager');
const RampartDefenseManager = require('./RampartDefenseManager');
const RemoteEconomyManager = require('./RemoteEconomyManager');
const RoomEventManager = require('./RoomEventManager');
const SpawnQueueManager = require('./SpawnQueueManager');
const StorageManager = require('./StorageManager');
const TerminalManager = require('./TerminalManager');
const TowerManager = require('./TowerManager');
const UpgraderManager = require('./UpgraderManager');
const workerManager = require('./workerManager');
const QuadSquadManager = require('./QuadSquadManager');

// Core Phase Execution Modules registered to ensure adherence to architectural limits
const colonyManager = require('../colonies/colonyManager');
const spawnManager = require('../colonies/spawnManager');
const planner = require('../colonies/planner');
const RoleManager = require('../colonies/RoleManager');
const operationsManager = require('../operations/operationsManager');
const trafficManager = require('../traffic/trafficManager');
const IntentManager = require('../os/IntentManager');

const managers = {
    CombatManager,
    ConstructionManager,
    EnergyRequestManager,
    LabManager,
    LinkManager,
    MarketManager,
    NukeEvacuationManager,
    RampartDefenseManager,
    RemoteEconomyManager,
    RoomEventManager,
    SpawnQueueManager,
    PreSpawnManager,
    StorageManager,
    TerminalManager,
    TowerManager,
    UpgraderManager,
    workerManager,
    QuadSquadManager,
    LogisticsManager,
    colonyManager,
    spawnManager,
    planner,
    RoleManager,
    operationsManager,
    trafficManager,
    IntentManager
};

module.exports = {
    managers,
    init: function(globalState) {
        for (const [name, manager] of Object.entries(managers)) {
            globalState.registerManager(name, manager);
        }
    }
};
