class TaskQueue {
    /**
     * Initializes an empty queue.
     */
    constructor() {
        this.items = [];
    }

    /**
     * Adds an item to the end of the queue.
     * @param {*} item - The item to add to the queue.
     */
    enqueue(item) {
        this.items.push(item);
    }

    /**
     * Removes and returns the item from the front of the queue.
     * @returns {*} The item at the front of the queue, or undefined if the queue is empty.
     */
    dequeue() {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.items.shift();
    }

    /**
     * Returns the item at the front of the queue without removing it.
     * @returns {*} The item at the front of the queue, or undefined if the queue is empty.
     */
    peek() {
        if (this.isEmpty()) {
            return undefined;
        }
        return this.items[0];
    }

    /**
     * Checks if the queue is empty.
     * @returns {boolean} True if the queue is empty, false otherwise.
     */
    isEmpty() {
        return this.items.length === 0;
    }

    /**
     * Returns the number of items in the queue.
     * @returns {number} The size of the queue.
     */
    size() {
        return this.items.length;
    }
}

module.exports = TaskQueue;
