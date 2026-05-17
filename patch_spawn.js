const fs = require('fs');

// Patch bodyCalc.js
let bodyCalc = fs.readFileSync('src/utils/bodyCalc.js', 'utf8');

bodyCalc = bodyCalc.replace(/static calculateEarlyGameHarvester\(energyCapacity\) \{[\s\S]*?return this\.buildArray\(\{ \[WORK\]: work, \[CARRY\]: carry, \[MOVE\]: move \}\);\n    \}/,
`static calculateEarlyGameHarvester(energyCapacity) {
        let work = 0;
        let move = 0;
        let cost = 0;

        while (work < 3 && cost + BODYPART_COST[WORK] + BODYPART_COST[MOVE] <= energyCapacity) {
            work++;
            move++;
            cost += BODYPART_COST[WORK] + BODYPART_COST[MOVE];
        }

        return this.buildArray({ [WORK]: work, [MOVE]: move });
    }`);

bodyCalc = bodyCalc.replace(/static calculateDomesticHauler\(energyCapacity\) \{[\s\S]*?return this\.buildArray\(\{ \[CARRY\]: carry, \[MOVE\]: move \}\);\n    \}/,
`static calculateDomesticHauler(energyCapacity) {
        let carry = 0;
        let move = 0;
        let cost = 0;

        while (cost + BODYPART_COST[CARRY] + BODYPART_COST[MOVE] <= energyCapacity && carry + move + 2 <= 50) {
            carry++;
            move++;
            cost += BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
        }

        if (carry === 0 && energyCapacity >= 100) {
            carry = 1; move = 1;
        }

        return this.buildArray({ [CARRY]: carry, [MOVE]: move });
    }`);

fs.writeFileSync('src/utils/bodyCalc.js', bodyCalc);
