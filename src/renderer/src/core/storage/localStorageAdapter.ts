import type { SyncKVStorage } from 'thefactory-ui/headless'

/**
 * Shared `SyncKVStorage` adapter wrapping `window.localStorage` for web.
 * Implements the optional `subscribe` slot via the cross-tab `storage`
 * event, so headless hooks (`useStorageBackedState`, `useProjectSettings`,
 * …) react to writes made in other tabs / windows.
 *
 * The listener re-reads from storage instead of trusting `ev.newValue` so
 * a synthetic event (or a same-tab `setItem` + manual `dispatchEvent`)
 * still picks up the latest value.
 */
export const localStorageAdapter: SyncKVStorage = {
  get: (key) => window.localStorage.getItem(key),
  set: (key, value) => window.localStorage.setItem(key, value),
  subscribe: (key, listener) => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== key) return
      listener(window.localStorage.getItem(key))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  },
}
