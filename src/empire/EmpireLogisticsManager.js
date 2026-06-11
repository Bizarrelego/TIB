/**
 * Empire Logistics Manager
 * Balances resources across the empire by transferring energy, minerals, and power between colony Terminals.
 * Includes Emergency Crisis Intervention for starving colonies.
 */
class EmpireLogisticsManager {
    static run() {
        if (Game.time % 50 !== 0) return;
        if (!global.State || !global.State.colonies) return;

        EmpireLogisticsManager.handleEmergencyEnergy();
        EmpireLogisticsManager.sendEnergyToLowRCLRooms();
        EmpireLogisticsManager.balanceMinerals();
        EmpireLogisticsManager.balancePower();
    }

    /**
     * Rescues starving colonies (Storage + Terminal < 20k energy)
     * by pulling energy from the richest RCL 7+ colonies.
     */
    static handleEmergencyEnergy() {
        const EMERGENCY_THRESHOLD = 20000;
        const PROVIDER_MIN_STORAGE = 100000;
        const BATCH_SIZE = 25000;

        const allRooms = Array.from(global.State.colonies.values()).map(c => Game.rooms[c.name]).filter(r => r && r.terminal && r.terminal.my && r.storage);

        const criticalRooms = allRooms.filter(r =>
            r.storage.store.getUsedCapacity(RESOURCE_ENERGY) + r.terminal.store.getUsedCapacity(RESOURCE_ENERGY) < EMERGENCY_THRESHOLD
        );

        if (criticalRooms.length === 0) return;

        const providers = allRooms.filter(r =>
            r.controller.level >= 7 &&
            r.storage.store.getUsedCapacity(RESOURCE_ENERGY) > PROVIDER_MIN_STORAGE &&
            r.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= BATCH_SIZE
        );

        if (providers.length === 0) return;

        // Help the poorest colony first
        criticalRooms.sort((a, b) => (a.storage.store.getUsedCapacity(RESOURCE_ENERGY) + a.terminal.store.getUsedCapacity(RESOURCE_ENERGY)) -
                                     (b.storage.store.getUsedCapacity(RESOURCE_ENERGY) + b.terminal.store.getUsedCapacity(RESOURCE_ENERGY)));
        
        for (const receiver of criticalRooms) {
            let bestProvider = null;
            let minCost = Infinity;

            for (const provider of providers) {
                if (provider.name === receiver.name) continue;
                if (provider.terminal.cooldown > 0) continue;

                const cost = Game.market.calcTransactionCost(BATCH_SIZE, provider.name, receiver.name);
                if (cost < minCost && provider.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= BATCH_SIZE + cost) {
                    minCost = cost;
                    bestProvider = provider;
                }
            }

            if (bestProvider) {
                const result = bestProvider.terminal.send(RESOURCE_ENERGY, BATCH_SIZE, receiver.name);
                if (result === OK) {
                    console.log(`[EmpireLogistics] EMERGENCY: Sent ${BATCH_SIZE} energy from ${bestProvider.name} to rescue ${receiver.name} (Cost: ${minCost})`);
                    // Terminal can only send once per tick
                    providers.splice(providers.indexOf(bestProvider), 1);
                }
            }
        }
    }

    /**
     * Funnels excess energy from high-level colonies to bootstrapping colonies (RCL < 6)
     */
    static sendEnergyToLowRCLRooms() {
        const PROVIDER_MIN_STORAGE = 300000;
        const PROVIDER_MIN_TERMINAL = 50000;
        const BATCH_SIZE = 25000;
        const MAX_COST = 5000;

        const allRooms = Array.from(global.State.colonies.values()).map(c => Game.rooms[c.name]).filter(r => r && r.terminal && r.terminal.my && r.storage);

        const providers = allRooms.filter(r =>
            r.controller.level >= 7 &&
            r.storage.store.getUsedCapacity(RESOURCE_ENERGY) > PROVIDER_MIN_STORAGE &&
            r.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > PROVIDER_MIN_TERMINAL &&
            r.terminal.cooldown === 0
        );

        if (providers.length === 0) return;

        const receivers = allRooms.filter(r =>
            r.controller.level < 6 &&
            r.storage.store.getUsedCapacity(RESOURCE_ENERGY) + r.terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 100000 &&
            r.terminal.store.getFreeCapacity() > BATCH_SIZE
        );

        if (receivers.length === 0) return;

        // Help the poorest colony first
        receivers.sort((a, b) => (a.storage.store.getUsedCapacity(RESOURCE_ENERGY) + a.terminal.store.getUsedCapacity(RESOURCE_ENERGY)) -
                                 (b.storage.store.getUsedCapacity(RESOURCE_ENERGY) + b.terminal.store.getUsedCapacity(RESOURCE_ENERGY)));

        for (const receiver of receivers) {
            let bestProvider = null;
            let minCost = MAX_COST + 1;

            for (const provider of providers) {
                if (provider.name === receiver.name) continue;
                const cost = Game.market.calcTransactionCost(BATCH_SIZE, provider.name, receiver.name);
                if (cost < minCost && provider.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= BATCH_SIZE + cost) {
                    minCost = cost;
                    bestProvider = provider;
                }
            }

            if (bestProvider && minCost <= MAX_COST) {
                const result = bestProvider.terminal.send(RESOURCE_ENERGY, BATCH_SIZE, receiver.name);
                if (result === OK) {
                    console.log(`[EmpireLogistics] PROGRESSION: Sent ${BATCH_SIZE} energy from ${bestProvider.name} to accelerate ${receiver.name} (Cost: ${minCost})`);
                    providers.splice(providers.indexOf(bestProvider), 1);
                }
            }
        }
    }

    /**
     * Distributes the 7 base minerals evenly across all terminals.
     * If a colony lacks a base mineral, a colony with > 5000 will send it some.
     */
    static balanceMinerals() {
        const rawMinerals = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];
        const BATCH_SIZE = 2000;
        const TARGET_AMOUNT = 5000;
        const PROVIDER_MIN = TARGET_AMOUNT + BATCH_SIZE;

        const allRooms = Array.from(global.State.colonies.values()).map(c => Game.rooms[c.name]).filter(r => r && r.terminal && r.terminal.my && r.storage);

        for (const mineral of rawMinerals) {
            const providers = allRooms.filter(r => r.terminal.store.getUsedCapacity(mineral) > PROVIDER_MIN && r.terminal.cooldown === 0);
            if (providers.length === 0) continue;

            const receivers = allRooms.filter(r => r.terminal.store.getUsedCapacity(mineral) < TARGET_AMOUNT && r.terminal.store.getFreeCapacity() > BATCH_SIZE);
            if (receivers.length === 0) continue;

            // Sort receivers by who has the least
            receivers.sort((a, b) => a.terminal.store.getUsedCapacity(mineral) - b.terminal.store.getUsedCapacity(mineral));
            // Sort providers by who has the most
            providers.sort((a, b) => b.terminal.store.getUsedCapacity(mineral) - a.terminal.store.getUsedCapacity(mineral));

            for (const receiver of receivers) {
                if (providers.length === 0) break;
                const provider = providers[0];

                const cost = Game.market.calcTransactionCost(BATCH_SIZE, provider.name, receiver.name);
                if (provider.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= cost) {
                    const result = provider.terminal.send(mineral, BATCH_SIZE, receiver.name);
                    if (result === OK) {
                        console.log(`[EmpireLogistics] BALANCING: Sent ${BATCH_SIZE} ${mineral} from ${provider.name} to ${receiver.name}`);
                        providers.shift(); // Provider used their cooldown
                    }
                }
            }
        }
    }

    /**
     * Funnels RESOURCE_POWER to colonies with active Power Spawns or high RCL rooms capable of processing it.
     */
    static balancePower() {
        const BATCH_SIZE = 500;
        const PROVIDER_MIN = 1000;

        const allRooms = Array.from(global.State.colonies.values()).map(c => Game.rooms[c.name]).filter(r => r && r.terminal && r.terminal.my && r.storage);

        const providers = allRooms.filter(r => r.terminal.store.getUsedCapacity(RESOURCE_POWER) > PROVIDER_MIN && r.terminal.cooldown === 0);
        if (providers.length === 0) return;

        // Receivers are RCL 8 rooms with a Power Spawn that are low on Power
        const receivers = allRooms.filter(r => {
            if (r.controller.level < 8) return false;
            const powerSpawns = r.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_POWER_SPAWN });
            if (powerSpawns.length === 0) return false;
            return r.terminal.store.getUsedCapacity(RESOURCE_POWER) < 5000 && r.terminal.store.getFreeCapacity() > BATCH_SIZE;
        });

        if (receivers.length === 0) return;

        receivers.sort((a, b) => a.terminal.store.getUsedCapacity(RESOURCE_POWER) - b.terminal.store.getUsedCapacity(RESOURCE_POWER));
        providers.sort((a, b) => b.terminal.store.getUsedCapacity(RESOURCE_POWER) - a.terminal.store.getUsedCapacity(RESOURCE_POWER));

        for (const receiver of receivers) {
            if (providers.length === 0) break;
            const provider = providers[0];

            if (provider.name === receiver.name) {
                providers.shift();
                continue;
            }

            const cost = Game.market.calcTransactionCost(BATCH_SIZE, provider.name, receiver.name);
            if (provider.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= cost) {
                const result = provider.terminal.send(RESOURCE_POWER, BATCH_SIZE, receiver.name);
                if (result === OK) {
                    console.log(`[EmpireLogistics] BALANCING: Sent ${BATCH_SIZE} POWER from ${provider.name} to ${receiver.name}`);
                    providers.shift();
                }
            }
        }
    }
}

module.exports = EmpireLogisticsManager;
