/**
 * Utility for managing the global spawn queue.
 */
class SpawnQueueUtility {
    static getQueue() {
        if (!global.SpawnQueue) {
            global.SpawnQueue = [];
        }
        return global.SpawnQueue;
    }

    static enqueue(request) {
        const queue = this.getQueue();
        queue.push(request);
    }

    static dequeue() {
        const queue = this.getQueue();
        return queue.shift();
    }

    static clear() {
        global.SpawnQueue = [];
    }
}

module.exports = SpawnQueueUtility;
