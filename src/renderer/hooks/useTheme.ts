import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

export function getSavedTheme(): Theme {
  const v = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
  return v === 'dark' || v === 'light' ? v : 'light'
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  // Use data-theme attribute (design tokens listen to [data-theme="dark"]) and set .dark class for compatibility
  html.setAttribute('data-theme', theme)
  if (theme === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

export function setTheme(theme: Theme) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, theme)
  }
  applyTheme(theme)
}

// Call this once on app boot to apply persisted theme before any UI renders
export function initTheme() {
  applyTheme(getSavedTheme())
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getSavedTheme())

  useEffect(() => {
    applyTheme(theme)
    try { window.localStorage.setItem(STORAGE_KEY, theme) } catch {}
  }, [theme])

  return { theme, setTheme: setThemeState }
}
