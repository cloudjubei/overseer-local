import { useEffect, useMemo } from 'react'
import { useAppSettings } from '@core/contexts/AppSettingsContext'
import {
  useResolvedTheme,
  type SystemThemeSource,
} from 'thefactory-ui/headless'

const DARK_QUERY = '(prefers-color-scheme: dark)'

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

/**
 * Reads the stored theme from `AppSettings`, resolves it via the headless
 * `useResolvedTheme` (subscribing to `prefers-color-scheme` when the user
 * picked `system`), and writes the corresponding `data-theme` attribute /
 * `.dark` class on `<html>`.
 *
 * Mount this once near the app root.
 */
export function useApplyTheme(): void {
  const { settings } = useAppSettings()
  const system = useMemo(() => makeWebSystemThemeSource(), [])
  const resolved = useResolvedTheme({ theme: settings.theme, system })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])
}
