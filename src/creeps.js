// src/creeps.js
// Backward-compatibility shim re-exporting from modular creep subsystems
const { getTrafficCostMatrix, resolveAllTraffic } = require('./traffic');
const { runHarvesters } = require('./harvesters');
const { runLogistics } = require('./logistics');
const { runWorkers } = require('./workers');
const { runQuadSquad, executeQuadSquad } = require('./combat_quads');

function executeCreepAction(creep) {
    if (!creep || creep.fatigue > 0) return;
    const heap = creep.heap || (creep.heap = {});
    if (heap.actionIntent && typeof creep[heap.actionIntent] === 'function' && heap.targetId) {
        const target = (typeof Game !== 'undefined' && Game.getObjectById) ? Game.getObjectById(heap.targetId) : null;
        if (target) {
            creep[heap.actionIntent](target);
        }
    }
}
function runCreeps() {
    if (typeof Game === 'undefined') return;
    for (const roomName in Game.rooms) {
        runHarvesters(roomName);
        runWorkers(roomName);
        runLogistics(roomName);
    }
    runQuadSquad();
    resolveAllTraffic();
}

function moveCreep(creep, direction) {
    if (!creep || creep.fatigue > 0) return;
    const heap = creep.heap || (creep.heap = {});
    if (direction && typeof creep.move === 'function') {
        creep.move(direction);
        heap.sleepUntil = null; // Reset sleep until after moving
    }
}

module.exports = {
    executeCreepAction,
    executeQuadSquad,
    getTrafficCostMatrix,
    moveCreep,
    resolveAllTraffic,
    runCreeps,
    runHarvesters,
    runLogistics,
    runQuadSquad,
    runWorkers
};
