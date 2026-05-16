class ResetRecovery {
    checkAndRecover() {
        if (global.__resetDetected === undefined) {
            global.__resetDetected = true;
            console.log(`[ResetRecovery] VM Reset detected. Rehydrating caches...`);

            if (Memory._recoveryCache) {
                try {
                    const parsed = JSON.parse(Memory._recoveryCache);
                    if (global.Cache) {
                        const targets = ['structures', 'creeps', 'sources'];
                        for (const target of targets) {
                            if (parsed[target] && global.Cache.has(target)) {
                                const targetMap = global.Cache.get(target);
                                for (const key in parsed[target]) {
                                    targetMap.set(key, parsed[target][key]);
                                }
                            }
                        }
                        console.log(`[ResetRecovery] Successfully rehydrated ID dictionaries.`);
                    }
                } catch (e) {
                    console.log(`[ResetRecovery] Failed to parse recovery cache data: ${e.message}`);
                }
            } else {
                console.log(`[ResetRecovery] No recovery cache data found to rehydrate.`);
            }
        }
    }

    saveState() {
        // Throttle saving to prevent CPU overhead, save every 10 ticks
        if (typeof Game !== 'undefined' && Game.time % 10 !== 0) return;

        if (global.Cache) {
            const targets = ['structures', 'creeps', 'sources'];
            const obj = {};

            for (const target of targets) {
                if (global.Cache.has(target)) {
                    const targetMap = global.Cache.get(target);
                    obj[target] = {};
                    for (const [key, value] of targetMap.entries()) {
                        obj[target][key] = value;
                    }
                }
            }

            Memory._recoveryCache = JSON.stringify(obj);
        }
    }
}

module.exports = new ResetRecovery();
