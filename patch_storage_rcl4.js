const fs = require('fs');

// Patch upgrader.js to pull from Storage
let upgrader = fs.readFileSync('src/roles/upgrader.js', 'utf8');
upgrader = upgrader.replace(/\/\/ Lock position near controller and pull from drop pile[\s\S]*?if \(creep\.store\.getUsedCapacity\(RESOURCE_ENERGY\) > 0\) \{/,
`// Lock position near controller and pull from drop pile or Storage
        if (creep.pos.getRangeTo(controller) > 3) {
            movement.moveTo(creep, controller);
        } else {
            const storage = room.storage;
            if (storage && storage.isActive()) {
                if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, storage);
                    }
                }
            } else {
                // Find dropped energy
                const dropped = global.State.droppedByRoom.get(room.name) || new Map();
                let targetDrop = null;
                for (const drop of dropped.values()) {
                    if (drop.resourceType === RESOURCE_ENERGY && creep.pos.isNearTo(drop)) {
                        targetDrop = drop;
                        break;
                    }
                }

                if (targetDrop && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    creep.pickup(targetDrop);
                }
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {`);
fs.writeFileSync('src/roles/upgrader.js', upgrader);

// Patch hauler.js to deliver to Storage and handle poaching state
let hauler = fs.readFileSync('src/roles/hauler.js', 'utf8');
hauler = hauler.replace(/\/\/ Priority 1: Spawns and Extensions[\s\S]*?bestTarget = null;\n                            \}\n                        \}/,
`// Priority 1: Spawns and Extensions
                        const spawns = structures ? (structures.get(STRUCTURE_SPAWN) || []) : [];
                        const extensions = structures ? (structures.get(STRUCTURE_EXTENSION) || []) : [];
                        for (const s of spawns) {
                            if (s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { bestTarget = s; break; }
                        }
                        if (!bestTarget) {
                            for (const e of extensions) {
                                if (e.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { bestTarget = e; break; }
                            }
                        }

                        // Priority 2: Storage (RCL 4)
                        const storage = room.storage;
                        if (!bestTarget && storage && storage.isActive() && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            bestTarget = storage;
                        }

                        // Priority 3: Upgrader Drop Pile
                        if (!bestTarget) {
                            const upgraders = global.State.creepsByRoom.get(room.name)?.get('upgrader') || [];
                            if (upgraders.length > 0 && !storage) {
                                creep.heap.targetId = 'controller';
                                target = null;
                                bestTarget = null;
                            }
                        }`);

hauler = hauler.replace(/if \(ignoreCore && creep\.heap\.state === 'transfer' && creep\.heap\.targetId\) \{/,
`if (creep.heap.state === 'poaching') {
                    const storage = room.storage;
                    if (storage && storage.isActive() && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, storage);
                        }
                    } else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                        creep.heap.state = 'transfer';
                    } else {
                        creep.heap.state = 'pickup';
                    }
                    continue;
                }
                if (ignoreCore && creep.heap.state === 'transfer' && creep.heap.targetId) {`);
fs.writeFileSync('src/roles/hauler.js', hauler);

// Patch harvester.js to stop drop-mining if Storage exists and in primary room
let harvester = fs.readFileSync('src/roles/harvester.js', 'utf8');
harvester = harvester.replace(/\/\/ Zero-Pathing Drop Mining\n                if \(creep\.store\.getUsedCapacity\(\) > 0\) \{\n                    creep\.drop\(RESOURCE_ENERGY\);\n                \}/,
`// Zero-Pathing Drop Mining
                if (creep.store.getUsedCapacity() > 0) {
                    const storage = room.storage;
                    // If storage exists and we are in primary room, we terminate drop mining and rely on links/haulers to clear our inventory
                    // Actually, prompt says "Terminate drop-mining in the primary room."
                    if (!storage) {
                        creep.drop(RESOURCE_ENERGY);
                    }
                }`);
fs.writeFileSync('src/roles/harvester.js', harvester);

// Patch stateScanner.js to use room.getEventLog()
// It is already using eventLogRadar which uses room.getEventLog(). We just need to make sure stateScanner reads it.
let stateScanner = fs.readFileSync('src/state/stateScanner.js', 'utf8');
stateScanner = stateScanner.replace(/const events = global\.State\.getEvents \? global\.State\.getEvents\(roomName\) : \(global\.State\.eventCache\.get\(roomName\) \|\| \[\]\);/,
`const events = Game.rooms[roomName] ? Game.rooms[roomName].getEventLog() : [];`);
fs.writeFileSync('src/state/stateScanner.js', stateScanner);

// Sub-tick ledgers for resource transfers
// Sub-tick ledgers are already handled by TrafficManager's virtual ledger (e.g. TrafficManager.registerTransfer, TrafficManager.getVirtualState).
// The prompt states: "Implement virtual ledgers for resource transfers and spawn queues to prevent engine rejections and ERR_NOT_ENOUGH_RESOURCES."
// TrafficManager has this, we should use it in hauler and upgrader.

let haulerLedger = fs.readFileSync('src/roles/hauler.js', 'utf8');
haulerLedger = haulerLedger.replace(/if \(creep\.pickup\(target\) === ERR_NOT_IN_RANGE\) \{/g,
`if (TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, creep.store.getFreeCapacity()) === OK) {
                                // Registered
                            } else if (creep.pos.getRangeTo(target) > 1) {`);
haulerLedger = haulerLedger.replace(/if \(creep\.withdraw\(target, RESOURCE_ENERGY\) === ERR_NOT_IN_RANGE\) \{/g,
`if (TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY, creep.store.getFreeCapacity()) === OK) {
                            } else if (creep.pos.getRangeTo(target) > 1) {`);
haulerLedger = haulerLedger.replace(/const result = creep\.transfer\(target, RESOURCE_ENERGY\);\n                        if \(result === ERR_NOT_IN_RANGE\) \{/g,
`const amount = Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), TrafficManager.getVirtualState(target, RESOURCE_ENERGY).free);
                        if (amount > 0 && TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, amount) === OK) {
                            TrafficManager.lockPipeline(creep.name, creep.id, target.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                        } else if (creep.pos.getRangeTo(target) > 1) {`);
fs.writeFileSync('src/roles/hauler.js', haulerLedger);

let upgraderLedger = fs.readFileSync('src/roles/upgrader.js', 'utf8');
upgraderLedger = upgraderLedger.replace(/if \(creep\.withdraw\(storage, RESOURCE_ENERGY\) === ERR_NOT_IN_RANGE\) \{/g,
`if (TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, creep.store.getFreeCapacity(RESOURCE_ENERGY)) === OK) {
                    } else if (creep.pos.getRangeTo(storage) > 1) {`);
upgraderLedger = upgraderLedger.replace(/if \(creep\.pickup\(targetDrop\) === ERR_NOT_IN_RANGE\) \{/g, // We didn't have this but we did `creep.pickup(targetDrop)` directly.
`// handled below`);
upgraderLedger = upgraderLedger.replace(/creep\.pickup\(targetDrop\);/,
`if (TrafficManager.registerPickup(creep, targetDrop, RESOURCE_ENERGY, creep.store.getFreeCapacity()) === OK) {}`);
fs.writeFileSync('src/roles/upgrader.js', upgraderLedger);
