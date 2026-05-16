/**
 * @file logger.js
 * @description Centralized logging utility for outputting informative and debug messages to the console.
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
};

const CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG;

class Logger {
    static getLogPrefix(levelName) {
        const time = typeof Game !== 'undefined' ? Game.time : 'N/A';
        return `[${time}] [${levelName}]`;
    }

    static debug(message) {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
            console.log(`${this.getLogPrefix('DEBUG')} ${message}`);
        }
    }

    static info(message) {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
            console.log(`${this.getLogPrefix('INFO')} ${message}`);
        }
    }

    static warn(message) {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
            console.log(`${this.getLogPrefix('WARN')} ${message}`);
        }
    }

    static error(message) {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
            console.log(`${this.getLogPrefix('ERROR')} ${message}`);
        }
    }

    static fatal(message) {
        if (CURRENT_LOG_LEVEL <= LOG_LEVELS.FATAL) {
            console.log(`${this.getLogPrefix('FATAL')} ${message}`);
        }
    }
}

module.exports = Logger;
