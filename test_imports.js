global.Creep = function() {};
global.Room = function() {};
global.Game = { time: 0, cpu: { getUsed: () => 0 } };
global.Memory = {};
global.State = {};
try {
  require('./src/managers/managerOrchestrator.js');
  console.log("Imports successful");
} catch(e) {
  console.error("Import failed:", e);
}
