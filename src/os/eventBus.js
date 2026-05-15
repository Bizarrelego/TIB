/**
 * A simple Publish-Subscribe (PubSub) event bus for cross-module communication.
 * @class PubSub
 */
class PubSub {
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
     * Initializes the event bus.
     */
    init() {
        // Initialization logic, if any, can be placed here.
        // For now, it satisfies the required initialization step.
    }

    /**
     * Subscribes a callback to a specific event.
     * @param {string} event - The name of the event to subscribe to.
     * @param {Function} callback - The function to call when the event is published.
     * @returns {void}
     */
    subscribe(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
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
        }
    }

    /**
     * Publishes an event, calling all subscribed callbacks with the provided data.
     * @param {string} event - The name of the event to publish.
     * @param {*} data - The data to pass to the callbacks.
     * @returns {void}
     */
    publish(event, data) {
        if (this.events.has(event)) {
            for (const callback of this.events.get(event)) {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`Error in EventBus for event ${event}: ${e.stack}`);
                }
            }
        }
    }
}

const eventBus = new PubSub();
module.exports = eventBus;
