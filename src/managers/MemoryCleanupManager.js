/**
 * Cleans up stale memory entries, specifically for dead creeps.
 */
module.exports = {
  /**
   * Iterates through Memory.creeps and deletes entries for creeps that no longer exist in Game.creeps.
   * Throttled via tick-slicing.
   */
  run: function () {
    // Tick-slicing optimization: only run memory cleanup every 100 ticks
    if (Game.time % 100 !== 0) return;

    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        delete Memory.creeps[name];
      }
    }
  }
};
