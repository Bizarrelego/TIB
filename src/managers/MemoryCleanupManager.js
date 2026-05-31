/**
 * Cleans up stale memory entries, specifically for dead creeps.
 */
module.exports = {
  /**
   * Iterates through Memory.creeps and deletes entries for creeps that no longer exist in Game.creeps.
   * Called once per tick.
   */
  run: function () {
    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        delete Memory.creeps[name];
      }
    }
  }
};
