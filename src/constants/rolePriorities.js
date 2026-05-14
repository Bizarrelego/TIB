const ROLE_PRIORITIES = new Map([
    ['emergencyBuilder', 115],
    ['reserver', 110],
    ['rampartMelee', 105],
    ['harvester', 100],
    ['remoteHarvester', 95],
    ['hauler', 90],
    ['remoteHauler', 85],
    ['fastFiller', 80],
    ['hubManager', 70],
    ['upgrader', 60],
    ['scout', 50],
    ['worker', 40],
    ['domesticHauler', 30],
    ['default', 0]
]);

module.exports = ROLE_PRIORITIES;
