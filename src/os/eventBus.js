const errorHandler = require('../utils/errorHandler');
const Profiler = require('../utils/profiler');

/**
 * A simple Publish-Subscribe (PubSub) event bus for cross-module communication.
 * @class PubSub
 */
class PubSub {
    init() {
        if (!this.events) {
            this.events = new Map();
        }
    }

    /**
     * Creates an instance of PubSub.
     */
    constructor() {
        /**
         * @type {Map<string, Set<Function>>}
         */
        this.events = new Map();
    }

    /**
     * Subscribes a callback to a specific event.
     * @param {string} event - The name of the event to subscribe to.
     * @param {Function} callback - The function to call when the event is published.
     * @returns {Function} A function to unsubscribe this specific callback.
     */
    subscribe(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);

        return () => this.unsubscribe(event, callback);
    }

    /**
     * Subscribes a callback to a specific event, but only executes it once.
     * @param {string} event - The name of the event to subscribe to.
     * @param {Function} callback - The function to call when the event is published.
     * @returns {Function} A function to unsubscribe this specific callback early.
     */
    subscribeOnce(event, callback) {
        const wrapper = (data) => {
            this.unsubscribe(event, wrapper);
            callback(data);
        };
        return this.subscribe(event, wrapper);
    }

    /**
     * Unsubscribes a callback from a specific event.
     * @param {string} event - The name of the event to unsubscribe from.
     * @param {Function} callback - The function to remove.
     * @returns {void}
     */
    unsubscribe(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
            if (this.events.get(event).size === 0) {
                this.events.delete(event);
            }
        }
    }

    /**
     * Publishes an event, calling all subscribed callbacks with the provided data.
     * Wraps execution in global error boundaries and inline CPU tracking.
     * @param {string} event - The name of the event to publish.
     * @param {*} data - The data to pass to the callbacks.
     * @returns {void}
     */
    publish(event, data) {
        if (!this.events.has(event)) return;

        const profilerEnabled = global.PROFILER_ENABLED || (typeof Memory !== 'undefined' && Memory.PROFILER_ENABLED);
        const cpuAvailable = typeof Game !== 'undefined' && Game.cpu && typeof Game.cpu.getUsed === 'function';
        const start = (profilerEnabled && cpuAvailable) ? Game.cpu.getUsed() : (profilerEnabled ? Date.now() : 0);

        for (const callback of this.events.get(event)) {
            try {
                callback(data);
            } catch (e) {
                errorHandler.logError(e, `EventBus:${event}`);
            }
        }

        if (profilerEnabled) {
            const end = cpuAvailable ? Game.cpu.getUsed() : Date.now();
            Profiler.record(`EventBus:${event}`, end - start);
        }
    }

    /**
     * Clears all subscriptions. Useful for resetting state between tests.
     * @returns {void}
     */
    clear() {
        this.events.clear();
    }
}

const eventBus = new PubSub();
module.exports = eventBus;
