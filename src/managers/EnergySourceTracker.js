const EnergyRequestManager = require('./EnergyRequestManager');

class EnergySourceTracker {
    static run() {
        if (EnergyRequestManager.handleSourceSleep) {
            EnergyRequestManager.handleSourceSleep();
        }
    }
}

module.exports = EnergySourceTracker;
