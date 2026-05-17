/**
 * @file RoleManager.js
 * @description Executes all creep roles that are not strictly bound to specific standalone managers.
 */

const harvester = require('../roles/harvester');
const worker = require('../roles/worker');
const domesticHauler = require('../roles/domesticHauler');
const fastFiller = require('../roles/fastFiller');
const hauler = require('../roles/hauler');
const remoteHauler = require('../roles/remoteHauler');
const powerHauler = require('../roles/powerHauler');
const remoteHarvester = require('../roles/remoteHarvester');
const skHauler = require('../roles/skHauler');
const skMiner = require('../roles/skMiner');
const soloDismantler = require('../roles/soloDismantler');
const emergencyBuilder = require('../roles/emergencyBuilder');
const skGuard = require('../roles/skGuard');
const decoy = require('../roles/decoy');
const hubManager = require('../roles/hubManager');
const reserver = require('../roles/reserver');

class RoleManager {
    static runAll() {
        if (!global.State || !global.State.rooms) return;
        for (const room of global.State.rooms.values()) {
            try {
                harvester.run(room);
                worker.run(room);
                domesticHauler.run(room);
                fastFiller.run(room);
                hauler.run(room);
                remoteHauler.run(room);
                powerHauler.run(room);
                remoteHarvester.run(room);
                skHauler.run(room);
                skMiner.run(room);
                soloDismantler.run(room);
                emergencyBuilder.run(room);
                skGuard.run(room);
                decoy.run(room);
                hubManager.run(room);
                reserver.run(room);
            } catch (e) {
                console.log(`[RoleManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
}

module.exports = RoleManager;