const fs = require('fs');
let code = fs.readFileSync('src/roles/reserver.js', 'utf8');

const replacement = `            // Move to the room's controller
            const controller = creep.room.controller;
            if (!controller) continue;

            const myName = 'jules'; // Fallback username
            const isOwner = controller.owner && controller.owner.username === myName;
            const isEnemyOwner = controller.owner && controller.owner.username !== myName;

            const isReservedByMe = controller.reservation && controller.reservation.username === myName;
            const isReservedByEnemy = controller.reservation && controller.reservation.username !== myName;

            if (!controller.owner && !isReservedByEnemy) {
                // Unowned and not reserved by enemy, so we reserve it
                if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, controller);
                }
            } else if (isEnemyOwner || isReservedByEnemy) {
                // Owned or reserved by someone else
                if (creep.attackController(controller) === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, controller);
                }
            } else {
                // We own it or already reserved it and are in range doing so
                if (!creep.pos.isNearTo(controller)) {
                    movement.moveTo(creep, controller);
                }
            }`;

code = code.replace(/\/\/ Move to the room's controller[\s\S]*?\} else \{[\s\S]*?movement\.moveTo\(creep, controller\);\s*\}\s*\}/, replacement);

fs.writeFileSync('src/roles/reserver.js', code);
