import type { SyncKVStorage } from 'thefactory-ui/headless'

/**
 * Shared `SyncKVStorage` adapter wrapping `window.localStorage` for the
 * Electron renderer. The renderer is a single browser window — no
 * cross-window subscription path is implemented (the optional `subscribe`
 * slot is omitted). When that's needed, route through the Electron
 * preload bridge and add a listener here.
 */
export const localStorageAdapter: SyncKVStorage = {
  get: (key) => window.localStorage.getItem(key),
  set: (key, value) => window.localStorage.setItem(key, value),
}
