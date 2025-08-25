const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    outDir: 'out/renderer',
    rollupOptions: {
      input: {
        main_window: 'src/index.html',
        task_create: 'src/task_create.html',
        feature_create: 'src/feature_create.html'
      }
    }
  }
});