const fs = require('fs');
const content = fs.readFileSync('src/traffic/trafficManager.js', 'utf8');

const replacement = `    /**
     * @param {object} creep
     * @param {number} direction
     */
    registerMove(creep, direction) {
        // Fatigue Gating: Ensure only the specific creep is gated.
        // The TrafficManager should only process creeps that are capable of moving.
        if (!creep || creep.fatigue > 0) return;

        if (global.State && global.State.trafficIntents) {
            global.State.trafficIntents.set(creep.name, { direction, priority: creep.heap.priority || 0 });
        }
    },

    /**
     * @param {object} creep
     * @param {object} targetPos
     * @param {object} [opts={}]
     */
    registerMoveIntent(creep, targetPos, opts = {}) {
        if (!creep || creep.fatigue > 0) return;
        if (!global.State) global.State = {};
        if (!(global.State.trafficIntents instanceof Map)) global.State.trafficIntents = new Map();

        global.State.trafficIntents.set(creep.name, {
            creep,
            targetPos,
            opts,
            originalPos: creep.pos
        });
    },`;

const newContent = content.replace(/    \/\*\*\n     \* @param \{object\} creep\n     \* @param \{number\} direction\n     \*\/\n    registerMove\(creep, direction\) \{[\s\S]*?\}\,/, replacement);
fs.writeFileSync('src/traffic/trafficManager.js', newContent);
