/* global DISMANTLE */

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

    let combatPartsCount = 0;

    for (let i = 0; i < hostiles.length; i++) {
        const creep = hostiles[i];
        if (creep.body) {
            for (let j = 0; j < creep.body.length; j++) {
                const type = creep.body[j].type;
                if (type === ATTACK || type === RANGED_ATTACK || type === HEAL || type === DISMANTLE) {
                    combatPartsCount++;
                }
            }
        } else {
            // Invaders often don't expose body array clearly without active vision or we just assume the worst
            combatPartsCount += 5; // Assume at least 5 combat parts to trigger CRITICAL or ALERT
        }
    }

    if (combatPartsCount >= 15) {
        return DEFCON.EMERGENCY;
    } else if (combatPartsCount >= 5) {
        return DEFCON.CRITICAL;
    } else if (combatPartsCount > 0) {
        return DEFCON.ALERT;
    }

    return DEFCON.CAUTION; // Non-combat hostiles (scouts)
}

module.exports = {
    DEFCON,
    determineDefcon
};
