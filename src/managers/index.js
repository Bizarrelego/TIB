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
    StorageManager,
    TerminalManager,
    TowerManager,
    UpgraderManager,
    workerManager,
    QuadSquadManager
};

module.exports = {
    init: function(globalState) {
        for (const [name, manager] of Object.entries(managers)) {
            globalState.registerManager(name, manager);
        }
    }
};
