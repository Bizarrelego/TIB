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

    static unshift(request) {
        const queue = this.getQueue();
        queue.unshift(request);
    }

    static dequeue() {
        const queue = this.getQueue();
        return queue.shift();
    }

    static getRoleCounts() {
        const queue = this.getQueue();
        const counts = new Map();
        for (const req of queue) {
            if (!counts.has(req.role)) {
                counts.set(req.role, 1);
            } else {
                counts.set(req.role, counts.get(req.role) + 1);
            }
        }
        return counts;
    }

    static clear() {
        global.SpawnQueue = [];
    }
}

module.exports = SpawnQueueUtility;
