// src/structures.js
// Backward-compatibility shim re-exporting from modular structure subsystems

const { calcDistance } = require('./constants');
const { getRoomState } = require('./state');

function runStructures() {
    runTowers();
    runLinks();
    runLabs();
    runTerminal();
    runPowerSpawn();
    runObserver();
}
function runTowers() {
    const towers = getRoomState().towers;
    for (const tower of towers) {
        if (!tower || tower.fatigue > 0) continue;

        const hostileCreeps = tower.room.find(FIND_HOSTILE_CREEPS);
        if (hostileCreeps.length > 0) {
            let target = hostileCreeps[0];
            for (const creep of hostileCreeps) {
                if (creep.hits < target.hits || calcDistance(tower.pos, creep.pos) < calcDistance(tower.pos, target.pos)) {
                    target = creep;
                }
            }
            tower.attack(target);
        } else {
            const damagedFriendlyCreeps = tower.room.find(FIND_MY_CREEPS).filter(c => c.hits < c.hitsMax);
            if (damagedFriendlyCreeps.length > 0) {
                tower.heal(damagedFriendlyCreeps[0]);
            } else {
                const criticalStructures = tower.room.find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL);
                for (const structure of criticalStructures) {
                    if (structure.hits < 5000) {
                        tower.repair(structure);
                        break;
                    }
                }
            }
        }
    }
}
function runLinks() {
    const links = getRoomState().links;
    for (const link of links) {
        if (!link || link.fatigue > 0) continue;

        const sourceLink = link.room.find(FIND_MY_STRUCTURES).filter(s => s.structureType === STRUCTURE_LINK && calcDistance(link.pos, s.pos) <= 2)[0];
        const storageLink = link.room.find(FIND_MY_STRUCTURES).filter(s => s.structureType === STRUCTURE_LINK && calcDistance(link.pos, s.pos) === 1)[0];
        const controllerLink = link.room.find(FIND_MY_STRUCTURES).filter(s => s.structureType === STRUCTURE_LINK && calcDistance(link.pos, s.pos) <= 2)[0];

        if (sourceLink && sourceLink.store[RESOURCE_ENERGY] >= 400 && storageLink && storageLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
            link.transferEnergy(storageLink);
        } else if (sourceLink && sourceLink.store[RESOURCE_ENERGY] >= 400 && controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
            link.transferEnergy(controllerLink);
        }
    }
}
function runLabs() {
    const labs = getRoomState().labs;
    for (const lab of labs) {
        if (!lab || lab.fatigue > 0) continue;

        // Implement lab actions here
    }
}
function runTerminal() {
    const terminal = getRoomState().terminal;
    if (!terminal || terminal.fatigue > 0) return;

    // Implement terminal actions here
}
function runPowerSpawn() {
    const powerSpawns = getRoomState().powerSpawns;
    for (const powerSpawn of powerSpawns) {
        if (!powerSpawn || powerSpawn.fatigue > 0) continue;

        // Implement power spawn actions here
    }
}
function runObserver() {
    const observers = getRoomState().observers;
    for (const observer of observers) {
        if (!observer || observer.fatigue > 0) continue;

        // Implement observer actions here
    }
}
function runMarket() {
    const market = getRoomState().market;
    if (!market || market.fatigue > 0) return;

    // Implement market actions here
}
function runDefense() {
    const towers = getRoomState().towers;
    for (const tower of towers) {
        if (!tower || tower.fatigue > 0) continue;

        const hostileCreeps = tower.room.find(FIND_HOSTILE_CREEPS);
        if (hostileCreeps.length > 0) {
            let target = hostileCreeps[0];
            for (const creep of hostileCreeps) {
                if (creep.hits < target.hits || calcDistance(tower.pos, creep.pos) < calcDistance(tower.pos, target.pos)) {
                    target = creep;
                }
            }
            tower.attack(target);
        } else {
            const damagedFriendlyCreeps = tower.room.find(FIND_MY_CREEPS).filter(c => c.hits < c.hitsMax);
            if (damagedFriendlyCreeps.length > 0) {
                tower.heal(damagedFriendlyCreeps[0]);
            } else {
                const criticalStructures = tower.room.find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL);
                for (const structure of criticalStructures) {
                    if (structure.hits < 5000) {
                        tower.repair(structure);
                        break;
                    }
                }
            }
        }
    }
}
module.exports = {
    runDefense,
    runLabs,
    runLinks,
    runMarket,
    runObserver,
    runPowerSpawn,
    runStructures,
    runTerminal,
    runTowers
};
