const Profiler = require('../utils/profiler');
const { executeManager } = require('../utils/errorHandler');
const { Game } = require('../utils/mocks');

/**
 * @file ObserverManager.js
 * @description Manages Observer structures to scan remote rooms for intel.
 */

class ObserverManager {
    constructor() {
        this.OBSERVER_RANGE = 10;
        this.INTEL_STALE_TICKS = 10000;
    }

    /**
     * Initializes the ObserverManager state on the global object.
     */
    init() {
        if (!global.State) return;
        if (!global.State.observerQueue) {
            global.State.observerQueue = new Map();
        }
    }

    /**
     * Runs the observer scanning logic. Identifies available observers and assigns scan targets.
     */
    run() {
        if (!global.State || !global.State.structuresByRoom) return;

        for (const [roomName, structures] of global.State.structuresByRoom.entries()) {
            const observers = structures.get(STRUCTURE_OBSERVER);
            if (observers && observers.size > 0) {
                const observer = Array.from(observers.values())[0]; // Assuming 1 observer per room

                // Only scan if not on cooldown (cooldown logic not strictly needed as observerRoom takes 1 tick and observes for next tick, but we should issue only 1 command per observer per tick)

                const target = this.getScanTarget(observer, roomName);
                if (target) {
                    const result = observer.observeRoom(target);
                    if (result === OK) {
                        // Successfully scheduled a scan
                        // We could remove it from the queue if it was an explicit target,
                        // but let's handle queue management if needed
                        if (global.State.observerQueue && global.State.observerQueue.has(target)) {
                            global.State.observerQueue.delete(target);
                        }
                    }
                }
            }
        }
    }

    /**
     * Determines the next room to scan for a given observer.
     * @param {StructureObserver} observer - The observer structure.
     * @param {string} roomName - The name of the room containing the observer.
     * @returns {string|null} The room name to scan, or null if no target.
     */
    getScanTarget(observer, roomName) {
        // Priority 1: Requested targets in global.State.observerQueue within range
        if (global.State.observerQueue && global.State.observerQueue.size > 0) {
            // Find highest priority target within range
            let bestTarget = null;
            let bestPriority = -1;

            for (const [targetRoomName, data] of global.State.observerQueue.entries()) {
                if (Game.map.getRoomLinearDistance(roomName, targetRoomName) <= this.OBSERVER_RANGE) {
                    if (data.priority > bestPriority) {
                        bestPriority = data.priority;
                        bestTarget = targetRoomName;
                    }
                }
            }

            if (bestTarget) {
                return bestTarget;
            }
        }

        // Priority 2: Scan nearby rooms (range <= 10) for missing or stale intel
        // Since we don't have Game.map.getRoomStatus (or similar) here without heavy logic,
        // we could iterate over a bounding box of coordinates and check intel state.

        // Extract x, y from roomName e.g., W1N1
        const match = roomName.match(/^([WE])([0-9]+)([NS])([0-9]+)$/);
        if (match) {
            const hDir = match[1];
            const x = parseInt(match[2], 10);
            const vDir = match[3];
            const y = parseInt(match[4], 10);

            // Generate a random room within radius 10 to check
            for (let i = 0; i < 50; i++) { // Max 50 random attempts to find a good target
                const dx = Math.floor(Math.random() * (this.OBSERVER_RANGE * 2 + 1)) - this.OBSERVER_RANGE;
                const dy = Math.floor(Math.random() * (this.OBSERVER_RANGE * 2 + 1)) - this.OBSERVER_RANGE;

                let targetX = x + dx;
                let targetY = y + dy;

                // Simplified coordinate handling (assuming no wrapping across W0/E0 or N0/S0 for simplicity in this fallback,
                // though real implementation might need coordinate translation)
                if (targetX < 0 || targetY < 0) continue; // Skip edge crossing for simplicity in random fallback

                const targetRoom = `${hDir}${targetX}${vDir}${targetY}`;

                // Check if intel is missing or stale
                const intel = global.State.intel ? global.State.intel.get(targetRoom) : null;
                if (!intel || !intel.lastSeen || (Game.time - intel.lastSeen > this.INTEL_STALE_TICKS)) {
                    return targetRoom;
                }
            }
        }

        return null;
    }
}

const instance = new ObserverManager();

module.exports = {
    init: Profiler.wrap('ObserverManager.init', (...args) => executeManager('ObserverManager.init', instance.init.bind(instance), ...args)),
    run: Profiler.wrap('ObserverManager.run', (...args) => executeManager('ObserverManager.run', instance.run.bind(instance), ...args)),
    getScanTarget: Profiler.wrap('ObserverManager.getScanTarget', (...args) => executeManager('ObserverManager.getScanTarget', instance.getScanTarget.bind(instance), ...args)),
    _instance: instance
};
