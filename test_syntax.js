global.Creep = function() {};
global.StructureSpawn = function() {};
global.RoomPosition = function() {};
global.Room = function() {};
global.Room.Terrain = function() {};
global.Game = { cpu: { bucket: 10000 }, map: {}, rooms: {}, creeps: {} };
global.Memory = { rooms: {} };

// constants
global.STRUCTURE_SPAWN = "spawn";
global.STRUCTURE_EXTENSION = "extension";
global.STRUCTURE_ROAD = "road";
global.STRUCTURE_WALL = "constructedWall";
global.STRUCTURE_RAMPART = "rampart";
global.STRUCTURE_KEEPER_LAIR = "keeperLair";
global.STRUCTURE_PORTAL = "portal";
global.STRUCTURE_CONTROLLER = "controller";
global.STRUCTURE_LINK = "link";
global.STRUCTURE_STORAGE = "storage";
global.STRUCTURE_TOWER = "tower";
global.STRUCTURE_OBSERVER = "observer";
global.STRUCTURE_POWER_BANK = "powerBank";
global.STRUCTURE_POWER_SPAWN = "powerSpawn";
global.STRUCTURE_EXTRACTOR = "extractor";
global.STRUCTURE_LAB = "lab";
global.STRUCTURE_TERMINAL = "terminal";
global.STRUCTURE_CONTAINER = "container";
global.STRUCTURE_NUKER = "nuker";
global.STRUCTURE_FACTORY = "factory";
global.STRUCTURE_INVADER_CORE = "invaderCore";

global.RESOURCE_ENERGY = "energy";

global.WORK = "work";
global.CARRY = "carry";
global.MOVE = "move";
global.ATTACK = "attack";
global.RANGED_ATTACK = "ranged_attack";
global.HEAL = "heal";
global.CLAIM = "claim";
global.TOUGH = "tough";

global.BODYPART_COST = {
    "move": 50,
    "work": 100,
    "attack": 80,
    "carry": 50,
    "heal": 250,
    "ranged_attack": 150,
    "tough": 10,
    "claim": 600
};

global.OK = 0;
global.ERR_NOT_OWNER = -1;
global.ERR_NO_PATH = -2;
global.ERR_NAME_EXISTS = -3;
global.ERR_BUSY = -4;
global.ERR_NOT_FOUND = -5;
global.ERR_NOT_ENOUGH_ENERGY = -6;
global.ERR_NOT_ENOUGH_RESOURCES = -6;
global.ERR_INVALID_TARGET = -7;
global.ERR_FULL = -8;
global.ERR_NOT_IN_RANGE = -9;
global.ERR_INVALID_ARGS = -10;
global.ERR_TIRED = -11;
global.ERR_NO_BODYPART = -12;
global.ERR_NOT_ENOUGH_EXTENSIONS = -6;
global.ERR_RCL_NOT_ENOUGH = -14;
global.ERR_GCL_NOT_ENOUGH = -15;

try {
  require('./src/main.js');
  console.log("Syntax valid.");
} catch(e) {
  console.log(e);
}
