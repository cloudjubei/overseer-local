const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    outDir: 'out/renderer'
  }
});
