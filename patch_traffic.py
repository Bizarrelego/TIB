import re

with open('src/managers/TrafficManager.js', 'r') as f:
    content = f.read()

search_1 = """            // Fixes stationary creep deadlocks by injecting their positions as unwalkable (255) into a tick-cached cloned matrix, forcing PathFinder to route around them.
            for (const creepName in Game.creeps) {
                const c = Game.creeps[creepName];
                if (c.room.name !== roomName) continue;
                const role = (c.memory.role || '').toLowerCase();
                if (role === 'harvester' || role === 'upgrader' || (c.heap && c.heap.sitTargetId)) {
                    tickMatrix.set(c.pos.x, c.pos.y, 255);
                }
            }"""

replace_1 = """            // Fixes stationary creep deadlocks by injecting their positions as unwalkable (255) into a tick-cached cloned matrix, forcing PathFinder to route around them.
            const creepsInRoom = roomState.creeps || [];
            for (let i = 0; i < creepsInRoom.length; i++) {
                const c = creepsInRoom[i];
                const role = (c.memory.role || '').toLowerCase();
                if (role === 'harvester' || role === 'upgrader' || (c.heap && c.heap.sitTargetId)) {
                    tickMatrix.set(c.pos.x, c.pos.y, 255);
                }
            }"""

content = content.replace(search_1, replace_1)

with open('src/managers/TrafficManager.js', 'w') as f:
    f.write(content)

print("Patched TrafficManager.js")
