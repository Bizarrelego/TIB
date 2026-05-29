/**
 * @file cpuBudgets.js
 * @description Centralized configuration for manager and phase CPU budgets.
 */

const CPU_BUDGETS = {
    DEFAULT: 10,
    'Phase1_OSInit': 5,
    'Phase2_GlobalState': 10,
    'Phase3_Colonies': 20,
    'Phase4_Operations': 15,
    'Phase5_Traffic': 10,
    'Phase6_IntentsSleep': 5
};

module.exports = CPU_BUDGETS;
