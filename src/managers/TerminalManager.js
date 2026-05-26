/**
 * Handles terminal resource management and inter-room transfers.
 */
class TerminalManager {
    /**
     * Executes terminal operations per room based on global intents.
     * @param {Room} room - The room object.
     */
    static run(room) {
        if (Game.cpu.bucket < 2000) return; // CPU Throttling

        if (!room.terminal || room.terminal.cooldown > 0) return;

        try {
            if (global.State && global.State.terminalIntents && global.State.terminalIntents.has(room.name)) {
                const intent = global.State.terminalIntents.get(room.name);
                if (intent) {
                    const result = room.terminal.send(intent.resourceType, intent.amount, intent.targetRoom);
                    if (result === OK) {
                        // Clear intent once executed
                        global.State.terminalIntents.delete(room.name);
                        console.log(`[TerminalManager] Sent ${intent.amount} ${intent.resourceType} from ${room.name} to ${intent.targetRoom}`);
                    }
                }
            }
        } catch (e) {
            console.log(`[TerminalManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
}

module.exports = TerminalManager;
