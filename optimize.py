import sys

with open('src/managers/TaskAssignmentManager.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Target 1: getRemoteCensus
search1 = """            for (const name in Game.creeps) {
                const c = Game.creeps[name];
                if (c.memory.targetRoom) {
                    const key = `${c.memory.role}_${c.memory.colony}_${c.memory.targetRoom}`;
                    global.remoteCensus.set(key, (global.remoteCensus.get(key) || 0) + 1);
                }
            }"""

replace1 = """            for (const colony of global.State.colonies.values()) {
                for (let i = 0; i < colony.creeps.length; i++) {
                    const c = colony.creeps[i];
                    if (c.memory.targetRoom) {
                        const key = `${c.memory.role}_${c.memory.colony}_${c.memory.targetRoom}`;
                        global.remoteCensus.set(key, (global.remoteCensus.get(key) || 0) + 1);
                    }
                }
            }"""

if search1 in content:
    content = content.replace(search1, replace1)
else:
    print("Failed to find search1")

# Target 2: fastfiller loop
search2 = """                for (const name in Game.creeps) {
                    const c = Game.creeps[name];
                    if (c.memory.role === 'fastfiller' && c.name !== creep.name) {
                        if (c.memory.spotX === s.x && c.memory.spotY === s.y) occupied = true;
                    }
                }"""

replace2 = """                const colony = global.State.colonies.get(creep.memory.colony);
                const fastfillers = colony && colony.creepsByRole['fastfiller'] ? colony.creepsByRole['fastfiller'] : [];
                for (let j = 0; j < fastfillers.length; j++) {
                    const c = fastfillers[j];
                    if (c.name !== creep.name) {
                        if (c.memory.spotX === s.x && c.memory.spotY === s.y) occupied = true;
                    }
                }"""

if search2 in content:
    content = content.replace(search2, replace2)
else:
    print("Failed to find search2")


# Target 3: assignHarvester
search3 = """            for (const name in Game.creeps) {
                const c = Game.creeps[name];
                if (c.memory.role === 'harvester' && c.memory.colony === creep.memory.colony && c.memory.targetId) {
                    counts.set(c.memory.targetId, (counts.get(c.memory.targetId) || 0) + 1);
                }
            }"""

replace3 = """            const colony = global.State.colonies.get(creep.memory.colony);
            const harvesters = colony && colony.creepsByRole['harvester'] ? colony.creepsByRole['harvester'] : [];
            for (let i = 0; i < harvesters.length; i++) {
                const c = harvesters[i];
                if (c.memory.targetId) {
                    counts.set(c.memory.targetId, (counts.get(c.memory.targetId) || 0) + 1);
                }
            }"""

if search3 in content:
    content = content.replace(search3, replace3)
else:
    print("Failed to find search3")

with open('src/managers/TaskAssignmentManager.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
