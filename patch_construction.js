const fs = require('fs');

let workerManagerCode = fs.readFileSync('src/managers/workerManager.js', 'utf8');

const search = `            } else if (creep.heap.state === 'build') {
                if (sites && sites.length > 0) {
                    let bestSite = null;
                    let highestPriority = -Infinity;

                    for (let i = 0; i < sites.length; i++) {
                        const site = sites[i];
                        const priority = STRUCTURE_PRIORITIES.get(site.structureType) || STRUCTURE_PRIORITIES.get('default');
                        if (priority > highestPriority) {
                            highestPriority = priority;
                            bestSite = site;
                        }
                    }

                    if (bestSite) {
                        creep.heap.targetId = bestSite.id;
                    } else {
                        creep.heap.targetId = sites[0].id;
                    }
                } else {`;

const replace = `            } else if (creep.heap.state === 'build') {
                if (sites && sites.length > 0) {
                    let highestPriority = -Infinity;

                    // Priority Order: STRUCTURE_EXTENSION > STRUCTURE_CONTAINER > STRUCTURE_TOWER > STRUCTURE_STORAGE > STRUCTURE_RAMPART > STRUCTURE_ROAD
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
                        const priority = customPriorities[site.structureType] || STRUCTURE_PRIORITIES.get(site.structureType) || STRUCTURE_PRIORITIES.get('default');
                        if (priority === highestPriority) {
                            highestPrioritySites.push(site);
                        }
                    }

                    let bestSite = null;
                    let minDistance = Infinity;

                    // Calculate closest highest priority site to a central point (spawns[0] or controller) to group workers
                    let referencePos = room.controller ? room.controller.pos : creep.pos;
                    if (structures && structures.get(STRUCTURE_SPAWN) && structures.get(STRUCTURE_SPAWN).length > 0) {
                        referencePos = structures.get(STRUCTURE_SPAWN)[0].pos;
                    }

                    for (let i = 0; i < highestPrioritySites.length; i++) {
                        const site = highestPrioritySites[i];
                        const dist = Math.max(Math.abs(referencePos.x - site.pos.x), Math.abs(referencePos.y - site.pos.y));
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestSite = site;
                        }
                    }

                    if (bestSite) {
                        creep.heap.targetId = bestSite.id;
                    } else {
                        creep.heap.targetId = sites[0].id;
                    }
                } else {`;

workerManagerCode = workerManagerCode.replace(search, replace);

fs.writeFileSync('src/managers/workerManager.js', workerManagerCode);
console.log('workerManager build priority updated');
