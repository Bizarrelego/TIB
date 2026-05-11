const eventBus = require('../os/eventBus');

// Initialization and Subscription (Fires on load/require)
eventBus.subscribe('LINK_ROUTE_ACTIVE', (data) => {
    if (!global.State.logistics) {
        global.State.logistics = new Map();
    }
    
    let roomLog = global.State.logistics.get(data.roomName);
    if (!roomLog) {
        roomLog = {};
        global.State.logistics.set(data.roomName, roomLog);
    }
    
    if (data.route === 'controller') {
        roomLog.controllerLinkActive = true;
        roomLog.controllerLinkTick = Game.time;
    }
});

function run(room) {
    try {
        if (!global.State.logistics) global.State.logistics = new Map();
        const roomLog = global.State.logistics.get(room.name) || {};

        // Expire cache if link goes offline/runs dry
        if (roomLog.controllerLinkActive && (Game.time - roomLog.controllerLinkTick > 5)) {
            roomLog.controllerLinkActive = false;
        }

        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const haulers = roomCreeps.get('hauler') || [];
        const domesticHaulers = roomCreeps.get('domesticHauler') || [];
        const allTransporters = haulers.concat(domesticHaulers);
        
        // Broadcast priority shifts to haulers
        if (roomLog.controllerLinkActive) {
            for (let i = 0; i < allTransporters.length; i++) {
                const creep = allTransporters[i];
                creep.heap = creep.heap || {};
                
                // Instruct downstream roles to reject controller drops
                creep.heap.ignoreController = true;

                // Mark obsolete domestic routes for immediate retirement/recycling
                if (creep.memory.role === 'domesticHauler') {
                    creep.heap.retired = true;
                }
            }
        } else {
            // Revert configuration if link network goes down
            for (let i = 0; i < allTransporters.length; i++) {
                if (allTransporters[i].heap) {
                    allTransporters[i].heap.ignoreController = false;
                    allTransporters[i].heap.retired = false;
                }
            }
        }
    } catch (e) {
        console.log(`[Logistics Error] Room ${room.name}: ${e.stack}`);
    }
}

module.exports = { run };