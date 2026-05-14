/**
 * @file defense.js
 * @description Manages DEFCON handling, ramparts, and killbox funneling.
 */

const { determineDefcon, DEFCON } = require('../constants/defcon');
const TowerManager = require('../managers/TowerManager');
const rampartMelee = require('../roles/rampartMelee');
const remoteDefender = require('../roles/remoteDefender');
const drainerHunter = require('../roles/drainerHunter');

module.exports = {
    /**
     * Runs defense logistics for a given room.
     * @param {Room} room
     */
    run(room) {
        try {
            TowerManager.run(room);

            const defconLevel = determineDefcon(room.name);

            if (defconLevel <= DEFCON.ALERT) {
                rampartMelee.run(room);
            }

            remoteDefender.run(room);
            drainerHunter.run(room);

        } catch (e) {
            console.error(`[DefenseManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
};
