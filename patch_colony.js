const fs = require('fs');

// Patch planner.js
let planner = fs.readFileSync('src/colonies/planner.js', 'utf8');
planner = planner.replace(/const plannerState = global\.State\.roomPlanner\.get\(room\.name\);/,
`const plannerState = global.State.roomPlanner.get(room.name);

            // Hardcode coordinate stamp for 5 extensions
            const spawns = global.State.spawnsByRoom.get(room.name) || [];
            if (spawns.length > 0) {
                const spawn = spawns[0];
                const stamp = [
                    {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}, {x: 1, y: 1}
                ];
                const plannedStructures = plannerState.get('plannedStructures');
                for (let i = 0; i < stamp.length && i < 5; i++) {
                    const tx = spawn.pos.x + stamp[i].x;
                    const ty = spawn.pos.y + stamp[i].y;
                    const id = \`\${STRUCTURE_EXTENSION}-\${tx}-\${ty}\`;
                    if (!plannedStructures.has(id)) {
                        plannedStructures.set(id, {
                            pos: new RoomPosition(tx, ty, room.name),
                            type: STRUCTURE_EXTENSION,
                            id: id
                        });
                    }
                }
            }

            // Disable dynamic road and container generation
            if (true) {
                rampartPlanner.run(room, plannerState, plannerState.get('plannedStructures'));
                return;
            }
`);
fs.writeFileSync('src/colonies/planner.js', planner);

// Patch colonyManager.js
let colonyManager = fs.readFileSync('src/colonies/colonyManager.js', 'utf8');
colonyManager = colonyManager.replace(/const state = creep\.heap\.state;/,
`const state = creep.heap.state;

        // Multi-room OS Interrupt: Override Upgrader to Builder if sites exist
        if (state === 'upgrade' && sites.length > 0) {
            creep.heap.state = 'build';
            creep.heap.targetId = sites[0].id;
        }`);
fs.writeFileSync('src/colonies/colonyManager.js', colonyManager);
