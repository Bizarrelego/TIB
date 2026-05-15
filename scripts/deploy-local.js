const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Target directory on Blake's PC
const targetDir = 'C:\\Users\\Blake\\AppData\\Local\\Screeps\\scripts\\127_0_0_1___21025\\default';
const targetFile = path.join(targetDir, 'main.js');
const sourceFile = path.join(__dirname, '../dist/main.js');

try {
  // 1. Execute Rollup to bundle the code into dist/main.js
  console.log("Bundling code with Rollup...");
  execSync('npx rollup -c', { stdio: 'inherit' });

  // 2. Ensure target directory exists
  if (!fs.existsSync(targetDir)) {
    console.log(`Creating target directory: ${targetDir}`);
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 3. Copy the bundled file
  console.log(`Copying main.js to ${targetDir}...`);
  fs.copyFileSync(sourceFile, targetFile);
  
  console.log("SUCCESS: Local deployment complete.");
} catch (error) {
  console.error("FATAL: Local deployment failed.");
  console.error(error.message);
  process.exit(1);
}