// src/planner.js
// Backward-compatibility shim re-exporting from modular planner subsystems
const { findAnchor, getRoomBlueprint } = require('./bunker');
const { planRoadNetwork } = require('./roads');
const { computeMinCut, planMincutRamparts } = require('./mincut');
const { planOutposts, runObserver } = require('./remotes');

function runPlanner() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || !room.controller.my) continue;
        const blueprint = getRoomBlueprint(room);
        planRoadNetwork(room, blueprint);
        planMincutRamparts(room, blueprint);
    }
}

module.exports = {
    runPlanner,
    findAnchor,
    getRoomBlueprint,
    planRoadNetwork,
    computeMinCut,
    planMincutRamparts,
    planOutposts,
    runObserver
};
