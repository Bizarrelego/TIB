const fs = require('fs');

let requestCode = fs.readFileSync('src/managers/EnergyRequestManager.js', 'utf8');

const searchRequests = `        // Priority 10: Storage
        for (let i = 0; i < storage.length; i++) {
            requests.push({ target: storage[i], priority: 10, amount: storage[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }`;

const replaceRequests = `        // Priority 10: Storage
        for (let i = 0; i < storage.length; i++) {
            // Give Storage priority 100 for general haulers moving energy
            requests.push({ target: storage[i], priority: 100, amount: storage[i].store.getFreeCapacity(RESOURCE_ENERGY) });
        }`;

requestCode = requestCode.replace(searchRequests, replaceRequests);

const searchSupplies = `        // Storage (always available as a low priority source if nothing else is)
        const storage = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_STORAGE]);
        for (let i = 0; i < storage.length; i++) {
            const store = storage[i];
            const amount = store.store.getUsedCapacity(RESOURCE_ENERGY);
            supplies.push({ target: store, priority: 10, amount: amount });
        }`;

const replaceSupplies = `        // Storage (always available as a low priority source if nothing else is)
        const storage = resourceUtils.getStructuresWithUsedCapacity(roomName, [STRUCTURE_STORAGE]);
        for (let i = 0; i < storage.length; i++) {
            const store = storage[i];
            const amount = store.store.getUsedCapacity(RESOURCE_ENERGY);
            // If Storage exists and has energy, it becomes priority 100 for general logistics (workers/upgraders)
            supplies.push({ target: store, priority: 100, amount: amount });
        }`;

requestCode = requestCode.replace(searchSupplies, replaceSupplies);

fs.writeFileSync('src/managers/EnergyRequestManager.js', requestCode);
console.log('EnergyRequestManager updated');
