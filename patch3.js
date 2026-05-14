const fs = require('fs');
const content = fs.readFileSync('src/traffic/trafficManager.js', 'utf8');

const regex = /executeIntents\(\) \{[\s\S]*?\} \/\/\s*end of executeIntents/;
// Let's replace the entire executeIntents function and also resolveDeadlocks and executeSwaps as they are tightly coupled and we are rewriting the execution flow.

const replacement = `    executeIntents() {
        try {
            // Process pipeline ledger first
            if (global.State && global.State.pipelineLedger) {
                for (const [creepId, intent] of global.State.pipelineLedger.entries()) {
                    const liveCreep = Game.getObjectById(creepId);
                    if (liveCreep) {
                        this.flushIntent(liveCreep, intent);
                    }
                    global.State.pipelineLedger.delete(creepId);
                }
            }

            if (!global.State || !global.State.trafficIntents || global.State.trafficIntents.size === 0) return;

            // Phase 1: Build Dependency Graph & Identify Swaps
            const dependencyGraph = new Map();
            if (!(global.State.swapRegistry instanceof Map)) global.State.swapRegistry = new Map();
            global.State.swapRegistry.clear();

            const currentPositions = new Map();
            if (typeof Game !== 'undefined' && Game.creeps) {
                for (const creepName in Game.creeps) {
                    const creep = Game.creeps[creepName];
                    currentPositions.set(\`\${creep.pos.roomName}_\${creep.pos.x}_\${creep.pos.y}\`, creepName);
                }
            }

            for (const [creepName, intent] of global.State.trafficIntents.entries()) {
                const { creep, targetPos, opts, originalPos } = intent;
                if (!creep || !targetPos) continue;

                let intendedNextPos = null;
                const dx = Math.abs(creep.pos.x - targetPos.x);
                const dy = Math.abs(creep.pos.y - targetPos.y);

                if (dx <= 1 && dy <= 1 && creep.pos.roomName === targetPos.roomName) {
                    intendedNextPos = targetPos;
                } else {
                    const pathInfo = PathFinder.search(creep.pos, { pos: targetPos, range: 1 }, opts);
                    if (pathInfo && pathInfo.path && pathInfo.path.length > 0) {
                        if (!creep.heap) creep.heap = {};
                        creep.heap.path = pathInfo.path;
                        intendedNextPos = pathInfo.path[0];
                    }
                }

                if (!intendedNextPos) continue;
                intent.intendedNextPos = intendedNextPos;

                const posKey = \`\${intendedNextPos.roomName}_\${intendedNextPos.x}_\${intendedNextPos.y}\`;
                const blockingCreepName = currentPositions.get(posKey);

                if (blockingCreepName && blockingCreepName !== creepName) {
                    dependencyGraph.set(creepName, blockingCreepName);

                    const blockingIntent = global.State.trafficIntents.get(blockingCreepName);
                    if (blockingIntent && blockingIntent.intendedNextPos) {
                        const bNextPos = blockingIntent.intendedNextPos;
                        if (bNextPos.roomName === originalPos.roomName && bNextPos.x === originalPos.x && bNextPos.y === originalPos.y) {
                            global.State.swapRegistry.set(creepName, blockingCreepName);
                            global.State.swapRegistry.set(blockingCreepName, creepName);
                        }
                    }
                }
            }

            // Phase 2: Resolve Deadlocks
            DeadlockEngine.detectAndResolve(global.State.trafficIntents, dependencyGraph);

            // Phase 3: Execute Moves
            const remainingIntents = Array.from(global.State.trafficIntents.values());
            remainingIntents.sort((a, b) => {
                const priorityA = (a.creep && a.creep.memory && a.creep.memory.role) ? (ROLE_PRIORITIES.get(a.creep.memory.role) || 0) : 0;
                const priorityB = (b.creep && b.creep.memory && b.creep.memory.role) ? (ROLE_PRIORITIES.get(b.creep.memory.role) || 0) : 0;
                return priorityB - priorityA; // Descending priority
            });

            const processedSwaps = new Set();

            for (const intent of remainingIntents) {
                const { creep, targetPos, opts, intendedNextPos } = intent;
                if (!creep) continue;

                if (global.State.swapRegistry.has(creep.name)) {
                    if (processedSwaps.has(creep.name)) continue;

                    const blockingCreepName = global.State.swapRegistry.get(creep.name);
                    const blockingCreep = Game.creeps[blockingCreepName];

                    if (blockingCreep) {
                        const dx = blockingCreep.pos.x - creep.pos.x;
                        const dy = blockingCreep.pos.y - creep.pos.y;
                        const dir = creep.pos.getDirectionTo(blockingCreep.pos); // Alternative logic

                        // Custom getDirection logic if needed since getDirectionTo exists in Screeps API
                        if (dir) {
                           creep.move(dir);
                           blockingCreep.move(((dir + 3) % 8) + 1);
                        }
                    }

                    processedSwaps.add(creep.name);
                    processedSwaps.add(blockingCreepName);
                    global.State.trafficIntents.delete(creep.name);
                    global.State.trafficIntents.delete(blockingCreepName);
                    continue;
                }

                if (intendedNextPos) {
                    const posKey = \`\${intendedNextPos.roomName}_\${intendedNextPos.x}_\${intendedNextPos.y}\`;
                    const blockingCreepName = currentPositions.get(posKey);

                    if (blockingCreepName && blockingCreepName !== creep.name) {
                        if (!global.State.trafficIntents.has(blockingCreepName)) {
                            // Blocked by a stationary creep, do not move
                            global.State.trafficIntents.delete(creep.name);
                            continue;
                        }
                    }
                }

                movement.moveTo(creep, targetPos, opts);
                global.State.trafficIntents.delete(creep.name);
            }
        } catch (e) {
            console.error(\`[TrafficManager Execution Error]: \${e.stack}\`);
        }
    }`;

// Since the old executeIntents, resolveDeadlocks, and executeSwaps need to be removed or replaced:
// Let's replace the whole bottom part of the file.
const contentLines = content.split('\n');
const startIndex = contentLines.findIndex(line => line.includes('executeIntents() {'));
let endIndex = contentLines.length - 1; // Till module.exports = TrafficManager;

const newContentPart = contentLines.slice(0, startIndex).join('\n') + '\n' + replacement + '\n};\n\nmodule.exports = TrafficManager;\n';
fs.writeFileSync('src/traffic/trafficManager.js', newContentPart);
