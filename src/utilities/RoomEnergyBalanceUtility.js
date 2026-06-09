class RoomEnergyBalanceUtility {
    /**
     * Calculates the net energy flow in a room.
     * @param {string} roomName - The name of the room.
     * @returns {Object} An object containing total energy production rate, consumption rate, net flow, and total deficit.
     */
    static calculateEnergyBalance(roomName) {
        if (!global.State || !global.State.rooms) {
            return { productionRate: 0, consumptionRate: 0, netFlow: 0, totalDeficit: 0 };
        }

        const state = typeof global.State.rooms.get === 'function' ? global.State.rooms.get(roomName) : global.State.rooms[roomName];
        if (!state) {
            return { productionRate: 0, consumptionRate: 0, netFlow: 0, totalDeficit: 0 };
        }

        // 1. Calculate maxSourceProductionRate
        let maxSourceProductionRate = 0;
        if (state.sources && state.sources.length > 0) {
            for (let i = 0; i < state.sources.length; i++) {
                const source = state.sources[i];
                const capacity = source.energyCapacity || 3000;
                maxSourceProductionRate += capacity / 300;
            }
        }

        // 2. Calculate harvesterProductionRate
        let harvesterProductionRate = 0;
        if (state.harvesters && state.harvesters.length > 0) {
            for (let i = 0; i < state.harvesters.length; i++) {
                const creep = state.harvesters[i];
                const workParts = creep.body.filter(part => part.type === WORK).length;
                harvesterProductionRate += workParts * 2;
            }
        }

        // 3. Determine actual productionRate
        const productionRate = Math.min(maxSourceProductionRate, harvesterProductionRate);

        // 4. Calculate consumptionRate
        let consumptionRate = 0;
        if (state.creeps && state.creeps.length > 0) {
            for (let i = 0; i < state.creeps.length; i++) {
                const creep = state.creeps[i];
                const role = creep.memory.role;
                const workParts = creep.body.filter(part => part.type === WORK).length;

                if (role === 'upgrader') {
                    consumptionRate += workParts * 1;
                } else if (role === 'builder') {
                    consumptionRate += workParts * 5;
                } else if (role === 'repairman') {
                    consumptionRate += workParts * 1;
                }
            }
        }

        // 5. Calculate totalDeficit
        let totalDeficit = 0;
        if (state.spawns && state.spawns.length > 0) {
            for (let i = 0; i < state.spawns.length; i++) {
                totalDeficit += state.spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) || 0;
            }
        }
        if (state.extensions && state.extensions.length > 0) {
            for (let i = 0; i < state.extensions.length; i++) {
                totalDeficit += state.extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) || 0;
            }
        }
        if (state.upgraders && state.upgraders.length > 0) {
            for (let i = 0; i < state.upgraders.length; i++) {
                totalDeficit += state.upgraders[i].store.getFreeCapacity(RESOURCE_ENERGY) || 0;
            }
        }

        const netFlow = productionRate - consumptionRate;

        return {
            productionRate,
            consumptionRate,
            netFlow,
            totalDeficit
        };
    }
}

module.exports = RoomEnergyBalanceUtility;
