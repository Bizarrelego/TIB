const PreSpawnManager = require('./PreSpawnManager');
const CombatManager = require('./CombatManager');
const ConstructionManager = require('./ConstructionManager');
const CreepAssignmentManager = require('./CreepAssignmentManager');
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
const BoostManager = require('./BoostManager');
const VisualsManager = require('./VisualsManager');
const PowerSpawnManager = require('./PowerSpawnManager');
const AllianceIntelManager = require('./AllianceIntelManager');
const SourceManager = require('./SourceManager');
const MineralManager = require('./MineralManager');
const CreepOperationalDataManager = require('./CreepOperationalDataManager');
const { wrap } = require('../utils/ManagerExecutionWrapper');

const managers = {
    CombatManager,
    ConstructionManager,
    CreepAssignmentManager,
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
    BoostManager,
    VisualsManager,
    PowerSpawnManager,
    AllianceIntelManager,
    SourceManager,
    MineralManager,
    CreepOperationalDataManager
};

module.exports = {
    managers,
    init: function(globalState) {
        for (const [name, manager] of Object.entries(managers)) {
            // Ensure each manager's run function is wrapped with error boundaries and profiler
            if (manager && typeof manager.run === 'function' && !manager.__wrapped) {
                const originalRun = manager.run;
                manager.run = wrap(name, (...args) => originalRun.apply(manager, args));
                manager.__wrapped = true;
            }
            globalState.registerManager(name, manager);
        }
    }
};
