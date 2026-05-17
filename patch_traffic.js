const fs = require('fs');

let hauler = fs.readFileSync('src/roles/hauler.js', 'utf8');
hauler = "const TrafficManager = require('../traffic/trafficManager');\n" + hauler;
hauler = hauler.replace(/if \(TrafficManager\.registerPickup\(creep, target, RESOURCE_ENERGY, creep\.store\.getFreeCapacity\(\)\) === OK\) \{[\s\S]*?\} else if \(creep\.pos\.getRangeTo\(target\) > 1\) \{/g,
`const status = TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, creep.store.getFreeCapacity());
                            if (status !== OK && creep.pos.getRangeTo(target) > 1) {`);
hauler = hauler.replace(/if \(TrafficManager\.registerWithdraw\(creep, target, RESOURCE_ENERGY, creep\.store\.getFreeCapacity\(\)\) === OK\) \{[\s\S]*?\} else if \(creep\.pos\.getRangeTo\(target\) > 1\) \{/g,
`const status = TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY, creep.store.getFreeCapacity());
                            if (status !== OK && creep.pos.getRangeTo(target) > 1) {`);
fs.writeFileSync('src/roles/hauler.js', hauler);

let upgrader = fs.readFileSync('src/roles/upgrader.js', 'utf8');
upgrader = "const TrafficManager = require('../traffic/trafficManager');\n" + upgrader;
upgrader = upgrader.replace(/if \(TrafficManager\.registerWithdraw\(creep, storage, RESOURCE_ENERGY, creep\.store\.getFreeCapacity\(RESOURCE_ENERGY\)\) === OK\) \{[\s\S]*?\} else if \(creep\.pos\.getRangeTo\(storage\) > 1\) \{/g,
`const status = TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, creep.store.getFreeCapacity(RESOURCE_ENERGY));
                    if (status !== OK && creep.pos.getRangeTo(storage) > 1) {`);
upgrader = upgrader.replace(/if \(TrafficManager\.registerPickup\(creep, targetDrop, RESOURCE_ENERGY, creep\.store\.getFreeCapacity\(\)\) === OK\) \{\}/g,
`TrafficManager.registerPickup(creep, targetDrop, RESOURCE_ENERGY, creep.store.getFreeCapacity());`);
fs.writeFileSync('src/roles/upgrader.js', upgrader);
