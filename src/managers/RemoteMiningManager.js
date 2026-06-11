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
            
            // Don't evaluate owned rooms
            if (intel.controller && intel.controller.owner) continue;
            
            const isSKRoom = intel.roomType === 'sk';
            // SK rooms are only profitable if we can afford the military upkeep (approx 3500 energy for Paladin)
            // The Paladin costs 3500 and lasts 1500 ticks -> ~2.33 energy per tick
            // A dedicated SKMiner costs about 1200 energy -> 0.8 energy per tick
            const militaryUpkeepPerTick = isSKRoom ? 2.5 : 0;
            const minerCost = isSKRoom ? 1200 : 650;

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
                
                // Hauler needs (distance * 2) * (isSKRoom ? 13 : 10) capacity
                // SK source is 4000/300 = ~13 energy per tick
                const energyPerTick = isSKRoom ? 13.33 : 10;
                const requiredCapacity = distance * 2 * energyPerTick;
                const haulerCost = Math.ceil(requiredCapacity / 100) * 150;
                
                const roadCostPerTick = distance * 0.002;

                const upkeepCost = (minerCost / 1500) + (haulerCost / 1500) + roadCostPerTick + militaryUpkeepPerTick;
                
                const netIncome = energyPerTick - upkeepCost;

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
