/**
 * Global Constants
 * This module defines and exports common string literals used across various parts of the bot,
 * such as creep roles and state names.
 */

// Roles
const ROLE_MINER = 'miner';
const ROLE_HAULER = 'hauler';
const ROLE_UPGRADER = 'upgrader';

// States
const STATE_IDLE = 'idle';
const STATE_HARVESTING = 'harvesting';
const STATE_TRANSFERRING = 'transferring';
const STATE_UPGRADING = 'upgrading';
const STATE_PICKUP = 'pickup';
const STATE_WITHDRAW = 'withdraw';

module.exports = {
  ROLE_MINER,
  ROLE_HAULER,
  ROLE_UPGRADER,
  STATE_IDLE,
  STATE_HARVESTING,
  STATE_TRANSFERRING,
  STATE_UPGRADING,
  STATE_PICKUP,
  STATE_WITHDRAW
};
