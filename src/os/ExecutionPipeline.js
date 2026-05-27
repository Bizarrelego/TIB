/**
 * @file ExecutionPipeline.js
 * @description Central orchestrator module responsible for executing the bot's tick logic
 * in the defined 6 phases: OS Init & Cache, Global State, Colonies, Operations,
 * Traffic Control, and Intents & Sleep. Ensures correct sequencing and wraps
 * execution with ManagerExecutionWrapper for consistent error handling and profiling.
 */

const OSOrchestrator = require('./OSOrchestrator');
const trafficManager = require('../traffic/trafficManager');
const cpuThrottler = require('./cpuThrottler');
const SystemScheduler = require('./SystemScheduler');
const { wrap } = require('../utils/ManagerExecutionWrapper');

/**
 * The execution pipeline orchestrator.
 * @namespace ExecutionPipeline
 */
const ExecutionPipeline = {
    /**
     * Executes the 6-phase pipeline for the current tick.
     * Integrates with `cpuThrottler` to respect CPU limits and skips non-critical
     * phases if necessary. Also executes scheduled tasks via `SystemScheduler`.
     *
     * @returns {void}
     */
    run: function() {
        let throttlerFlags = {};
        if (cpuThrottler && typeof cpuThrottler.run === 'function') {
            throttlerFlags = cpuThrottler.run() || {};
        }

        // Phase 1: OS Init & Cache
        wrap('Phase1_OSInit', () => OSOrchestrator.runPhase1())();

        // Phase 2: Global State
        wrap('Phase2_GlobalState', () => OSOrchestrator.runPhase2(throttlerFlags))();

        // Phase 3: Colonies
        OSOrchestrator.runPhase3(throttlerFlags);

        // Phase 4: Operations
        OSOrchestrator.runPhase4(throttlerFlags);

        // Phase 5: Traffic Control
        if (trafficManager && typeof trafficManager.run === 'function') {
            wrap('Phase5_Traffic', () => trafficManager.run())();
        }

        // Run scheduled system tasks
        if (SystemScheduler && typeof SystemScheduler.run === 'function') {
            wrap('SystemScheduler', () => SystemScheduler.run())();
        }

        // Phase 6: Intents & Sleep
        wrap('Phase6_IntentsSleep', () => OSOrchestrator.runPhase6())();
    }
};

module.exports = ExecutionPipeline;
