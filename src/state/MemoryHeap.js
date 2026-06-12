class MemoryHeap {
    static init() {
        if (!global.MemoryHeap) {
            global.MemoryHeap = {
                creepState: new Int8Array(10000),     // Flat array for state enums
                moveIntents: new Uint32Array(10000),  // Packed coordinates (roomID << 12 | x << 6 | y)
                actionIntents: new Map(),             // intent payloads grouped by target or action
                
                // Indexing for numerical mapping
                creepRegistry: new Map(),             // Map creepName -> id
                idPool: [],                           // Free ids
                
                roomRegistry: new Map(),              // Map roomName -> roomID
                roomIdPool: [],
                nextRoomId: 1
            };

            for (let i = 9999; i >= 1; i--) {
                global.MemoryHeap.idPool.push(i);
            }
        }
    }

    static getCreepId(creepName) {
        if (!global.MemoryHeap.creepRegistry.has(creepName)) {
            const id = global.MemoryHeap.idPool.pop();
            if (id === undefined) throw new Error("Creep ID pool exhausted!");
            global.MemoryHeap.creepRegistry.set(creepName, id);
        }
        return global.MemoryHeap.creepRegistry.get(creepName);
    }

    static freeCreepId(creepName) {
        if (global.MemoryHeap.creepRegistry.has(creepName)) {
            const id = global.MemoryHeap.creepRegistry.get(creepName);
            global.MemoryHeap.idPool.push(id);
            global.MemoryHeap.creepState[id] = 0;
            global.MemoryHeap.moveIntents[id] = 0;
            global.MemoryHeap.creepRegistry.delete(creepName);
        }
    }

    static getRoomId(roomName) {
        if (!global.MemoryHeap.roomRegistry.has(roomName)) {
            let id;
            if (global.MemoryHeap.roomIdPool.length > 0) {
                id = global.MemoryHeap.roomIdPool.pop();
            } else {
                id = global.MemoryHeap.nextRoomId++;
            }
            global.MemoryHeap.roomRegistry.set(roomName, id);
        }
        return global.MemoryHeap.roomRegistry.get(roomName);
    }

    static registerIntent(intentPayload) {
        // payload: { c: creepName, a: actionEnum, targetId: id, x, y, p: priority }
        // Group by targetId for structures or just push to an array
        const target = intentPayload.targetId || 'global';
        if (!global.MemoryHeap.actionIntents.has(target)) {
            global.MemoryHeap.actionIntents.set(target, []);
        }
        global.MemoryHeap.actionIntents.get(target).push(intentPayload);
    }

    static clearIntents() {
        global.MemoryHeap.actionIntents.clear();
    }
}

module.exports = MemoryHeap;
