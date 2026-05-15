const Profiler = require('./src/utils/profiler.js');

let mockCpuUsed = 0;
global.Game = {
    time: 1,
    cpu: {
        bucket: 10000,
        getUsed: function() {
            return mockCpuUsed;
        }
    }
};

class DummyManager {
    static doWork1() {
        mockCpuUsed += 100;
    }
    static doWork2() {
        mockCpuUsed += 200;
    }
}

const WrappedManager = Profiler.wrap('DummyManager', DummyManager);

WrappedManager.doWork1();
WrappedManager.doWork2();

global.Game.time = 2;
WrappedManager.doWork1();

console.log(Profiler.getAverage('DummyManager.doWork1'));
console.log(Profiler.getAverage('DummyManager.doWork2'));
Profiler.logBottlenecks(0.05);
