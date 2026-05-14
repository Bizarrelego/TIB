const fs = require('fs');
let code = fs.readFileSync('src/operations/scoutManager.js', 'utf8');

const replacement1 = `                        // Priority 1: Unseen room
                        if (!intel || !intel.lastSeen) {
                            scoutCreep.heap.targetRoom = neighborRoom;
                            return neighborRoom;
                        }`;

code = code.replace(/\/\/ Priority 1: Unseen room\n                        if \(\!intel \|\| \!intel\.lastSeen\) \{\n                            return neighborRoom;\n                        \}/, replacement1);

const replacement2 = `    // Sort and return Priority 2 if available
    if (highScores.length > 0) {
        highScores.sort((a, b) => b.score - a.score || a.distance - b.distance);
        scoutCreep.heap.targetRoom = highScores[0].roomName;
        return highScores[0].roomName;
    }

    // Sort and return Priority 3 if available
    if (staleRooms.length > 0) {
        staleRooms.sort((a, b) => b.age - a.age || a.distance - b.distance);
        scoutCreep.heap.targetRoom = staleRooms[0].roomName;
        return staleRooms[0].roomName;
    }`;

code = code.replace(/\/\/ Sort and return Priority 2 if available[\s\S]*?return staleRooms\[0\]\.roomName;\n    \}/, replacement2);

fs.writeFileSync('src/operations/scoutManager.js', code);
