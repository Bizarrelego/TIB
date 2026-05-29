/**
 * @file CpuBudgetManager.js
 * @description Manages CPU budgets for different execution phases and managers.
 */

const CPU_BUDGETS = require('../constants/cpuBudgets');
const Profiler = require('../utils/profiler');
const Logger = require('../utils/logger');

class CpuBudgetManager {
    static get customBudgets() { if (!this._customBudgets) this._customBudgets = new Map(); return this._customBudgets; }

    /**
     * Set a custom budget for a manager/phase, overriding the default in CPU_BUDGETS.
     * @param {string} name - The name of the manager/phase.
     * @param {number} limit - The CPU limit.
     */
    static setBudget(name, limit) {
        this.customBudgets.set(name, limit);
    }

    /**
     * Gets the current budget limit for a manager/phase.
     * @param {string} name - The name of the manager/phase.
     * @returns {number} The CPU limit.
     */
    static getBudget(name) {
        if (this.customBudgets.has(name)) {
            return this.customBudgets.get(name);
        }
        if (CPU_BUDGETS[name] !== undefined) {
            return CPU_BUDGETS[name];
        }
        return CPU_BUDGETS.DEFAULT || 10;
    }

    /**
     * Checks if the manager/phase has exceeded its CPU budget.
     * Logs a warning if it just exceeded the budget.
     * @param {string} name - The name of the manager/phase.
     * @returns {boolean} True if the budget is exceeded, false otherwise.
     */
    static isBudgetExceeded(name) {
        const used = Profiler.getActiveUsed(name);
        const limit = this.getBudget(name);

        if (used > limit) {
            const currentTick = typeof Game !== 'undefined' ? Game.time : 0;
            if (!this._warnedTicks) this._warnedTicks = new Map();
            if (this._warnedTicks.get(name) !== currentTick) {
                Logger.warn(`[CpuBudgetManager] ${name} exceeded CPU budget (${used.toFixed(2)} / ${limit})`);
                this._warnedTicks.set(name, currentTick);
            }
            return true;
        }
        return false;
    }

    /**
     * Alias for isBudgetExceeded, semantic method for managers to check if they should stop processing.
     * @param {string} name - The name of the manager/phase.
     * @returns {boolean} True if the manager should yield.
     */
    static shouldYield(name) {
        return this.isBudgetExceeded(name);
    }
}

module.exports = CpuBudgetManager;
