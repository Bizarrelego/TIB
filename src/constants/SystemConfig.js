/**
 * @file SystemConfig.js
 * @description Defines the central configuration for various systems and managers.
 * This includes their criticality, default execution frequency (tick slicing), and CPU budget allocations.
 */

/**
 * @typedef {Object} SystemConfigEntry
 * @property {string} name - The display name of the system.
 * @property {'CRITICAL' | 'NORMAL' | 'LOW'} criticality - The criticality level of the system.
 * @property {number} defaultFrequency - The default tick interval for execution.
 * @property {string} cpuBudgetKey - The key referencing a budget in CPU_BUDGETS.
 */

/**
 * Centralized system configuration metadata.
 * @type {Map<string, SystemConfigEntry>}
 */
const SystemConfig = new Map([
    ['garbageCollector', {
        name: 'Garbage Collector',
        criticality: 'LOW',
        defaultFrequency: 100,
        cpuBudgetKey: 'DEFAULT'
    }],
    ['SpawnManager', {
        name: 'Spawn Manager',
        criticality: 'CRITICAL',
        defaultFrequency: 1,
        cpuBudgetKey: 'Phase3_Colonies'
    }],
    ['ConstructionManager', {
        name: 'Construction Manager',
        criticality: 'NORMAL',
        defaultFrequency: 5,
        cpuBudgetKey: 'Phase3_Colonies'
    }],
    ['MarketManager', {
        name: 'Market Manager',
        criticality: 'NORMAL',
        defaultFrequency: 10,
        cpuBudgetKey: 'Phase4_Operations'
    }],
    ['DefenseManager', {
        name: 'Defense Manager',
        criticality: 'CRITICAL',
        defaultFrequency: 1,
        cpuBudgetKey: 'Phase3_Colonies'
    }],
    ['IntelManager', {
        name: 'Intel Manager',
        criticality: 'LOW',
        defaultFrequency: 20,
        cpuBudgetKey: 'Phase4_Operations'
    }]
]);

module.exports = SystemConfig;
