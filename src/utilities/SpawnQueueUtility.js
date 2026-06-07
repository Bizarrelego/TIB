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
        const counts = Object.create(null);
        for (const req of queue) {
            if (counts[req.role] === undefined) {
                counts[req.role] = 1;
            } else {
                counts[req.role]++;
            }
        }
        return counts;
    }

    static clear() {
        global.SpawnQueue = [];
    }
}

module.exports = SpawnQueueUtility;
