const Profiler = require('../utils/profiler');

/**
 * Handles terminal resource management and inter-room transfers.
 */
class TerminalManager {
    /**
     * Executes terminal operations per room.
     * @param {Room} room - The room object.
     */
    static run(room) {
        if (Game.cpu.bucket < 2000) return; // CPU Throttling

        // Execute terminal operations occasionally to save CPU
        if (Game.time % 5 !== 0) return;

        if (!room.terminal || room.terminal.cooldown > 0) return;

        try {
            this.manageEnergyBuffer(room);
            this.distributeResources(room);
        } catch (e) {
            console.log(`[TerminalManager Error] Room ${room.name}: ${e.stack}`);
        }
    }

    /**
     * Balances energy between terminal-equipped rooms to ensure min thresholds are met.
     * @param {Room} room - The room object.
     */
    static manageEnergyBuffer(room) {
        const terminal = room.terminal;
        const TARGET_ENERGY_BUFFER = 50000;

        // If this room has excess energy, look for rooms that need it
        if (terminal.store[RESOURCE_ENERGY] > TARGET_ENERGY_BUFFER + 10000) {
            for (const otherRoomName in Game.rooms) {
                if (otherRoomName === room.name) continue;

                const otherRoom = Game.rooms[otherRoomName];
                if (otherRoom.controller && otherRoom.controller.my && otherRoom.terminal) {
                    if (otherRoom.terminal.store[RESOURCE_ENERGY] < TARGET_ENERGY_BUFFER) {
                        const amountNeeded = TARGET_ENERGY_BUFFER - otherRoom.terminal.store[RESOURCE_ENERGY];
                        const amountToSend = Math.min(amountNeeded, terminal.store[RESOURCE_ENERGY] - TARGET_ENERGY_BUFFER);

                        if (amountToSend > 0) {
                            const cost = Game.market.calcTransactionCost(amountToSend, room.name, otherRoomName);
                            if (terminal.store[RESOURCE_ENERGY] >= amountToSend + cost) {
                                const result = terminal.send(RESOURCE_ENERGY, amountToSend, otherRoomName);
                                if (result === OK) {
                                    console.log(`[TerminalManager] Sent ${amountToSend} energy from ${room.name} to ${otherRoomName}`);
                                    return; // Only one transfer per tick
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Distributes surplus minerals from this room to other rooms lacking the mineral.
     * @param {Room} room - The room object.
     */
    static distributeResources(room) {
        const terminal = room.terminal;
        // Example: maintain 5k of each basic mineral in every terminal
        const TARGET_MINERAL_AMOUNT = 5000;

        for (const resourceType in terminal.store) {
            if (resourceType === RESOURCE_ENERGY) continue; // Handled separately

            const amount = terminal.store[resourceType];
            if (amount > TARGET_MINERAL_AMOUNT + 1000) {
                // Find a room that needs this resource
                for (const otherRoomName in Game.rooms) {
                    if (otherRoomName === room.name) continue;

                    const otherRoom = Game.rooms[otherRoomName];
                    if (otherRoom.controller && otherRoom.controller.my && otherRoom.terminal) {
                        const otherAmount = otherRoom.terminal.store[resourceType] || 0;
                        if (otherAmount < TARGET_MINERAL_AMOUNT) {
                            const amountNeeded = TARGET_MINERAL_AMOUNT - otherAmount;
                            const amountToSend = Math.min(amountNeeded, amount - TARGET_MINERAL_AMOUNT);

                            if (amountToSend > 0) {
                                const cost = Game.market.calcTransactionCost(amountToSend, room.name, otherRoomName);
                                if (terminal.store[RESOURCE_ENERGY] >= cost) {
                                    const result = terminal.send(resourceType, amountToSend, otherRoomName);
                                    if (result === OK) {
                                        console.log(`[TerminalManager] Sent ${amountToSend} ${resourceType} from ${room.name} to ${otherRoomName}`);
                                        return; // Only one transfer per tick
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

for (const method of Object.getOwnPropertyNames(TerminalManager)) {
    if (typeof TerminalManager[method] === 'function' && method !== 'constructor' && method !== 'prototype' && method !== 'name' && method !== 'length') {
        TerminalManager[method] = Profiler.wrap(`TerminalManager.${method}`, TerminalManager[method]);
    }
}

module.exports = TerminalManager;
