import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror electron.vite.config.ts: `thefactory-ui` is linked via `file:`
    // and ships its own `node_modules/react`, so without dedupe vitest ends
    // up with two React copies and hooks fail with "Invalid hook call".
    dedupe: ['react', 'react-dom'],
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@api': resolve(__dirname, 'src/renderer/src/api'),
      '@core': resolve(__dirname, 'src/renderer/src/core'),
      '@services': resolve(__dirname, 'src/renderer/src/services'),
      '@generated': resolve(__dirname, 'src/renderer/src/generated'),
      '@ui': resolve(__dirname, 'src/renderer/src/ui'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/renderer/src/test/setup.ts'],
  },
})
