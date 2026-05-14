const fs = require('fs');
let code = fs.readFileSync('src/operations/scoutManager.js', 'utf8');

const replacement = `function getScoutTarget(scoutCreep) {
    if (!global.State) return null;
    if (!global.State.intel) global.State.intel = new Map();

    const queue = [scoutCreep.room.name];
    const visited = new Set();
    visited.add(scoutCreep.room.name);

    const maxDistance = 15;
    let depth = 0;

    const highScores = [];
    const staleRooms = [];

    while (queue.length > 0 && depth < maxDistance) {
        const levelSize = queue.length;
        for (let i = 0; i < levelSize; i++) {
            const currentRoom = queue.shift();
            const exits = Game.map.describeExits(currentRoom);

            if (exits) {
                for (const direction in exits) {
                    const neighborRoom = exits[direction];

                    // Hostile Avoidance check
                    const hasHeatmap = global.State.heatmapsByRoom && global.State.heatmapsByRoom.has(neighborRoom);
                    const neighborIntel = global.State.intel.get(neighborRoom);
                    if (hasHeatmap || (neighborIntel && neighborIntel.hostile)) {
                        continue;
                    }

                    if (!visited.has(neighborRoom)) {
                        visited.add(neighborRoom);
                        queue.push(neighborRoom);

                        const intel = global.State.intel.get(neighborRoom);

                        // Priority 1: Unseen room
                        if (!intel || !intel.lastSeen) {
                            return neighborRoom;
                        }

                        // Priority 2: High expansion score
                        if (intel.expansionScore && intel.expansionScore > 0) {
                            highScores.push({ roomName: neighborRoom, score: intel.expansionScore, distance: depth + 1 });
                        }

                        // Priority 3: Stale intel
                        if (Game.time - intel.lastSeen > 1000) {
                            staleRooms.push({ roomName: neighborRoom, age: Game.time - intel.lastSeen, distance: depth + 1 });
                        }
                    }
                }
            }
        }
        depth++;
    }`;

code = code.replace(/function getScoutTarget\(scoutCreep\) \{[\s\S]*?depth\+\+;\n    \}/, replacement);

fs.writeFileSync('src/operations/scoutManager.js', code);
