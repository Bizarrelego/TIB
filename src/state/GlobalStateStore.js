/**
 * Module representing the central, in-memory store for the current tick's game objects.
 * Populated by GlobalStateScanner.
 * @module GlobalStateStore
 */

const GlobalStateStore = {
  rooms: new Map(),
  sources: [],
  spawns: [],
  droppedEnergy: [],
  ruins: [],
  tombstones: [],
  creeps: [],

  /**
   * Clears the current state to prepare for a new tick.
   */
  clear() {
    this.rooms.clear();
    this.sources = [];
    this.spawns = [];
    this.droppedEnergy = [];
    this.ruins = [];
    this.tombstones = [];
    this.creeps = [];
  },

  /**
   * Sets or updates a state property.
   *
   * @param {string} key - The state property to update.
   * @param {*} value - The value to set.
   */
  set(key, value) {
    this[key] = value;
  }
};

module.exports = GlobalStateStore;
