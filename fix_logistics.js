const fs = require('fs');
let code = fs.readFileSync('src/colonies/logisticsManager.js', 'utf8');

// Replace all instances of creep.heap.set with safe setter logic, and creep.heap.has with safe logic
// Actually, it's easier to just ensure creep.heap is a Map at the top of the creep loop for fastFillers and hubManagers, BUT it might get deserialized as an object across ticks by the Memory Proxy.
// A simpler fix is to write a helper function at the top of the file:
// function setHeap(creep, key, val) { if (creep.heap instanceof Map) creep.heap.set(key, val); else creep.heap[key] = val; }
// function hasHeap(creep, key) { return creep.heap instanceof Map ? creep.heap.has(key) : creep.heap[key] !== undefined; }
// function getHeap(creep, key) { return creep.heap instanceof Map ? creep.heap.get(key) : creep.heap[key]; }

code = `
function setHeap(creep, key, val) { if (creep.heap instanceof Map) creep.heap.set(key, val); else creep.heap[key] = val; }
function hasHeap(creep, key) { return creep.heap instanceof Map ? creep.heap.has(key) : creep.heap[key] !== undefined; }
function getHeap(creep, key) { return creep.heap instanceof Map ? creep.heap.get(key) : creep.heap[key]; }
` + code;

code = code.replace(/creep\.heap\.set\((['"]\w+['"]),\s*([^)]+)\)/g, 'setHeap(creep, $1, $2)');
code = code.replace(/creep\.heap\.has\((['"]\w+['"])\)/g, 'hasHeap(creep, $1)');
// Also get calls if any (I already manually changed one)
code = code.replace(/creep\.heap\.get\((['"]\w+['"])\)/g, 'getHeap(creep, $1)');

fs.writeFileSync('src/colonies/logisticsManager.js', code);
