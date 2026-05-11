/* global ATTACK, RANGED_ATTACK, HEAL, DISMANTLE */

const DEFCON = {
    NORMAL: 5,
    CAUTION: 4,
    ALERT: 3,
    CRITICAL: 2,
    EMERGENCY: 1
};

function determineDefcon(roomName) {
    if (!global.State || !global.State.hostilesByRoom) return DEFCON.NORMAL;

    const hostiles = global.State.hostilesByRoom.get(roomName) || [];

    if (hostiles.length === 0) {
        return DEFCON.NORMAL;
    }

    // Simple logic for now: if there are hostiles, go to alert.
    // In the future, this can be expanded to check hostile body parts (ATTACK, RANGED_ATTACK, HEAL, DISMANTLE)
    // to distinguish between harmless scouts and actual threats.

    let hasCombatParts = false;
    for (let i = 0; i < hostiles.length; i++) {
        const creep = hostiles[i];
        if (creep.body) {
            for (let j = 0; j < creep.body.length; j++) {
                const type = creep.body[j].type;
                if (type === ATTACK || type === RANGED_ATTACK || type === HEAL || type === DISMANTLE) {
                    hasCombatParts = true;
                    break;
                }
            }
        } else {
            // Invaders often don't expose body array clearly without active vision or we just assume the worst
            hasCombatParts = true;
        }
        if (hasCombatParts) break;
    }

    if (hasCombatParts) {
        return DEFCON.ALERT; // Or lower depending on threat analysis
    }

    return DEFCON.CAUTION; // Non-combat hostiles (scouts)
}

module.exports = {
    DEFCON,
    determineDefcon
};
