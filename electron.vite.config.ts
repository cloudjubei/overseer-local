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
      },
      // `thefactory-ui` is linked via `file:` and has its own `node_modules/react`.
      // Without dedupe, Vite resolves bare `react` imports from the symlinked
      // package's tree, so the renderer ends up with two React copies and hooks
      // (e.g. `ToastProvider`'s `useState`) fail with "Cannot read properties of null".
      dedupe: ['react', 'react-dom'],
    },
    plugins: [react()],
  },
})
