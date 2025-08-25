import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import path from 'node:path';

export default defineConfig({
  productName: 'DesktopApp',
  appId: 'com.example.desktopapp',
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
    },
  },
  renderer: {
    build: {
      outDir: 'out/renderer',
    },
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src/renderer/src'),
      },
    },
  },
});
