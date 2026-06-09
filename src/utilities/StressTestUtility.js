/**
 * Utility to inject mock data into global.State for automated stress testing.
 */
class StressTestUtility {
    static run() {
        if (!global.State || !global.State.rooms) return;

        let mainRoom = null;
        for (const [roomName, roomState] of global.State.rooms) {
            if (roomState.spawns && roomState.spawns.length > 0) {
                mainRoom = roomName;
                break;
            }
        }
        if (!mainRoom) return;

        const roomState = global.State.rooms.get(mainRoom);
        const spawn = roomState.spawns[0];

        // THE KITE & FLEE STRESS TEST
        // Mocks hostiles in global state to validate threat-matrix generation and ranger kiting displacement.
        if (Memory.stressTestCombat) {
            if (!roomState.hostiles) roomState.hostiles = [];
            
            for (let i = 0; i < 3; i++) {
                roomState.hostiles.push({
                    id: `mock_hostile_${i}`,
                    pos: {
                        x: spawn.pos.x + 3 + i,
                        y: spawn.pos.y + 3 + i,
                        roomName: mainRoom,
                        getRangeTo: function(pos) {
                            return Math.max(Math.abs(this.x - pos.x), Math.abs(this.y - pos.y));
                        }
                    },
                    body: [
                        { type: 'attack', hits: 100 },
                        { type: 'ranged_attack', hits: 100 }
                    ],
                    hits: 1000,
                    hitsMax: 1000,
                    my: false,
                    owner: { username: 'Invader' }
                });
            }
        }

        // THE TRAFFIC CHOKEPOINT TEST
        // Forces catastrophic path collision across the entire colony to validate the DFS traffic resolver and stationary creep anchoring.
        if (Memory.stressTestTraffic) {
            let count = 0;
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep.room.name !== mainRoom) continue;
                
                const role = creep.memory.role || '';
                if (role === 'meleeCreep' || role === 'rangerCreep' || role === 'medicCreep') continue;
                if (!creep.heap) continue;

                creep.heap.targetId = null;
                creep.heap.actionIntent = 'move';
                
                if (count % 2 === 0) {
                    creep.heap.destination = { x: 10, y: 10, roomName: mainRoom, range: 1 };
                } else {
                    creep.heap.destination = { x: 40, y: 40, roomName: mainRoom, range: 1 };
                }
                count++;
            }
        }
    }
}

module.exports = StressTestUtility;
