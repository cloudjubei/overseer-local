import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // `thefactory-ui` is linked via `file:..` and has React + Radix in its
    // own `node_modules`. Without forcing every dependency to the host's
    // copy, vite resolves them from inside the symlinked package and ends
    // up with two React instances at render time → "Invalid hook call".
    // `dedupe` covers ESM; the explicit aliases force CJS resolutions
    // (Radix's `require('react')`) to the host's copies too.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@core': resolve(__dirname, 'src/renderer/src/core'),
      '@services': resolve(__dirname, 'src/renderer/src/services'),
      '@ui': resolve(__dirname, 'src/renderer/src/ui'),
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
      '@radix-ui/react-select': resolve(
        __dirname,
        'node_modules/@radix-ui/react-select',
      ),
      '@radix-ui/react-context': resolve(
        __dirname,
        'node_modules/@radix-ui/react-context',
      ),
      '@radix-ui/react-slot': resolve(__dirname, 'node_modules/@radix-ui/react-slot'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/renderer/src/test/setup.ts'],
    server: {
      // Force vite to transform `thefactory-ui` + its bundled `@radix-ui`
      // through its ESM pipeline so `resolve.dedupe` actually applies
      // (otherwise CJS imports inside the symlinked package resolve
      // `react` from the package's own tree).
      deps: { inline: [/^thefactory-ui($|\/)/, /^@radix-ui\//] },
    },
  },
})
