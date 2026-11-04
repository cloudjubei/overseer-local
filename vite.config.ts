import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Alias, type Plugin } from 'vite'
import { readServedAuth } from './src/renderer/src/served/servedUtils'

const replacedBy = (specifierEnd: string, file: string): Alias => ({
  find: new RegExp(`^.*${specifierEnd}$`),
  replacement: resolve(__dirname, 'src/renderer/src/served', file),
})

function fakeBackendOnly(): Plugin {
  return {
    name: 'fake-backend-only',
    apply: 'build',
    buildStart() {
      readServedAuth(
        { baseUrl: process.env.VITE_API_BASE_URL, token: process.env.VITE_BEARER_TOKEN },
        {},
      )
    },
  }
}

/**
 * The renderer alone, for a browser on the fake backend: what `factory.webApp`
 * in `package.json` builds and serves. It is never the desktop app, which
 * `electron.vite.config.ts` builds and which imports nothing replaced here.
 * Needing Electron is what the replacements are for: see `docs/ARCHITECTURE.md`.
 */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  envDir: false,
  plugins: [react(), fakeBackendOnly()],
  build: {
    outDir: resolve(__dirname, 'dist/served'),
    emptyOutDir: true,
  },
  resolve: {
    alias: [
      replacedBy('/services/authService', 'servedAuthService.ts'),
      replacedBy('/macOsDictationTrigger', 'servedDictationTrigger.ts'),
      replacedBy('/LoginScreen', 'NeedsDesktopApp.tsx'),
      replacedBy('/BackendConnectionPanel', 'NeedsDesktopApp.tsx'),
      { find: '@renderer', replacement: resolve(__dirname, 'src/renderer/src') },
      { find: '@core', replacement: resolve(__dirname, 'src/renderer/src/core') },
      { find: '@services', replacement: resolve(__dirname, 'src/renderer/src/services') },
      { find: '@ui', replacement: resolve(__dirname, 'src/renderer/src/ui') },
    ],
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
})
