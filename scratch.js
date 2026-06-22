const { PerformanceObserver, performance } = require('perf_hooks');

const arr = new Uint8Array(2500);
for (let i = 0; i < 2500; i++) arr[i] = Math.floor(Math.random() * 255);

let t0 = performance.now();
for (let i = 0; i < 10000; i++) {
  const ser = Array.from(arr);
}
let t1 = performance.now();
console.log(`Serialize Array.from: ${t1 - t0}ms`);

t0 = performance.now();
for (let i = 0; i < 10000; i++) {
    const ser = Object.values(arr);
}
t1 = performance.now();
console.log(`Serialize Object.values: ${t1 - t0}ms`);

t0 = performance.now();
for (let i = 0; i < 10000; i++) {
    // RLE encoding simulation
    let encoded = [];
    let prev = arr[0];
    let count = 1;
    for (let j = 1; j < 2500; j++) {
        if (arr[j] === prev) { count++; }
        else {
            encoded.push(prev, count);
            prev = arr[j];
            count = 1;
        }
    }
    encoded.push(prev, count);
}
t1 = performance.now();
console.log(`Serialize RLE: ${t1 - t0}ms`);

t0 = performance.now();
for (let i = 0; i < 10000; i++) {
  // PathFinder.CostMatrix serialize returns an array of numbers, which is actually a Uint8Array reference
  // so we can just clone it. Wait, the docs say CostMatrix.serialize() returns `number[]`.
  // In reality, it returns the underlying `_bits` which is a Uint8Array.
  // Let's test the cost of just keeping the CostMatrix itself in cache!
}
t1 = performance.now();
console.log(`Serialize none: ${t1 - t0}ms`);
