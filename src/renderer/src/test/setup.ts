import '@testing-library/jest-dom/vitest'

/**
 * jsdom does not implement matchMedia. We provide a controllable stub so
 * components that depend on prefers-color-scheme can be tested deterministically.
 * Tests can call `(window.matchMedia('...') as ControllableMql)._setMatches(bool)`
 * to flip the result and re-fire registered listeners.
 */
type ControllableMql = Omit<MediaQueryList, 'matches'> & {
  matches: boolean
  _setMatches: (matches: boolean) => void
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  const registry = new Map<string, ControllableMql>()
  window.matchMedia = (query: string): MediaQueryList => {
    const existing = registry.get(query)
    if (existing) return existing

    const listeners = new Set<(ev: MediaQueryListEvent) => void>()

    const mql = {
      matches: false,
      media: query,
      onchange: null,
      addListener: (cb: (ev: MediaQueryListEvent) => void) => listeners.add(cb),
      removeListener: (cb: (ev: MediaQueryListEvent) => void) => listeners.delete(cb),
      addEventListener: (_type: string, cb: EventListener) =>
        listeners.add(cb as (ev: MediaQueryListEvent) => void),
      removeEventListener: (_type: string, cb: EventListener) =>
        listeners.delete(cb as (ev: MediaQueryListEvent) => void),
      dispatchEvent: () => false,
      _setMatches(next: boolean) {
        mql.matches = next
        const ev = { matches: next, media: query } as MediaQueryListEvent
        for (const l of listeners) l(ev)
      },
    } as ControllableMql

    registry.set(query, mql)
    return mql
  }
}
