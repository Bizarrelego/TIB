const PreSpawnManager = require('./PreSpawnManager');
const CombatManager = require('./CombatManager');
const ConstructionManager = require('./ConstructionManager');
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
const EnergySourceTracker = require('./EnergySourceTracker');
const SegmentManager = require('./SegmentManager');
const { wrap } = require('../utils/ManagerExecutionWrapper');
const { wrapManager } = require('../utils/ManagerErrorBoundary');
const Profiler = require('../utils/profiler');

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
    BoostManager,
    VisualsManager,
    PowerSpawnManager,
    AllianceIntelManager,
    SourceManager,
    MineralManager,
    CreepOperationalDataManager,
    EnergySourceTracker,
    SegmentManager
};

module.exports = {
    managers,
    init: function(globalState) {
        for (const [name, manager] of Object.entries(managers)) {
            // Ensure each manager's run function is wrapped with error boundaries and profiler
            if (manager && typeof manager.run === 'function' && !manager.__wrapped) {
                const originalRun = manager.run;
                // Double wrap: error boundary first, then profiler wrapper
                manager.run = Profiler.wrap(name, wrapManager((...args) => originalRun.apply(manager, args), name));
                manager.__wrapped = true;
            }
            if (globalState && typeof globalState.registerManager === 'function') {
                globalState.registerManager(name, manager);
            }
        }
    },
    run: function(managerName, ...args) {
        // Method to execute per-tick logic for a specific manager
        if (managers[managerName] && typeof managers[managerName].run === 'function') {
            return managers[managerName].run(...args);
        }
    }
};
