import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useResolvedTheme,
  type SystemThemeSource,
  type Theme as HeadlessTheme,
} from 'thefactory-ui/headless'

/**
 * Desktop's theme hook. Same API as before — `{ initTheme, availableThemes,
 * theme, setTheme }` — but the resolve step now goes through the shared
 * headless `useResolvedTheme`. Persistence (localStorage) + DOM application
 * (data-theme attribute + .dark class) stay here because they're
 * platform-specific.
 *
 * Desktop currently exposes only `'light' | 'dark'` to callers; the
 * headless hook accepts `'system'` too — when/if the UI starts surfacing a
 * "system" option, this hook needs no further changes.
 */

export type Theme = Extract<HeadlessTheme, 'light' | 'dark'>

const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function getSavedTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'dark' || v === 'light' ? v : 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  html.setAttribute('data-theme', theme)
  html.classList.toggle('dark', theme === 'dark')
}

function makeWebSystemThemeSource(): SystemThemeSource | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
  return {
    get: () => (window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'),
    subscribe: (cb) => {
      const mql = window.matchMedia(DARK_QUERY)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
  }
}

export function useTheme() {
  const [storedTheme, setStoredTheme] = useState<Theme>(() => getSavedTheme())
  const system = useMemo(() => makeWebSystemThemeSource(), [])
  const resolved = useResolvedTheme({ theme: storedTheme, system })

  useEffect(() => {
    applyTheme(resolved)
  }, [resolved])

  const availableThemes: Theme[] = ['light', 'dark']

  const initTheme = useCallback(() => {
    const t = getSavedTheme()
    applyTheme(t)
    setStoredTheme(t)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, t)
    setStoredTheme(t)
  }, [])

  return { initTheme, availableThemes, theme: storedTheme, setTheme }
}
