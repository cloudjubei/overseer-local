const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    sourcemap: true,
    outDir: 'out/preload',
    target: 'chrome120'
  }
});