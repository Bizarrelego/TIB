const Logger = {
    info: function(message) {
        console.log(`[INFO] ${message}`);
    },
    warn: function(message) {
        console.log(`[WARN] ${message}`);
    },
    error: function(message) {
        console.log(`[ERROR] ${message}`);
    },
    debug: function(message) {
        console.log(`[DEBUG] ${message}`);
    },
    run: function() {
        // End-of-tick logging can be implemented here
    }
};

module.exports = Logger;
