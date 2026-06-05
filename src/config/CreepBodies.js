const HARVESTER_BODY = [WORK, WORK, MOVE];
const HAULER_BODY = [CARRY, CARRY, MOVE, MOVE];
const UPGRADER_BODY = [WORK, CARRY, MOVE];

const CreepBodies = new Map([
    ['harvester', HARVESTER_BODY],
    ['hauler', HAULER_BODY],
    ['upgrader', UPGRADER_BODY]
]);

module.exports = CreepBodies;
