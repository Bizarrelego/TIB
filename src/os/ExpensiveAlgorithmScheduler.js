const AusterityTrigger = require('./AusterityTrigger');
const CostMatrixUpdateTrigger = require('../traffic/CostMatrixUpdateTrigger');

/**
 * @typedef {Object} AlgorithmOptions
 * @property {number} [threshold=8000] - The CPU bucket threshold required to run the algorithm.
 * @property {boolean} [checkRoomHash=false] - Whether to check if the room hash has changed before running.
 */

/**
 * @typedef {Object} ScheduledTask
 * @property {string} algorithmName - The name of the algorithm.
 * @property {string} roomId - The name of the room.
 * @property {AlgorithmOptions} options - Execution options.
 * @property {Function} callback - The function to execute.
 */

class ExpensiveAlgorithmScheduler {
    /**
     * Initializes the queue in global.State if it doesn't exist.
     * @private
     */
    static _initQueue() {
        if (!global.State) global.State = new Map();
        if (!global.State.has('expensiveAlgorithmQueue')) {
            global.State.set('expensiveAlgorithmQueue', []);
        }
    }

    /**
     * Queues an algorithm for execution when the CPU bucket allows.
     * @param {string} algorithmName - The name of the algorithm to schedule.
     * @param {string} roomId - The name of the room the algorithm is for.
     * @param {AlgorithmOptions} options - Options controlling the execution.
     * @param {Function} callback - The function that performs the actual computation.
     */
    static scheduleAlgorithm(algorithmName, roomId, options, callback) {
        this._initQueue();
        const queue = global.State.get('expensiveAlgorithmQueue');

        // Prevent duplicate tasks for the same room and algorithm
        const exists = queue.some(t => t.algorithmName === algorithmName && t.roomId === roomId);
        if (!exists) {
            queue.push({ algorithmName, roomId, options, callback });
        }
    }

    /**
     * Checks the CPU bucket and other conditions to decide which queued algorithms to execute this tick.
     * Executes at most one algorithm per tick to prevent CPU spikes.
     */
    static runScheduledAlgorithms() {
        this._initQueue();
        const queue = global.State.get('expensiveAlgorithmQueue');

        if (queue.length === 0) return;

        // Check global bucket trajectory to avoid running expensive operations if a crash is imminent
        if (AusterityTrigger.shouldTriggerAusterity()) {
            return;
        }

        // We execute at most ONE expensive task per tick
        for (let i = 0; i < queue.length; i++) {
            const task = queue[i];
            const threshold = task.options.threshold !== undefined ? task.options.threshold : 8000;

            // Engine API availability check
            if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket !== undefined) {
                if (Game.cpu.bucket <= threshold) {
                    continue;
                }
            }

            // If room hash check is enabled and the room hasn't changed, we can skip computation
            if (task.options.checkRoomHash) {
                if (!CostMatrixUpdateTrigger.shouldUpdateCostMatrix(task.roomId)) {
                    // Remove from queue and proceed to check the next task
                    queue.splice(i, 1);
                    i--;
                    continue;
                }
            }

            // Execute the task
            try {
                task.callback();
            } catch (e) {
                console.log(`[ExpensiveAlgorithmScheduler] Error executing ${task.algorithmName} for ${task.roomId}: ${e.stack}`);
            }

            // Remove from queue
            queue.splice(i, 1);

            // Only run one algorithm per tick
            break;
        }
    }
}

module.exports = ExpensiveAlgorithmScheduler;
