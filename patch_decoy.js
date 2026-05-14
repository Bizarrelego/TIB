const fs = require('fs');

const content = `/**
 * @file decoy.js
 * @description Parks on enemy sites to block builds. Kites defenders to waste CPU.
 */

const movement = require('../utils/movement');
const CombatManager = require('../managers/CombatManager');

module.exports = {
    /**
     * Executes logic for decoy role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const decoys = roomCreeps.get('decoy');
        if (!decoys || decoys.length === 0) return;

        for (const creep of decoys) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                const targetRoomName = creep.memory.targetRoom;
                if (!targetRoomName) continue;

                // Move to target room
                if (creep.room.name !== targetRoomName) {
                    const targetPos = new RoomPosition(25, 25, targetRoomName);
                    movement.moveTo(creep, targetPos);
                    continue;
                }

                // Bounce off edge
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    const centerPos = new RoomPosition(25, 25, targetRoomName);
                    movement.moveTo(creep, centerPos);
                    continue;
                }

                // Kite hostiles
                const hostiles = global.State.hostilesByRoom.get(creep.room.name);
                if (hostiles && hostiles.length > 0) {
                    if (CombatManager.kite(creep, hostiles)) {
                        continue; // Kiting took precedence
                    }
                }

                // Park on construction sites
                const sites = global.State.sitesByRoom.get(creep.room.name) || [];
                const enemySites = sites.filter(s => !s.my);

                if (enemySites.length > 0) {
                    const targetSite = enemySites[0]; // just grab the first one for now
                    if (!creep.pos.isEqualTo(targetSite.pos)) {
                        movement.moveTo(creep, targetSite.pos);
                    }
                }
            } catch (e) {
                console.error(\`[decoy Error] Room \${room.name}, Creep \${creep.name}: \${e.stack}\`);
            }
        }
    }
};
`;

fs.writeFileSync('src/roles/decoy.js', content);
