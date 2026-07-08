import re

with open('src/managers/TrafficManager.js', 'r') as f:
    content = f.read()

search_1 = """        // Pass 1: Global Path Generation & Collection
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];"""

replace_1 = """        // Pass 1: Global Path Generation & Collection
        const allCreeps = [];
        for (const colony of global.State.colonies.values()) {
            if (colony.creeps) allCreeps.push(...colony.creeps);
        }
        for (let i = 0; i < allCreeps.length; i++) {
            const creep = allCreeps[i];"""

content = content.replace(search_1, replace_1)

with open('src/managers/TrafficManager.js', 'w') as f:
    f.write(content)

print("Patched TrafficManager.js run loop")
