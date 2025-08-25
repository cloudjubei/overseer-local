const path = require('path');

module.exports = {
  packagerConfig: {},
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        mainConfig: './vite.main.config.js',
        preloadConfig: './vite.preload.config.js',
        renderer: {
          config: './vite.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer/App.tsx',
              name: 'main_window',
              preload: {
                js: './src/preload.js'
              }
            },
            {
              html: './src/task_create.html',
              js: './src/renderer/TaskCreateView.tsx',
              name: 'task_create',
              preload: {
                js: './src/preload.js'
              }
            },
            {
              html: './src/feature_create.html',
              js: './src/renderer/FeatureCreateView.tsx',
              name: 'feature_create',
              preload: {
                js: './src/preload.js'
              }
            }
          ]
        }
      }
    }
  ]
};
