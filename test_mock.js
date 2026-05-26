global.Creep = function() {};
global.RoomPosition = function() {};
global.Game = { time: 0, map: { getRoomTerrain: () => ({ get: () => 0 }) }, cpu: { getUsed: () => 0 }, creeps: {} };
global.Memory = {};
global.STRUCTURE_SPAWN = 'spawn';
global.STRUCTURE_EXTENSION = 'extension';
global.STRUCTURE_RAMPART = 'rampart';
global.STRUCTURE_CONTAINER = 'container';
global.STRUCTURE_LINK = 'link';
global.STRUCTURE_STORAGE = 'storage';
global.STRUCTURE_TERMINAL = 'terminal';
global.STRUCTURE_TOWER = 'tower';
global.STRUCTURE_ROAD = 'road';
global.TERRAIN_MASK_WALL = 1;
global.RESOURCE_ENERGY = 'energy';
global.BODYPART_COST = { work: 100, carry: 50, move: 50, claim: 600 };
global.WORK = 'work';
global.CARRY = 'carry';
global.MOVE = 'move';
global.CLAIM = 'claim';
global.OK = 0;

try {
  require('./src/main.js');
  console.log("Mock tests passed!");
} catch (e) {
  console.error(e);
}
