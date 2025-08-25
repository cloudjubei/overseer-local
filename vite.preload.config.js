const { defineConfig } = require('vite');

module.exports = defineConfig({
  build: {
    sourcemap: true,
    outDir: 'out/preload',
    rollupOptions: {
      input: 'src/preload.js'
    },
    target: 'chrome120'
  }
});
