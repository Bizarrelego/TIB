/**
 * @file defense.js
 * @description Manages DEFCON handling, ramparts, and killbox funneling.
 */

const { determineDefcon, DEFCON } = require('../constants/defcon');
const TowerManager = require('../managers/TowerManager');
const SpawnQueueManager = require('../managers/SpawnQueueManager');
const rampartMelee = require('../roles/rampartMelee');
const HeatmapGenerator = require('../traffic/heatmapGenerator');
const CostMatrixCache = require('../traffic/costMatrixCache');

module.exports = {
    /**
     * Runs defense logistics for a given room.
     * @param {Room} room
     */
    run(room) {
        try {
            const defconLevel = determineDefcon(room.name);

            // Dynamic Heatmap Generation
            const hostiles = global.State && global.State.hostilesByRoom ? global.State.hostilesByRoom.get(room.name) : null;
            if (hostiles && hostiles.size > 0) {
                const dynamicMatrix = HeatmapGenerator.generate(room.name, hostiles.values());
                CostMatrixCache.setDynamic(room.name, dynamicMatrix);
            } else {
                CostMatrixCache.deleteDynamic(room.name);
            }

            if (defconLevel <= DEFCON.CRITICAL) {
                room.memory.haltUpgrades = true;
            } else {
                room.memory.haltUpgrades = false;
            }

            let defenseRepairTarget = null;

            // Event-Driven O(1) Repair Queue lookup
            if (global.State.repairQueues && global.State.repairQueues.has(room.name)) {
                const queue = global.State.repairQueues.get(room.name);
                for (let i = 0; i < 100; i++) {
                    if (queue[i].size > 0) {
                        for (const id of queue[i]) {
                            const target = Game.getObjectById(id);
                            if (target && (target.structureType === STRUCTURE_RAMPART || target.structureType === STRUCTURE_WALL) && target.hits < target.hitsMax) {
                                defenseRepairTarget = target;
                                break;
                            } else if (!target) {
                                queue[i].delete(id);
                            }
                        }
                        if (defenseRepairTarget) break;
                    }
                }
            }

            TowerManager.run(room, defenseRepairTarget);

            if (defconLevel <= DEFCON.ALERT) {
                // Request rampartMelee creeps when under attack
                const roomCreeps = global.State.creepsByRoom ? global.State.creepsByRoom.get(room.name) : null;
                let rampartMeleeCount = 0;

                if (roomCreeps) {
                    const rampartMelees = roomCreeps.get('rampartMelee');
                    if (rampartMelees) {
                        rampartMeleeCount = rampartMelees.length;
                    }
                }

                // Add pending requests to the count
                if (SpawnQueueManager.globalQueue.has(room.name)) {
                    const requests = SpawnQueueManager.globalQueue.get(room.name);
                    for (const req of requests) {
                        if (req.role === 'rampartMelee') {
                            rampartMeleeCount++;
                        }
                    }
                }

                // Aim for 1-2 rampartMelee creeps based on DEFCON severity
                const targetCount = defconLevel <= DEFCON.CRITICAL ? 2 : 1;

                if (rampartMeleeCount < targetCount) {
                    SpawnQueueManager.requestRampartMelee(room);
                }
            }

            // Top-down assignment of targets for rampartMelee
            const roomCreeps = global.State.creepsByRoom ? global.State.creepsByRoom.get(room.name) : null;
            if (roomCreeps) {
                const rampartMelees = roomCreeps.get('rampartMelee') || [];
                for (const creep of rampartMelees) {
                    if (!creep.heap) creep.heap = {};

                    if (!creep.heap.parkPos) {
                        const structuresMapLocal = global.State.structuresByRoom ? global.State.structuresByRoom.get(room.name) : null;
                        if (structuresMapLocal) {
                            const rampartsLocal = structuresMapLocal.get(STRUCTURE_RAMPART) || [];
                            if (rampartsLocal.length > 0) {
                                const originLocal = room.controller || (global.State.spawnsByRoom && global.State.spawnsByRoom.get(room.name) && global.State.spawnsByRoom.get(room.name)[0]);
                                if (originLocal) {
                                    let closestRampart = null;
                                    let minDist = Infinity;
                                    for (const rampart of rampartsLocal) {
                                        const dist = Math.max(Math.abs(rampart.pos.x - originLocal.pos.x), Math.abs(rampart.pos.y - originLocal.pos.y));
                                        if (dist < minDist) {
                                            minDist = dist;
                                            closestRampart = rampart;
                                        }
                                    }
                                    if (closestRampart) {
                                        // Cache as simple coordinate object
                                        creep.heap.parkPos = { x: closestRampart.pos.x, y: closestRampart.pos.y, roomName: closestRampart.pos.roomName };
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Execute defender roles
            rampartMelee.run(room);

        } catch (e) {
            console.error(`[DefenseManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
};
