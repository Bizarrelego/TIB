const MarketOrderExecutor = require('./MarketOrderExecutor');
const MarketOrderAnalyzer = require('./MarketOrderAnalyzer');

const POWER_SELL_THRESHOLD = 10000;
const POWER_BUY_THRESHOLD = 1000;
const POWER_SPAWN_ALLOCATION_LIMIT = 5000;
const MIN_ENERGY_FOR_POWER_BUY = 300000;
const MIN_CREDITS_FOR_POWER_BUY = 10000;

/**
 * Manages raw Power resource within a colony.
 * Responsible for tracking power inventory and deciding on its allocation
 * (e.g., Power Spawn, market sales, boosting).
 */
class PowerResourceManager {
    /**
     * Executes the Power resource management logic for a room.
     * @param {Room} room - The room object.
     */
    static run(room) {
        if (!room.controller || !room.controller.my || room.controller.level < 8) return;
        if (!room.terminal && !room.storage) return;
        if (Game.cpu.bucket < 2000) return;

        let totalPower = 0;
        let totalEnergy = 0;

        if (room.storage) {
            totalPower += room.storage.store.getUsedCapacity(RESOURCE_POWER);
            totalEnergy += room.storage.store.getUsedCapacity(RESOURCE_ENERGY);
        }

        if (room.terminal) {
            totalPower += room.terminal.store.getUsedCapacity(RESOURCE_POWER);
            totalEnergy += room.terminal.store.getUsedCapacity(RESOURCE_ENERGY);
        }

        // Cache power state to heap for other managers (like logistics)
        if (!global.State.colonyPower) global.State.colonyPower = new Map();
        global.State.colonyPower.set(room.name, totalPower);

        this.allocatePower(room, totalPower);

        // Throttle market operations
        if (Game.time % 10 === 0 && room.terminal && !room.terminal.cooldown) {
            this.handleMarketTrading(room, totalPower, totalEnergy);
        }
    }

    /**
     * Allocates power.
     * Sets targets for the Power Spawn or saving for boosts.
     * @param {Room} room
     * @param {number} totalPower
     */
    static allocatePower(room, totalPower) {
        // Find Power Spawn using global.State cache
        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const powerSpawns = structuresMap.get(STRUCTURE_POWER_SPAWN) || [];
        if (powerSpawns.length === 0) return;

        const powerSpawn = powerSpawns[0];

        // Determine if we should push power to Power Spawn
        // This flag can be read by hubManager or fastFiller to move power to the spawn
        if (!global.State.powerAllocationTarget) global.State.powerAllocationTarget = new Map();

        if (totalPower > POWER_SPAWN_ALLOCATION_LIMIT) {
            // Give everything above reserve to power spawn up to its capacity
            const space = powerSpawn.store.getFreeCapacity(RESOURCE_POWER);
            if (space > 0) {
                global.State.powerAllocationTarget.set(room.name, space);
            } else {
                global.State.powerAllocationTarget.set(room.name, 0);
            }
        } else {
            // Keep reserved for potential boosts or safety net
            global.State.powerAllocationTarget.set(room.name, 0);
        }
    }

    /**
     * Sells excess power or buys power if needed.
     * Uses globally cached market orders from MarketManager to save CPU,
     * and filters outlier/spoof orders.
     * @param {Room} room
     * @param {number} totalPower
     * @param {number} totalEnergy
     */
    static handleMarketTrading(room, totalPower, totalEnergy) {
        if (!room.terminal) return;
        if (!global.State.marketOrders || !global.State.marketOrders.has(RESOURCE_POWER)) return;

        const allPowerOrders = global.State.marketOrders.get(RESOURCE_POWER);
        if (!allPowerOrders || allPowerOrders.length === 0) return;

        const buyOrders = [];
        const sellOrders = [];

        for (let i = 0; i < allPowerOrders.length; i++) {
            if (allPowerOrders[i].type === ORDER_BUY) {
                buyOrders.push(allPowerOrders[i]);
            } else if (allPowerOrders[i].type === ORDER_SELL) {
                sellOrders.push(allPowerOrders[i]);
            }
        }

        // Apply IQR Filter to reject troll/spoof orders
        const outliers = MarketOrderAnalyzer.detectOutliers(buyOrders, sellOrders);
        const outlierIds = new Set();
        for (let i = 0; i < outliers.length; i++) {
            outlierIds.add(outliers[i].id);
        }

        if (totalPower > POWER_SELL_THRESHOLD) {
            const surplus = totalPower - POWER_SELL_THRESHOLD;

            // Filter valid buy orders
            const validBuyOrders = [];
            for (let i = 0; i < buyOrders.length; i++) {
                if (!outlierIds.has(buyOrders[i].id)) {
                    validBuyOrders.push(buyOrders[i]);
                }
            }

            if (validBuyOrders.length === 0) return;

            // Sort by price descending
            validBuyOrders.sort((a, b) => b.price - a.price);

            const bestOrder = validBuyOrders[0];
            const amountToTrade = Math.min(surplus, bestOrder.remainingAmount, 1000);
            if (amountToTrade <= 0) return;

            const cost = Game.market.calcTransactionCost(amountToTrade, room.name, bestOrder.roomName);
            if (room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= cost) {
                MarketOrderExecutor.executeTrade(bestOrder.id, amountToTrade, room.name);
            }

        } else if (totalPower < POWER_BUY_THRESHOLD && totalEnergy > MIN_ENERGY_FOR_POWER_BUY && Game.market.credits > MIN_CREDITS_FOR_POWER_BUY) {
            const deficit = POWER_BUY_THRESHOLD - totalPower;

            // Filter valid sell orders
            const validSellOrders = [];
            for (let i = 0; i < sellOrders.length; i++) {
                if (!outlierIds.has(sellOrders[i].id)) {
                    validSellOrders.push(sellOrders[i]);
                }
            }

            if (validSellOrders.length === 0) return;

            // Sort by price ascending
            validSellOrders.sort((a, b) => a.price - b.price);

            const bestOrder = validSellOrders[0];

            // Basic sanity check to not buy extremely overpriced power
            if (bestOrder.price > 100) return; // Example maximum price threshold

            const amountToTrade = Math.min(deficit, bestOrder.remainingAmount, 1000);
            if (amountToTrade <= 0) return;

            const cost = Game.market.calcTransactionCost(amountToTrade, room.name, bestOrder.roomName);
            if (room.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= cost) {
                MarketOrderExecutor.executeTrade(bestOrder.id, amountToTrade, room.name);
            }
        }
    }
}

module.exports = PowerResourceManager;
