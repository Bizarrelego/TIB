const fs = require('fs');

let offense = fs.readFileSync('src/operations/offense.js', 'utf8');
offense = offense.replace(/const towers = Game\.rooms\[targetRoomName\]\.find\(FIND_HOSTILE_STRUCTURES, \{\n                filter: s => s\.structureType === STRUCTURE_TOWER\n            \}\);/g,
`const structures = global.State.structuresByRoom.get(targetRoomName);
            const towers = structures ? structures.get(STRUCTURE_TOWER) || [] : [];`);
fs.writeFileSync('src/operations/offense.js', offense);
