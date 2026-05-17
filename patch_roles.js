const fs = require('fs');

// Patch harvester.js
let harvester = fs.readFileSync('src/roles/harvester.js', 'utf8');
harvester = harvester.replace(/\/\/ Top-Down Harvester Container Building[\s\S]*?\}\n                \}/,
`// Zero-Pathing Drop Mining
                if (creep.store.getUsedCapacity() > 0) {
                    creep.drop(RESOURCE_ENERGY);
                }`);
fs.writeFileSync('src/roles/harvester.js', harvester);

// Patch hauler.js
let hauler = fs.readFileSync('src/roles/hauler.js', 'utf8');
hauler = hauler.replace(/if \(ignoreCore && creep\.heap\.state === 'transfer' && creep\.heap\.targetId\) \{[\s\S]*?creep\.heap\.targetId = null; \/\/ Invalidate target\n                    \}\n                \}/, '');

hauler = hauler.replace(/let bestTarget = null;\n                        const structures = global\.State\.structuresByRoom\.get\(room\.name\);[\s\S]*?bestTarget = target;\n                        \}/,
`let bestTarget = null;
                        const structures = global.State.structuresByRoom.get(room.name);

                        // Priority 1: Spawns and Extensions
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

                        // Priority 2: Upgrader Drop Pile
                        if (!bestTarget) {
                            const upgraders = global.State.creepsByRoom.get(room.name)?.get('upgrader') || [];
                            if (upgraders.length > 0) {
                                creep.heap.targetId = 'controller';
                                target = null;
                                bestTarget = null;
                            }
                        }`);
fs.writeFileSync('src/roles/hauler.js', hauler);

// Patch upgrader.js
let upgrader = fs.readFileSync('src/roles/upgrader.js', 'utf8');
upgrader = upgrader.replace(/if \(controllerContainer\) \{[\s\S]*?\} else \{/,
`if (false) {
        } else {
            // Lock position near controller and pull from drop pile
            if (creep.pos.getRangeTo(controller) > 3) {
                movement.moveTo(creep, controller);
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

                if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    creep.upgradeController(controller);
                }
            }`);
fs.writeFileSync('src/roles/upgrader.js', upgrader);
