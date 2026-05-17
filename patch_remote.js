const fs = require('fs');

let remoteEconomy = fs.readFileSync('src/managers/RemoteEconomyManager.js', 'utf8');
remoteEconomy = remoteEconomy.replace(/if \(colonyRemoteHarvesters\.length > 0\) \{/,
`// Deploy remote miners and haulers to 1-2 adjacent rooms using cached paths
        const exits = Game.map.describeExits(room.name);
        if (exits) {
            for (const direction in exits) {
                const targetRoomName = exits[direction];
                const route = Game.map.findRoute(room.name, targetRoomName);
                if (route && route.length <= 2) {
                    // Cache the route for future use (simplified here, assume it's valid)
                    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
                    if (!Memory.rooms[room.name].remoteRoutes) Memory.rooms[room.name].remoteRoutes = {};
                    Memory.rooms[room.name].remoteRoutes[targetRoomName] = route;
                }
            }
        }

        if (colonyRemoteHarvesters.length > 0) {`);
fs.writeFileSync('src/managers/RemoteEconomyManager.js', remoteEconomy);
