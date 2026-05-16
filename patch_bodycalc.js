const fs = require('fs');
const filepath = 'src/utils/bodyCalc.js';
let content = fs.readFileSync(filepath, 'utf8');

const newMethod = `
    /**
     * Calculates optimal body for powerHauler based on capacity and distance.
     * @param {number} energyCapacity
     * @param {number} distance
     * @param {number} powerAmount
     * @returns {string[]}
     */
    static calculatePowerHauler(energyCapacity, distance, powerAmount) {
        const carryNeeded = Math.ceil(powerAmount / 50);
        let carry = 0;
        let move = 0;
        let cost = 0;

        while (carry < carryNeeded && carry + move < 50) {
            if (cost + BODYPART_COST[CARRY] + BODYPART_COST[MOVE] <= energyCapacity) {
                carry++;
                move++;
                cost += BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
            } else {
                break;
            }
        }

        if (carry === 0 && energyCapacity >= 100) {
            carry = 1; move = 1;
        }

        return this.buildArray({ [CARRY]: carry, [MOVE]: move });
    }
`;

content = content.replace('    static getBuildPower(roomName) {', newMethod + '\n    static getBuildPower(roomName) {');
fs.writeFileSync(filepath, content);
