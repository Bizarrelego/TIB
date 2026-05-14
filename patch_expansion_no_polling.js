const fs = require('fs');

let content = fs.readFileSync('src/operations/expansion.js', 'utf8');

// Replace Game.rooms iteration with global.State.controllersByRoom
content = content.replace(/for \(const \[roomName, room\] of Object.entries\(Game.rooms\)\) \{/g,
\`for (const [roomName, controller] of global.State.controllersByRoom.entries()) {
        const room = controller.room;\`);

// Add helper functions
const helpers = \`
function getAdjacentRooms(roomName) {
    const coords = roomName.match(/([WE])([0-9]+)([NS])([0-9]+)/);
    let hDir = coords[1];
    let x = parseInt(coords[2], 10);
    let vDir = coords[3];
    let y = parseInt(coords[4], 10);
    const neighbors = [];

    const getNextCoord = (dir, val, delta) => {
        let newVal = val + delta;
        if (newVal < 0) {
            newVal = Math.abs(newVal) - 1;
            dir = dir === 'W' ? 'E' : (dir === 'E' ? 'W' : (dir === 'N' ? 'S' : 'N'));
        }
        return dir + newVal;
    };

    neighbors.push(getNextCoord(hDir, x, 0) + getNextCoord(vDir, y, -1));
    neighbors.push(getNextCoord(hDir, x, 1) + getNextCoord(vDir, y, 0));
    neighbors.push(getNextCoord(hDir, x, 0) + getNextCoord(vDir, y, 1));
    neighbors.push(getNextCoord(hDir, x, -1) + getNextCoord(vDir, y, 0));

    return neighbors;
}

function getRoomDistance(room1, room2) {
    const c1 = room1.match(/([WE])([0-9]+)([NS])([0-9]+)/);
    const c2 = room2.match(/([WE])([0-9]+)([NS])([0-9]+)/);

    const x1 = c1[1] === 'W' ? -parseInt(c1[2], 10) : parseInt(c1[2], 10) + 1;
    const y1 = c1[3] === 'N' ? -parseInt(c1[4], 10) : parseInt(c1[4], 10) + 1;
    const x2 = c2[1] === 'W' ? -parseInt(c2[2], 10) : parseInt(c2[2], 10) + 1;
    const y2 = c2[3] === 'N' ? -parseInt(c2[4], 10) : parseInt(c2[4], 10) + 1;

    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
\`;

content = content.replace('const SpawnQueueManager = require(\'../managers/SpawnQueueManager\');', 'const SpawnQueueManager = require(\'../managers/SpawnQueueManager\');\n' + helpers);

// Replace Game.map.describeExits in earlyPoaching
content = content.replace(/const exits = Game.map.describeExits\(roomName\);\n        if \(\!exits\) continue;\n\n        for \(const dir in exits\) \{\n            const neighborRoom = exits\[dir\];/g,
\`const neighbors = getAdjacentRooms(roomName);
        for (let i = 0; i < neighbors.length; i++) {
            const neighborRoom = neighbors[i];\`);

// Replace Game.rooms in remoteDenial
content = content.replace(/for \(const roomName of Object.keys\(Game.rooms\)\) \{/g,
\`for (const [roomName, controller] of global.State.controllersByRoom.entries()) {\`);
content = content.replace(/const room = Game.rooms\[roomName\];/g, \`const room = controller.room;\`);

// Replace Object.values(Game.rooms).filter
content = content.replace(/const myRooms = Object.values\(Game.rooms\).filter\(r => r.controller && r.controller.my\);/g,
\`const myRooms = [];
    if (global.State.controllersByRoom) {
        for (const controller of global.State.controllersByRoom.values()) {
            if (controller && controller.my && controller.room) {
                myRooms.push(controller.room);
            }
        }
    }\`);

// Replace Game.map.findRoute
content = content.replace(/const route = Game.map.findRoute\(room.name, bestTarget\);\n            if \(route \!\=\= ERR_NO_PATH && route.length < minRoute\) \{/g,
\`const dist = getRoomDistance(room.name, bestTarget);
            if (dist < minRoute) {\`);
content = content.replace(/minRoute = route.length;/g, \`minRoute = dist;\`);

fs.writeFileSync('src/operations/expansion.js', content);
