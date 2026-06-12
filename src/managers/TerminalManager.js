/**
 * Terminal Manager (Empire Logistics)
 * 
 * Implements the Memory.empire.logistics queue.
 * Consumers (RCL 6 rooms, starved rooms, etc.) place requests.
 * Suppliers fulfill them every 10 ticks based on market transaction costs.
 */
class TerminalManager {
    static run() {
        if (Game.time % 10 !== 0) return;
        if (!global.State || !global.State.colonies) return;

        if (!Memory.empire) Memory.empire = {};
        if (!Memory.empire.logistics) Memory.empire.logistics = [];

        TerminalManager.processLogisticsQueue();
    }

    /**
     * API for consumers to request resources.
     * @param {string} roomName - The colony requesting the resource.
     * @param {string} resourceType - The RESOURCE_* constant.
     * @param {number} amount - The exact amount requested.
     * @param {number} priority - 1 (High/Emergency) to 5 (Low/Progression).
     */
    static requestResource(roomName, resourceType, amount, priority = 3) {
        if (!Memory.empire) Memory.empire = {};
        if (!Memory.empire.logistics) Memory.empire.logistics = [];

        // Check if a request already exists to prevent duplicates
        for (let i = 0; i < Memory.empire.logistics.length; i++) {
            const req = Memory.empire.logistics[i];
            if (req.roomName === roomName && req.resourceType === resourceType) {
                req.amount = amount;
                req.priority = priority;
                return;
            }
        }

        Memory.empire.logistics.push({
            roomName,
            resourceType,
            amount,
            priority,
            tick: Game.time
        });
    }

    static processLogisticsQueue() {
        const queue = Memory.empire.logistics;
        if (!queue || queue.length === 0) return;

        // Sort by priority (1 is highest), then by oldest request
        queue.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.tick - b.tick;
        });

        const allRooms = Array.from(global.State.colonies.values())
            .map(c => Game.rooms[c.name])
            .filter(r => r && r.terminal && r.terminal.my && r.storage);

        // Track terminals that have sent this tick
        const usedTerminals = new Set();

        for (let i = 0; i < queue.length; i++) {
            const request = queue[i];
            const receiverRoom = Game.rooms[request.roomName];
            
            // If the receiver lost their terminal or the request is fulfilled, clear it
            if (!receiverRoom || !receiverRoom.terminal) {
                queue.splice(i, 1);
                i--;
                continue;
            }

            const currentAmount = receiverRoom.terminal.store.getUsedCapacity(request.resourceType) + 
                                  (receiverRoom.storage ? receiverRoom.storage.store.getUsedCapacity(request.resourceType) : 0);
            
            if (currentAmount >= request.amount) {
                queue.splice(i, 1);
                i--;
                continue; // Request fulfilled natively
            }

            const deficit = request.amount - currentAmount;
            const batchSize = Math.min(deficit, 25000); // Max 25k per send to prevent choking

            let bestProvider = null;
            let minCost = Infinity;

            for (const provider of allRooms) {
                if (provider.name === request.roomName) continue;
                if (usedTerminals.has(provider.name)) continue;
                if (provider.terminal.cooldown > 0) continue;

                const available = provider.terminal.store.getUsedCapacity(request.resourceType);
                if (available < batchSize) continue;

                // For energy, ensure provider has surplus
                if (request.resourceType === RESOURCE_ENERGY) {
                    if (provider.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 100000) continue;
                }

                const cost = Game.market.calcTransactionCost(batchSize, provider.name, request.roomName);
                if (cost < minCost && provider.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= cost + (request.resourceType === RESOURCE_ENERGY ? batchSize : 0)) {
                    minCost = cost;
                    bestProvider = provider;
                }
            }

            if (bestProvider) {
                const result = bestProvider.terminal.send(request.resourceType, batchSize, request.roomName);
                if (result === OK) {
                    console.log(`[TerminalManager] FULFILLED (Pri ${request.priority}): Sent ${batchSize} ${request.resourceType} from ${bestProvider.name} to ${request.roomName} (Cost: ${minCost})`);
                    usedTerminals.add(bestProvider.name);
                }
            }
        }
    }
}

module.exports = TerminalManager;
