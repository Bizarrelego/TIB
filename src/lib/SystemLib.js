// src/lib/SystemLib.js

class Logger {
    static info(message) { console.log(`[INFO] ${message}`); }
    static warn(message) { console.log(`[WARN] ${message}`); }
    static error(message) { console.log(`[ERROR] ${message}`); }
    static debug(message) { console.log(`[DEBUG] ${message}`); }
    static run() {}
}

class ErrorHandlingUtility {
    static wrap(fn, context) {
        return function (...args) {
            try { return fn.apply(this, args); }
            catch (error) {
                const errorMessage = `Error in ${context}: ${error.message}\nStack: ${error.stack}`;
                Logger.error(errorMessage);
            }
        };
    }
}

const ProfilerUtility = {
    enabled: false,
    metrics: new Map(),
    start: function () { if (this.enabled) this.metrics.clear(); },
    end: function () { if (this.enabled) { Logger.debug(`Total CPU used this tick: ${Game.cpu.getUsed().toFixed(3)}`); } },
    setEnabled: function (state) { this.enabled = state; },
    wrap: function (fn, name) {
        const profiler = this;
        return function (...args) {
            if (!profiler.enabled) return fn.apply(this, args);
            const start = Game.cpu.getUsed();
            const result = fn.apply(this, args);
            const used = Game.cpu.getUsed() - start;
            if (!profiler.metrics.has(name)) profiler.metrics.set(name, { calls: 0, totalCpu: 0 });
            const data = profiler.metrics.get(name);
            data.calls++; data.totalCpu += used;
            return result;
        };
    },
    report: function () {
        if (!this.enabled || this.metrics.size === 0) return;
        Logger.info('--- Profiler Report ---');
        for (const [name, data] of this.metrics.entries()) {
            Logger.info(`${name}: ${data.calls} calls, ${data.totalCpu.toFixed(3)} CPU total, ${(data.totalCpu / data.calls).toFixed(3)} CPU avg`);
        }
        Logger.info('-----------------------');
        this.metrics.clear();
    }
};

class StressTestUtility {
    static run() {
        if (!global.State || !global.State.rooms) return;
        let mainRoom = null;
        for (const [roomName, roomState] of global.State.rooms) {
            if (roomState.spawns && roomState.spawns.length > 0) { mainRoom = roomName; break; }
        }
        if (!mainRoom) return;

        const roomState = global.State.rooms.get(mainRoom);
        const spawn = roomState.spawns[0];

        if (Memory.stressTestCombat) {
            if (!roomState.hostiles) roomState.hostiles = [];
            for (let i = 0; i < 3; i++) {
                roomState.hostiles.push({
                    id: `mock_hostile_${i}`,
                    pos: { x: spawn.pos.x + 3 + i, y: spawn.pos.y + 3 + i, roomName: mainRoom, getRangeTo: function (pos) { return Math.max(Math.abs(this.x - pos.x), Math.abs(this.y - pos.y)); } },
                    body: [{ type: 'attack', hits: 100 }, { type: 'ranged_attack', hits: 100 }],
                    hits: 1000, hitsMax: 1000, my: false, owner: { username: 'Invader' }
                });
            }
        }

        if (Memory.stressTestTraffic) {
            let count = 0;
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep.room.name !== mainRoom) continue;
                const role = creep.memory.role || '';
                if (role === 'meleeCreep' || role === 'rangerCreep' || role === 'medicCreep') continue;
                if (!creep.heap) continue;

                creep.heap.targetId = null;
                creep.heap.actionIntent = 'move';
                creep.heap.destination = (count % 2 === 0) ? { x: 10, y: 10, roomName: mainRoom, range: 1 } : { x: 40, y: 40, roomName: mainRoom, range: 1 };
                count++;
            }
        }
    }
}

class RouteDistanceCalculator {
    static getDistance(sourceId, sourcePos, colonyName) {
        if (!Memory.sources) Memory.sources = {};
        if (!Memory.sources[sourceId]) Memory.sources[sourceId] = {};
        
        if (Memory.sources[sourceId].distance) {
            return Memory.sources[sourceId].distance;
        }

        const roomState = global.State?.rooms?.get(colonyName);
        if (!roomState) return 25; // fallback

        let targetPos = null;
        if (roomState.storage) targetPos = roomState.storage.pos;
        else if (roomState.spawns && roomState.spawns.length > 0) targetPos = roomState.spawns[0].pos;

        if (!targetPos) return 25; // fallback

        const fromPos = new RoomPosition(sourcePos.x, sourcePos.y, sourcePos.roomName || sourcePos.roomName);
        
        const ret = PathFinder.search(fromPos, { pos: targetPos, range: 1 }, {
            plainCost: 2,
            swampCost: 10,
            roomCallback: function(_roomName) {
                // Return a flat matrix or let pathfinder use default costs
                return new PathFinder.CostMatrix;
            }
        });

        const distance = ret.path.length;
        // Add a slight padding to the distance
        Memory.sources[sourceId].distance = distance > 0 ? distance : 25;
        return Memory.sources[sourceId].distance;
    }
}

module.exports = {
    Logger,
    ErrorHandlingUtility,
    ProfilerUtility,
    StressTestUtility,
    RouteDistanceCalculator
};
