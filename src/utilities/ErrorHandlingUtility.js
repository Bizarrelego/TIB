const Logger = require('./Logger');

class ErrorHandlingUtility {
    /**
     * Wraps a function with a try-catch block to handle and log errors.
     * @param {Function} fn The function to wrap.
     * @param {string} context A string providing context for where the error occurred.
     * @returns {Function} The wrapped function.
     */
    static wrap(fn, context) {
        return function(...args) {
            try {
                return fn.apply(this, args);
            } catch (error) {
                const errorMessage = `Error in ${context}: ${error.message}\nStack: ${error.stack}`;
                if (Logger && Logger.error) {
                    Logger.error(errorMessage);
                } else {
                    console.log(`[ERROR] ${errorMessage}`);
                }
            }
        };
    }
}

module.exports = ErrorHandlingUtility;
