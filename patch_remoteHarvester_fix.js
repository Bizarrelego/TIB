const fs = require('fs');
let code = fs.readFileSync('src/roles/remoteHarvester.js', 'utf8');

const replacement = `            // Check hostiles
            if (global.State.hostilesByRoom && global.State.hostilesByRoom.has(creep.room.name)) {
                const hostiles = global.State.hostilesByRoom.get(creep.room.name);
                if (hostiles && hostiles.length > 0) {
                    // Retreat actively to home room
                    if (creep.memory.homeRoom && creep.room.name !== creep.memory.homeRoom) {
                        const homePos = new RoomPosition(25, 25, creep.memory.homeRoom);
                        movement.moveTo(creep, homePos);
                    }
                    continue;
                }
            }`;

code = code.replace(/\/\/ Check hostiles[\s\S]*?continue; \n                \}\n            \}/, replacement);

fs.writeFileSync('src/roles/remoteHarvester.js', code);
