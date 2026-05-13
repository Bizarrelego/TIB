const fs = require('fs');
let code = fs.readFileSync('src/colonies/planner.js', 'utf8');

// Factory isn't defined in standard Screeps Constants without global Game object or if we just mock it for ESLint
// Wait, the error is 'STRUCTURE_FACTORY' is not defined no-undef.
// Screeps Constants provides STRUCTURE_FACTORY globally usually. But in Node testing without require('screeps-globals') it fails.
// Let's just remove it from the buildOrder and TIGGA_STAMP if it's causing issues.
// But wait, the prompt error says:
// 131:17  error  'STRUCTURE_FACTORY' is not defined  no-undef
// 143:18  error  'STRUCTURE_FACTORY' is not defined  no-undef
// 143:60  error  'STRUCTURE_FACTORY' is not defined  no-undef
// The other structures like STRUCTURE_SPAWN, STRUCTURE_STORAGE don't have this error?
// That means they are defined somewhere, maybe globally or in a constants file, but STRUCTURE_FACTORY is missing from it.

// Let's replace STRUCTURE_FACTORY with 'factory' since the property name inside TIGGA_STAMP is already "factory" but the constant STRUCTURE_FACTORY is what's used inside the buildOrder.
// Oh wait! The constant is actually STRUCTURE_FACTORY.
// If ESLint complains about STRUCTURE_FACTORY being undefined but NOT STRUCTURE_SPAWN, it means the mock constants file used for ESLint is missing STRUCTURE_FACTORY.

// Let's modify planner.js to just define STRUCTURE_FACTORY if it's not defined, or use the string 'factory'.
// The standard screeps string is 'factory'.

code = code.replace(/STRUCTURE_FACTORY/g, "'factory'");

fs.writeFileSync('src/colonies/planner.js', code);
