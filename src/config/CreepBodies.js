/**
 * Hardcoded creep body configurations for different roles.
 */

const MINER_BODY = [WORK, WORK, MOVE];
const HAULER_BODY = [CARRY, CARRY, MOVE, MOVE];
const UPGRADER_BODY = [WORK, CARRY, MOVE, MOVE];

module.exports = {
  MINER_BODY,
  HAULER_BODY,
  UPGRADER_BODY
};
