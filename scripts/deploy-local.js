const fs = require('fs');
const path = require('path');
const rollup = require('rollup');
const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
// node scripts/deploy-local.js
// Target directory on Blake's PC
const targetDir = 'C:\\Users\\Blake\\AppData\\Local\\Screeps\\scripts\\127_0_0_1___21025\\default';
const projectRoot = path.resolve(__dirname, '..');
const targetFile = path.join(targetDir, 'main.js');
const sourceFile = path.join(projectRoot, 'dist', 'main.js');

// Helper to recursively copy .wasm files while preserving folder structure
function copyWasmFiles(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyWasmFiles(srcPath, destPath);
    } else if (entry.name.endsWith('.wasm')) {
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied WebAssembly module: ${entry.name}`);
    }
  }
}

async function deploy() {
  try {
    // 1. Execute Rollup Programmatically
    console.log("Bundling code with Rollup API...");
    const bundle = await rollup.rollup({
      input: path.join(projectRoot, 'src', 'main.js'),
      external: (id) => id.endsWith('.wasm'), // Tell Rollup to ignore binary WASM files
      plugins: [
        nodeResolve(),
        commonjs()
      ]
    });

    await bundle.write({
      file: sourceFile,
      format: 'cjs',
      exports: 'auto'
    });

    // 2. Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      console.log(`Creating target directory: ${targetDir}`);
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 3. Copy the bundled JS file
    console.log(`Copying main.js to ${targetDir}...`);
    fs.copyFileSync(sourceFile, targetFile);

    // 4. Copy WebAssembly files to maintain require() references
    copyWasmFiles(path.join(projectRoot, 'src'), targetDir);
    
    console.log("SUCCESS: Local deployment complete.");
  } catch (error) {
    console.error("\nFATAL: Local deployment failed.");
    console.error(error.message || error);
    process.exit(1);
  }
}

deploy();