import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@core': resolve('src/renderer/src/core'),
        '@services': resolve('src/renderer/src/services'),
        '@ui': resolve('src/renderer/src/ui'),
      },
      // `thefactory-ui` is linked via `file:` and has its own `node_modules/react`
      // and `node_modules/react-router-dom` (v6, for its own tests). Without dedupe,
      // a production build resolves those bare imports from the symlinked package's
      // tree, so the renderer ends up with two React copies (hooks fail with "Cannot
      // read properties of null") and two router contexts (`RouterLeaveGuard` finds
      // no navigator and the window stays blank).
      dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
    },
    plugins: [react()],
  },
})
