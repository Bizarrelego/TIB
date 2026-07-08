import re

with open('src/managers/TaskAssignmentManager.js', 'r') as f:
    content = f.read()

# Patch getRemoteCensus
search_1 = """            for (const name in Game.creeps) {
                const c = Game.creeps[name];
                if (c.memory.targetRoom) {
                    const key = `${c.memory.role}_${c.memory.colony}_${c.memory.targetRoom}`;
                    global.remoteCensus.set(key, (global.remoteCensus.get(key) || 0) + 1);
                }
            }"""

replace_1 = """            for (const colony of global.State.colonies.values()) {
                for (const c of colony.creeps) {
                    if (c.memory.targetRoom) {
                        const key = `${c.memory.role}_${c.memory.colony}_${c.memory.targetRoom}`;
                        global.remoteCensus.set(key, (global.remoteCensus.get(key) || 0) + 1);
                    }
                }
            }"""
content = content.replace(search_1, replace_1)

# Patch assignFastfiller
search_2 = """                for (const name in Game.creeps) {
                    const c = Game.creeps[name];
                    if (c.memory.role === 'fastfiller' && c.name !== creep.name) {
                        if (c.memory.spotX === s.x && c.memory.spotY === s.y) occupied = true;
                    }
                }"""

replace_2 = """                const colony = global.State.colonies.get(creep.memory.colony);
                const fastfillers = colony && colony.creepsByRole['fastfiller'] ? colony.creepsByRole['fastfiller'] : [];
                for (let j = 0; j < fastfillers.length; j++) {
                    const c = fastfillers[j];
                    if (c.name !== creep.name) {
                        if (c.memory.spotX === s.x && c.memory.spotY === s.y) occupied = true;
                    }
                }"""
content = content.replace(search_2, replace_2)

# Patch assignHarvester
search_3 = """            for (const name in Game.creeps) {
                const c = Game.creeps[name];
                if (c.memory.role === 'harvester' && c.memory.colony === creep.memory.colony && c.memory.targetId) {
                    counts.set(c.memory.targetId, (counts.get(c.memory.targetId) || 0) + 1);
                }
            }"""

replace_3 = """            const colony = global.State.colonies.get(creep.memory.colony);
            const harvesters = colony && colony.creepsByRole['harvester'] ? colony.creepsByRole['harvester'] : [];
            for (let i = 0; i < harvesters.length; i++) {
                const c = harvesters[i];
                if (c.memory.targetId) {
                    counts.set(c.memory.targetId, (counts.get(c.memory.targetId) || 0) + 1);
                }
            }"""
content = content.replace(search_3, replace_3)

with open('src/managers/TaskAssignmentManager.js', 'w') as f:
    f.write(content)

print("Patched TaskAssignmentManager.js")
