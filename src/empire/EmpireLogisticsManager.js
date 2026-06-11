/**
 * Empire Logistics Manager
 * Balances resources across the empire by transferring energy and minerals between colony Terminals.
 */
class EmpireLogisticsManager {
    static run() {
        if (Game.time % 50 !== 0) return;
        if (!global.State || !global.State.colonies) return;

        const senders = [];
        const receivers = [];

        // 1. Identify Senders and Receivers
        for (const colony of global.State.colonies.values()) {
            const roomState = global.State.rooms.get(colony.name);
            if (!roomState || !roomState.storage || !roomState.terminal || !roomState.terminal.my) continue;

            const storageEnergy = roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY);
            const terminalEnergy = roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY);

            // We need energy in terminal to send, but we also want to balance based on Storage health
            if (storageEnergy > 300000 && terminalEnergy > 10000) {
                senders.push({ roomName: colony.name, terminal: roomState.terminal, storageEnergy });
            } else if (storageEnergy < 50000) {
                receivers.push({ roomName: colony.name, terminal: roomState.terminal, storageEnergy });
            }
        }

        // Sort senders (richest first) and receivers (poorest first)
        senders.sort((a, b) => b.storageEnergy - a.storageEnergy);
        receivers.sort((a, b) => a.storageEnergy - b.storageEnergy);

        // 2. Execute Energy Transfers
        for (let i = 0; i < receivers.length; i++) {
            if (senders.length === 0) break;
            
            const receiver = receivers[i];
            const sender = senders[0]; // Take the richest sender

            if (receiver.terminal.store.getFreeCapacity() > 50000) { // Ensure space
                const sendAmount = Math.min(25000, sender.terminal.store.getUsedCapacity(RESOURCE_ENERGY));
                
                if (sendAmount >= 5000) {
                    const result = sender.terminal.send(RESOURCE_ENERGY, sendAmount, receiver.roomName);
                    if (result === OK) {
                        // Successfully sent, remove this sender from the list since a terminal can only send once per tick
                        senders.shift();
                    }
                }
            }
        }

        // Mineral balancing would follow a similar logic structure here
    }
}

module.exports = EmpireLogisticsManager;
