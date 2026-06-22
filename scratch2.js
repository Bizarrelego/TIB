const { PerformanceObserver, performance } = require('perf_hooks');

const arr = new Uint8Array(2500);
for (let i = 0; i < 2500; i++) arr[i] = Math.floor(Math.random() * 255);

let t0 = performance.now();
for (let i = 0; i < 10000; i++) {
    // encode
    let e = [];
    let prev = arr[0], count = 1;
    for(let j=1; j<2500; j++) {
        if(arr[j] === prev && count < 255) count++;
        else { e.push(prev, count); prev = arr[j]; count = 1; }
    }
    e.push(prev, count);
}
let t1 = performance.now();
console.log(`RLE: ${t1 - t0}ms`);
