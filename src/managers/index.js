const CombatManager = require('./CombatManager');
const QuadSquadManager = require('./QuadSquadManager');
const ConstructionManager = require('./ConstructionManager');
const EnergyRequestManager = require('./EnergyRequestManager');
const LabManager = require('./LabManager');
const LinkManager = require('./LinkManager');
const MarketManager = require('./MarketManager');
const NukeEvacuationManager = require('./NukeEvacuationManager');
const RemoteEconomyManager = require('./RemoteEconomyManager');
const RoomEventManager = require('./RoomEventManager');
const SpawnQueueManager = require('./SpawnQueueManager');
const StorageManager = require('./StorageManager');
const TerminalManager = require('./TerminalManager');
const TowerManager = require('./TowerManager');
const UpgraderManager = require('./UpgraderManager');
const workerManager = require('./workerManager');

const managers = {
    CombatManager,
    QuadSquadManager,
    ConstructionManager,
    EnergyRequestManager,
    LabManager,
    LinkManager,
    MarketManager,
    NukeEvacuationManager,
    RemoteEconomyManager,
    RoomEventManager,
    SpawnQueueManager,
    StorageManager,
    TerminalManager,
    TowerManager,
    UpgraderManager,
    workerManager
};

module.exports = {
    init: function(globalState) {
        for (const [name, manager] of Object.entries(managers)) {
            globalState.registerManager(name, manager);
        }
    }
};
