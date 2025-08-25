const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    sourcemap: true,
    outDir: 'out/main',
    rollupOptions: {
      external: ['electron', 'node:fs', 'node:fs/promises', 'node:path', 'fs', 'path']
    },
    target: 'node18'
  }
});