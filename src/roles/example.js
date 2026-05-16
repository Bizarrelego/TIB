/**
 * @file example.js
 * @description GOLD STANDARD ROLE TEMPLATE.
 * * STRICT ARCHITECTURAL CONSTRAINTS:
 * 1. Top-Down Management: Managers dictate targets. Creeps NEVER scan, sort, or find.
 * 2. Blind Execution: Creeps read `creep.heap` and execute blindly.
 * 3. O(1) Complexity: Lookups are strictly `Game.getObjectById()`. No `.find()`.
 * 4. Fault Tolerant: Invalid targets immediately clear heap state and yield to manager.
 */

// Import your centralized movement and intent managers.
// NEVER use native creep.moveTo() if it bypasses your traffic and fatigue gating.
const movement = require('../utils/movement'); 

module.exports = {
    /**
     * Executes the mindless actor logic for the tick.
     * @param {Creep} creep - The creep executing this role.
     */
    run(creep) {
        // 1. READ STATE (Top-Down Assignment)
        // A Manager (e.g., colonyManager) MUST have populated these in Phase 1 or 2.
        const targetId = creep.heap.targetId;
        const state = creep.heap.state; // e.g., 'harvest', 'fill', 'upgrade'

        // 2. YIELD ON EMPTY
        // If the manager hasn't assigned a target, do absolutely nothing. 
        // Do not scan for work. Yield the CPU.
        if (!targetId || !state) {
            return;
        }

        // 3. FAULT-TOLERANT VALIDATION (O(1))
        // Verify the object still exists in the engine this tick.
        const target = Game.getObjectById(targetId);
        if (!target) {
            // Target was destroyed, decayed, or vision was lost.
            // WIPE the state so the Manager reassigns next tick. NEVER search for a replacement here.
            creep.heap.targetId = null;
            creep.heap.state = null;
            return;
        }

        // 4. BLIND EXECUTION
        // Route to the exact atomic action required by the state.
        switch (state) {
            case 'harvest':
                this.executeHarvest(creep, target);
                break;
            case 'fill':
                this.executeFill(creep, target);
                break;
            default:
                // Unrecognized state. Wipe and yield to prevent infinite error loops.
                creep.heap.targetId = null;
                creep.heap.state = null;
                break;
        }
    },

    /**
     * Atomic Execution: Harvest
     * @param {Creep} creep
     * @param {Source|Mineral} target
     */
    executeHarvest(creep, target) {
        // Spatial check using fast engine geometry, not pathfinding.
        if (!creep.pos.isNearTo(target)) {
            // Delegate pathing to movement utility. 
            // Note: If you use packed drop IDs for parking, route to the drop ID instead of the target.
            movement.moveTo(creep, target.pos, { range: 1 });
            return;
        }

        // Execute action. Do not check if creep is full before harvesting if you want native overflow drops.
        creep.harvest(target);

        // State Wipe on Completion
        if (creep.store.getFreeCapacity() === 0) {
            creep.heap.targetId = null;
            creep.heap.state = null;
        }
    },

    /**
     * Atomic Execution: Fill
     * @param {Creep} creep
     * @param {Structure} target
     */
    executeFill(creep, target) {
        if (!creep.pos.isNearTo(target)) {
            movement.moveTo(creep, target.pos, { range: 1 });
            return;
        }

        // Execute Action
        const result = creep.transfer(target, RESOURCE_ENERGY);
        
        // State Wipe on Completion or Failure
        // If the transfer succeeds and empties the creep OR fills the target, we are done.
        // If ERR_FULL occurs, another creep beat us to it. Wipe and let manager reassign.
        if (
            result === ERR_FULL || 
            (result === OK && (creep.store[RESOURCE_ENERGY] === 0 || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0))
        ) {
            creep.heap.targetId = null;
            creep.heap.state = null;
        }
    }
};