const fs = require('fs');
let logistics = fs.readFileSync('src/colonies/logisticsManager.js', 'utf8');

// shift the logistics pipeline to Storage. Terminate drop-mining in the primary room. Spawns and Upgraders pull exclusively from Storage.
logistics = logistics.replace(/if \(massiveDrop\) creep\.heap\.state = 'pickup';/,
`if (storage) {
                creep.heap.state = 'withdraw';
            } else if (massiveDrop) creep.heap.state = 'pickup';`);

fs.writeFileSync('src/colonies/logisticsManager.js', logistics);
