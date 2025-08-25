const { defineConfig } = require('vite');
const path = require('path');

module.exports = defineConfig({
  build: {
    sourcemap: true,
    outDir: 'out/main',
    rollupOptions: {
      input: path.resolve(__dirname, 'src/index.js'),
      external: ['electron', 'node:fs', 'node:fs/promises', 'node:path', 'fs', 'path']
    },
    target: 'node18'
  }
});
