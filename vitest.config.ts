import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror electron.vite.config.ts: `thefactory-ui` is linked via `file:`
    // and ships its own `node_modules/react`, so without dedupe vitest ends
    // up with two React copies and hooks fail with "Invalid hook call".
    dedupe: ['react', 'react-dom', 'reconnecting-websocket'],
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@core': resolve(__dirname, 'src/renderer/src/core'),
      '@services': resolve(__dirname, 'src/renderer/src/services'),
      '@ui': resolve(__dirname, 'src/renderer/src/ui'),
      // Force a single resolution path for `reconnecting-websocket` so the
      // test's `vi.mock` intercepts imports made by `thefactory-ui`'s
      // bundled `WsClient` chunk as well as direct imports here.
      'reconnecting-websocket': resolve(
        __dirname,
        'node_modules/reconnecting-websocket/dist/reconnecting-websocket-mjs.js',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/renderer/src/test/setup.ts'],
  },
})
