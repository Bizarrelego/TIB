const fs = require('fs');
let workerManagerCode = fs.readFileSync('src/managers/workerManager.js', 'utf8');

// Update hauler count logic to include domesticHaulers (per memory constraint)
const search = `            const haulers = roomCreepsAll.get('hauler');
            if (haulers) haulerCount = haulers.length;`;

const replace = `            const haulers = roomCreepsAll.get('hauler');
            if (haulers) haulerCount += haulers.length;
            const domesticHaulers = roomCreepsAll.get('domesticHauler');
            if (domesticHaulers) haulerCount += domesticHaulers.length;`;

workerManagerCode = workerManagerCode.replace(search, replace);
fs.writeFileSync('src/managers/workerManager.js', workerManagerCode);
console.log('workerManager hauler count updated');
