/**
 * Empire-Level Remote Mining Manager
 * Evaluates the mathematical profitability of remote sources using PathFinder.
 * Optimizes CPU and energy utilization by mathematically aborting remote mining operations in mathematically unprofitable or walled-off sectors.
 */
class RemoteMiningManager {
    static run() {
        if (Game.time % 100 !== 0) return;
        if (!global.State || !global.State.colonies) return;

        for (const colony of global.State.colonies.values()) {
            RemoteMiningManager.evaluateColonyNeighbors(colony);
        }
    }

    static evaluateColonyNeighbors(colony) {
        const coreRoom = colony.coreRoom;
        if (!coreRoom) return;

        // Need an anchor to measure distance from
        let anchor = coreRoom.storage;
        if (!anchor) {
            const spawns = coreRoom.find(FIND_MY_SPAWNS);
            if (spawns.length > 0) anchor = spawns[0];
        }
        if (!anchor) return;

        const exits = Game.map.describeExits(coreRoom.name);
        if (!exits) return;

        const neighbors = Object.values(exits);
        for (let i = 0; i < neighbors.length; i++) {
            const adjRoom = neighbors[i];
            const intel = Memory.rooms[adjRoom];
            
            // Only evaluate if we have Intel and it has sources
            if (!intel || !intel.sources || intel.sources.length === 0) continue;
            
            // Don't evaluate owned rooms or SK rooms
            if (intel.controller && intel.controller.owner) continue;
            if (intel.roomType === 'sk') continue;

            let profitable = false;

            for (let j = 0; j < intel.sources.length; j++) {
                const source = intel.sources[j];
                const pos = new RoomPosition(source.x, source.y, adjRoom);

                const ret = PathFinder.search(
                    anchor.pos,
                    { pos: pos, range: 1 },
                    {
                        plainCost: 2,
                        swampCost: 10,
                        maxOps: 10000
                    }
                );

                if (ret.incomplete || ret.path.length > 60) {
                    continue; // Dead weight
                }

                // Calculate exact costs
                const distance = ret.path.length;
                
                // 5 WORK, 1 CARRY, 2 MOVE
                const harvesterCost = 650; 
                
                // Hauler needs (distance * 2) * 10 capacity to make round trip
                // A 100 capacity block (2 CARRY, 1 MOVE) costs 150 energy.
                const requiredCapacity = distance * 2 * 10;
                const haulerCost = Math.ceil(requiredCapacity / 100) * 150;
                
                // Road decays 1 hp per 1000 ticks. Costs 1 energy per hp to repair. Average 0.001 per tile.
                // Accounting for swamp multipliers, we estimate 0.002 average.
                const roadCostPerTick = distance * 0.002;

                const upkeepCost = (harvesterCost / 1500) + (haulerCost / 1500) + roadCostPerTick;
                
                // Source yields 3000 energy every 300 ticks = 10 energy/tick
                const netIncome = 10 - upkeepCost;

                if (netIncome > 0) {
                    profitable = true;
                    break; // If even 1 source is profitable, the room is viable
                }
            }

            if (!profitable) {
                intel.isDeadWeight = true;
            } else {
                intel.isDeadWeight = false;
            }
        }
    }
}

module.exports = RemoteMiningManager;
