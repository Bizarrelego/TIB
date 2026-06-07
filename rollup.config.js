import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import wasm from '@rollup/plugin-wasm';

export default {
  input: 'src/main.js',
  output: {
    file: '../../../AppData/Local/Screeps/scripts/127_0_0_1___21025/default/main.js',
    format: 'cjs',
    exports: 'auto'
  },
  plugins: [
    wasm({
      targetEnv: 'node' // Natively integrates with the Screeps runtime environment
    }),
    resolve(),
    commonjs()
  ]
};