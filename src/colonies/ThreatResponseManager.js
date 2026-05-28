/**
 * @file ThreatResponseManager.js
 * @description Central coordinator for defensive actions within a colony.
 * Subscribes to events and triggers the appropriate defensive modules based on the threat evaluation.
 */

const eventBus = require('../os/eventBus');
const {
    EVENT_HOSTILE_SPOTTED,
    EVENT_HOSTILE_ATTACK,
    EVENT_STRUCTURE_DAMAGED
} = require('../constants/eventTypes');
const ThreatEvaluator = require('./ThreatEvaluator');
const defconManager = require('./defconManager');
const RampartDefenseManager = require('../managers/RampartDefenseManager');
const TowerManager = require('../managers/TowerManager');
const Logger = require('../utils/logger');
const { DEFCON } = require('../constants/defcon');

class ThreatResponseManager {
    /**
     * Initializes the Threat Response Manager and subscribes to relevant events.
     */
    static init() {
        if (this._initialized) return;

        eventBus.subscribe(EVENT_HOSTILE_SPOTTED, this.handleThreatEvent.bind(this));
        eventBus.subscribe(EVENT_HOSTILE_ATTACK, this.handleThreatEvent.bind(this));
        eventBus.subscribe(EVENT_STRUCTURE_DAMAGED, this.handleStructureDamagedEvent.bind(this));

        this._initialized = true;
    }

    /**
     * Handles threat-related events to coordinate defensive actions.
     * @param {Object} payload - The event payload.
     * @param {string} payload.roomName - The name of the room where the event occurred.
     */
    static handleThreatEvent(payload) {
        if (!payload || !payload.roomName) return;

        const roomName = payload.roomName;
        const room = Game.rooms ? Game.rooms[roomName] : null;

        if (!room) return;

        try {
            const threatProfile = ThreatEvaluator.evaluateThreat(roomName);

            // Trigger the defensive modules that are relevant for the threat profile
            if (threatProfile.defconLevel <= DEFCON.CAUTION) {
                defconManager.run(room);

                // Rampart defense handles swaps, call if threat level allows
                if (threatProfile.defconLevel <= DEFCON.ALERT) {
                    RampartDefenseManager.run(room);
                }

                // Tower manager handles its own target evaluations
                TowerManager.run(room);
            }
        } catch (e) {
            Logger.error(`[ThreatResponseManager Error] Handling threat event in ${roomName}: ${e.stack}`);
        }
    }

    /**
     * Handles structure damaged events to trigger defenses.
     * @param {Object} payload - The event payload.
     * @param {string} payload.roomName - The room where the damage occurred.
     * @param {string} payload.structureId - The id of the damaged structure.
     */
    static handleStructureDamagedEvent(payload) {
        if (!payload || !payload.roomName) return;

        const roomName = payload.roomName;
        const room = Game.rooms ? Game.rooms[roomName] : null;

        if (!room) return;

        try {
            const threatProfile = ThreatEvaluator.evaluateThreat(roomName);

            if (threatProfile.defconLevel <= DEFCON.CAUTION) {
                defconManager.run(room);
                TowerManager.run(room);
            }
        } catch (e) {
            Logger.error(`[ThreatResponseManager Error] Handling structure damage in ${roomName}: ${e.stack}`);
        }
    }
}

module.exports = ThreatResponseManager;
