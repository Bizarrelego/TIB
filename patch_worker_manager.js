const fs = require('fs');

let workerManagerCode = fs.readFileSync('src/managers/workerManager.js', 'utf8');

const search = `                    // Priority Order: STRUCTURE_EXTENSION > STRUCTURE_CONTAINER > STRUCTURE_TOWER > STRUCTURE_STORAGE > STRUCTURE_RAMPART > STRUCTURE_ROAD
                    const customPriorities = {
                        [STRUCTURE_EXTENSION]: 100,
                        [STRUCTURE_CONTAINER]: 90,
                        [STRUCTURE_TOWER]: 80,
                        [STRUCTURE_STORAGE]: 70,
                        [STRUCTURE_RAMPART]: 60,
                        [STRUCTURE_ROAD]: 50
                    };

                    for (let i = 0; i < sites.length; i++) {
                        const site = sites[i];
                        const priority = customPriorities[site.structureType] || STRUCTURE_PRIORITIES.get(site.structureType) || STRUCTURE_PRIORITIES.get('default');
                        if (priority > highestPriority) {
                            highestPriority = priority;
                        }
                    }

                    let highestPrioritySites = [];
                    for (let i = 0; i < sites.length; i++) {
                        const site = sites[i];
                        const priority = customPriorities[site.structureType] || STRUCTURE_PRIORITIES.get(site.structureType) || STRUCTURE_PRIORITIES.get('default');`;

const replace = `                    // Priority Order: STRUCTURE_EXTENSION > STRUCTURE_CONTAINER > STRUCTURE_TOWER > STRUCTURE_STORAGE > STRUCTURE_RAMPART > STRUCTURE_ROAD
                    const customPriorities = new Map([
                        [STRUCTURE_EXTENSION, 100],
                        [STRUCTURE_CONTAINER, 90],
                        [STRUCTURE_TOWER, 80],
                        [STRUCTURE_STORAGE, 70],
                        [STRUCTURE_RAMPART, 60],
                        [STRUCTURE_ROAD, 50]
                    ]);

                    for (let i = 0; i < sites.length; i++) {
                        const site = sites[i];
                        const priority = customPriorities.get(site.structureType) || STRUCTURE_PRIORITIES.get(site.structureType) || STRUCTURE_PRIORITIES.get('default');
                        if (priority > highestPriority) {
                            highestPriority = priority;
                        }
                    }

                    let highestPrioritySites = [];
                    for (let i = 0; i < sites.length; i++) {
                        const site = sites[i];
                        const priority = customPriorities.get(site.structureType) || STRUCTURE_PRIORITIES.get(site.structureType) || STRUCTURE_PRIORITIES.get('default');`;

workerManagerCode = workerManagerCode.replace(search, replace);

fs.writeFileSync('src/managers/workerManager.js', workerManagerCode);
console.log('workerManager build priority Map updated');
