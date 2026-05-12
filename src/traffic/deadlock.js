const ROLE_PRIORITIES = require('../constants/rolePriorities');

const DeadlockEngine = {
    detectAndResolve(intents, dependencyGraph) {
        try {
            const visited = new Set();
            const recursionStack = new Set();

            const getCycle = (stack, startNode) => {
                const arr = Array.from(stack);
                const startIndex = arr.indexOf(startNode);
                if (startIndex !== -1) {
                    return arr.slice(startIndex);
                }
                return arr;
            };

            const detectCycle = (creepName) => {
                if (!visited.has(creepName)) {
                    visited.add(creepName);
                    recursionStack.add(creepName);

                    const nextCreep = dependencyGraph.get(creepName);
                    if (nextCreep) {
                        if (!visited.has(nextCreep)) {
                            detectCycle(nextCreep);
                        } else if (recursionStack.has(nextCreep)) {
                            // Cycle detected
                            const cycle = getCycle(recursionStack, nextCreep);
                            DeadlockEngine.resolveDeadlock(cycle, intents);
                        }
                    }
                }
                recursionStack.delete(creepName);
            };

            for (const creepName of dependencyGraph.keys()) {
                if (!visited.has(creepName)) {
                    detectCycle(creepName);
                }
            }
        } catch (e) {
            console.log(`[DeadlockEngine Error]: ${e.stack}`);
        }
    },

    resolveDeadlock(cycle, intents) {
        if (!cycle || cycle.length === 0) return;

        let lowestPriority = Infinity;
        let lowestPriorityCreep = null;

        for (const creepName of cycle) {
            let priority = ROLE_PRIORITIES.get('default');
            const liveCreep = global.State && global.State.creepLookup ? global.State.creepLookup.get(creepName) : null;

            if (liveCreep && liveCreep.memory && liveCreep.memory.role) {
                priority = ROLE_PRIORITIES.get(liveCreep.memory.role) ?? ROLE_PRIORITIES.get('default');
            }

            if (priority < lowestPriority) {
                lowestPriority = priority;
                lowestPriorityCreep = creepName;
            }
        }

        if (lowestPriorityCreep) {
            intents.delete(lowestPriorityCreep);
        }
    }
};

module.exports = DeadlockEngine;
