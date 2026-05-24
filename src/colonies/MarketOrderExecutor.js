/**
 * Module responsible for executing market orders identified by MarketArbitrageAnalyzer.
 * Handles Game.market.deal calls and return code validation.
 *
 * @module MarketOrderExecutor
 */

/**
 * Result of a trade execution attempt.
 *
 * @typedef {Object} TradeExecutionResult
 * @property {boolean} success - Whether the trade was successfully executed.
 * @property {number} code - The return code from Game.market.deal.
 * @property {string} message - A human-readable description of the result.
 */

/**
 * Attempts to execute a market trade using Game.market.deal.
 * Validates the parameters and handles the return codes, providing specific
 * feedback for missing resources or other engine errors.
 *
 * @param {string} orderId - The ID of the market order to fulfill.
 * @param {number} amount - The amount of resources to trade.
 * @param {string} targetRoomName - The name of the room containing the terminal to use.
 * @returns {TradeExecutionResult} The result of the trade execution attempt.
 */
function executeTrade(orderId, amount, targetRoomName) {
    if (typeof orderId !== 'string' || orderId.length === 0) {
        return { success: false, code: ERR_INVALID_ARGS, message: 'Invalid order ID provided.' };
    }

    if (typeof amount !== 'number' || amount <= 0) {
        return { success: false, code: ERR_INVALID_ARGS, message: 'Trade amount must be a positive number.' };
    }

    if (typeof targetRoomName !== 'string' || targetRoomName.length === 0) {
        return { success: false, code: ERR_INVALID_ARGS, message: 'Invalid target room name provided.' };
    }

    // Explicitly call Game.market.deal
    const result = Game.market.deal(orderId, amount, targetRoomName);

    switch (result) {
        case OK:
            console.log(`[MarketOrderExecutor] Successfully executed trade: order ${orderId}, amount ${amount}, room ${targetRoomName}.`);
            return { success: true, code: OK, message: 'Trade executed successfully.' };

        case ERR_NOT_ENOUGH_RESOURCES:
            console.log(`[MarketOrderExecutor] Trade failed (ERR_NOT_ENOUGH_RESOURCES): room ${targetRoomName} lacks resources or energy for order ${orderId}. Logistics must fulfill deficit.`);
            return { success: false, code: ERR_NOT_ENOUGH_RESOURCES, message: 'Insufficient resources or energy in terminal.' };

        case ERR_TIRED:
            console.log(`[MarketOrderExecutor] Trade failed (ERR_TIRED): terminal in room ${targetRoomName} is on cooldown.`);
            return { success: false, code: ERR_TIRED, message: 'Terminal is currently on cooldown.' };

        case ERR_INVALID_ARGS:
            console.log(`[MarketOrderExecutor] Trade failed (ERR_INVALID_ARGS): invalid order ${orderId} or amount ${amount}.`);
            return { success: false, code: ERR_INVALID_ARGS, message: 'Invalid arguments provided to Game.market.deal.' };

        case ERR_NOT_OWNER:
            console.log(`[MarketOrderExecutor] Trade failed (ERR_NOT_OWNER): room ${targetRoomName} is not owned by the player.`);
            return { success: false, code: ERR_NOT_OWNER, message: 'Player does not own the target room or its terminal.' };

        case ERR_FULL:
            console.log(`[MarketOrderExecutor] Trade failed (ERR_FULL): terminal in room ${targetRoomName} cannot hold the purchased resources.`);
            return { success: false, code: ERR_FULL, message: 'Terminal cannot hold the purchased resources.' };

        default:
            console.log(`[MarketOrderExecutor] Trade failed with unknown error code: ${result} for order ${orderId} in room ${targetRoomName}.`);
            return { success: false, code: result, message: `Unknown Game.market.deal error: ${result}.` };
    }
}

module.exports = {
    executeTrade
};
