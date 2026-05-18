/**
 * @file PollingAuditor.js
 * @description Auditor module to enforce the Zero Native Polling constraint.
 * Wraps native Room functions (find, lookAt, lookForAt) to track and report their usage.
 */

const Logger = require('./logger');

/**
 * @typedef {Object} PollingViolation
 * @property {string} method - The name of the native method called.
 * @property {string} stack - The stack trace of the call.
 * @property {number} time - The Game.time when the violation occurred.
 */

class PollingAuditor {
    constructor() {
        /**
         * @type {PollingViolation[]}
         * @private
         */
        this.violations = [];

        /**
         * @type {boolean}
         * @private
         */
        this.installed = false;
    }

    /**
     * Installs the auditor by monkey-patching native Room prototype methods.
     * @returns {void}
     */
    install() {
        if (this.installed) return;
        if (typeof Room === 'undefined') {
            Logger.warn('PollingAuditor: Room prototype not found, cannot install.');
            return;
        }

        const originalFind = Room.prototype.find;
        const originalLookAt = Room.prototype.lookAt;
        const originalLookForAt = Room.prototype.lookForAt;

        const self = this;

        Room.prototype.find = function (...args) {
            self._recordViolation('Room.find');
            return originalFind.apply(this, args);
        };

        Room.prototype.lookAt = function (...args) {
            self._recordViolation('Room.lookAt');
            return originalLookAt.apply(this, args);
        };

        Room.prototype.lookForAt = function (...args) {
            self._recordViolation('Room.lookForAt');
            return originalLookForAt.apply(this, args);
        };

        this.installed = true;
        Logger.info('PollingAuditor installed. Native polling functions wrapped.');
    }

    /**
     * Records a polling violation.
     * @param {string} method - The name of the method being called.
     * @private
     * @returns {void}
     */
    _recordViolation(method) {
        const stack = new Error().stack || '';
        // Capture the stack trace skipping the immediate frames
        const frames = stack.split('\n');
        const callerStack = frames.length > 3 ? frames.slice(3).join('\n').trim() : stack;

        const time = typeof Game !== 'undefined' ? Game.time : 0;

        Logger.warn(`[PollingAuditor] Zero Native Polling Violation! Method: ${method} called.`);

        this.violations.push({
            method,
            stack: callerStack,
            time
        });
    }

    /**
     * Generates a summary report of all recorded polling violations.
     * @returns {string} The formatted report string.
     */
    report() {
        if (this.violations.length === 0) {
            return 'PollingAuditor Report: No native polling violations detected.';
        }

        let reportStr = `PollingAuditor Report: ${this.violations.length} violations detected.\n`;
        for (const v of this.violations) {
            reportStr += `- [Tick ${v.time}] ${v.method} called.\n  Stack:\n${v.stack}\n`;
        }

        return reportStr;
    }

    /**
     * Clears all recorded violations.
     * @returns {void}
     */
    clear() {
        this.violations = [];
    }
}

// Export as singleton
module.exports = new PollingAuditor();
