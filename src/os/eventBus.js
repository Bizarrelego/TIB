class PubSub {
    constructor() {
        this.events = new Map();
    }

    subscribe(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        this.events.get(event).add(callback);
    }

    unsubscribe(event, callback) {
        if (this.events.has(event)) {
            this.events.get(event).delete(callback);
        }
    }

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
