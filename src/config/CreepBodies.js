/**
 * Hardcoded creep body configurations for different roles.
 */

const harvester = [WORK, WORK, MOVE];
const hauler = [CARRY, CARRY, MOVE, MOVE];
const upgrader = [WORK, CARRY, MOVE, MOVE];

const CreepBodies = new Map([
  ['harvester', harvester],
  ['hauler', hauler],
  ['upgrader', upgrader]
]);

module.exports = CreepBodies;
